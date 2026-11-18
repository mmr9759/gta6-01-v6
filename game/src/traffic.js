// traffic.js — VELMARA v6: the living street. Traffic cars follow the road
// graph, stop for the car ahead and turn at intersections; pedestrians stroll
// the sidewalks, cross at crosswalks and flee from gunfire.
'use strict';

const Traffic = {
  cars: [],
  peds: [],
  rng: null,

  init: function () {
    this.rng = mulberry32(CFG.SEED + 77);
    this.cars = [];
    this.peds = [];
    for (let i = 0; i < 16; i++) this.spawnCar(true);
    for (let i = 0; i < 26; i++) this.spawnPed(true);
  },

  spawnCar: function (anywhere) {
    const rng = this.rng;
    const model = Math.floor(rng() * 6); // models 0-5 on the street
    const vertical = rng() < 0.5;
    let x, y, dir;
    if (vertical) {
      x = City.roadsX[Math.floor(rng() * City.roadsX.length)] + (rng() < 0.5 ? -21 : 21);
      y = 80 + rng() * (CFG.WORLD_H - 160);
      dir = rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      y = City.roadsY[Math.floor(rng() * City.roadsY.length)] + (rng() < 0.5 ? -21 : 21);
      x = 80 + rng() * (CFG.WORLD_W - 160);
      dir = rng() < 0.5 ? 0 : Math.PI;
    }
    const c = {
      model: model, x: x, y: y, angle: dir,
      speed: 90 + rng() * 70, cruise: 90 + rng() * 70,
      vertical: vertical, color: CARS[model].color,
      stopped: 0, brakeLight: false, parked: false,
    };
    if (model === 2 && rng() < 0.3) c.color = '#f2c230';
    this.cars.push(c);
    return c;
  },

  spawnPed: function (anywhere) {
    const rng = this.rng;
    const x = 100 + rng() * (CFG.WORLD_W - 200);
    const y = 100 + rng() * (CFG.WORLD_H - 200);
    const p = {
      x: x, y: y, angle: rng() * Math.PI * 2,
      speed: 45 + rng() * 35, target: null, flee: 0,
      color: ['#e04040', '#4a6fa5', '#e0a040', '#7a4a8a', '#3a8a5a', '#c9c9c9'][Math.floor(rng() * 6)],
      bob: rng() * 10,
    };
    this.peds.push(p);
    return p;
  },

  // A parked car the player can steal, placed on a road near (x,y).
  parkedCarNear: function (x, y) {
    const rp = City.nearestRoadPoint(x, y);
    const model = Math.floor(this.rng() * 6);
    const lane = this.rng() < 0.5 ? -21 : 21;
    const c = {
      model: model,
      x: rp.axis === 'v' ? rp.x + lane : rp.x + (this.rng() - 0.5) * 160,
      y: rp.axis === 'h' ? rp.y + lane : rp.y + (this.rng() - 0.5) * 160,
      angle: rp.axis === 'v' ? (this.rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (this.rng() < 0.5 ? 0 : Math.PI),
      speed: 0, cruise: 0, vertical: rp.axis === 'v', color: CARS[model].color,
      stopped: 0, brakeLight: false, parked: true,
    };
    this.cars.push(c);
    return c;
  },

  update: function (dt, player, gunfireAt) {
    const rng = this.rng;
    // --- traffic cars ---
    for (const c of this.cars) {
      if (c.parked) continue;
      // Car ahead on the same lane? Slow down or stop.
      let blocked = false;
      for (const o of this.cars) {
        if (o === c || o.parked) continue;
        const dx = o.x - c.x, dy = o.y - c.y;
        const ahead = dx * Math.cos(c.angle) + dy * Math.sin(c.angle);
        const side = Math.abs(-dx * Math.sin(c.angle) + dy * Math.cos(c.angle));
        if (ahead > 0 && ahead < 78 && side < 26) { blocked = true; break; }
      }
      if (player && !player.onFoot && player.car) {
        const dx = player.x - c.x, dy = player.y - c.y;
        const ahead = dx * Math.cos(c.angle) + dy * Math.sin(c.angle);
        const side = Math.abs(-dx * Math.sin(c.angle) + dy * Math.cos(c.angle));
        if (ahead > 0 && ahead < 80 && side < 28) blocked = true;
      }
      const target = blocked ? 0 : c.cruise;
      c.speed += clamp(target - c.speed, -260 * dt, 150 * dt);
      c.brakeLight = blocked;
      if (c.speed > 1) {
        c.x += Math.cos(c.angle) * c.speed * dt;
        c.y += Math.sin(c.angle) * c.speed * dt;
      }
      // At an intersection, sometimes turn onto the crossing road.
      const nearX = City.nearestRoadX(c.x), nearY = City.nearestRoadY(c.y);
      const onCross = Math.abs(c.x - nearX) < 6 || Math.abs(c.y - nearY) < 6;
      if (onCross && rng() < dt * 0.35) {
        if (c.vertical && Math.abs(c.y - nearY) < 8) {
          c.vertical = false;
          c.angle = rng() < 0.5 ? 0 : Math.PI;
          c.y = nearY + (rng() < 0.5 ? -21 : 21);
        } else if (!c.vertical && Math.abs(c.x - nearX) < 8) {
          c.vertical = true;
          c.angle = rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
          c.x = nearX + (rng() < 0.5 ? -21 : 21);
        }
      }
      // Wrap around the map edges so traffic never runs dry.
      if (c.x < 40 || c.x > CFG.WORLD_W - 40 || c.y < 40 || c.y > CFG.WORLD_H - 40) {
        const i = this.cars.indexOf(c);
        this.cars.splice(i, 1);
        this.spawnCar(true);
      }
    }
    // Keep the streets full near the player.
    if (this.cars.length < 16) this.spawnCar(true);

    // --- pedestrians ---
    for (const p of this.peds) {
      p.bob += dt * 8;
      if (gunfireAt && dist2(p.x, p.y, gunfireAt.x, gunfireAt.y) < 300 * 300) p.flee = 2.5;
      if (p.flee > 0) {
        p.flee -= dt;
        const a = Math.atan2(p.y - gunfireAt.y, p.x - gunfireAt.x);
        p.angle = a;
        p.x += Math.cos(a) * 170 * dt;
        p.y += Math.sin(a) * 170 * dt;
      } else {
        if (!p.target || dist2(p.x, p.y, p.target.x, p.target.y) < 100) {
          const rp = City.nearestRoadPoint(p.x + (rng() - 0.5) * 500, p.y + (rng() - 0.5) * 500);
          p.target = { x: clamp(rp.x + (rng() - 0.5) * 60, 60, CFG.WORLD_W - 60), y: clamp(rp.y + (rng() - 0.5) * 60, 60, CFG.WORLD_H - 60) };
        }
        const a = Math.atan2(p.target.y - p.y, p.target.x - p.x);
        p.angle = a;
        p.x += Math.cos(a) * p.speed * dt;
        p.y += Math.sin(a) * p.speed * dt;
      }
      // Stay out of buildings.
      const b = City.inBuilding(p.x, p.y, 4);
      if (b) { p.x -= Math.cos(p.angle) * p.speed * dt * 2; p.y -= Math.sin(p.angle) * p.speed * dt * 2; p.target = null; }
      p.x = clamp(p.x, 40, CFG.WORLD_W - 40);
      p.y = clamp(p.y, 40, CFG.WORLD_H - 40);
    }
    if (this.peds.length < 26) this.spawnPed(true);
  },

  // The nearest drivable (non-police) car to a point, for stealing.
  nearestCar: function (x, y, maxDist) {
    let best = null, bd = maxDist * maxDist;
    for (const c of this.cars) {
      if (c.model === 7) continue;
      const d = dist2(x, y, c.x, c.y);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  },

  removeCar: function (c) {
    const i = this.cars.indexOf(c);
    if (i >= 0) this.cars.splice(i, 1);
  },
};
