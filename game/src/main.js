// main.js — VELMARA v6: the game itself. State, input, the loop, player
// physics, combat, interactions, the GPS autopilot and saving. Everything
// the other files describe comes together here.
'use strict';

const G = {
  state: 'menu', // menu | playing | paused | phone | shop | choice | gameover | ending
  time: 0,
  clockHour: 9,
  clockMin: 0,
  cash: 250,
  missionIndex: 0,
  branch: null,
  mission: null,
  failedMission: null,
  ending: false,
  overReason: null,
  player: null,
  enemies: [],
  targetCar: null,
  convoyCar: null,
  particles: [],
  race: null,
  shop: null,
  weaponsOwned: ['fists'],
  ammo: {},
  weapon: 'fists',
  upgrades: [],
  stats: { missionsDone: 0, fares: 0, races: 0, coins: 0, carsStolen: 0, earned: 0, bestRace: {} },
  damageFlash: 0,
  autopilot: false,
  mouse: { x: 640, y: 360, down: false },
  gunfireAt: null,
  saveTimer: 0,
};

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

function newPlayer(x, y) {
  return {
    x: x, y: y, angle: -Math.PI / 2, speed: 0, hp: 100,
    onFoot: true, car: null, shootCd: 0, punchCd: 0,
  };
}

function newGame() {
  G.cash = 250;
  G.missionIndex = 0;
  G.branch = null;
  G.mission = null;
  G.failedMission = null;
  G.ending = false;
  G.overReason = null;
  G.player = newPlayer(1350, 1650);
  G.enemies = [];
  G.targetCar = null;
  G.convoyCar = null;
  G.particles = [];
  G.race = null;
  G.shop = null;
  G.weaponsOwned = ['fists'];
  G.ammo = {};
  G.weapon = 'fists';
  G.upgrades = [];
  G.stats = { missionsDone: 0, fares: 0, races: 0, coins: 0, carsStolen: 0, earned: 0, bestRace: {} };
  G.clockHour = 9;
  G.clockMin = 0;
  G.autopilot = false;
  City.coins.forEach(c => { c.taken = false; });
  Police.init();
  Traffic.init();
  Economy.init();
  Traffic.parkedCarNear(1350, 1600); // Riko's first ride, right by the spawn
  Missions.start(G, 0);
  G.state = 'playing';
  HUD.showCard('MISSION 1 — WELCOME TO VELMARA', 'Meet Marisol at her bar in Barrio Sol', 4);
}

function continueGame() {
  G.player = newPlayer(1350, 1650);
  G.enemies = [];
  G.targetCar = null;
  G.convoyCar = null;
  G.particles = [];
  G.race = null;
  G.shop = null;
  G.autopilot = false;
  Police.init();
  Traffic.init();
  Economy.init();
  const had = Economy.load(G);
  if (!had) { newGame(); return; }
  if (G.player) { G.player.hp = 100; G.player.onFoot = true; G.player.car = null; }
  Traffic.parkedCarNear(G.player.x, G.player.y + 60);
  Missions.start(G, G.missionIndex);
  G.state = 'playing';
  HUD.toast('Welcome back to Velmara, Riko.');
}

// ---- input ----
const keys = {};
let mouseDown = false;

window.addEventListener('keydown', (e) => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab', ' '].includes(e.key)) e.preventDefault();
  keys[e.key.toLowerCase()] = true;
  Audio8.init(); Audio8.resume();
  handleKeyPress(e.key.toLowerCase());
});
window.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });
canvas.addEventListener('mousemove', (e) => {
  const r = canvas.getBoundingClientRect();
  G.mouse.x = (e.clientX - r.left) * (canvas.width / r.width);
  G.mouse.y = (e.clientY - r.top) * (canvas.height / r.height);
});
canvas.addEventListener('mousedown', (e) => {
  mouseDown = true;
  Audio8.init(); Audio8.resume();
  if (G.state === 'playing') tryShoot();
});
window.addEventListener('mouseup', () => { mouseDown = false; });
canvas.addEventListener('click', () => { Audio8.init(); Audio8.resume(); });

