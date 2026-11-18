// economy.js — VELMARA v6: money and what it buys. Taxi fares, gold coins,
// street races, the gun shop, Rico's garage upgrades, Pay N' Spray, the
// Sunset Motel safehouse — and the save file that remembers all of it.
'use strict';

const Economy = {
  // A taxi passenger: pick them up, drive them to the marker, get paid.
  taxi: null,
  rng: null,

  init: function () {
    this.rng = mulberry32(CFG.SEED + 31);
    this.taxi = null;
  },

  startFare: function (G) {
    if (this.taxi) return false;
    const rng = this.rng;
    const spots = [
      { x: 1350, y: 450 }, { x: 450, y: 450 }, { x: 2850, y: 750 },
      { x: 750, y: 1950 }, { x: 3150, y: 2250 }, { x: 1950, y: 1050 },
    ];
    const from = spots[Math.floor(rng() * spots.length)];
    let to = spots[Math.floor(rng() * spots.length)];
    if (to === from) to = spots[(spots.indexOf(from) + 3) % spots.length];
    const dist = Math.sqrt(dist2(from.x, from.y, to.x, to.y));
    this.taxi = {
      from: from, to: to, state: 'pickup',
      fare: Math.round(60 + dist / 12) * (G.clockHour >= 20 || G.clockHour < 6 ? 2 : 1),
    };
    return true;
  },

  update: function (G, dt) {
    if (!this.taxi) return null;
    const t = this.taxi, p = G.player;
    const d = (x, y) => Math.sqrt(dist2(p.x, p.y, x, y));
    if (t.state === 'pickup' && d(t.from.x, t.from.y) < 55) {
      t.state = 'riding';
      return { event: 'taxi-pickup', fare: t.fare };
    }
    if (t.state === 'riding' && d(t.to.x, t.to.y) < 60) {
      const fare = t.fare;
      G.cash += fare;
      G.stats.fares++;
      G.stats.earned += fare;
      this.taxi = null;
      Audio8.sfx('cash');
      return { event: 'taxi-done', fare: fare };
    }
    return null;
  },

  // Gold coins scattered around the city.
  collectCoins: function (G) {
    let got = 0;
    for (const c of City.coins) {
      if (!c.taken && dist2(G.player.x, G.player.y, c.x, c.y) < 40 * 40) {
        c.taken = true;
        G.cash += 150;
        G.stats.coins++;
        got++;
        Audio8.sfx('coin');
      }
    }
    if (got > 0 && G.stats.coins >= 24) {
      G.cash += 2000; // all coins bonus
      return { event: 'all-coins', bonus: 2000 };
    }
    return got > 0 ? { event: 'coin', n: got } : null;
  },

  // Street race: a timed loop of checkpoints on a route.
  startRace: function (G, routeI) {
    const route = City.raceRoutes[routeI];
    G.race = { route: routeI, cp: 0, time: 0, best: G.stats.bestRace[routeI] || 0 };
    return route;
  },

  updateRace: function (G, dt) {
    if (!G.race) return null;
    const r = G.race, route = City.raceRoutes[r.route];
    r.time += dt;
    const cp = route.cps[r.cp];
    const p = G.player;
    if (cp && dist2(p.x, p.y, cp[0], cp[1]) < 70 * 70) {
      r.cp++;
      Audio8.sfx('pickup');
      if (r.cp >= route.cps.length) {
        const prize = 600;
        G.cash += prize;
        G.stats.races++;
        if (!G.stats.bestRace[r.route] || r.time < G.stats.bestRace[r.route]) G.stats.bestRace[r.route] = r.time;
        const t = r.time;
        G.race = null;
        Audio8.sfx('mission');
        return { event: 'race-won', prize: prize, time: t };
      }
    }
    return null;
  },

  // Shops. Each returns a message string for the HUD, or null if not applicable.
  buyWeapon: function (G, wid) {
    const w = WEAPONS.find(x => x.id === wid);
    if (!w || w.price === 0) return null;
    if (G.weaponsOwned.includes(wid)) {
      if (G.cash < 100) return 'Not enough cash for ammo.';
      G.cash -= 100;
      G.ammo[wid] = (G.ammo[wid] || 0) + w.ammo;
      return 'Ammo restocked: ' + w.name + '.';
    }
    if (G.cash < w.price) return 'Not enough cash for the ' + w.name + '.';
    G.cash -= w.price;
    G.weaponsOwned.push(wid);
    G.ammo[wid] = w.ammo;
    G.weapon = wid;
    Audio8.sfx('cash');
    return 'Bought the ' + w.name + '. Press Q to switch weapons.';
  },

  buyUpgrade: function (G, uid) {
    const u = GARAGE_UPGRADES.find(x => x.id === uid);
    if (!u) return null;
    if (uid === 'repair') {
      if (G.cash < u.price) return 'Not enough cash for repairs.';
      G.cash -= u.price;
      if (G.player.car) G.player.car.hp = 100;
      return 'Car repaired to mint condition.';
    }
    if (G.upgrades.includes(uid)) return 'Already installed.';
    if (u.needs && !G.upgrades.includes(u.needs)) return 'Needs ' + u.needs + ' first.';
    if (G.cash < u.price) return 'Not enough cash for ' + u.name + '.';
    G.cash -= u.price;
    G.upgrades.push(uid);
    Audio8.sfx('cash');
    return u.name + ' installed.';
  },

  paynspray: function (G) {
    if (G.cash < 200) return 'Pay N\u2019 Spray costs $200.';
    G.cash -= 200;
    Police.clearWanted();
    if (G.player.car) { G.player.car.hp = 100; G.player.car.color = CARS[G.player.car.model].color; }
    Audio8.sfx('cash');
    return 'Fresh paint, clean record. Wanted level cleared.';
  },

  safehouse: function (G) {
    G.player.hp = 100;
    this.save(G);
    return 'Saved. You feel rested — health restored.';
  },

  // --- persistence ---
  save: function (G) {
    try {
      const data = {
        cash: G.cash, missionIndex: G.missionIndex, branch: G.branch,
        weaponsOwned: G.weaponsOwned, ammo: G.ammo, weapon: G.weapon,
        upgrades: G.upgrades, stats: G.stats,
        px: G.player.x, py: G.player.y, clockHour: G.clockHour,
        coinsTaken: City.coins.map(c => c.taken),
      };
      localStorage.setItem(CFG.SAVE_KEY, JSON.stringify(data));
      return true;
    } catch (e) { return false; }
  },

  load: function (G) {
    try {
      const raw = localStorage.getItem(CFG.SAVE_KEY);
      if (!raw) return false;
      const d = JSON.parse(raw);
      G.cash = d.cash; G.missionIndex = d.missionIndex; G.branch = d.branch || null;
      G.weaponsOwned = d.weaponsOwned || ['fists'];
      G.ammo = d.ammo || {}; G.weapon = d.weapon || 'fists';
      G.upgrades = d.upgrades || []; G.stats = Object.assign(G.stats, d.stats || {});
      G.player.x = d.px || 1350; G.player.y = d.py || 1500;
      G.clockHour = d.clockHour || 9;
      if (d.coinsTaken) d.coinsTaken.forEach((t, i) => { if (City.coins[i]) City.coins[i].taken = t; });
      return true;
    } catch (e) { return false; }
  },

  hasSave: function () {
    try { return !!localStorage.getItem(CFG.SAVE_KEY); } catch (e) { return false; }
  },
};
