// police.js — VELMARA v6: the wanted system. Patrols cruise the roads at 0
// stars; crimes raise the heat and the Velmara PD answers — pursuit cars,
// foot cops, roadblocks at 3 stars and a helicopter with a spotlight at 4.
'use strict';

const Police = {
  wanted: 0,
  heat: 0,           // 0..100, fills toward the next star
  cops: [],          // {car} pursuit cars
  footCops: [],      // {x,y,angle,speed}
  heli: null,        // {x,y,alt}
  roadblock: null,   // {x,y,angle,cars:[...]}
  decayTimer: 0,
  bustTimer: 0,
  spawnTimer: 0,
  rng: null,

  init: function () {
    this.rng = mulberry32(CFG.SEED + 913);
    this.wanted = 0; this.heat = 0;
    this.cops = []; this.footCops = []; this.heli = null; this.roadblock = null;
    this.decayTimer = 0; this.bustTimer = 0; this.spawnTimer = 0;
  },

  addWanted: function (n, silent) {
    if (this.wanted >= 5) { this.heat = 100; return; }
    this.heat += n * 22;
    while (this.heat >= 100 && this.wanted < 5) { this.heat -= 100; this.wanted++; }
    if (this.wanted > 0 && !silent) this.spawnTimer = 0;
  },

  clearWanted: function () {
    this.wanted = 0; this.heat = 0;
    this.cops = []; this.footCops = []; this.heli = null; this.roadblock = null;
  },

  // How many pursuit cars the current heat can field.
  copQuota: function () {
    return [0, 1, 2, 3, 4, 5][this.wanted];
  },

  update: function (dt, player, onBusted) {
    const rng = this.rng;
    // Heat decays when no cop can see the player (and no helicopter is up).
    let seen = false;
    for (const c of this.cops) if (dist2(c.x, c.y, player.x, player.y) < 500 * 500) seen = true;
    if (this.heli) seen = true;
    if (!seen && this.wanted > 0) {
      this.decayTimer += dt;
      if (this.decayTimer > 7) { this.decayTimer = 0; this.heat -= 25; if (this.heat < 0) { this.heat = 0; this.wanted--; } }
    } else this.decayTimer = 0;

    // Spawn pursuit cars up to quota, from the map edge nearest the player.
    this.spawnTimer -= dt;
    if (this.wanted > 0 && this.cops.length < this.copQuota() && this.spawnTimer <= 0) {
      this.spawnTimer = 1.2;
      const a = rng() * Math.PI * 2;
      const rp = City.nearestRoadPoint(player.x + Math.cos(a) * 700, player.y + Math.sin(a) * 700);
      this.cops.push({
        model: 7, x: clamp(rp.x, 60, CFG.WORLD_W - 60), y: clamp(rp.y, 60, CFG.WORLD_H - 60),
        angle: Math.atan2(player.y - rp.y, player.x - rp.x),
        speed: 0, cruise: 420 + this.wanted * 30, vertical: rp.axis === 'v',
        color: '#1a1a2e', siren: rng() * 10, ramCooldown: 0,
      });
    }
    // Foot cops join the chase at 1-2 stars when the player is on foot.
    if (this.wanted > 0 && this.wanted <= 2 && player.onFoot && this.footCops.length < 3 && rng() < dt * 0.5) {
      const a = rng() * Math.PI * 2;
      this.footCops.push({ x: player.x + Math.cos(a) * 320, y: player.y + Math.sin(a) * 320, angle: 0, speed: 200 });
    }

    // Pursuit cars: chase along the road graph, then ram when close.
    for (let i = this.cops.length - 1; i >= 0; i--) {
      const c = this.cops[i];
      const d = Math.sqrt(dist2(c.x, c.y, player.x, player.y));
      c.siren += dt;
      let tx = player.x, ty = player.y;
      if (d > 180) {
        // Drive the graph toward the player's road point.
        const wp = City.nextWaypoint(c.x, c.y, player.x, player.y);
        tx = wp.x; ty = wp.y;
      }
      const want = Math.atan2(ty - c.y, tx - c.x);
      c.angle += clamp(angDiff(c.angle, want), -2.6 * dt, 2.6 * dt);
      // Close in fast, then stop and box the player in — never bulldoze them.
      const target = d < 80 ? 0 : d > 260 ? c.cruise : c.cruise * 0.85;
      c.speed += clamp(target - c.speed, -420 * dt, 300 * dt);
      c.x += Math.cos(c.angle) * c.speed * dt;
      c.y += Math.sin(c.angle) * c.speed * dt;
      City.collideCircle(c, 16);
      c.ramCooldown -= dt;
      // Ram the player: damage + a jolt, but never shove the car across the map.
      if (player.car && d < 52 && c.ramCooldown <= 0) {
        c.ramCooldown = 0.8;
        player.car.hp -= 6;
        Render.shake = 6;
        Audio8.sfx('crash');
      }
      if (d > 1500) this.cops.splice(i, 1); // lost the trail, despawn
    }

    // Foot cops run the player down on foot.
    for (let i = this.footCops.length - 1; i >= 0; i--) {
      const f = this.footCops[i];
      const d = Math.sqrt(dist2(f.x, f.y, player.x, player.y));
      const a = Math.atan2(player.y - f.y, player.x - f.x);
      f.angle = a;
      f.x += Math.cos(a) * f.speed * dt;
      f.y += Math.sin(a) * f.speed * dt;
      City.collideCircle(f, 10);
      if (d > 900 || this.wanted === 0) this.footCops.splice(i, 1);
      // Busted: a foot cop catches the player standing still on foot.
      if (player.onFoot && d < 24) {
        this.bustTimer += dt;
        if (this.bustTimer > 1.6 && onBusted) onBusted('busted');
      }
    }
    if (!player.onFoot) this.bustTimer = 0;

    // Roadblock at 3+ stars: two cruisers parked across the road ahead.
    if (this.wanted >= 3 && !this.roadblock && rng() < dt * 0.25) {
      const ahead = { x: player.x + Math.cos(player.angle || 0) * 520, y: player.y + Math.sin(player.angle || 0) * 520 };
      const rp = City.nearestRoadPoint(ahead.x, ahead.y);
      if (rp) {
        this.roadblock = {
          x: rp.x, y: rp.y, angle: rp.axis === 'v' ? 0 : Math.PI / 2,
          ttl: 25, cars: [
            { model: 7, x: rp.x - 30, y: rp.y, angle: rp.axis === 'v' ? 0 : Math.PI / 2, speed: 0, cruise: 0, vertical: false, color: '#1a1a2e', siren: 0, ramCooldown: 0 },
            { model: 7, x: rp.x + 30, y: rp.y, angle: rp.axis === 'v' ? 0 : Math.PI / 2, speed: 0, cruise: 0, vertical: false, color: '#1a1a2e', siren: 0, ramCooldown: 0 },
          ],
        };
      }
    }
    if (this.roadblock) {
      this.roadblock.ttl -= dt;
      if (this.roadblock.ttl <= 0 || this.wanted < 3) this.roadblock = null;
    }

    // Helicopter at 4+ stars: hovers over the player, spotlight at night.
    if (this.wanted >= 4 && !this.heli) {
      this.heli = { x: player.x, y: player.y, alt: 260, rotor: 0 };
    }
    if (this.heli) {
      this.heli.rotor += dt * 22;
      this.heli.x = lerp(this.heli.x, player.x, dt * 1.4);
      this.heli.y = lerp(this.heli.y, player.y - 60, dt * 1.4);
      if (this.wanted < 4) this.heli = null;
    }
  },

  nearestCopDist: function (player) {
    let bd = Infinity;
    for (const c of this.cops) bd = Math.min(bd, dist2(c.x, c.y, player.x, player.y));
    for (const f of this.footCops) bd = Math.min(bd, dist2(f.x, f.y, player.x, player.y));
    return Math.sqrt(bd);
  },
};
