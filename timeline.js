// Pure radar-tijdlijnlogica: projectie op een peildatum en afleiding van de
// changelog uit de historie per entry. Werkt zowel in de browser (globals)
// als in Node (module.exports), zodat het migratiescript dezelfde logica deelt.
(function (global) {
    "use strict";

    // Slug -> index mapping. De index sluit aan op de volgorde die radar.js
    // (config.rings / config.quadrants) verwacht.
    const RING_SLUGS = ["gebruik", "probeer", "onderzoek", "verminder"];
    const QUADRANT_SLUGS = ["platform", "talen", "ontwerp", "practices"];

    const RING_LABELS = ["Gebruik", "Probeer", "Onderzoek", "Verminder"];

    const MONTHS = [
        "januari", "februari", "maart", "april", "mei", "juni",
        "juli", "augustus", "september", "oktober", "november", "december",
    ];

    function ringIndex(slug) {
        return RING_SLUGS.indexOf(slug);
    }

    function quadrantIndex(slug) {
        return QUADRANT_SLUGS.indexOf(slug);
    }

    function ringLabel(slug) {
        const i = ringIndex(slug);
        return i === -1 ? slug : RING_LABELS[i];
    }

    // "2026-05-01" -> "Mei 2026"
    function formatMomentLabel(date) {
        const [year, month] = date.split("-");
        const name = MONTHS[Number(month) - 1] || month;
        return name.charAt(0).toUpperCase() + name.slice(1) + " " + year;
    }

    // Alle unieke wijzigingsmoment-datums, oplopend gesorteerd.
    function momentDates(data) {
        const set = new Set();
        for (const entry of data) {
            for (const h of entry.history) set.add(h.date);
        }
        return Array.from(set).sort();
    }

    // Grootste datum <= value (of null). ISO-datums sorteren lexicografisch.
    function lastLE(sorted, value) {
        let result = null;
        for (const d of sorted) {
            if (d <= value) result = d;
            else break;
        }
        return result;
    }

    function lastLT(sorted, value) {
        let result = null;
        for (const d of sorted) {
            if (d < value) result = d;
            else break;
        }
        return result;
    }

    // Ring van een entry op een peildatum (slug) of null als afwezig/verwijderd.
    function ringAt(entry, date) {
        let ring = null;
        for (const h of entry.history) {
            if (h.date <= date) ring = h.ring;
            else break;
        }
        return ring;
    }

    // Het wijzigingsmoment dat op peildatum van kracht is (of null).
    function resolveMoment(data, peildatum) {
        return lastLE(momentDates(data), peildatum);
    }

    // Projecteer de radar op een peildatum. Levert entries in de vorm die
    // radar.js verwacht: label, link, quadrant-index, ring-index en de
    // afgeleide status (0 = ongewijzigd, 1 = nieuw, 2 = verplaatst).
    function projectRadar(data, peildatum) {
        const moments = momentDates(data);
        const current = lastLE(moments, peildatum);
        if (!current) return [];
        const previous = lastLT(moments, current);

        const out = [];
        for (const entry of data) {
            const ring = ringAt(entry, current);
            if (ring === null) continue;

            const prevRing = previous ? ringAt(entry, previous) : null;
            let status = 0;
            if (prevRing === null) status = 1; // nieuw
            else if (prevRing !== ring) status = 2; // verplaatst

            out.push({
                label: entry.label,
                link: entry.link,
                quadrant: quadrantIndex(entry.quadrant),
                ring: ringIndex(ring),
                status: status,
            });
        }
        return out;
    }

    // Leid de changelog af: per wijzigingsmoment de groepen nieuw / verplaatst
    // (van -> naar) / verwijderd. Nieuwste moment eerst.
    function deriveChangelog(data) {
        const moments = momentDates(data);
        const result = [];

        for (let i = 0; i < moments.length; i++) {
            const date = moments[i];
            const prev = i > 0 ? moments[i - 1] : null;
            const added = [];
            const moved = [];
            const removed = [];

            for (const entry of data) {
                const ring = ringAt(entry, date);
                const prevRing = prev ? ringAt(entry, prev) : null;
                if (ring === null && prevRing === null) continue;

                if (ring !== null && prevRing === null) {
                    added.push(entry.label);
                } else if (ring === null && prevRing !== null) {
                    removed.push(entry.label);
                } else if (ring !== prevRing) {
                    moved.push({ label: entry.label, from: prevRing, to: ring });
                }
            }

            added.sort((a, b) => a.localeCompare(b));
            removed.sort((a, b) => a.localeCompare(b));
            moved.sort((a, b) => a.label.localeCompare(b.label));

            result.push({
                date: date,
                label: formatMomentLabel(date),
                added: added,
                moved: moved,
                removed: removed,
            });
        }

        result.reverse();
        return result;
    }

    const api = {
        RING_SLUGS: RING_SLUGS,
        QUADRANT_SLUGS: QUADRANT_SLUGS,
        ringIndex: ringIndex,
        quadrantIndex: quadrantIndex,
        ringLabel: ringLabel,
        formatMomentLabel: formatMomentLabel,
        momentDates: momentDates,
        ringAt: ringAt,
        resolveMoment: resolveMoment,
        projectRadar: projectRadar,
        deriveChangelog: deriveChangelog,
    };

    if (typeof module !== "undefined" && module.exports) {
        module.exports = api;
    } else {
        for (const key in api) global[key] = api[key];
    }
})(typeof window !== "undefined" ? window : this);
