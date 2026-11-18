// city.js — VELMARA v6: the city itself. Seeded generation of roads, blocks,
// buildings, trees, lamps and fixed places, plus the road-graph helpers that
// traffic, police and the GPS autopilot all drive on.
'use strict';

const City = {
  roadsX: [],
  roadsY: [],
  buildings: [],
  trees: [],
  lamps: [],
  coins: [],
  places: {},
  raceRoutes: [],

  build: function () {
    const rng = mulberry32(CFG.SEED);
    this.roadsX = [];
    this.roadsY = [];
    for (let x = 150; x <= CFG.WORLD_W - 150; x += CFG.ROAD_STEP) this.roadsX.push(x);
    for (let y = 150; y <= CFG.WORLD_H - 150; y += CFG.ROAD_STEP) this.roadsY.push(y);
    this.buildings = [];
    this.trees = [];
    this.lamps = [];
    this.coins = [];

    // Fixed story places, all on road corners so the player can always reach them.
    this.places = {
      bar:        { name: 'Marisol\u2019s Bar',  x: 1350, y: 1350, kind: 'bar',        icon: '\u2665' },
      garage:     { name: 'Rico\u2019s Garage',  x: 2250, y: 1650, kind: 'garage',     icon: '\u2699' },
      gunshop:    { name: 'Ammo & Sons',      x: 1950, y: 750,  kind: 'gunshop',    icon: '\u2726' },
      safehouse:  { name: 'Sunset Motel',     x: 750,  y: 1950, kind: 'safehouse',  icon: '\u2302' },
      paynspray:  { name: 'Pay N\u2019 Spray',   x: 3150, y: 1950, kind: 'paynspray',  icon: '\u2728' },
      hospital:   { name: 'Velmara General',  x: 2550, y: 450,  kind: 'hospital',   icon: '+' },
      docks:      { name: 'Marina Docks',     x: 450,  y: 450,  kind: 'docks',      icon: '\u2693' },
      bank:       { name: 'Banco de Velmara', x: 2850, y: 750,  kind: 'bank',       icon: '$' },
      plaza:      { name: 'Plaza del Sol',    x: 1350, y: 450,  kind: 'plaza',      icon: '\u2600' },
      motel2:     { name: 'Costa Motel',      x: 3150, y: 2250, kind: 'safehouse2', icon: '\u2302' },
    };

    // Buildings fill every block between two roads.
    for (let i = 0; i < this.roadsX.length - 1; i++) {
      for (let j = 0; j < this.roadsY.length - 1; j++) {
        const bx0 = this.roadsX[i] + CFG.ROAD_W / 2 + 8;
        const by0 = this.roadsY[j] + CFG.ROAD_W / 2 + 8;
        const bx1 = this.roadsX[i + 1] - CFG.ROAD_W / 2 - 8;
        const by1 = this.roadsY[j + 1] - CFG.ROAD_W / 2 - 8;
        const cx = (bx0 + bx1) / 2, cy = (by0 + by1) / 2;
        const d = this.districtAt(cx, cy);
        const roll = rng();
        if (d.style === 'beach') { this.makeBeachBlock(bx0, by0, bx1, by1, rng); continue; }
        if (roll < 0.10) { this.makeParkBlock(bx0, by0, bx1, by1, rng, d); continue; }
        if (roll < 0.16) { this.makeLotBlock(bx0, by0, bx1, by1, rng, d); continue; }
        const n = d.style === 'towers' ? 1 : (rng() < 0.5 ? 2 : 1);
        if (n === 1) {
          const w = (bx1 - bx0) * (0.55 + rng() * 0.3);
          const dep = (by1 - by0) * (0.55 + rng() * 0.3);
          this.addBuilding(cx - w / 2, cy - dep / 2, w, dep, d, rng);
        } else {
          const w = (bx1 - bx0) * 0.42, dep = (by1 - by0) * 0.42;
          this.addBuilding(bx0 + 6, by0 + 6, w, dep, d, rng);
          this.addBuilding(bx1 - w - 6, by1 - dep - 6, w, dep, d, rng);
          if (rng() < 0.5) this.addBuilding(bx1 - w - 6, by0 + 6, w * 0.7, dep * 0.7, d, rng);
        }
      }
    }

    // Trees line the sidewalks; lamps stand at every intersection.
    for (let i = 0; i < this.roadsX.length; i++) {
      for (let j = 0; j < this.roadsY.length; j++) {
        this.lamps.push({ x: this.roadsX[i] + CFG.ROAD_W / 2 + 6, y: this.roadsY[j] - CFG.ROAD_W / 2 - 6 });
        if (rng() < 0.7) this.trees.push({ x: this.roadsX[i] - CFG.ROAD_W / 2 - 10, y: this.roadsY[j] + 60 + rng() * 120, s: 14 + rng() * 10 });
      }
    }
    for (let k = 0; k < 90; k++) {
      const bx = 100 + rng() * (CFG.WORLD_W - 200);
      const by = 100 + rng() * (CFG.WORLD_H - 200);
      if (!this.onRoad(bx, by) && !this.inBuilding(bx, by, 20)) this.trees.push({ x: bx, y: by, s: 13 + rng() * 12 });
    }

    // 24 gold coins hidden around the city — collect them all for a bonus.
    let placed = 0, guard = 0;
    while (placed < 24 && guard++ < 400) {
      const x = 120 + rng() * (CFG.WORLD_W - 240);
      const y = 120 + rng() * (CFG.WORLD_H - 240);
      if (this.onRoad(x, y) || this.inBuilding(x, y, 16)) continue;
      this.coins.push({ x: x, y: y, taken: false });
      placed++;
    }

    // Three street-race routes, each a loop of checkpoints on the road graph.
    this.raceRoutes = [
      { name: 'Downtown Dash', cps: [[1950, 150], [3150, 150], [3150, 1050], [1950, 1050]] },
      { name: 'Beachfront Run', cps: [[450, 2250], [1650, 2250], [3150, 2250], [3150, 1950], [450, 1950]] },
      { name: 'Marina Loop', cps: [[450, 450], [450, 1650], [1650, 1650], [1650, 450]] },
    ];
    return this;
  },

  makeBeachBlock: function (x0, y0, x1, y1, rng) {
    // Beach blocks get palms and umbrellas instead of buildings.
    for (let k = 0; k < 4; k++) {
      this.trees.push({ x: x0 + 20 + rng() * (x1 - x0 - 40), y: y0 + 20 + rng() * (y1 - y0 - 40), s: 16 + rng() * 8, palm: true });
    }
  },

  makeParkBlock: function (x0, y0, x1, y1, rng, d) {
    for (let k = 0; k < 6; k++) {
      this.trees.push({ x: x0 + 16 + rng() * (x1 - x0 - 32), y: y0 + 16 + rng() * (y1 - y0 - 32), s: 15 + rng() * 10 });
    }
    this.buildings.push({ x: x0 + (x1 - x0) / 2 - 22, y: y0 + (y1 - y0) / 2 - 22, w: 44, d: 44, h: 14, district: d, kiosk: true, color: '#b8a888', roof: '#8a6a3a' });
  },

  makeLotBlock: function (x0, y0, x1, y1, rng, d) {
    // A parking lot: flat, with a few parked cars drawn by the traffic system.
    this.buildings.push({ x: x0, y: y0, w: x1 - x0, d: y1 - y0, h: 2, district: d, lot: true, color: '#5a5a60', roof: '#5a5a60' });
  },

  addBuilding: function (x, y, w, d, dist, rng) {
    let h = 26 + rng() * 40;
    if (dist.style === 'towers') h = 90 + rng() * 150;
    if (dist.style === 'old') h = 22 + rng() * 26;
    if (dist.style === 'marina') h = 20 + rng() * 30;
    if (dist.style === 'industrial') h = 18 + rng() * 22;
    const tint = 0.85 + rng() * 0.3;
    this.buildings.push({
      x: x, y: y, w: w, d: d, h: h, district: dist,
      color: shade(dist.wall, tint), roof: shade(dist.roof, tint),
      windows: Math.floor(w / 26), floors: Math.max(1, Math.floor(h / 22)),
    });
  },

  districtAt: function (x, y) {
    for (const d of DISTRICTS) {
      if (x >= d.x0 && x < d.x1 && y >= d.y0 && y < d.y1) return d;
    }
    return DISTRICTS[3];
  },

  onRoad: function (x, y) {
    for (const rx of this.roadsX) if (Math.abs(x - rx) < CFG.ROAD_W / 2) return true;
    for (const ry of this.roadsY) if (Math.abs(y - ry) < CFG.ROAD_W / 2) return true;
    return false;
  },

  inBuilding: function (x, y, pad) {
    pad = pad || 0;
    for (const b of this.buildings) {
      if (b.lot) continue;
      if (x > b.x - pad && x < b.x + b.w + pad && y > b.y - pad && y < b.y + b.d + pad) return b;
    }
    return null;
  },

  // Push a circle out of every building it overlaps. Returns true on a hit.
  collideCircle: function (p, r) {
    let hit = false;
    for (const b of this.buildings) {
      if (b.lot) continue;
      const nx = clamp(p.x, b.x, b.x + b.w);
      const ny = clamp(p.y, b.y, b.y + b.d);
      const dx = p.x - nx, dy = p.y - ny;
      const d2 = dx * dx + dy * dy;
      if (d2 < r * r) {
        hit = true;
        if (d2 > 0.01) {
          const d = Math.sqrt(d2);
          p.x = nx + (dx / d) * r;
          p.y = ny + (dy / d) * r;
        } else {
          p.x += r; // dead centre: shove east
        }
      }
    }
    if (p.x < 30) { p.x = 30; hit = true; }
    if (p.y < 30) { p.y = 30; hit = true; }
    if (p.x > CFG.WORLD_W - 30) { p.x = CFG.WORLD_W - 30; hit = true; }
    if (p.y > CFG.WORLD_H - 30) { p.y = CFG.WORLD_H - 30; hit = true; }
    return hit;
  },

  nearestRoadPoint: function (x, y) {
    let best = null, bd = Infinity;
    for (const rx of this.roadsX) {
      const d = Math.abs(x - rx);
      if (d < bd) { bd = d; best = { x: rx, y: clamp(y, 60, CFG.WORLD_H - 60), axis: 'v' }; }
    }
    for (const ry of this.roadsY) {
      const d = Math.abs(y - ry);
      if (d < bd) { bd = d; best = { x: clamp(x, 60, CFG.WORLD_W - 60), y: ry, axis: 'h' }; }
    }
    return best;
  },

  // Snap a point onto the road graph (used by the GPS autopilot).
  roadPoint: function (x, y) {
    return this.nearestRoadPoint(x, y);
  },

  // Next intersection waypoint when driving from (x,y) towards (tx,ty) on the graph.
  nextWaypoint: function (x, y, tx, ty) {
    const cur = this.nearestRoadPoint(x, y);
    const tgt = this.nearestRoadPoint(tx, ty);
    if (!cur || !tgt) return { x: tx, y: ty };
    const dx = tgt.x - cur.x, dy = tgt.y - cur.y;
    if (Math.abs(dx) > 40 && cur.axis === 'h') {
      // On a horizontal road: drive to the vertical road nearest the target.
      const vx = this.nearestRoadX(tx);
      return { x: vx, y: cur.y };
    }
    if (Math.abs(dy) > 40 && cur.axis === 'v') {
      const hy = this.nearestRoadY(ty);
      return { x: cur.x, y: hy };
    }
    if (Math.abs(dx) > 40) return { x: tgt.x, y: cur.y };
    if (Math.abs(dy) > 40) return { x: cur.x, y: tgt.y };
    return { x: tx, y: ty };
  },

  nearestRoadX: function (x) {
    let best = this.roadsX[0], bd = Infinity;
    for (const rx of this.roadsX) { const d = Math.abs(x - rx); if (d < bd) { bd = d; best = rx; } }
    return best;
  },

  nearestRoadY: function (y) {
    let best = this.roadsY[0], bd = Infinity;
    for (const ry of this.roadsY) { const d = Math.abs(y - ry); if (d < bd) { bd = d; best = ry; } }
    return best;
  },
};
