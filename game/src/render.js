// render.js — VELMARA v6: the pseudo-3D chase camera. The simulation is
// top-down, but the picture is a perspective chase cam: the camera sits
// behind Riko, buildings rise as extruded boxes, cars are 3D boxes, and the
// sun-soaked coast glows at golden hour and neon at night.
'use strict';

const Render = {
  cam: null,
  shake: 0,

  // The chase camera: behind the player, looking ahead and slightly down.
  // If a building stands between the camera and the player, pull the camera
  // in (and up) until the player is visible again.
  computeCamera: function (G) {
    const p = G.player;
    let dist = p.onFoot ? CFG.CAM_DIST_FOOT : CFG.CAM_DIST_CAR;
    let height = p.onFoot ? CFG.CAM_HEIGHT_FOOT : CFG.CAM_HEIGHT_CAR;
    const a = p.angle;
    for (let tries = 0; tries < 8; tries++) {
      const ex = p.x - Math.cos(a) * dist;
      const ey = p.y - Math.sin(a) * dist;
      if (!this.cameraBlocked(p.x, p.y, ex, ey, height)) break;
      dist *= 0.78;
      height += 26;
      if (dist < 110) break;
    }
    const shx = this.shake > 0 ? (Math.random() - 0.5) * this.shake : 0;
    const shy = this.shake > 0 ? (Math.random() - 0.5) * this.shake : 0;
    const ex = p.x - Math.cos(a) * dist + shx;
    const ey = p.y - Math.sin(a) * dist + shy;
    const ez = height;
    const tx = p.x + Math.cos(a) * 90;
    const ty = p.y + Math.sin(a) * 90;
    const tz = 10;
    let fx = tx - ex, fy = ty - ey, fz = tz - ez;
    const fl = Math.sqrt(fx * fx + fy * fy + fz * fz);
    fx /= fl; fy /= fl; fz /= fl;
    // right = normalize(cross(f, worldUp))
    let rx = fy * 1 - fz * 0, ry = fz * 0 - fx * 1, rz = fx * 0 - fy * 0;
    // cross((fx,fy,fz),(0,0,1)) = (fy*1 - fz*0, fz*0 - fx*1, fx*0 - fy*0)
    const rl = Math.sqrt(rx * rx + ry * ry + rz * rz) || 1;
    rx /= rl; ry /= rl; rz /= rl;
    // up = cross(right, f)
    const ux = ry * fz - rz * fy, uy = rz * fx - rx * fz, uz = rx * fy - ry * fx;
    const focal = (CFG.VIEW_H / 2) / Math.tan((CFG.FOV_DEG / 2) * Math.PI / 180);
    this.cam = { ex: ex, ey: ey, ez: ez, fx: fx, fy: fy, fz: fz, rx: rx, ry: ry, rz: rz, ux: ux, uy: uy, uz: uz, focal: focal };
    return this.cam;
  },

  // True when a building taller than the sight line stands between (x0,y0)
  // and (x1,y1) — tested at the eye point and the segment midpoint.
  cameraBlocked: function (x0, y0, x1, y1, height) {
    const pts = [[x1, y1, height], [(x0 + x1) / 2, (y0 + y1) / 2, height * 0.75]];
    for (const pt of pts) {
      for (const b of City.buildings) {
        if (b.lot) continue;
        if (pt[0] > b.x - 6 && pt[0] < b.x + b.w + 6 && pt[1] > b.y - 6 && pt[1] < b.y + b.d + 6 && b.h > pt[2]) return true;
      }
    }
    return false;
  },

  project: function (cam, x, y, z) {
    const dx = x - cam.ex, dy = y - cam.ey, dz = z - cam.ez;
    const cz = dx * cam.fx + dy * cam.fy + dz * cam.fz;
    if (cz < 8) return null;
    const cx = dx * cam.rx + dy * cam.ry + dz * cam.rz;
    const cy = dx * cam.ux + dy * cam.uy + dz * cam.uz;
    const s = cam.focal / cz;
    return { x: CFG.VIEW_W / 2 + cx * s, y: CFG.VIEW_H / 2 - cy * s, z: cz, s: s };
  },

  // Project a ground quad and fill it. Returns false when off-screen/behind.
  quad: function (ctx, cam, pts, fill) {
    const ps = [];
    for (const q of pts) {
      const pr = this.project(cam, q[0], q[1], q[2] || 0);
      if (!pr) return false;
      ps.push(pr);
    }
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(ps[0].x, ps[0].y);
    for (let i = 1; i < ps.length; i++) ctx.lineTo(ps[i].x, ps[i].y);
    ctx.closePath();
    ctx.fill();
    return true;
  },

  // A box centred at (cx,cy) with footprint w x d and height h, drawn face by face.
  box: function (ctx, cam, cx, cy, w, d, h, colors, litWindows) {
    const x0 = cx - w / 2, x1 = cx + w / 2, y0 = cy - d / 2, y1 = cy + d / 2;
    const faces = [
      { n: [0, -1], pts: [[x0, y0, 0], [x1, y0, 0], [x1, y0, h], [x0, y0, h]], fill: colors.south },
      { n: [0, 1], pts: [[x1, y1, 0], [x0, y1, 0], [x0, y1, h], [x1, y1, h]], fill: colors.north },
      { n: [-1, 0], pts: [[x0, y1, 0], [x0, y0, 0], [x0, y0, h], [x0, y1, h]], fill: colors.west },
      { n: [1, 0], pts: [[x1, y0, 0], [x1, y1, 0], [x1, y1, h], [x1, y0, h]], fill: colors.east },
    ];
    for (const f of faces) {
      const fcX = (f.pts[0][0] + f.pts[1][0]) / 2;
      const fcY = (f.pts[0][1] + f.pts[1][1]) / 2;
      const toCamX = cam.ex - fcX, toCamY = cam.ey - fcY;
      if (f.n[0] * toCamX + f.n[1] * toCamY <= 0) continue;
      this.quad(ctx, cam, f.pts, f.fill);
      if (litWindows) this.faceWindows(ctx, cam, f.pts, litWindows);
    }
    // Roof.
    this.quad(ctx, cam, [[x0, y0, h], [x1, y0, h], [x1, y1, h], [x0, y1, h]], colors.roof);
  },

  // Lit (or dark) window dots interpolated across a wall face.
  faceWindows: function (ctx, cam, pts, mode) {
    const cols = 4, rows = 3;
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const u = (i + 0.5) / cols, v = 0.25 + (j + 0.5) / rows * 0.65;
        const bx = lerp(lerp(pts[0][0], pts[1][0], u), lerp(pts[3][0], pts[2][0], u), v);
        const by = lerp(lerp(pts[0][1], pts[1][1], u), lerp(pts[3][1], pts[2][1], u), v);
        const bz = lerp(lerp(pts[0][2], pts[1][2], u), lerp(pts[3][2], pts[2][2], u), v);
        const pr = this.project(cam, bx, by, bz);
        if (!pr) continue;
        const s = Math.max(1.5, pr.s * 3);
        ctx.fillStyle = mode === 'night' ? 'rgba(255,214,120,0.9)' : 'rgba(30,40,60,0.55)';
        ctx.fillRect(pr.x - s / 2, pr.y - s / 2, s, s * 1.3);
      }
    }
  },

  // Sky gradient, sun/moon and drifting clouds by time of day.
  drawSky: function (ctx, G) {
    const h = G.clockHour;
    const night = h >= 19 || h < 6;
    let top, mid, bot, sunA;
    if (h >= 6 && h < 9) { top = '#7fb2e0'; mid = '#f2c98a'; bot = '#f7e0b0'; sunA = 0.9; }
    else if (h >= 9 && h < 16) { top = '#3f8fd2'; mid = '#7fb8e8'; bot = '#cfe8f7'; sunA = 1; }
    else if (h >= 16 && h < 19) { top = '#5a6fb0'; mid = '#f2a35e'; bot = '#ffd9a0'; sunA = 0.95; }
    else if (h >= 19 && h < 21) { top = '#2c2c5e'; mid = '#b05e7a'; bot = '#e88a5e'; sunA = 0.4; }
    else { top = '#070a1e'; mid = '#101736'; bot = '#1d2447'; sunA = 0.25; }
    const g = ctx.createLinearGradient(0, 0, 0, CFG.VIEW_H * 0.62);
    g.addColorStop(0, top); g.addColorStop(0.55, mid); g.addColorStop(1, bot);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, CFG.VIEW_W, CFG.VIEW_H * 0.62);
    // Sun or moon disc, low on the horizon at dawn/dusk.
    const sunX = CFG.VIEW_W * (0.22 + 0.56 * ((h % 12) / 12));
    const sunY = CFG.VIEW_H * (h >= 6 && h < 18 ? 0.16 : 0.12);
    ctx.globalAlpha = sunA;
    ctx.fillStyle = (h >= 6 && h < 18) ? '#fff3c4' : '#e8ecff';
    ctx.beginPath(); ctx.arc(sunX, sunY, h >= 6 && h < 18 ? 34 : 24, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 0.25;
    ctx.beginPath(); ctx.arc(sunX, sunY, 52, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    // Clouds drift with the clock — faint at night, bright by day.
    ctx.fillStyle = night ? 'rgba(200,200,220,0.16)' : 'rgba(255,255,255,0.55)';
    for (let i = 0; i < 5; i++) {
      const cx = ((i * 263 + G.clockMin * 2.2) % (CFG.VIEW_W + 200)) - 100;
      const cy = 40 + i * 26;
      ctx.beginPath();
      ctx.ellipse(cx, cy, 70, 14, 0, 0, Math.PI * 2);
      ctx.ellipse(cx + 40, cy + 6, 50, 11, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  isNight: function (G) { return G.clockHour >= 19 || G.clockHour < 6; },
  isGolden: function (G) { return (G.clockHour >= 16 && G.clockHour < 19) || (G.clockHour >= 6 && G.clockHour < 8); },

  // ---- the whole scene, in draw order: sky, ground, then objects far to near.
  drawWorld: function (ctx, G) {
    const cam = this.computeCamera(G);
    const p = G.player;
    this.drawSky(ctx, G);
    const night = this.isNight(G);
    const golden = this.isGolden(G);

    // Horizon: a distant skyline silhouette so the world never ends in sky.
    ctx.fillStyle = night ? '#0d1230' : (golden ? '#8a6a8a' : '#6a8ab0');
    ctx.beginPath();
    ctx.moveTo(0, CFG.VIEW_H * 0.52);
    let hx = 0;
    const hrng = mulberry32(42);
    while (hx < CFG.VIEW_W) {
      const bw = 40 + hrng() * 90, bh = 20 + hrng() * 70;
      ctx.lineTo(hx, CFG.VIEW_H * 0.52 - bh);
      ctx.lineTo(hx + bw, CFG.VIEW_H * 0.52 - bh);
      ctx.lineTo(hx + bw, CFG.VIEW_H * 0.52);
      hx += bw + 8;
    }
    ctx.lineTo(CFG.VIEW_W, CFG.VIEW_H * 0.52);
    ctx.closePath();
    ctx.fill();

    // ---- ground: district blocks, then roads, dashes and crosswalks.
    const vis = { x0: p.x - 900, y0: p.y - 900, x1: p.x + 900, y1: p.y + 900 };
    for (let i = 0; i < City.roadsX.length - 1; i++) {
      for (let j = 0; j < City.roadsY.length - 1; j++) {
        const bx0 = City.roadsX[i] + CFG.ROAD_W / 2, by0 = City.roadsY[j] + CFG.ROAD_W / 2;
        const bx1 = City.roadsX[i + 1] - CFG.ROAD_W / 2, by1 = City.roadsY[j + 1] - CFG.ROAD_W / 2;
        if (bx1 < vis.x0 || bx0 > vis.x1 || by1 < vis.y0 || by0 > vis.y1) continue;
        const d = City.districtAt((bx0 + bx1) / 2, (by0 + by1) / 2);
        this.quad(ctx, cam, [[bx0, by0, 0], [bx1, by0, 0], [bx1, by1, 0], [bx0, by1, 0]], shade(d.ground, night ? 0.35 : golden ? 0.9 : 1));
        this.quad(ctx, cam, [[bx0 + 8, by0 + 8, 0.5], [bx1 - 8, by0 + 8, 0.5], [bx1 - 8, by1 - 8, 0.5], [bx0 + 8, by1 - 8, 0.5]], shade(d.block, night ? 0.35 : golden ? 0.9 : 1));
      }
    }
    const asphalt = night ? '#23232c' : (golden ? '#3d3a44' : '#3a3a42');
    for (const rx of City.roadsX) {
      if (rx < vis.x0 - 100 || rx > vis.x1 + 100) continue;
      for (let j = 0; j < City.roadsY.length - 1; j++) {
        const y0 = City.roadsY[j], y1 = City.roadsY[j + 1];
        this.quad(ctx, cam, [[rx - 42, y0, 0.4], [rx + 42, y0, 0.4], [rx + 42, y1, 0.4], [rx - 42, y1, 0.4]], asphalt);
        // Centre dashes.
        for (let y = y0 + 30; y < y1 - 20; y += 60) {
          if (Math.abs(y - p.y) > 700) continue;
          this.quad(ctx, cam, [[rx - 2, y, 0.6], [rx + 2, y, 0.6], [rx + 2, y + 26, 0.6], [rx - 2, y + 26, 0.6]], night ? '#8a8a3a' : '#d8c85a');
        }
      }
    }
    for (const ry of City.roadsY) {
      if (ry < vis.y0 - 100 || ry > vis.y1 + 100) continue;
      for (let i = 0; i < City.roadsX.length - 1; i++) {
        const x0 = City.roadsX[i], x1 = City.roadsX[i + 1];
        this.quad(ctx, cam, [[x0, ry - 42, 0.4], [x1, ry - 42, 0.4], [x1, ry + 42, 0.4], [x0, ry + 42, 0.4]], asphalt);
        for (let x = x0 + 30; x < x1 - 20; x += 60) {
          if (Math.abs(x - p.x) > 700) continue;
          this.quad(ctx, cam, [[x, ry - 2, 0.6], [x + 26, ry - 2, 0.6], [x + 26, ry + 2, 0.6], [x, ry + 2, 0.6]], night ? '#8a8a3a' : '#d8c85a');
        }
      }
    }
    // Crosswalk stripes at intersections near the player.
    ctx.fillStyle = night ? '#7a7a7a' : '#e8e8e8';
    for (const rx of City.roadsX) {
      for (const ry of City.roadsY) {
        if (Math.abs(rx - p.x) > 650 || Math.abs(ry - p.y) > 650) continue;
        for (let k = -2; k <= 2; k++) {
          this.quad(ctx, cam, [[rx + k * 14 - 4, ry - 52, 0.7], [rx + k * 14 + 4, ry - 52, 0.7], [rx + k * 14 + 4, ry - 34, 0.7], [rx + k * 14 - 4, ry - 34, 0.7]], night ? '#7a7a7a' : '#e8e8e8');
        }
      }
    }

    // ---- objects, far to near.
    const items = [];
    const depthOf = (x, y) => (x - cam.ex) * cam.fx + (y - cam.ey) * cam.fy;
    for (const b of City.buildings) {
      const cx = b.x + b.w / 2, cy = b.y + b.d / 2;
      const dep = depthOf(cx, cy);
      if (dep < 10 || dep > CFG.DRAW_DIST + 200) continue;
      if (Math.abs(cx - p.x) > 1000 || Math.abs(cy - p.y) > 1000) continue;
      items.push({ dep: dep, kind: 'building', b: b });
    }
    for (const t of City.trees) {
      const dep = depthOf(t.x, t.y);
      if (dep < 10 || dep > CFG.DRAW_DIST) continue;
      items.push({ dep: dep, kind: 'tree', t: t });
    }
    for (const c of Traffic.cars) {
      const dep = depthOf(c.x, c.y);
      if (dep < 10 || dep > CFG.DRAW_DIST) continue;
      items.push({ dep: dep, kind: 'car', c: c });
    }
    for (const pd of Traffic.peds) {
      const dep = depthOf(pd.x, pd.y);
      if (dep < 10 || dep > CFG.DRAW_DIST) continue;
      items.push({ dep: dep, kind: 'ped', c: pd });
    }
    for (const c of Police.cops) {
      const dep = depthOf(c.x, c.y);
      if (dep < 10 || dep > CFG.DRAW_DIST) continue;
      items.push({ dep: dep, kind: 'copcar', c: c });
    }
    if (Police.roadblock) for (const c of Police.roadblock.cars) {
      const dep = depthOf(c.x, c.y);
      if (dep > 10 && dep < CFG.DRAW_DIST) items.push({ dep: dep, kind: 'copcar', c: c });
    }
    for (const f of Police.footCops) {
      const dep = depthOf(f.x, f.y);
      if (dep < 10 || dep > CFG.DRAW_DIST) continue;
      items.push({ dep: dep, kind: 'footcop', c: f });
    }
    for (const e of G.enemies) {
      if (!e.alive) continue;
      const dep = depthOf(e.x, e.y);
      if (dep < 10 || dep > CFG.DRAW_DIST) continue;
      items.push({ dep: dep, kind: 'enemy', c: e });
    }
    for (const c of City.coins) {
      if (c.taken) continue;
      const dep = depthOf(c.x, c.y);
      if (dep < 10 || dep > CFG.DRAW_DIST) continue;
      items.push({ dep: dep, kind: 'coin', c: c });
    }
    if (G.targetCar) items.push({ dep: depthOf(G.targetCar.x, G.targetCar.y), kind: 'targetcar', c: G.targetCar });
    if (G.convoyCar) items.push({ dep: depthOf(G.convoyCar.x, G.convoyCar.y), kind: 'convoycar', c: G.convoyCar });
    if (Police.heli) items.push({ dep: depthOf(Police.heli.x, Police.heli.y), kind: 'heli', c: Police.heli });
    // The player is drawn last (nearest) — but still depth-sorted with the rest.
    items.push({ dep: depthOf(p.x, p.y), kind: 'player', c: p });
    items.sort((a, b) => b.dep - a.dep);

    for (const it of items) this.drawItem(ctx, cam, G, it);

    // Objective marker beam + floating diamond.
    const obj = Missions.currentObjective(G);
    if (obj && obj.x !== undefined && obj.type !== 'choice') {
      const base = this.project(cam, obj.x, obj.y, 0);
      const top = this.project(cam, obj.x, obj.y, 130);
      if (base && top) {
        ctx.fillStyle = 'rgba(255,200,40,0.16)';
        ctx.beginPath();
        ctx.moveTo(base.x - 26 * base.s / 10, base.y);
        ctx.lineTo(top.x - 8, top.y);
        ctx.lineTo(top.x + 8, top.y);
        ctx.lineTo(base.x + 26 * base.s / 10, base.y);
        ctx.closePath(); ctx.fill();
        const bob = Math.sin(G.time * 3) * 8;
        ctx.fillStyle = '#ffc828';
        ctx.beginPath();
        ctx.moveTo(top.x, top.y - 14 + bob);
        ctx.lineTo(top.x + 12, top.y + bob);
        ctx.lineTo(top.x, top.y + 14 + bob);
        ctx.lineTo(top.x - 12, top.y + bob);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#7a5200'; ctx.lineWidth = 2; ctx.stroke();
      }
    }
    // Race checkpoints.
    if (G.race) {
      const route = City.raceRoutes[G.race.route];
      const cp = route.cps[G.race.cp];
      if (cp) {
        const pr = this.project(cam, cp[0], cp[1], 0);
        if (pr) {
          ctx.strokeStyle = '#37e08a'; ctx.lineWidth = 4;
          ctx.beginPath(); ctx.arc(pr.x, pr.y, 26 * pr.s, 0, Math.PI * 2); ctx.stroke();
          ctx.fillStyle = '#37e08a';
          ctx.font = 'bold 16px system-ui, sans-serif'; ctx.textAlign = 'center';
          ctx.fillText('CP ' + (G.race.cp + 1) + '/' + route.cps.length, pr.x, pr.y - 34);
        }
      }
    }
    // Taxi passenger / destination.
    if (Economy.taxi) {
      const t = Economy.taxi;
      const pt = t.state === 'pickup' ? t.from : t.to;
      const pr = this.project(cam, pt.x, pt.y, 0);
      if (pr) {
        ctx.fillStyle = t.state === 'pickup' ? '#37c8e0' : '#37e08a';
        ctx.beginPath(); ctx.arc(pr.x, pr.y, 12, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 13px system-ui, sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(t.state === 'pickup' ? 'PICKUP' : 'DROP $' + t.fare, pr.x, pr.y - 18);
      }
    }

    // Particles (explosions, muzzle flashes, smoke).
    for (const pt of G.particles) {
      const pr = this.project(cam, pt.x, pt.y, pt.z || 6);
      if (!pr) continue;
      const r = Math.max(2, pt.r * pr.s / 6);
      ctx.globalAlpha = clamp(pt.life / pt.maxLife, 0, 1);
      ctx.fillStyle = pt.color;
      ctx.beginPath(); ctx.arc(pr.x, pr.y, r, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }

    // Night tint + headlight glow + heli spotlight.
    if (night) {
      ctx.fillStyle = 'rgba(8,10,38,0.34)';
      ctx.fillRect(0, 0, CFG.VIEW_W, CFG.VIEW_H);
      // Warm pool of light around the player.
      const pp = this.project(cam, p.x, p.y, 0);
      if (pp) {
        const g = ctx.createRadialGradient(pp.x, pp.y, 40, pp.x, pp.y, 320);
        g.addColorStop(0, 'rgba(255,220,140,0.10)');
        g.addColorStop(1, 'rgba(255,220,140,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, CFG.VIEW_W, CFG.VIEW_H);
      }
    }
    if (golden) {
      ctx.fillStyle = 'rgba(255,150,60,0.07)';
      ctx.fillRect(0, 0, CFG.VIEW_W, CFG.VIEW_H);
    }
    if (Police.heli && night) {
      const hp = this.project(cam, Police.heli.x, Police.heli.y, 0);
      const pp = this.project(cam, p.x, p.y, 0);
      if (hp && pp) {
        ctx.fillStyle = 'rgba(255,255,200,0.14)';
        ctx.beginPath();
        ctx.moveTo(hp.x - 10, hp.y - 120);
        ctx.lineTo(pp.x - 70, pp.y);
        ctx.lineTo(pp.x + 70, pp.y);
        ctx.lineTo(hp.x + 10, hp.y - 120);
        ctx.closePath(); ctx.fill();
      }
    }
    if (G.damageFlash > 0) {
      ctx.fillStyle = 'rgba(255,30,30,' + (G.damageFlash * 0.25) + ')';
      ctx.fillRect(0, 0, CFG.VIEW_W, CFG.VIEW_H);
    }
    // Vignette for a filmic edge.
    const vg = ctx.createRadialGradient(640, 360, 320, 640, 360, 760);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.28)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, CFG.VIEW_W, CFG.VIEW_H);
    if (this.shake > 0) this.shake = Math.max(0, this.shake - 0.6);
  },

  drawItem: function (ctx, cam, G, it) {
    const night = this.isNight(G);
    if (it.kind === 'building') {
      const b = it.b;
      if (b.lot) {
        // Parking lot: flat slab with painted bays.
        this.quad(ctx, cam, [[b.x, b.y, 1], [b.x + b.w, b.y, 1], [b.x + b.w, b.y + b.d, 1], [b.x, b.y + b.d, 1]], '#4a4a52');
        return;
      }
      const cx = b.x + b.w / 2, cy = b.y + b.d / 2;
      const sun = this.isGolden(G) ? 1.08 : 1;
      const colors = {
        south: shade(b.color, 1.0 * sun), north: shade(b.color, 0.62),
        west: shade(b.color, 0.82 * sun), east: shade(b.color, 0.72),
        roof: b.kiosk ? '#8a6a3a' : shade(b.roof, night ? 0.4 : 1),
      };
      // Rotate the box by its footprint: buildings are axis-aligned, so w/d map directly.
      const x0 = b.x, x1 = b.x + b.w, y0 = b.y, y1 = b.y + b.d, h = b.h;
      const faces = [
        { n: [0, -1], pts: [[x0, y0, 0], [x1, y0, 0], [x1, y0, h], [x0, y0, h]], fill: colors.south },
        { n: [0, 1], pts: [[x1, y1, 0], [x0, y1, 0], [x0, y1, h], [x1, y1, h]], fill: colors.north },
        { n: [-1, 0], pts: [[x0, y1, 0], [x0, y0, 0], [x0, y0, h], [x0, y1, h]], fill: colors.west },
        { n: [1, 0], pts: [[x1, y0, 0], [x1, y1, 0], [x1, y1, h], [x1, y0, h]], fill: colors.east },
      ];
      for (const f of faces) {
        const fcX = (f.pts[0][0] + f.pts[1][0]) / 2, fcY = (f.pts[0][1] + f.pts[1][1]) / 2;
        if (f.n[0] * (cam.ex - fcX) + f.n[1] * (cam.ey - fcY) <= 0) continue;
        this.quad(ctx, cam, f.pts, f.fill);
        if (!b.kiosk && it.dep < 650) this.faceWindows(ctx, cam, f.pts, night ? 'night' : 'day');
      }
      this.quad(ctx, cam, [[x0, y0, h], [x1, y0, h], [x1, y1, h], [x0, y1, h]], colors.roof);
      if (b.h > 100) {
        // Rooftop beacon on the towers.
        const rp = this.project(cam, cx, cy, h + 6);
        if (rp) { ctx.fillStyle = night ? '#ff4040' : '#c04040'; ctx.beginPath(); ctx.arc(rp.x, rp.y, 3, 0, Math.PI * 2); ctx.fill(); }
      }
      return;
    }
    if (it.kind === 'tree') {
      const t = it.t;
      const base = this.project(cam, t.x, t.y, 0);
      if (!base) return;
      // Shadow.
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath(); ctx.ellipse(base.x, base.y, 14 * base.s, 5 * base.s, 0, 0, Math.PI * 2); ctx.fill();
      const top = this.project(cam, t.x, t.y, t.palm ? 46 : 30);
      if (!top) return;
      ctx.strokeStyle = '#6a4a2a'; ctx.lineWidth = Math.max(2, 2.5 * top.s);
      ctx.beginPath(); ctx.moveTo(base.x, base.y); ctx.lineTo(top.x, top.y); ctx.stroke();
      ctx.fillStyle = t.palm ? '#3f9a4a' : '#2e7a3a';
      ctx.beginPath(); ctx.arc(top.x, top.y, (t.s || 16) * top.s, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.beginPath(); ctx.arc(top.x - 4, top.y - 4, (t.s || 16) * top.s / 2, 0, Math.PI * 2); ctx.fill();
      return;
    }
    if (it.kind === 'car' || it.kind === 'copcar' || it.kind === 'targetcar' || it.kind === 'convoycar') {
      this.drawCar(ctx, cam, G, it.c);
      return;
    }
    if (it.kind === 'ped' || it.kind === 'footcop' || it.kind === 'enemy') {
      this.drawPerson(ctx, cam, G, it.c, it.kind);
      return;
    }
    if (it.kind === 'coin') {
      const c = it.c;
      const pr = this.project(cam, c.x, c.y, 10 + Math.sin(G.time * 3 + c.x) * 3);
      if (!pr) return;
      const r = Math.max(3, 9 * pr.s);
      ctx.fillStyle = '#ffd94a';
      ctx.beginPath(); ctx.arc(pr.x, pr.y, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#b8860b';
      ctx.font = 'bold ' + Math.max(8, r) + 'px system-ui, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('$', pr.x, pr.y + r / 3);
      return;
    }
    if (it.kind === 'heli') {
      const h = it.c;
      const pr = this.project(cam, h.x, h.y, h.alt);
      const sh = this.project(cam, h.x, h.y, 0);
      if (sh) {
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath(); ctx.ellipse(sh.x, sh.y, 30 * sh.s, 10 * sh.s, 0, 0, Math.PI * 2); ctx.fill();
      }
      if (!pr) return;
      const s = pr.s;
      ctx.fillStyle = '#20242e';
      ctx.beginPath(); ctx.ellipse(pr.x, pr.y, 34 * s, 12 * s, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#3a4a6a';
      ctx.beginPath(); ctx.ellipse(pr.x + 8 * s, pr.y - 6 * s, 12 * s, 6 * s, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#888'; ctx.lineWidth = 2;
      const ra = h.rotor;
      ctx.beginPath();
      ctx.moveTo(pr.x - Math.cos(ra) * 52 * s, pr.y - Math.sin(ra) * 10 * s);
      ctx.lineTo(pr.x + Math.cos(ra) * 52 * s, pr.y + Math.sin(ra) * 10 * s);
      ctx.stroke();
      return;
    }
    if (it.kind === 'player') {
      const p = it.c;
      if (p.onFoot) this.drawPerson(ctx, cam, G, p, 'player');
      else if (p.car) this.drawCar(ctx, cam, G, p.car, true);
      return;
    }
  },

  // A car as a 3D box: body, cabin, windshield, wheels, headlights, shadow.
  drawCar: function (ctx, cam, G, c, isPlayer) {
    const m = CARS[c.model] || CARS[0];
    const len = m.len, wid = m.wid;
    const a = c.angle || 0;
    const fx = Math.cos(a), fy = Math.sin(a);
    const px = -fy, py = fx; // perpendicular
    const halfL = len / 2, halfW = wid / 2;
    const corners = (off, w2) => [
      [c.x + fx * off - px * w2, c.y + fy * off - py * w2],
      [c.x + fx * off + px * w2, c.y + fy * off + py * w2],
    ];
    const night = this.isNight(G);
    // Shadow.
    const sh = [[c.x - fx * halfL - px * halfW, c.y - fy * halfL - py * halfW],
                [c.x + fx * halfL - px * halfW, c.y + fy * halfL - py * halfW],
                [c.x + fx * halfL + px * halfW, c.y + fy * halfL + py * halfW],
                [c.x - fx * halfL + px * halfW, c.y - fy * halfL + py * halfW]];
    this.quad(ctx, cam, sh.map(q => [q[0], q[1], 0.5]), 'rgba(0,0,0,0.30)');
    // Body: top + two visible sides, built from rotated corners.
    const bodyTop = [
      [c.x - fx * halfL - px * halfW, c.y - fy * halfL - py * halfW, 16],
      [c.x + fx * halfL - px * halfW, c.y + fy * halfL - py * halfW, 16],
      [c.x + fx * halfL + px * halfW, c.y + fy * halfL + py * halfW, 16],
      [c.x - fx * halfL + px * halfW, c.y - fy * halfL + py * halfW, 16],
    ];
    const bodySideA = [
      [c.x - fx * halfL - px * halfW, c.y - fy * halfL - py * halfW, 0],
      [c.x + fx * halfL - px * halfW, c.y + fy * halfL - py * halfW, 0],
      [c.x + fx * halfL - px * halfW, c.y + fy * halfL - py * halfW, 16],
      [c.x - fx * halfL - px * halfW, c.y - fy * halfL - py * halfW, 16],
    ];
    const bodySideB = [
      [c.x + fx * halfL + px * halfW, c.y + fy * halfL + py * halfW, 0],
      [c.x - fx * halfL + px * halfW, c.y - fy * halfL + py * halfW, 0],
      [c.x - fx * halfL + px * halfW, c.y - fy * halfL + py * halfW, 16],
      [c.x + fx * halfL + px * halfW, c.y + fy * halfL + py * halfW, 16],
    ];
    const bodyFront = [
      [c.x + fx * halfL - px * halfW, c.y + fy * halfL - py * halfW, 0],
      [c.x + fx * halfL + px * halfW, c.y + fy * halfL + py * halfW, 0],
      [c.x + fx * halfL + px * halfW, c.y + fy * halfL + py * halfW, 16],
      [c.x + fx * halfL - px * halfW, c.y + fy * halfL - py * halfW, 16],
    ];
    const bodyBack = [
      [c.x - fx * halfL + px * halfW, c.y - fy * halfL + py * halfW, 0],
      [c.x - fx * halfL - px * halfW, c.y - fy * halfL - py * halfW, 0],
      [c.x - fx * halfL - px * halfW, c.y - fy * halfL - py * halfW, 16],
      [c.x - fx * halfL + px * halfW, c.y - fy * halfL + py * halfW, 16],
    ];
    const col = c.model === 7 ? '#e8e8e8' : (c.color || m.color);
    const dark = shade(col, 0.55);
    // Draw sides only when they face the camera.
    const faceVisible = (pts) => {
      const fcX = (pts[0][0] + pts[1][0]) / 2, fcY = (pts[0][1] + pts[1][1]) / 2;
      const nx = (pts[1][1] - pts[0][1]), ny = -(pts[1][0] - pts[0][0]);
      return nx * (cam.ex - fcX) + ny * (cam.ey - fcY) > 0;
    };
    if (faceVisible(bodySideA)) this.quad(ctx, cam, bodySideA, shade(col, 0.75));
    if (faceVisible(bodySideB)) this.quad(ctx, cam, bodySideB, shade(col, 0.85));
    if (faceVisible(bodyFront)) this.quad(ctx, cam, bodyFront, shade(col, 0.9));
    if (faceVisible(bodyBack)) this.quad(ctx, cam, bodyBack, dark);
    this.quad(ctx, cam, bodyTop, shade(col, 1.05));
    // Cabin: a smaller box toward the rear-middle.
    const cabOff = -halfL * 0.08, cabL = len * 0.34, cabW = wid * 0.78;
    const cab = [
      [c.x + fx * (cabOff - cabL / 2) - px * cabW / 2, c.y + fy * (cabOff - cabL / 2) - py * cabW / 2, 16],
      [c.x + fx * (cabOff + cabL / 2) - px * cabW / 2, c.y + fy * (cabOff + cabL / 2) - py * cabW / 2, 16],
      [c.x + fx * (cabOff + cabL / 2) + px * cabW / 2, c.y + fy * (cabOff + cabL / 2) + py * cabW / 2, 16],
      [c.x + fx * (cabOff - cabL / 2) + px * cabW / 2, c.y + fy * (cabOff - cabL / 2) + py * cabW / 2, 16],
    ];
    const cabSideA = [
      [c.x + fx * (cabOff - cabL / 2) - px * cabW / 2, c.y + fy * (cabOff - cabL / 2) - py * cabW / 2, 16],
      [c.x + fx * (cabOff + cabL / 2) - px * cabW / 2, c.y + fy * (cabOff + cabL / 2) - py * cabW / 2, 16],
      [c.x + fx * (cabOff + cabL / 2) - px * cabW / 2, c.y + fy * (cabOff + cabL / 2) - py * cabW / 2, 28],
      [c.x + fx * (cabOff - cabL / 2) - px * cabW / 2, c.y + fy * (cabOff - cabL / 2) - py * cabW / 2, 28],
    ];
    const cabSideB = [
      [c.x + fx * (cabOff + cabL / 2) + px * cabW / 2, c.y + fy * (cabOff + cabL / 2) + py * cabW / 2, 16],
      [c.x + fx * (cabOff - cabL / 2) + px * cabW / 2, c.y + fy * (cabOff - cabL / 2) + py * cabW / 2, 16],
      [c.x + fx * (cabOff - cabL / 2) + px * cabW / 2, c.y + fy * (cabOff - cabL / 2) + py * cabW / 2, 28],
      [c.x + fx * (cabOff + cabL / 2) + px * cabW / 2, c.y + fy * (cabOff + cabL / 2) + py * cabW / 2, 28],
    ];
    const cabTop = cab.map(q => [q[0], q[1], 28]);
    if (faceVisible(cabSideA)) this.quad(ctx, cam, cabSideA, '#1c2733');
    if (faceVisible(cabSideB)) this.quad(ctx, cam, cabSideB, '#243240');
    this.quad(ctx, cam, cabTop, shade(col, 0.9));
    // Police light bar + taxi sign.
    if (c.model === 7) {
      const bar = this.project(cam, c.x + fx * cabOff, c.y + fy * cabOff, 30);
      if (bar) {
        const blink = Math.floor(G.time * 4) % 2 === 0;
        ctx.fillStyle = blink ? '#ff2020' : '#2040ff';
        ctx.beginPath(); ctx.arc(bar.x - 6, bar.y, 4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = blink ? '#2040ff' : '#ff2020';
        ctx.beginPath(); ctx.arc(bar.x + 6, bar.y, 4, 0, Math.PI * 2); ctx.fill();
      }
    }
    if (c.model === 6) {
      const sg = this.project(cam, c.x, c.y, 32);
      if (sg) {
        ctx.fillStyle = '#f2b705';
        ctx.fillRect(sg.x - 10, sg.y - 5, 20, 10);
        ctx.fillStyle = '#111';
        ctx.font = 'bold 8px system-ui, sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('TAXI', sg.x, sg.y + 3);
      }
    }
    // Headlights at night + brake lights.
    if (night) {
      const hl = this.project(cam, c.x + fx * halfL, c.y + fy * halfL, 8);
      if (hl) {
        ctx.fillStyle = 'rgba(255,240,180,0.9)';
        ctx.beginPath(); ctx.arc(hl.x - 5, hl.y, 3, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(hl.x + 5, hl.y, 3, 0, Math.PI * 2); ctx.fill();
      }
    }
    if (c.brakeLight) {
      const bl = this.project(cam, c.x - fx * halfL, c.y - fy * halfL, 8);
      if (bl) {
        ctx.fillStyle = '#ff2020';
        ctx.beginPath(); ctx.arc(bl.x - 5, bl.y, 3, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(bl.x + 5, bl.y, 3, 0, Math.PI * 2); ctx.fill();
      }
    }
    // Damage smoke when the car is nearly wrecked.
    if (c.hp !== undefined && c.hp < 35 && Math.random() < 0.3) {
      G.particles.push({ x: c.x, y: c.y, z: 20, r: 6, color: 'rgba(80,80,80,0.7)', life: 0.6, maxLife: 0.6 });
    }
  },

  // A person: shadow, body box, head, and a gun in hand when armed.
  drawPerson: function (ctx, cam, G, p, kind) {
    const base = this.project(cam, p.x, p.y, 0);
    if (!base) return;
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath(); ctx.ellipse(base.x, base.y, 10 * base.s, 4 * base.s, 0, 0, Math.PI * 2); ctx.fill();
    const bob = kind === 'ped' ? Math.sin(p.bob || 0) * 2 : 0;
    const bodyTop = this.project(cam, p.x, p.y, 30 + bob);
    const head = this.project(cam, p.x, p.y, 40 + bob);
    if (!bodyTop || !head) return;
    const w = Math.max(4, 12 * bodyTop.s);
    const col = kind === 'player' ? '#e8b04a' : kind === 'footcop' ? '#1a2a4a' : kind === 'enemy' ? '#5a1a1a' : (p.color || '#888');
    ctx.fillStyle = col;
    ctx.fillRect(bodyTop.x - w / 2, bodyTop.y, w, base.y - bodyTop.y);
    ctx.fillStyle = '#e8c39a';
    ctx.beginPath(); ctx.arc(head.x, head.y, Math.max(3, 6 * head.s), 0, Math.PI * 2); ctx.fill();
    if (kind === 'player') {
      // Riko's jacket stripe + cap.
      ctx.fillStyle = '#20242e';
      ctx.fillRect(bodyTop.x - w / 2, bodyTop.y + 6, w, 4);
      ctx.fillStyle = '#e04040';
      ctx.beginPath(); ctx.arc(head.x, head.y - 3, Math.max(3, 6 * head.s), Math.PI, 0); ctx.fill();
    }
    if (kind === 'footcop') {
      ctx.fillStyle = '#101828';
      ctx.beginPath(); ctx.arc(head.x, head.y - 3, Math.max(3, 6 * head.s), Math.PI, 0); ctx.fill();
    }
    if ((kind === 'enemy' || kind === 'footcop') && p.shootCd !== undefined) {
      // Gun barrel line toward the player.
      const a = Math.atan2(G.player.y - p.y, G.player.x - p.x);
      const gp = this.project(cam, p.x + Math.cos(a) * 18, p.y + Math.sin(a) * 18, 22);
      if (gp) {
        ctx.strokeStyle = '#111'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(bodyTop.x, bodyTop.y + 8); ctx.lineTo(gp.x, gp.y); ctx.stroke();
      }
    }
  },
};
