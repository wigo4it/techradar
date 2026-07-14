// Pure, DOM-vrije tijd<->pixel-schaal met een veranderlijk zichtvenster voor de
// tijdlijn-slider. Werkt in de browser (globals) en in Node (module.exports).
//
// Het absolute bereik is [minDate, maxDate] (vroegste wijzigingsmoment .. nu).
// Het zichtbare venster [viewStart, viewEnd] is daar altijd een deelinterval
// van; zoom() en pan() verschuiven/schalen het en klemmen binnen het bereik.
(function (global) {
    "use strict";

    function toMs(value) {
        if (value instanceof Date) return value.getTime();
        if (typeof value === "number") return value;
        return new Date(value).getTime();
    }

    function pad(n) {
        return n < 10 ? "0" + n : "" + n;
    }

    function isoDate(value) {
        const d = value instanceof Date ? value : new Date(toMs(value));
        return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
    }

    // config: { minDate, maxDate, viewStart, viewEnd, rangeStart, rangeEnd, minSpanMs }
    function createTimelineScale(config) {
        const minMs = toMs(config.minDate);
        const maxMs = toMs(config.maxDate);
        const r0 = config.rangeStart;
        const r1 = config.rangeEnd;
        const maxSpan = maxMs - minMs;
        const minSpan = Math.min(config.minSpanMs || 20 * 86400000, maxSpan);

        let vs = toMs(config.viewStart);
        let ve = toMs(config.viewEnd);

        // Klem een venster [s, e] binnen [minMs, maxMs], met breedte in
        // [minSpan, maxSpan]. Rechterrand komt nooit voorbij "nu".
        function clampWin(s, e) {
            let w = e - s;
            if (w > maxSpan) { s = minMs; e = maxMs; w = maxSpan; }
            if (w < minSpan) {
                const c = (s + e) / 2;
                s = c - minSpan / 2;
                e = c + minSpan / 2;
                w = minSpan;
            }
            if (s < minMs) { s = minMs; e = minMs + w; }
            if (e > maxMs) { e = maxMs; s = maxMs - w; }
            if (s < minMs) s = minMs;
            return [s, e];
        }

        const norm = clampWin(vs, ve);
        vs = norm[0];
        ve = norm[1];

        function dateToX(date) {
            const t = toMs(date);
            return r0 + ((t - vs) / (ve - vs)) * (r1 - r0);
        }

        function xToDate(x) {
            const cx = Math.max(r0, Math.min(r1, x));
            return new Date(vs + ((cx - r0) / (r1 - r0)) * (ve - vs));
        }

        // factor > 1 = uitzoomen (breder), < 1 = inzoomen. De datum onder atX
        // blijft op zijn pixelpositie.
        function zoom(atX, factor) {
            const w = ve - vs;
            const nw = Math.max(minSpan, Math.min(maxSpan, w * factor));
            const f = (Math.max(r0, Math.min(r1, atX)) - r0) / (r1 - r0);
            const dateAt = vs + f * w;
            const res = clampWin(dateAt - f * nw, dateAt - f * nw + nw);
            vs = res[0];
            ve = res[1];
        }

        // Verschuif het venster met dxPx aan pixels (sleep naar rechts = eerder).
        function pan(dxPx) {
            const w = ve - vs;
            const dt = -dxPx * (w / (r1 - r0));
            const res = clampWin(vs + dt, ve + dt);
            vs = res[0];
            ve = res[1];
        }

        return {
            dateToX: dateToX,
            xToDate: xToDate,
            zoom: zoom,
            pan: pan,
            view: function () { return { start: vs, end: ve }; },
            minDate: minMs,
            maxDate: maxMs,
            maxSpan: maxSpan,
            rangeStart: r0,
            rangeEnd: r1,
        };
    }

    const api = {
        createTimelineScale: createTimelineScale,
        isoDate: isoDate,
    };

    if (typeof module !== "undefined" && module.exports) {
        module.exports = api;
    } else {
        for (const key in api) global[key] = api[key];
    }
})(typeof window !== "undefined" ? window : this);
