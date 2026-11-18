// missions.js — VELMARA v6: the story. Twelve chained missions in three acts,
// with a real choice in the middle that changes which job you run next.
// Riko Vale arrives in Velmara broke; Marisol gives him work, the Broker
// offers him a shortcut, and the city decides what he becomes.
'use strict';

const MISSIONS = [
  { id: 1, act: 1, title: 'Welcome to Velmara', giver: 'Marisol', reward: 400,
    brief: 'Fresh off the boat and broke. Marisol runs the bar in Barrio Sol — go meet her. She always has work for a driver.',
    steps: [ { type: 'goto', x: 1350, y: 1350, r: 60, text: 'Drive to Marisol\u2019s Bar in Barrio Sol' } ] },
  { id: 2, act: 1, title: 'First Fare', giver: 'Marisol', reward: 300,
    brief: 'A customer waits at Plaza del Sol. Pick them up and drive them to the Marina Docks. Easy money — don\u2019t wreck the cab.',
    steps: [
      { type: 'goto', x: 1350, y: 450, r: 55, text: 'Pick up the passenger at Plaza del Sol' },
      { type: 'deliver', x: 450, y: 450, r: 60, time: 90, text: 'Drive the passenger to the Marina Docks' },
    ] },
  { id: 3, act: 1, title: 'Hot Wheels', giver: 'Marisol', reward: 800,
    brief: 'A Comet GT is parked near Rico\u2019s Garage. Steal it and bring it to the garage — no questions, no scratches if you can help it.',
    steps: [
      { type: 'steal', model: 2, x: 2250, y: 1500, r: 70, text: 'Steal the Comet GT near Rico\u2019s Garage' },
      { type: 'deliver', x: 2250, y: 1650, r: 70, time: 75, text: 'Deliver the Comet GT to Rico\u2019s Garage' },
    ] },
  { id: 4, act: 1, title: 'The Drop', giver: 'Marisol', reward: 1000,
    brief: 'A package at the docks, a buyer at the bank. Seventy-five seconds, no cops, no excuses.',
    steps: [
      { type: 'goto', x: 450, y: 450, r: 55, text: 'Collect the package at the Marina Docks' },
      { type: 'deliver', x: 2850, y: 750, r: 65, time: 75, text: 'Deliver the package to Banco de Velmara' },
    ] },
  { id: 5, act: 2, title: 'Turf War', giver: 'Marisol', reward: 1200,
    brief: 'The Lobo crew is muscling in on the docks. Go to the Marina and clear them out. Bring a gun — the gun shop on the north side sells them.',
    steps: [ { type: 'kill', count: 4, x: 450, y: 450, r: 320, text: 'Clear out 4 Lobo crew at the Marina Docks' } ] },
  { id: 6, act: 2, title: 'The Broker', giver: 'Marisol', reward: 900,
    brief: 'A man in a black Solano has been watching the bar. Tail him — stay close enough to see, far enough not to be seen.',
    steps: [ { type: 'follow', seconds: 30, x: 1350, y: 1350, text: 'Tail the black Solano — stay 60 to 260m back' } ] },
  { id: 7, act: 2, title: 'The Choice', giver: 'The Broker', reward: 0,
    brief: 'The Broker makes his offer: work for him and get rich fast — or stay loyal to Marisol and the neighbourhood. Choose.',
    steps: [ { type: 'choice', text: 'Choose a side: 1 — Marisol, 2 — The Broker' } ] },
  { id: 8, act: 2, title: 'Harbor Heist', giver: 'Marisol', reward: 2000, branch: 'marisol',
    brief: 'Marisol\u2019s crew hits a warehouse in Portside. Grab the crate and get out before the whole PD shows up.',
    steps: [
      { type: 'goto', x: 3150, y: 1650, r: 60, text: 'Reach the Portside warehouse' },
      { type: 'escape', text: 'Lose the cops — get your wanted level to zero' },
    ] },
  { id: 8, act: 2, title: 'Silent Partner', giver: 'The Broker', reward: 2000, branch: 'broker',
    brief: 'The Broker wants one man gone, quietly, at the plaza after dark. Make it clean, then vanish.',
    steps: [
      { type: 'kill', count: 1, x: 1350, y: 450, r: 300, text: 'Take out the Broker\u2019s target at Plaza del Sol' },
      { type: 'escape', text: 'Lose the cops — get your wanted level to zero' },
    ] },
  { id: 9, act: 2, title: 'Loose Ends', giver: 'Marisol', reward: 1500,
    brief: 'A rival convoy is rolling through Portside. Run their lead car off the road — ram it or shoot it until it burns.',
    steps: [ { type: 'destroy', x: 2550, y: 1650, r: 400, text: 'Destroy the rival convoy car in Portside' } ] },
  { id: 10, act: 3, title: 'Payback', giver: 'Marisol', reward: 2000,
    brief: 'The Lobos hit the bar. They are at the bank plaza, six of them, and they are not leaving on their own.',
    steps: [ { type: 'kill', count: 6, x: 2850, y: 750, r: 340, text: 'Clear 6 Lobos from the bank plaza' } ] },
  { id: 11, act: 3, title: 'The Big One', giver: 'The Broker', reward: 5000,
    brief: 'The bank. Sixty seconds inside, five stars outside. Get in, get the money, get to the Sunset Motel alive.',
    steps: [
      { type: 'goto', x: 2850, y: 750, r: 60, text: 'Reach Banco de Velmara' },
      { type: 'timed', seconds: 60, x: 2850, y: 750, text: 'The vault is open — hold on for 60 seconds' },
      { type: 'escape', x: 750, y: 1950, text: 'Escape to the Sunset Motel' },
    ] },
  { id: 12, act: 3, title: 'King of Velmara', giver: 'Marisol', reward: 8000,
    brief: 'One last race through Downtown. Beat the checkpoints, reach the plaza, and the city is yours.',
    steps: [
      { type: 'race', route: 0, text: 'Race the Downtown Dash — hit every checkpoint' },
      { type: 'goto', x: 1350, y: 450, r: 70, text: 'Reach Plaza del Sol — the finish line' },
    ] },
];

