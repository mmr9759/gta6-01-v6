// shots.js — VELMARA v6: deterministic scene staging for the four screenshots
// and for the play-test driver. Each shot puts Riko in a real gameplay
// situation — a chase, a night fare, a shootout, the title screen — using
// only the game's own systems (missions, wanted level, traffic, taxi).
'use strict';

function giveCar(G, model, x, y, angle) {
  const c = {
    model: model, x: x, y: y, angle: angle || 0, speed: 0,
    cruise: 0, vertical: false, color: CARS[model].color,
    stopped: 0, brakeLight: false, parked: false, hp: 100,
  };
  G.player.car = c;
  G.player.onFoot = false;
  G.player.x = x; G.player.y = y;
  G.player.angle = angle || 0;
  return c;
}

function stageShot(n) {
  const G = window.__velmara.G;
  if (n === 1) {
    // COVER — golden-hour chase in Downtown: 3 stars, cruisers closing in,
    // the bank heist (mission 11) live on the HUD.
    window.__velmara.newGame();
    G.clockHour = 17.4; G.clockMin = 24;
    giveCar(G, 2, 2850, 900, -Math.PI / 2); // Comet GT by the bank
    Missions.start(G, 9); // The Big One (index 9 in the no-branch list)
    Police.wanted = 3; Police.heat = 40;
    Police.cops.push(
      { model: 7, x: 2850, y: 1250, angle: -Math.PI / 2, speed: 380, cruise: 480, vertical: true, color: '#1a1a2e', siren: 0, ramCooldown: 0 },
      { model: 7, x: 2550, y: 900, angle: 0, speed: 380, cruise: 480, vertical: false, color: '#1a1a2e', siren: 1, ramCooldown: 0 },
      { model: 7, x: 3150, y: 750, angle: Math.PI, speed: 350, cruise: 480, vertical: false, color: '#1a1a2e', siren: 2, ramCooldown: 0 },
    );
    G.cash = 12450;
    HUD.showCard('MISSION 11 — THE BIG ONE', 'Reach Banco de Velmara — then hold the vault for 60 seconds', 5);
  } else if (n === 2) {
    // NIGHT — beachfront taxi fare on Costa Dorada, neon streets, no heat.
    window.__velmara.newGame();
    G.clockHour = 22.3; G.clockMin = 18;
    giveCar(G, 6, 3150, 2280, Math.PI); // the Taxi on the beachfront road
    G.mission = null;
    Economy.taxi = { from: { x: 3150, y: 2280 }, to: { x: 1950, y: 2280 }, state: 'riding', fare: 240 };
    G.cash = 3280;
    Traffic.parkedCarNear(2850, 2280);
    Traffic.parkedCarNear(2550, 2280);
    HUD.toast('Taxi fare — drive the passenger down the beachfront. Night fares pay double.');
  } else if (n === 3) {
    // DAY — on-foot shootout at the Marina Docks (mission 5, Turf War).
    window.__velmara.newGame();
    G.clockHour = 12; G.clockMin = 5;
    G.player.x = 450; G.player.y = 660;
    G.player.angle = -Math.PI / 2; // face north up the open road toward the docks
    G.player.onFoot = true;
    G.player.car = null;
    G.weaponsOwned = ['fists', 'pistol'];
    G.ammo = { pistol: 96 };
    G.weapon = 'pistol';
    Missions.start(G, 4); // Turf War — 4 rivals spawn around the docks
    G.enemies.forEach(e => { e.shootCd = 6; }); // hold fire while the shot is framed
    Police.wanted = 2; Police.heat = 30;
    Police.footCops.push({ x: 700, y: 620, angle: 0, speed: 200 });
    G.cash = 5410;
    HUD.showCard('MISSION 5 — TURF WAR', 'Clear out 4 Lobo crew at the Marina Docks', 5);
    HUD.card = null; HUD.cardT = 0; // keep the card out of this shot — the player stands where it would be
  } else {
    // TITLE — the start screen over a live sunset city.
    G.state = 'menu';
    G.clockHour = 18.3; G.clockMin = 20;
    G.player.x = 1350; G.player.y = 1350;
    G.player.angle = -Math.PI / 2;
  }
  window.__shotReady = true;
}

// Read ?shot=N (or ?autoplay=1) from the URL as soon as the game boots.
(function () {
  const q = new URLSearchParams(location.search);
  const shot = parseInt(q.get('shot') || '0', 10);
  const autoplay = q.get('autoplay') === '1';
  window.addEventListener('load', () => {
    setTimeout(() => {
      if (shot >= 1 && shot <= 4) stageShot(shot);
      else if (autoplay) window.__velmara.newGame();
      window.__shotReady = true;
    }, 300);
  });
  window.__stageShot = stageShot;
})();