function handleKeyPress(k) {
  if (G.state === 'menu' && k === 'enter') {
    if (Economy.hasSave()) continueGame(); else newGame();
    return;
  }
  if (G.state === 'gameover' && k === 'enter') { respawnAfterOver(); return; }
  if (G.state === 'ending' && k === 'enter') { G.state = 'playing'; G.ending = false; return; }
  if (G.state === 'playing' && k === 'escape') { G.state = 'paused'; return; }
  if (G.state === 'paused' && k === 'escape') { G.state = 'playing'; return; }
  if (G.state === 'paused' && k === 'r') { continueGame(); return; }
  if ((G.state === 'playing' || G.state === 'phone') && k === 'tab') {
    G.state = G.state === 'phone' ? 'playing' : 'phone';
    return;
  }
  if (G.state === 'phone' && k === 'f') { if (Missions.retryFailed(G)) { G.state = 'playing'; HUD.toast('Mission restarted.'); } return; }
  if (G.state === 'choice' && (k === '1' || k === '2')) { resolveChoice(k === '1' ? 'marisol' : 'broker'); return; }
  if (G.state === 'shop') {
    if (k === 'escape') { G.state = 'playing'; G.shop = null; return; }
    if (k === 'arrowup') { G.shop.sel = (G.shop.sel - 1 + G.shop.items.length) % G.shop.items.length; return; }
    if (k === 'arrowdown') { G.shop.sel = (G.shop.sel + 1) % G.shop.items.length; return; }
    if (k === 'enter') {
      const it = G.shop.items[G.shop.sel];
      if (it) G.shop.msg = it.buy();
      return;
    }
    const n = parseInt(k, 10);
    if (n >= 1 && n <= G.shop.items.length) {
      const it = G.shop.items[n - 1];
      G.shop.sel = n - 1;
      G.shop.msg = it.buy();
    }
    return;
  }
  if (G.state !== 'playing') return;
  if (k === 'e') interact();
  if (k === 'g') { G.autopilot = !G.autopilot; HUD.toast(G.autopilot ? 'GPS autopilot ON — driving to objective' : 'GPS autopilot OFF'); }
  if (k === 'm') { Audio8.setMuted(!Audio8.muted); HUD.toast(Audio8.muted ? 'Sound muted' : 'Sound on'); }
  if (k === '1' || k === '2' || k === '3') { Audio8.setStation(parseInt(k, 10) - 1); HUD.toast('Radio: ' + RADIO[Audio8.station].name); }
  if (k === 'q') cycleWeapon();
  if (k === 'h') Audio8.sfx('honk');
  if (k === 't') startTaxiShift();
  if (k === 'r') startRaceShift();
}

function cycleWeapon() {
  if (G.weaponsOwned.length < 2) return;
  const i = G.weaponsOwned.indexOf(G.weapon);
  G.weapon = G.weaponsOwned[(i + 1) % G.weaponsOwned.length];
  HUD.toast('Weapon: ' + WEAPONS.find(w => w.id === G.weapon).name);
}

function resolveChoice(branch) {
  G.branch = branch;
  const ms = G.mission;
  // Mission 7 completes by choosing; the next mission is the branch one.
  G.cash += 0;
  G.stats.missionsDone++;
  G.mission = null;
  Audio8.sfx('mission');
  const list = Missions.listFor(branch);
  // Mission 7 is index 6 in both lists; the branch mission is index 7.
  Missions.start(G, 7);
  G.state = 'playing';
  HUD.showCard(branch === 'marisol' ? 'MARISOL — HARBOR HEIST' : 'THE BROKER — SILENT PARTNER',
    branch === 'marisol' ? 'The crew hits Portside tonight.' : 'One man, one plaza, no witnesses.', 4);
}

