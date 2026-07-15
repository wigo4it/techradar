// The MIT License (MIT)

// Copyright (c) 2017 Zalando SE

// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:

// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.

// Aangepast (slice 3): van een one-shot renderer naar een persistente, op
// Label gekeyde d3-force-simulatie. Het statische raster wordt eenmaal gebouwd;
// bij elke peildatum-wisseling animeren blips naar hun nieuwe ring (physics-
// settle), verschijnen nieuwe entries en verdwijnen verwijderde. Herhaald
// aanroepen van radar_visualization({ title, entries }) werkt de radar bij.

function radar_visualization(config) {
  const style = getComputedStyle(document.documentElement);

  const colors = {
    background: style.getPropertyValue("--kleur-achtergrond"),
    text: style.getPropertyValue("--kleur-tekst"),
    grid: "#dddde0",
    inactive: "#ddd",
    gebruik: style.getPropertyValue("--kleur-gebruik"),
    probeer: style.getPropertyValue("--kleur-probeer"),
    onderzoek: style.getPropertyValue("--kleur-onderzoek"),
    verminder: style.getPropertyValue("--kleur-verminder"),
  };

  const QUAD_NAMES = [
    { name: "Platform & Cloud Services", subtitle: "Waarmee we het platform bouwen" }, // rechtsonder
    { name: "Talen, Frameworks & Tools", subtitle: "Waarmee we onze software realiseren" }, // linksonder
    { name: "Fundamentele Ontwerpkeuzes", subtitle: "Welke keuzes alignment brengen" }, // linksboven
    { name: "Engineering Practices", subtitle: "Hoe we kwaliteit borgen" }, // rechtsboven
  ];

  const RING_NAMES = [
    { name: "Gebruik", color: colors.gebruik, textColor: "white" },
    { name: "Probeer", color: colors.probeer, textColor: "black" },
    { name: "Onderzoek", color: colors.onderzoek, textColor: "white" },
    { name: "Verminder", color: colors.verminder, textColor: "white" },
  ];

  const links_in_new_tabs = true;
  const WIDTH = 1450;
  const HEIGHT = 1100;
  const TOP_CROP = 95; // lege band boven de titel wegsnijden (dichter bij de slider)
  const EASE = 0.1; // hoe snel een blip radiaal naar zijn nieuwe ring glijdt

  // radial_min / radial_max zijn veelvouden van PI
  const QUAD_GEO = [
    { radial_min: 0, radial_max: 0.5, factor_x: 1, factor_y: 1 }, // rechtsboven
    { radial_min: 0.5, radial_max: 1, factor_x: -1, factor_y: 1 }, // linksboven
    { radial_min: -1, radial_max: -0.5, factor_x: -1, factor_y: -1 }, // linksonder
    { radial_min: -0.5, radial_max: 0, factor_x: 1, factor_y: -1 }, // rechtsonder
  ];
  const RINGS = [130, 220, 310, 400];

  const title_offset = { x: -675, y: -440 };
  const footer_offset = { x: -675, y: 420 };
  const legend_offset = [
    { x: 450, y: 90 }, // rechtsonder
    { x: -675, y: 90 }, // linksonder
    { x: -675, y: -310 }, // linksboven
    { x: 450, y: -310 }, // rechtsboven
  ];

  // ---- geometrie-helpers ----
  function translate(x, y) {
    return "translate(" + x + "," + y + ")";
  }
  function polar(cartesian) {
    var x = cartesian.x, y = cartesian.y;
    return { t: Math.atan2(y, x), r: Math.sqrt(x * x + y * y) };
  }
  function cartesian(polar) {
    return { x: polar.r * Math.cos(polar.t), y: polar.r * Math.sin(polar.t) };
  }
  function bounded_interval(value, min, max) {
    var low = Math.min(min, max), high = Math.max(min, max);
    return Math.min(Math.max(value, low), high);
  }
  function bounded_ring(polar, r_min, r_max) {
    return { t: polar.t, r: bounded_interval(polar.r, r_min, r_max) };
  }
  function bounded_box(point, min, max) {
    return {
      x: bounded_interval(point.x, min.x, max.x),
      y: bounded_interval(point.y, min.y, max.y),
    };
  }
  function ringInner(ring) {
    return ring === 0 ? 30 : RINGS[ring - 1];
  }
  function ringOuter(ring) {
    return RINGS[ring];
  }
  // Houd een blip binnen zijn quadrant-wig en (geanimeerde) ringband.
  function clipNode(d) {
    var g = QUAD_GEO[d.quadrant];
    var cart_min = { x: 15 * g.factor_x, y: 15 * g.factor_y };
    var cart_max = { x: RINGS[3] * g.factor_x, y: RINGS[3] * g.factor_y };
    var c = bounded_box(d, cart_min, cart_max);
    var p = bounded_ring(polar(c), d.arInner + 15, d.arOuter - 15);
    d.x = cartesian(p).x;
    d.y = cartesian(p).y;
  }
  function randomInSegment(quadrant, ring) {
    var g = QUAD_GEO[quadrant];
    var t = (g.radial_min + Math.random() * (g.radial_max - g.radial_min)) * Math.PI;
    var ri = ringInner(ring) + 15, ro = ringOuter(ring) - 15;
    var r = ri + Math.random() * (ro - ri);
    return cartesian({ t: t, r: r });
  }
  function legend_transform(quadrant, ring, index, segmented) {
    var dx = ring < 2 ? 0 : 150;
    var dy = index == null ? -16 : index * 12;
    if (ring % 2 === 1) {
      dy = dy + 36 + segmented[quadrant][ring - 1].length * 12;
    }
    return translate(legend_offset[quadrant].x + dx, legend_offset[quadrant].y + dy);
  }

  // ---- rollover-bubble & legenda-highlight ----
  function showBubble(d) {
    var tooltip = d3.select("#bubble text").text(d.label);
    var bbox = tooltip.node().getBBox();
    d3.select("#bubble")
      .attr("transform", translate(d.x - bbox.width / 2, d.y - 16))
      .style("opacity", 1);
    d3.select("#bubble rect")
      .attr("x", -5).attr("y", -bbox.height)
      .attr("width", bbox.width + 10).attr("height", bbox.height + 4);
    d3.select("#bubble path").attr("transform", translate(bbox.width / 2 - 5, 3));
  }
  function hideBubble() {
    d3.select("#bubble").attr("transform", translate(0, 0)).style("opacity", 0);
  }
  function highlightLegendItem(d) {
    var el = document.getElementById("legendItem" + d.id);
    if (!el) return;
    el.setAttribute("filter", "url(#solid)");
    el.setAttribute("fill", colors.background);
  }
  function unhighlightLegendItem(d) {
    var el = document.getElementById("legendItem" + d.id);
    if (!el) return;
    el.removeAttribute("filter");
    el.setAttribute("fill", colors.text);
  }

  // ---- layout: partitioneer present-nodes en ken volgnummers toe ----
  function computeLayout(present) {
    var segmented = new Array(4);
    for (var q = 0; q < 4; q++) segmented[q] = [[], [], [], []];
    for (var i = 0; i < present.length; i++) {
      var d = present[i];
      segmented[d.quadrant][d.ring].push(d);
    }
    var id = 1;
    var order = [2, 3, 1, 0];
    for (var oi = 0; oi < order.length; oi++) {
      var qq = order[oi];
      for (var r = 0; r < 4; r++) {
        var arr = segmented[qq][r];
        for (var k = 0; k < arr.length; k++) arr[k].id = "" + id++;
      }
    }
    return segmented;
  }

  // ---- blip-inhoud (vorm volgt de afgeleide status) ----
  function appendShape(sel, d) {
    if (d.status == 1) {
      sel.append("rect").attr("class", "blip-shape") // nieuw (vierkant)
        .attr("x", -7).attr("y", -6).attr("width", 15).attr("height", 15)
        .attr("fill", d.color);
    } else if (d.status == 2) {
      sel.append("path").attr("class", "blip-shape") // verplaatst (driehoek)
        .attr("d", "M -11,5 11,5 0,-13 z").style("fill", d.color);
    } else {
      sel.append("circle").attr("class", "blip-shape").attr("r", 9).attr("fill", d.color);
    }
  }
  function renderBlipContent(sel, d) {
    sel.selectAll("*").remove();
    appendShape(sel, d);
    sel.append("text").attr("class", "blip-text")
      .text(d.id).attr("y", 3).attr("text-anchor", "middle")
      .style("fill", d.textColor).style("font-family", "Raleway")
      .style("font-size", ("" + d.id).length > 2 ? "8px" : "9px")
      .style("pointer-events", "none").style("user-select", "none");
    d._shapeStatus = d.status;
  }
  function updateBlipContent(sel, d) {
    if (d.status !== d._shapeStatus) {
      renderBlipContent(sel, d);
      return;
    }
    // zelfde vorm, mogelijk andere ringkleur: laat de kleur meelopen met de glijbeweging
    sel.select(".blip-shape").transition().duration(480)
      .attr("fill", d.color).style("fill", d.color);
    sel.select(".blip-text")
      .text(d.id)
      .style("font-size", ("" + d.id).length > 2 ? "8px" : "9px")
      .transition().duration(480).style("fill", d.textColor);
  }

  function renderLegend(segmented) {
    var legend = state.legendG;
    legend.selectAll("*").remove();
    for (var quadrant = 0; quadrant < 4; quadrant++) {
      legend.append("text")
        .attr("transform", translate(legend_offset[quadrant].x, legend_offset[quadrant].y - 65))
        .text(QUAD_NAMES[quadrant].name)
        .style("font-family", "Raleway").style("font-size", "20px")
        .style("font-weight", "900").style("fill", colors.text);
      legend.append("text")
        .attr("transform", translate(legend_offset[quadrant].x, legend_offset[quadrant].y - 45))
        .text(QUAD_NAMES[quadrant].subtitle || "")
        .style("font-family", "Raleway").style("font-size", "12px")
        .style("font-weight", "500").style("fill", colors.text).style("opacity", 0.85);

      for (var ring = 0; ring < 4; ring++) {
        legend.append("text")
          .attr("transform", legend_transform(quadrant, ring, null, segmented))
          .text(RING_NAMES[ring].name)
          .style("font-family", "Raleway").style("font-size", "12px")
          .style("font-weight", "bold").style("fill", RING_NAMES[ring].color);
        legend.selectAll(".legend" + quadrant + ring)
          .data(segmented[quadrant][ring])
          .enter()
          .append("a")
          .attr("href", function (d) { return d.link ? d.link : "#"; })
          .attr("target", function (d) { return d.link && links_in_new_tabs ? "_blank" : null; })
          .attr("data-custom-id", function (d) { return d.label.replace(/\s+/g, ""); })
          .attr("data-custom-name", function (d) { return d.label; })
          .attr("data-custom-bhvr", function () { return "NAVIGATION"; })
          .append("text")
          .attr("transform", function (d, i) { return legend_transform(quadrant, ring, i, segmented); })
          .attr("class", "legend" + quadrant + ring)
          .attr("id", function (d) { return "legendItem" + d.id; })
          .text(function (d) { return d.id + ". " + d.label; })
          .style("font-family", "Raleway").style("font-size", "11px")
          .attr("fill", colors.text)
          .on("mouseover", function (d) { showBubble(d); highlightLegendItem(d); })
          .on("mouseout", function (d) { hideBubble(); unhighlightLegendItem(d); });
      }
    }
  }

  // ---- update: verwerk een nieuwe peildatum-projectie ----
  function updateRadar(cfg) {
    var incoming = cfg.entries || [];
    var present = [];
    var seen = {};

    for (var i = 0; i < incoming.length; i++) {
      var e = incoming[i];
      seen[e.label] = true;
      var node = state.nodes[e.label];
      var color = RING_NAMES[e.ring].color;
      var textColor = RING_NAMES[e.ring].textColor;
      if (node) {
        node.quadrant = e.quadrant;
        node.ring = e.ring;
        node.status = e.status;
        node.link = e.link;
        node.color = color;
        node.textColor = textColor;
      } else {
        var p = randomInSegment(e.quadrant, e.ring);
        node = {
          label: e.label, link: e.link, quadrant: e.quadrant, ring: e.ring,
          status: e.status, color: color, textColor: textColor,
          x: p.x, y: p.y,
          arInner: ringInner(e.ring), arOuter: ringOuter(e.ring),
          _shapeStatus: null,
        };
        state.nodes[e.label] = node;
      }
      present.push(node);
    }

    // verwijder afwezige nodes uit de identiteitskaart (fade-out volgt in de join)
    for (var label in state.nodes) {
      if (!seen[label]) delete state.nodes[label];
    }

    var segmented = computeLayout(present);

    var join = state.rink.selectAll(".blip").data(present, function (d) { return d.label; });

    join.exit()
      .classed("blip", false)
      .transition().duration(450)
      .style("opacity", 0)
      .remove();

    var enter = join.enter()
      .append("g")
      .attr("class", "blip")
      .attr("transform", function (d) { return translate(d.x, d.y); })
      .style("opacity", 0)
      .on("mouseover", function (d) { showBubble(d); highlightLegendItem(d); })
      .on("mouseout", function (d) { hideBubble(); unhighlightLegendItem(d); });
    enter.each(function (d) { renderBlipContent(d3.select(this), d); });
    enter.transition().duration(480).style("opacity", 1);

    join.each(function (d) { updateBlipContent(d3.select(this), d); });

    state.blips = enter.merge(join);

    renderLegend(segmented);
    state.title.text(cfg.title || "");

    state.simulation.nodes(present);
    state.simulation.alpha(0.9).restart();
  }

  // ---- eenmalige opbouw van het statische raster ----
  let state = radar_visualization._state;
  if (!state) {
    var svg = d3.select("svg#radar")
      .style("background-color", colors.background)
      .attr("width", WIDTH)
      .attr("height", HEIGHT - TOP_CROP)
      .attr("viewBox", "0 " + TOP_CROP + " " + WIDTH + " " + (HEIGHT - TOP_CROP));
    svg.selectAll("*").remove();

    var radar = svg.append("g").attr("transform", translate(WIDTH / 2, HEIGHT / 2));
    var grid = radar.append("g");

    grid.append("line").attr("x1", 0).attr("y1", -400).attr("x2", 0).attr("y2", 400)
      .style("stroke", colors.grid).style("stroke-width", 2);
    grid.append("line").attr("x1", -400).attr("y1", 0).attr("x2", 400).attr("y2", 0)
      .style("stroke", colors.grid).style("stroke-width", 2);

    var defs = grid.append("defs");
    var filter = defs.append("filter")
      .attr("x", 0).attr("y", 0).attr("width", 1).attr("height", 1).attr("id", "solid");
    filter.append("feFlood").attr("flood-color", colors.text);
    filter.append("feComposite").attr("in", "SourceGraphic");

    for (var ri = 0; ri < RINGS.length; ri++) {
      grid.append("circle").attr("cx", 0).attr("cy", 0).attr("r", RINGS[ri])
        .style("fill", "none").style("stroke", colors.grid).style("stroke-width", 2);
      grid.append("text").text(RING_NAMES[ri].name)
        .attr("y", -RINGS[ri] + 32).attr("text-anchor", "middle")
        .style("fill", RING_NAMES[ri].color).style("opacity", 0.75)
        .style("text-transform", "uppercase").style("font-family", "Raleway")
        .style("font-size", "20px").style("font-weight", "900")
        .style("pointer-events", "none").style("user-select", "none");
    }

    var titleText = radar.append("text")
      .attr("transform", translate(title_offset.x, title_offset.y + 20))
      .style("font-family", "Raleway").style("font-size", "14").style("fill", colors.text);

    radar.append("text")
      .attr("transform", translate(footer_offset.x, footer_offset.y))
      .text("■ nieuw ▲ verplaatst").attr("xml:space", "preserve")
      .style("font-family", "Raleway").style("font-size", "10px").style("fill", colors.text);

    var legendG = radar.append("g");
    var rink = radar.append("g").attr("id", "rink");

    var bubble = radar.append("g").attr("id", "bubble")
      .attr("x", 0).attr("y", 0).style("opacity", 0)
      .style("pointer-events", "none").style("user-select", "none");
    bubble.append("rect").attr("rx", 4).attr("ry", 4).style("fill", colors.text);
    bubble.append("text").style("font-family", "Raleway").style("font-size", "10px")
      .style("fill", colors.background);
    bubble.append("path").attr("d", "M 0,0 10,0 5,8 z").style("fill", colors.text);

    state = {
      radar: radar, legendG: legendG, rink: rink, title: titleText,
      nodes: {}, blips: null, simulation: null,
    };
    radar_visualization._state = state;

    function ticked() {
      if (!state.blips) return;
      state.blips.attr("transform", function (d) {
        d.arInner += (ringInner(d.ring) - d.arInner) * EASE;
        d.arOuter += (ringOuter(d.ring) - d.arOuter) * EASE;
        clipNode(d);
        return translate(d.x, d.y);
      });
    }

    state.simulation = d3.forceSimulation()
      .velocityDecay(0.19) // magic number (found by experimentation)
      .force("collision", d3.forceCollide().radius(12).strength(0.85))
      .on("tick", ticked)
      .stop();
  }

  updateRadar(config);
}