const Missions = {
  // Resolve the mission list for a given branch choice (null = both shown).
  listFor: function (branch) {
    return MISSIONS.filter(m => !m.branch || m.branch === branch);
  },

  start: function (G, index) {
    const list = this.listFor(G.branch);
    const m = list[index];
    if (!m) return false;
    G.missionIndex = index;
    G.mission = { def: m, step: 0, timer: 0, kills: 0, followTime: 0, raceCp: 0, data: {} };
    this.setupStep(G);
    return true;
  },

  setupStep: function (G) {
    const ms = G.mission, step = ms.def.steps[ms.step];
    ms.timer = step.time || step.seconds || 0;
    ms.kills = 0; ms.followTime = 0; ms.raceCp = 0;
    G.enemies = [];
    G.targetCar = null;
    G.convoyCar = null;
    if (step.type === 'kill') this.spawnEnemies(G, step.x, step.y, step.count);
    if (step.type === 'follow') {
      G.targetCar = {
        model: 1, x: step.x + 200, y: step.y, angle: 0, speed: 150, cruise: 150,
        vertical: false, color: '#111111', stopped: 0, brakeLight: false, parked: false,
        loop: [[1650, 1350], [1650, 1650], [1050, 1650], [1050, 1350]], loopI: 0,
      };
    }
    if (step.type === 'destroy') {
      G.convoyCar = {
        model: 4, x: step.x, y: step.y, angle: Math.PI / 2, speed: 170, cruise: 170,
        vertical: true, color: '#5a1a1a', stopped: 0, brakeLight: false, parked: false, hp: 120,
        loop: [[2550, 1950], [2550, 1350], [3150, 1350], [3150, 1950]], loopI: 0,
      };
    }
    if (step.type === 'steal') {
      // Park a Comet GT at the marked spot for the player to steal.
      const c = Traffic.parkedCarNear(step.x, step.y);
      c.model = 2; c.color = CARS[2].color;
      ms.data.stealCar = c;
    }
  },

  spawnEnemies: function (G, x, y, n) {
    const rng = mulberry32(CFG.SEED + 500 + G.missionIndex * 13 + n);
    for (let i = 0; i < n; i++) {
      const a = rng() * Math.PI * 2, r = 60 + rng() * 160;
      G.enemies.push({
        x: clamp(x + Math.cos(a) * r, 60, CFG.WORLD_W - 60),
        y: clamp(y + Math.sin(a) * r, 60, CFG.WORLD_H - 60),
        hp: 100, angle: 0, speed: 120 + rng() * 40, shootCd: 1 + rng(),
        color: '#5a1a1a', alive: true,
      });
    }
  },

  currentObjective: function (G) {
    if (!G.mission) return null;
    const step = G.mission.def.steps[G.mission.step];
    return { text: step.text, x: step.x, y: step.y, r: step.r || 60, type: step.type };
  },

  // Advance the mission state machine. Returns 'complete' | 'failed' | 'step' | null.
  update: function (G, dt) {
    if (!G.mission) return null;
    const ms = G.mission, step = ms.def.steps[ms.step];
    const p = G.player;
    const dTo = (x, y) => Math.sqrt(dist2(p.x, p.y, x, y));

    if (step.type === 'goto' || step.type === 'deliver') {
      if (step.time) { ms.timer -= dt; if (ms.timer <= 0) return 'failed'; }
      if (dTo(step.x, step.y) < step.r) return this.advance(G);
    } else if (step.type === 'timed') {
      ms.timer -= dt;
      if (ms.timer <= 0) return this.advance(G);
      // Cops pour in while the vault timer runs.
      if (Police.wanted < 3) Police.addWanted(1, true);
    } else if (step.type === 'kill') {
      if (ms.kills >= step.count) return this.advance(G);
    } else if (step.type === 'follow') {
      const tc = G.targetCar;
      if (!tc) return 'failed';
      const d = dTo(tc.x, tc.y);
      if (d < 60) return 'failed'; // spotted
      if (d < 260) { ms.followTime += dt; if (ms.followTime >= step.seconds) return this.advance(G); }
      else ms.followTime = Math.max(0, ms.followTime - dt * 2);
    } else if (step.type === 'escape') {
      if (Police.wanted === 0) {
        if (step.x) { if (dTo(step.x, step.y) < 70) return this.advance(G); }
        else return this.advance(G);
      }
    } else if (step.type === 'destroy') {
      if (!G.convoyCar || G.convoyCar.hp <= 0) return this.advance(G);
    } else if (step.type === 'race') {
      const route = City.raceRoutes[step.route];
      const cp = route.cps[ms.raceCp];
      if (cp && dTo(cp[0], cp[1]) < 70) {
        ms.raceCp++;
        Audio8.sfx('pickup');
        if (ms.raceCp >= route.cps.length) return this.advance(G);
      }
    } else if (step.type === 'choice') {
      // Choice is resolved by the UI (keys 1/2); the engine waits.
      return null;
    } else if (step.type === 'steal') {
      const c = ms.data.stealCar;
      if (c && p.car === c) return this.advance(G);
    }
    return null;
  },

  advance: function (G) {
    const ms = G.mission;
    ms.step++;
    if (ms.step >= ms.def.steps.length) return 'complete';
    this.setupStep(G);
    Audio8.sfx('pickup');
    return 'step';
  },

  completeMission: function (G) {
    const m = G.mission.def;
    G.cash += m.reward;
    G.stats.missionsDone++;
    G.mission = null;
    Audio8.sfx('mission');
    // Next mission, or the ending.
    const list = this.listFor(G.branch);
    if (G.missionIndex + 1 < list.length) {
      this.start(G, G.missionIndex + 1);
      return { done: m, next: list[G.missionIndex + 1] };
    }
    G.ending = true;
    return { done: m, next: null };
  },

  failMission: function (G) {
    Audio8.sfx('fail');
    G.mission = null;
    // The mission can be retried from the phone (Tab) or by returning to the giver.
    G.failedMission = G.missionIndex;
  },

  retryFailed: function (G) {
    if (G.failedMission === undefined || G.failedMission === null) return false;
    return this.start(G, G.failedMission);
  },
};