function respawnAfterOver() {
  const fee = G.overReason === 'busted' ? 500 : 300;
  G.cash = Math.max(0, G.cash - fee);
  if (G.overReason === 'busted') { G.weaponsOwned = ['fists']; G.weapon = 'fists'; G.ammo = {}; }
  Police.clearWanted();
  const h = City.places.hospital;
  G.player = newPlayer(h.x, h.y + 80);
  G.player.hp = 100;
  G.enemies = [];
  G.targetCar = null;
  G.convoyCar = null;
  Traffic.parkedCarNear(h.x, h.y + 120);
  if (G.mission) Missions.start(G, G.missionIndex);
  G.state = 'playing';
  HUD.toast(G.overReason === 'busted' ? 'Out on bail. Back to work.' : 'Patched up. Back to work.');
}

function interact() {
  const p = G.player;
  if (!p.onFoot) {
    // Exit the car.
    const side = { x: p.x - Math.sin(p.angle) * 30, y: p.y + Math.cos(p.angle) * 30 };
    if (!City.inBuilding(side.x, side.y, 8)) { p.x = side.x; p.y = side.y; }
    p.onFoot = true;
    p.car = null;
    p.speed = 0;
    Audio8.sfx('door');
    return;
  }
  // On foot: try to enter the nearest car.
  const car = Traffic.nearestCar(p.x, p.y, 70);
  if (car) {
    const wasParked = car.parked;
    Traffic.removeCar(car);
    car.parked = false;
    car.hp = car.hp === undefined ? 100 : car.hp;
    car.speed = 0;
    p.car = car;
    p.onFoot = false;
    p.angle = car.angle;
    p.x = car.x; p.y = car.y;
    G.stats.carsStolen++;
    Audio8.sfx('door');
    if (!wasParked) {
      Police.addWanted(1);
      HUD.toast('Car stolen! The cops saw that.');
    }
    return;
  }
  // Places.
  for (const k in City.places) {
    const pl = City.places[k];
    if (dist2(p.x, p.y, pl.x, pl.y) < 70 * 70) {
      usePlace(pl);
      return;
    }
  }
}

function usePlace(pl) {
  if (pl.kind === 'garage') {
    G.shop = {
      title: 'RICO\u2019S GARAGE', sel: 0, msg: '',
      items: GARAGE_UPGRADES.map(u => ({ name: u.name, price: u.price, desc: u.desc, buy: () => Economy.buyUpgrade(G, u.id) })),
    };
    G.state = 'shop';
  } else if (pl.kind === 'gunshop') {
    G.shop = {
      title: 'AMMO & SONS', sel: 0, msg: 'Q switches weapons. Click to shoot.',
      items: WEAPONS.filter(w => w.id !== 'fists').map(w => ({
        name: w.name + (G.weaponsOwned.includes(w.id) ? ' (owned — ammo $100)' : ''), price: G.weaponsOwned.includes(w.id) ? 100 : w.price,
        desc: 'DMG ' + w.damage, buy: () => Economy.buyWeapon(G, w.id),
      })),
    };
    G.state = 'shop';
  } else if (pl.kind === 'safehouse' || pl.kind === 'safehouse2') {
    HUD.toast(Economy.safehouse(G));
  } else if (pl.kind === 'paynspray') {
    HUD.toast(Economy.paynspray(G));
  } else if (pl.kind === 'hospital') {
    if (G.cash >= 100 && G.player.hp < 100) { G.cash -= 100; G.player.hp = 100; HUD.toast('Patched up for $100.'); }
    else HUD.toast('Velmara General — you feel fine.');
  } else if (pl.kind === 'bar') {
    const list = Missions.listFor(G.branch);
    const next = list[G.missionIndex];
    HUD.toast(next ? 'Marisol: "' + next.title + ' — ' + next.brief + '"' : 'Marisol: "The city is yours, Riko."');
  } else {
    HUD.toast(pl.name + ' — ' + City.districtAt(pl.x, pl.y).desc);
  }
}

function startTaxiShift() {
  if (!G.player.car) { HUD.toast('You need a car to run taxi fares.'); return; }
  if (Economy.taxi) { HUD.toast('Finish the current fare first.'); return; }
  if (Economy.startFare(G)) {
    const t = Economy.taxi;
    HUD.showCard('TAXI FARE — $' + t.fare, 'Pick up the passenger (blue marker). Night fares pay double.', 3);
  }
}

