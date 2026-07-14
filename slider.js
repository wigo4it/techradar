// Tijdlijn-slider (view-laag) op d3 v4. Zoombare/panbare tijdas met markers per
// wijzigingsmoment, adaptieve jaar-/maand-ijkpunten, een "nu"-eindkap en een
// sleepbare thumb die magnetisch snapt. Meldt de peildatum via onChange (live)
// en onSettle (bij loslaten).
//
// Interacties (slice 4): scrollwiel/pinch = zoom (rond cursor), sleep op de
// achtergrond = pan, klik op de achtergrond of een marker = thumb daarheen,
// sleep op de thumb = scrubben. Zoom/pan wijzigen de peildatum niet.
(function (global) {
    "use strict";

    const SNAP_PX = 12;
    const MONTHS_SHORT = [
        "jan", "feb", "mrt", "apr", "mei", "jun",
        "jul", "aug", "sep", "okt", "nov", "dec",
    ];

    function ms(value) {
        return value instanceof Date ? value.getTime() : new Date(value).getTime();
    }
    function clampPx(x, a, b) {
        return Math.max(a, Math.min(b, x));
    }

    function createSlider(config) {
        const width = config.width || 1000;
        const height = 95;
        const padX = 44;
        const trackY = 52;
        const r0 = padX;
        const r1 = width - padX;

        // Standaardvenster: laatste 3 jaar tot "nu", geklemd op de historie.
        const maxMs = ms(config.maxDate);
        const minMs = ms(config.minDate);
        const maxD = new Date(maxMs);
        const threeYearsMs = new Date(maxD.getFullYear() - 3, maxD.getMonth(), maxD.getDate()).getTime();
        let viewStart = Math.max(minMs, threeYearsMs);
        // Deep-link naar een oudere datum dan het venster: toon volledige historie.
        if (ms(config.initialDate) < viewStart) viewStart = minMs;

        const scale = createTimelineScale({
            minDate: minMs,
            maxDate: maxMs,
            viewStart: viewStart,
            viewEnd: maxMs,
            rangeStart: r0,
            rangeEnd: r1,
            minSpanMs: 20 * 86400000,
        });

        let peildatum = config.initialDate;
        let landed = null;
        let targets = [];
        let pinch = null;

        // --- svg + lagen (achtergrond onderop, tooltip bovenop) ---
        const svg = d3.select(config.container).append("svg")
            .attr("id", "timeline").attr("width", width).attr("height", height)
            .attr("viewBox", "0 0 " + width + " " + height)
            .attr("preserveAspectRatio", "xMidYMid meet");
        const svgNode = svg.node();

        const bg = svg.append("rect").attr("class", "timeline-bg")
            .attr("x", 0).attr("y", 0).attr("width", width).attr("height", height);
        const ticksG = svg.append("g").attr("class", "timeline-ticks");
        svg.append("line").attr("class", "timeline-track")
            .attr("x1", r0).attr("y1", trackY).attr("x2", r1).attr("y2", trackY);
        const nowCap = svg.append("g").attr("class", "timeline-now-cap");
        nowCap.append("line").attr("class", "timeline-now")
            .attr("y1", trackY - 9).attr("y2", trackY + 9);
        nowCap.append("text").attr("class", "timeline-now-label")
            .attr("y", trackY + 28).attr("text-anchor", "end").text("Nu");
        const markersG = svg.append("g").attr("class", "timeline-markers");
        const thumb = svg.append("circle").attr("class", "timeline-thumb")
            .attr("cy", trackY).attr("r", 10);

        const tip = svg.append("g").attr("class", "timeline-tooltip")
            .style("opacity", 0).style("pointer-events", "none");
        const tipRect = tip.append("rect").attr("rx", 4).attr("ry", 4);
        const tipTitle = tip.append("text").attr("class", "timeline-tip-title");
        const tipSub = tip.append("text").attr("class", "timeline-tip-sub");
        const tipTail = tip.append("path").attr("class", "timeline-tip-tail")
            .attr("d", "M -5,0 5,0 0,6 z");

        svg.append("text").attr("class", "timeline-hint")
            .attr("x", width / 2).attr("y", height - 3).attr("text-anchor", "middle")
            .style("pointer-events", "none")
            .text("sleep de knop · scroll of pinch om te zoomen");

        // stabiele marker-objecten (identiteit blijft over redraws heen)
        const allMarkers = (config.moments || []).map(function (m) {
            return {
                date: m.date,
                label: m.label,
                added: (m.added || []).length,
                moved: (m.moved || []).length,
                removed: (m.removed || []).length,
                x: 0,
            };
        });

        // markergrootte schaalt (sqrt, voor oppervlakte) met het aantal
        // wijzigingen op dat moment: grote update = grotere stip.
        let maxTotal = 1;
        allMarkers.forEach(function (m) {
            maxTotal = Math.max(maxTotal, m.added + m.moved + m.removed);
        });
        function markerR(m) {
            const t = m.added + m.moved + m.removed;
            return 3.5 + Math.sqrt(t / maxTotal) * 4.5;
        }
        function paintMarkers() {
            markersG.selectAll("circle")
                .attr("r", function (d) { return markerR(d) + (d === landed ? 2.5 : 0); })
                .classed("timeline-marker-active", function (d) { return d === landed; });
        }

        function summaryText(m) {
            const parts = [];
            if (m.added) parts.push(m.added + " nieuw");
            if (m.moved) parts.push(m.moved + " verplaatst");
            if (m.removed) parts.push(m.removed + " verwijderd");
            return parts.length ? parts.join(" · ") : "geen wijzigingen";
        }
        function showTooltip(m) {
            tipTitle.text(m.label);
            tipSub.text(summaryText(m));
            const tw = Math.max(
                tipTitle.node().getComputedTextLength(),
                tipSub.node().getComputedTextLength(),
            );
            const boxW = tw + 22;
            const boxH = 36;
            const boxY = 6;
            const boxX = clampPx(m.x - boxW / 2, 2, width - boxW - 2);
            tipRect.attr("x", boxX).attr("y", boxY).attr("width", boxW).attr("height", boxH);
            tipTitle.attr("x", boxX + boxW / 2).attr("y", boxY + 15).attr("text-anchor", "middle");
            tipSub.attr("x", boxX + boxW / 2).attr("y", boxY + 29).attr("text-anchor", "middle");
            tipTail.attr("transform", "translate(" + m.x + "," + (boxY + boxH) + ")");
            tip.style("opacity", 1);
        }
        function hideTooltip() {
            tip.style("opacity", 0);
        }

        // Adaptieve ijkpunten: jaren bij een breed venster, anders maanden.
        function computeTicks(vsMs, veMs) {
            const days = (veMs - vsMs) / 86400000;
            const ticks = [];
            if (days > 550) {
                const y0 = new Date(vsMs).getFullYear();
                const y1 = new Date(veMs).getFullYear();
                for (let y = y0; y <= y1; y++) {
                    ticks.push({ date: new Date(y, 0, 1), label: "" + y, major: true });
                }
            } else {
                const s = new Date(vsMs);
                let cur = new Date(s.getFullYear(), s.getMonth(), 1);
                if (cur.getTime() < vsMs) cur = new Date(s.getFullYear(), s.getMonth() + 1, 1);
                while (cur.getTime() <= veMs) {
                    const major = cur.getMonth() === 0;
                    ticks.push({
                        date: new Date(cur),
                        label: major ? "" + cur.getFullYear() : MONTHS_SHORT[cur.getMonth()],
                        major: major,
                    });
                    cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
                }
            }
            return ticks;
        }

        function nearestTarget(x) {
            let best = null, bestD = Infinity;
            for (let i = 0; i < targets.length; i++) {
                const d = Math.abs(targets[i].x - x);
                if (d < bestD) { bestD = d; best = targets[i]; }
            }
            return best ? { target: best, dist: bestD } : null;
        }

        function redraw() {
            const v = scale.view();

            // ijkpunten
            ticksG.selectAll("*").remove();
            computeTicks(v.start, v.end).forEach(function (t) {
                const x = scale.dateToX(t.date);
                if (x < r0 || x > r1) return;
                ticksG.append("line")
                    .attr("class", t.major ? "timeline-tick timeline-tick-major" : "timeline-tick")
                    .attr("x1", x).attr("x2", x).attr("y1", trackY + 6).attr("y2", trackY + 13);
                ticksG.append("text")
                    .attr("class", t.major ? "timeline-year" : "timeline-month")
                    .attr("x", x).attr("y", trackY + 28).attr("text-anchor", "middle")
                    .text(t.label);
            });

            // "nu"-eindkap (alleen tonen als nu binnen het venster valt)
            const nowX = scale.dateToX(scale.maxDate);
            if (nowX >= r0 - 0.5 && nowX <= r1 + 0.5) {
                nowCap.style("display", null);
                nowCap.select("line").attr("x1", nowX).attr("x2", nowX);
                nowCap.select("text").attr("x", nowX);
            } else {
                nowCap.style("display", "none");
            }

            // markers
            allMarkers.forEach(function (m) { m.x = scale.dateToX(m.date); });
            const vis = allMarkers.filter(function (m) { return m.x >= r0 && m.x <= r1; });
            const sel = markersG.selectAll("circle").data(vis, function (d) { return d.date; });
            sel.exit().remove();
            sel.enter().append("circle")
                .attr("class", "timeline-marker").attr("cy", trackY)
                .on("mouseover", function (d) { showTooltip(d); })
                .on("mouseout", function (d) { if (d !== landed) hideTooltip(); })
                .on("click", function (d) { settleAtDate(d.date); })
                .merge(sel)
                .attr("cx", function (d) { return d.x; });
            paintMarkers();

            // snap-doelen: zichtbare markers + "nu" (indien zichtbaar)
            targets = vis.map(function (m) { return { x: m.x, date: m.date, marker: m }; });
            if (nowX >= r0 && nowX <= r1) {
                targets.push({ x: nowX, date: isoDate(scale.maxDate), marker: null });
            }

            // thumb (peildatum kan buiten het venster vallen -> aan de rand, gedimd)
            const tx = scale.dateToX(peildatum);
            thumb.attr("cx", clampPx(tx, r0, r1)).classed("timeline-thumb-off", tx < r0 || tx > r1);

            // tooltip van de gelande marker meebewegen/verbergen
            if (landed) {
                if (vis.indexOf(landed) >= 0) showTooltip(landed);
                else hideTooltip();
            }
        }

        function scrubTo(x) {
            let cx = clampPx(x, r0, r1);
            let date;
            const n = nearestTarget(cx);
            if (n && n.dist <= SNAP_PX) {
                cx = n.target.x;
                date = n.target.date;
            } else {
                date = isoDate(scale.xToDate(cx));
            }
            thumb.attr("cx", cx);
            peildatum = date;
            config.onChange(date);
        }
        function settleAt(x) {
            const n = nearestTarget(clampPx(x, r0, r1));
            if (!n) return;
            thumb.attr("cx", n.target.x);
            peildatum = n.target.date;
            config.onChange(n.target.date);
            landed = n.target.marker;
            if (landed) showTooltip(landed); else hideTooltip();
            paintMarkers();
            if (config.onSettle) config.onSettle(n.target.date);
        }
        function settleAtDate(date) {
            peildatum = date;
            landed = null;
            for (let i = 0; i < allMarkers.length; i++) {
                if (allMarkers[i].date === date) { landed = allMarkers[i]; break; }
            }
            thumb.attr("cx", clampPx(scale.dateToX(date), r0, r1));
            config.onChange(date);
            if (landed) showTooltip(landed);
            paintMarkers();
            if (config.onSettle) config.onSettle(date);
        }

        // --- interacties ---
        thumb.call(d3.drag()
            .on("start", function () { landed = null; hideTooltip(); paintMarkers(); })
            .on("drag", function () { scrubTo(d3.event.x); })
            .on("end", function () { settleAt(d3.event.x); }));

        let panMoved = 0;
        bg.call(d3.drag()
            .on("start", function () { panMoved = 0; })
            .on("drag", function () {
                if (pinch) return;
                panMoved += Math.abs(d3.event.dx);
                scale.pan(d3.event.dx);
                redraw();
            })
            .on("end", function () {
                if (pinch) return;
                if (panMoved < 4) settleAt(d3.event.x); // klik = thumb hierheen
            }));

        svg.on("wheel", function () {
            d3.event.preventDefault();
            const mx = d3.mouse(svgNode)[0];
            const factor = d3.event.deltaY > 0 ? 1.2 : 1 / 1.2;
            scale.zoom(clampPx(mx, r0, r1), factor);
            redraw();
        });

        function touchDist(e) {
            const a = e.touches[0], b = e.touches[1];
            return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
        }
        function touchMidX(e) {
            const rect = svgNode.getBoundingClientRect();
            const dispX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
            return dispX * (width / rect.width); // display-px -> viewBox-coördinaten
        }
        svgNode.addEventListener("touchstart", function (e) {
            if (e.touches.length === 2) { pinch = { d: touchDist(e) }; e.preventDefault(); }
        }, { passive: false });
        svgNode.addEventListener("touchmove", function (e) {
            if (pinch && e.touches.length === 2) {
                const nd = touchDist(e);
                if (nd > 0) {
                    scale.zoom(clampPx(touchMidX(e), r0, r1), pinch.d / nd);
                    pinch.d = nd;
                    redraw();
                }
                e.preventDefault();
            }
        }, { passive: false });
        svgNode.addEventListener("touchend", function (e) {
            if (e.touches.length < 2) pinch = null;
        });

        redraw();
        return { redraw: redraw };
    }

    const api = { createSlider: createSlider };

    if (typeof module !== "undefined" && module.exports) {
        module.exports = api;
    } else {
        for (const key in api) global[key] = api[key];
    }
})(typeof window !== "undefined" ? window : this);