function startRaceShift() {
  if (!G.player.car) { HUD.toast('You need a car to race.'); return; }
  if (G.race) { HUD.toast('Race already running.'); return; }
  const routeI = (G.stats.races % 3);
  const route = Economy.startRace(G, routeI);
  HUD.showCard('STREET RACE — ' + route.name.toUpperCase(), 'Hit every green checkpoint. Winner takes $600.', 3);
}

  // ---- combat ----
  function tryShoot() {
    const p = G.player;
    if (!p.onFoot || p.shootCd > 0) return;
    const w = WEAPONS.find(x => x.id === G.weapon);
    if (w.id !== 'fists') {
      if ((G.ammo[w.id] || 0) <= 0) { HUD.toast('Out of ammo — buy more at Ammo & Sons.'); return; }
      G.ammo[w.id]--;
    }
    p.shootCd = w.rate;
    // Aim from the player toward the mouse, in world space.
    const cam = Render.cam;
    const aimAngle = aimAngleFromMouse();
    p.angle = aimAngle;
    const muzzle = { x: p.x + Math.cos(aimAngle) * 22, y: p.y + Math.sin(aimAngle) * 22 };
    G.particles.push({ x: muzzle.x, y: muzzle.y, z: 24, r: 8, color: '#ffd94a', life: 0.12, maxLife: 0.12 });
    G.gunfireAt = { x: p.x, y: p.y };
    if (w.id === 'fists') {
      // Punch: the nearest enemy in reach.
      let best = null, bd = w.range * w.range;
      for (const e of G.enemies) {
        if (!e.alive) continue;
        const d = dist2(p.x, p.y, e.x, e.y);
        if (d < bd) { bd = d; best = e; }
      }
      if (best) damageEnemy(best, w.damage);
      return;
    }
    Audio8.sfx(w.id === 'shotgun' ? 'shotgun' : 'shoot');
    if (Police.nearestCopDist(p) < 500) Police.addWanted(1);
    // Hit the nearest enemy inside the aim cone and range.
    let best = null, bd = Infinity;
    for (const e of G.enemies) {
      if (!e.alive) continue;
      const d = Math.sqrt(dist2(p.x, p.y, e.x, e.y));
      if (d > w.range) continue;
      const a = Math.atan2(e.y - p.y, e.x - p.x);
      if (Math.abs(angDiff(aimAngle, a)) < 0.3 && d < bd) { bd = d; best = e; }
    }
    if (best) {
      damageEnemy(best, w.damage);
      G.particles.push({ x: best.x, y: best.y, z: 24, r: 7, color: '#ff4040', life: 0.3, maxLife: 0.3 });
    }
    // Shooting the convoy car damages it too.
    if (G.convoyCar && G.convoyCar.hp > 0) {
      const c = G.convoyCar;
      const d = Math.sqrt(dist2(p.x, p.y, c.x, c.y));
      if (d < w.range) {
        const a = Math.atan2(c.y - p.y, c.x - p.x);
        if (Math.abs(angDiff(aimAngle, a)) < 0.3) { c.hp -= w.damage; Audio8.sfx('crash'); }
      }
    }
  }

  function aimAngleFromMouse() {
    // The mouse aims on screen; convert the offset from screen centre to a world angle.
    const p = G.player;
    const dx = G.mouse.x - CFG.VIEW_W / 2;
    const dy = G.mouse.y - CFG.VIEW_H / 2;
    // Camera right vector in world space, from the render camera.
    const cam = Render.cam;
    if (!cam) return p.angle;
    // Screen right = cam right (rx,ry); screen up = -cam up projected to ground.
    const wx = dx * cam.rx + (-dy) * (-cam.fy);
    const wy = dx * cam.ry + (-dy) * (cam.fx);
    // Simpler robust mapping: screen x follows camera right, screen y follows camera forward.
    const fwdX = cam.fx, fwdY = cam.fy;
    const rgtX = cam.rx, rgtY = cam.ry;
    const mx = rgtX * dx + fwdX * (-dy) * 0.8;
    const my = rgtY * dx + fwdY * (-dy) * 0.8;
    return Math.atan2(my, mx);
  }

  function damageEnemy(e, dmg) {
    e.hp -= dmg;
    if (e.hp <= 0 && e.alive) {
      e.alive = false;
      G.cash += 50;
      G.stats.earned += 50;
      if (G.mission) G.mission.kills++;
      G.particles.push({ x: e.x, y: e.y, z: 20, r: 16, color: '#ff8030', life: 0.5, maxLife: 0.5 });
      Audio8.sfx('crash');
    }
  }

  // ---- per-frame update ----
  function update(dt) {
    G.time += dt;
    G.clockMin += dt * 2.4; // a full day lasts 10 minutes
    if (G.clockMin >= 60) { G.clockMin -= 60; G.clockHour = (G.clockHour + 1) % 24; }
    G.damageFlash = Math.max(0, G.damageFlash - dt * 2);
    for (let i = G.particles.length - 1; i >= 0; i--) {
      const pt = G.particles[i];
      pt.life -= dt;
      if (pt.life <= 0) G.particles.splice(i, 1);
    }
    if (G.state === 'menu') {
      // Attract mode: the camera slowly orbits the plaza.
      if (!G.player) G.player = newPlayer(1350, 1350);
      G.player.angle += dt * 0.12;
      G.player.x = 1350; G.player.y = 1350;
      return;
    }
    if (G.state !== 'playing') return;
    const p = G.player;
    p.shootCd = Math.max(0, p.shootCd - dt);
    p.punchCd = Math.max(0, p.punchCd - dt);
    if (mouseDown && G.weapon !== 'fists') tryShoot();

    if (p.onFoot) updateOnFoot(dt);
    else updateDriving(dt);

    // Mission target car / convoy drive their loops.
    updateLoopCar(G.targetCar, dt);
    updateLoopCar(G.convoyCar, dt);
    if (G.convoyCar && p.car && G.convoyCar.hp > 0) {
      const d = Math.sqrt(dist2(p.x, p.y, G.convoyCar.x, G.convoyCar.y));
      if (d < 55 && Math.abs(p.car.speed) > 150) {
        G.convoyCar.hp -= 25;
        p.car.speed *= 0.4;
        Render.shake = 10;
        Audio8.sfx('crash');
        G.particles.push({ x: G.convoyCar.x, y: G.convoyCar.y, z: 20, r: 14, color: '#ff8030', life: 0.4, maxLife: 0.4 });
        if (G.convoyCar.hp <= 0) {
          G.particles.push({ x: G.convoyCar.x, y: G.convoyCar.y, z: 30, r: 30, color: '#ff8030', life: 0.8, maxLife: 0.8 });
          HUD.toast('Convoy car destroyed!');
        }
      }
    }

    Traffic.update(dt, p, G.gunfireAt);
    G.gunfireAt = null;
    Police.update(dt, p, (reason) => { G.overReason = reason; G.state = 'gameover'; Audio8.sfx('busted'); });

    // Enemies hunt the player.
    for (const e of G.enemies) {
      if (!e.alive) continue;
      const d = Math.sqrt(dist2(e.x, e.y, p.x, p.y));
      if (d < 520) {
        const a = Math.atan2(p.y - e.y, p.x - e.x);
        e.angle = a;
        if (d > 60) {
          e.x += Math.cos(a) * e.speed * dt;
          e.y += Math.sin(a) * e.speed * dt;
          City.collideCircle(e, 10);
        }
        e.shootCd -= dt;
        if (d < 320 && e.shootCd <= 0) {
          e.shootCd = 1.6;
          p.hp -= 5 + Math.random() * 4;
          G.damageFlash = 1;
          Audio8.sfx('shoot');
          G.particles.push({ x: e.x + Math.cos(a) * 20, y: e.y + Math.sin(a) * 20, z: 24, r: 6, color: '#ffd94a', life: 0.12, maxLife: 0.12 });
        }
      }
    }

    // Mission state machine.
    if (G.mission) {
      if (G.mission.def.steps[G.mission.step].type === 'choice') G.state = 'choice';
      const res = Missions.update(G, dt);
      if (res === 'complete') {
        const out = Missions.completeMission(G);
        HUD.showCard('MISSION COMPLETE — ' + out.done.title.toUpperCase(), '+$' + out.done.reward + (out.next ? '  ·  Next: ' + out.next.title : '  ·  Story complete!'), 4);
        Economy.save(G);
        if (G.ending) G.state = 'ending';
      } else if (res === 'failed') {
        Missions.failMission(G);
        HUD.showCard('MISSION FAILED', 'Retry from your phone (Tab, then F).', 4);
      } else if (res === 'step') {
        const obj = Missions.currentObjective(G);
        if (obj) HUD.toast(obj.text);
      }
    }

    // Economy: taxi, coins, races.
    const te = Economy.update(G, dt);
    if (te && te.event === 'taxi-pickup') HUD.toast('Passenger aboard — drive to the green marker.');
    if (te && te.event === 'taxi-done') HUD.showCard('FARE COMPLETE', '+$' + te.fare, 2.5);
    const ce = Economy.collectCoins(G);
    if (ce && ce.event === 'all-coins') HUD.showCard('ALL 24 GOLD COINS', 'Bonus +$2000 — you found every one.', 4);
    else if (ce && ce.event === 'coin') HUD.toast('Gold coin! $150  (' + G.stats.coins + '/24)');
    const re = Economy.updateRace(G, dt);
    if (re) HUD.showCard('RACE WON — ' + City.raceRoutes[G.race ? G.race.route : 0].name.toUpperCase(), '+$' + re.prize + ' in ' + re.time.toFixed(1) + 's', 3);

    // Wasted?
    if (p.hp <= 0) {
      G.overReason = 'wasted';
      G.state = 'gameover';
      Audio8.sfx('fail');
    }
    // Car wrecked?
    if (p.car && p.car.hp <= 0) {
      G.particles.push({ x: p.x, y: p.y, z: 24, r: 26, color: '#ff8030', life: 0.8, maxLife: 0.8 });
      Audio8.sfx('crash');
      Render.shake = 14;
      p.car = null;
      p.onFoot = true;
      p.hp -= 15;
      HUD.toast('Your car is wrecked!');
    }

    // Audio follows speed, wanted level and the nearest cop.
    const speedFrac = p.car ? clamp(Math.abs(p.car.speed) / 600, 0, 1) : 0;
    Audio8.update(speedFrac, !p.onFoot, Police.wanted, Police.nearestCopDist(p) < 500, dt);

    // Autosave every 30 seconds.
    G.saveTimer += dt;
    if (G.saveTimer > 30) { G.saveTimer = 0; Economy.save(G); }
    HUD.update(dt);
  }

  function updateLoopCar(c, dt) {
    if (!c || c.hp !== undefined && c.hp <= 0) return;
    const wp = c.loop[c.loopI];
    if (!wp) return;
    const d = Math.sqrt(dist2(c.x, c.y, wp[0], wp[1]));
    if (d < 60) { c.loopI = (c.loopI + 1) % c.loop.length; return; }
    const want = Math.atan2(wp[1] - c.y, wp[0] - c.x);
    c.angle += clamp(angDiff(c.angle, want), -2.2 * dt, 2.2 * dt);
    c.speed = 150;
    c.x += Math.cos(c.angle) * c.speed * dt;
    c.y += Math.sin(c.angle) * c.speed * dt;
  }

  function updateOnFoot(dt) {
    const p = G.player;
    let mx = 0, my = 0;
    if (keys['w'] || keys['arrowup']) my -= 1;
    if (keys['s'] || keys['arrowdown']) my += 1;
    if (keys['a'] || keys['arrowleft']) mx -= 1;
    if (keys['d'] || keys['arrowright']) mx += 1;
    if (G.autopilot) {
      const obj = Missions.currentObjective(G);
      const tx = obj && obj.x !== undefined ? obj.x : (Economy.taxi ? (Economy.taxi.state === 'pickup' ? Economy.taxi.from.x : Economy.taxi.to.x) : null);
      const ty = obj && obj.x !== undefined ? obj.y : (Economy.taxi ? (Economy.taxi.state === 'pickup' ? Economy.taxi.from.y : Economy.taxi.to.y) : null);
      if (tx !== null && tx !== undefined) {
        const d = Math.sqrt(dist2(p.x, p.y, tx, ty));
        if (d > 30) { mx = (tx - p.x) / d; my = (ty - p.y) / d; }
        else G.autopilot = false;
      } else G.autopilot = false;
    }
    const len = Math.hypot(mx, my) || 1;
    const sprint = keys['shift'] ? 1.6 : 1;
    const sp = 230 * sprint;
    p.speed = (mx !== 0 || my !== 0) ? sp : 0;
    if (mx !== 0 || my !== 0) p.angle = Math.atan2(my / len, mx / len);
    p.x += (mx / len) * sp * dt * (mx !== 0 || my !== 0 ? 1 : 0);
    p.y += (my / len) * sp * dt * (mx !== 0 || my !== 0 ? 1 : 0);
    City.collideCircle(p, 12);
    p.x = clamp(p.x, 30, CFG.WORLD_W - 30);
    p.y = clamp(p.y, 30, CFG.WORLD_H - 30);
  }

  function updateDriving(dt) {
    const p = G.player;
    const car = p.car;
    if (!car) { p.onFoot = true; return; }
    const m = CARS[car.model];
    let top = m.top;
    if (G.upgrades.includes('engine2')) top *= 1.3;
    else if (G.upgrades.includes('engine1')) top *= 1.15;
    const accel = m.accel;
    let throttle = 0, steer = 0;
    if (G.autopilot) {
      const obj = Missions.currentObjective(G);
      let tx = null, ty = null;
      if (obj && obj.x !== undefined) { tx = obj.x; ty = obj.y; }
      else if (Economy.taxi) { const t = Economy.taxi; tx = t.state === 'pickup' ? t.from.x : t.to.x; ty = t.state === 'pickup' ? t.from.y : t.to.y; }
      else if (G.race) { const cp = City.raceRoutes[G.race.route].cps[G.race.cp]; if (cp) { tx = cp[0]; ty = cp[1]; } }
      if (tx !== null) {
        const wp = City.nextWaypoint(p.x, p.y, tx, ty);
        const want = Math.atan2(wp.y - p.y, wp.x - p.x);
        const diff = angDiff(p.angle, want);
        steer = clamp(diff * 1.6, -1, 1);
        throttle = Math.abs(diff) > 1.4 ? -0.4 : 1;
        if (Math.sqrt(dist2(p.x, p.y, tx, ty)) < 50) G.autopilot = false;
      } else G.autopilot = false;
    } else {
      if (keys['w'] || keys['arrowup']) throttle = 1;
      if (keys['s'] || keys['arrowdown']) throttle = -0.7;
      if (keys['a'] || keys['arrowleft']) steer = -1;
      if (keys['d'] || keys['arrowright']) steer = 1;
    }
    const handbrake = keys['shift'] || keys[' '];
    // Steering scales with speed, and flips in reverse.
    const spd = car.speed;
    const steerAuthority = clamp(Math.abs(spd) / 140, 0, 1);
    car.angle += steer * m.grip * 0.55 * steerAuthority * dt * (spd >= 0 ? 1 : -1) * (handbrake ? 1.6 : 1);
    car.speed += throttle * accel * dt;
    if (throttle === 0) car.speed -= car.speed * 0.9 * dt;
    if (handbrake) car.speed -= car.speed * 2.2 * dt;
    car.speed = clamp(car.speed, -top * 0.5, top);
    const nx = p.x + Math.cos(car.angle) * car.speed * dt;
    const ny = p.y + Math.sin(car.angle) * car.speed * dt;
    // Collision: front and rear circles against buildings.
    const fx = Math.cos(car.angle), fy = Math.sin(car.angle);
    const front = { x: nx + fx * (m.len / 2 - 6), y: ny + fy * (m.len / 2 - 6) };
    const rear = { x: nx - fx * (m.len / 2 - 6), y: ny - fy * (m.len / 2 - 6) };
    const hitF = City.collideCircle(front, 15);
    const hitR = City.collideCircle(rear, 15);
    if (hitF || hitR) {
      if (Math.abs(car.speed) > 240) {
        car.hp -= 8;
        Render.shake = 8;
        Audio8.sfx('crash');
        G.particles.push({ x: front.x, y: front.y, z: 14, r: 10, color: '#ffb040', life: 0.4, maxLife: 0.4 });
      }
      car.speed *= 0.35;
      p.x = (front.x + rear.x) / 2 - fx * 0;
      p.y = (front.y + rear.y) / 2;
      // Recompute the centre from the pushed circles.
      p.x = (front.x + rear.x) / 2;
      p.y = (front.y + rear.y) / 2;
      car.x = p.x; car.y = p.y;
    } else {
      p.x = nx; p.y = ny;
      car.x = p.x; car.y = p.y;
    }
    car.angle = car.angle % (Math.PI * 2);
    p.angle = car.angle;
    // Bump into traffic cars.
    for (const o of Traffic.cars) {
      if (o === car) continue;
      const d = Math.sqrt(dist2(p.x, p.y, o.x, o.y));
      if (d < 52 && d > 0.1) {
        const push = (52 - d) / 2;
        const ux = (p.x - o.x) / d, uy = (p.y - o.y) / d;
        p.x += ux * push; p.y += uy * push;
        o.x -= ux * push; o.y -= uy * push;
        if (Math.abs(car.speed) > 200) {
          car.hp -= 3;
          if (G.upgrades.includes('armor1')) car.hp += 1.5;
          Audio8.sfx('crash');
          Render.shake = 5;
        }
        car.speed *= 0.7;
      }
    }
    // Bump into police pursuit cars (they also ram us — see police.js).
    for (const c of Police.cops) {
      const d = Math.sqrt(dist2(p.x, p.y, c.x, c.y));
      if (d < 54 && d > 0.1) {
        // Split the overlap: mostly the cop gives way, so a stopped player
        // is boxed in, not bulldozed across the map.
        const overlap = 54 - d;
        const ux = (p.x - c.x) / d, uy = (p.y - c.y) / d;
        p.x += ux * overlap * 0.25; p.y += uy * overlap * 0.25;
        c.x -= ux * overlap * 0.75; c.y -= uy * overlap * 0.75;
        car.speed *= 0.8;
      }
    }
    // Running over a pedestrian: the PD notices if a cop is near.
    for (const pd of Traffic.peds) {
      const d = Math.sqrt(dist2(p.x, p.y, pd.x, pd.y));
      if (d < 26 && Math.abs(car.speed) > 60) {
        pd.flee = 3;
        pd.x += (pd.x - p.x) * 0.5; pd.y += (pd.y - p.y) * 0.5;
        if (Police.nearestCopDist(p) < 500) Police.addWanted(1);
        Render.shake = 4;
        Audio8.sfx('crash');
      }
    }
    p.x = clamp(p.x, 30, CFG.WORLD_W - 30);
    p.y = clamp(p.y, 30, CFG.WORLD_H - 30);
    car.x = p.x; car.y = p.y;
  }

  // ---- the loop ----
  let lastT = 0;
  function frame(t) {
    const dt = clamp((t - lastT) / 1000 || 0.016, 0.001, 0.05);
    lastT = t;
    update(dt);
    ctx.clearRect(0, 0, CFG.VIEW_W, CFG.VIEW_H);
    if (G.state === 'menu') {
      Render.drawWorld(ctx, G);
    } else {
      Render.drawWorld(ctx, G);
    }
    HUD.draw(ctx, G);
    requestAnimationFrame(frame);
  }

  // ---- boot ----
  City.build();
  Police.init();
  Traffic.init();
  Economy.init();
  G.player = newPlayer(1350, 1350);
  requestAnimationFrame(frame);

  // Test and screenshot hooks (used by the CDP driver, not by gameplay).
  window.__velmara = { G: G, newGame: newGame, continueGame: continueGame, Missions: Missions, Police: Police, Economy: Economy, City: City };
