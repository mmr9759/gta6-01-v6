// hud.js — VELMARA v6: everything drawn flat on top of the 3D view — the
// HUD, the minimap, the start screen, the phone, shop menus, mission cards
// and the busted / wasted / ending screens.
'use strict';

const HUD = {
  message: null,
  messageT: 0,
  card: null,
  cardT: 0,

  toast: function (text, dur) {
    this.message = text;
    this.messageT = dur || 3.5;
  },

  showCard: function (title, sub, dur) {
    this.card = { title: title, sub: sub || '' };
    this.cardT = dur || 3;
  },

  update: function (dt) {
    if (this.messageT > 0) this.messageT -= dt;
    if (this.cardT > 0) this.cardT -= dt;
  },

  draw: function (ctx, G) {
    const W = CFG.VIEW_W, H = CFG.VIEW_H;
    if (G.state === 'menu') { this.drawMenu(ctx, G); return; }
    if (G.state === 'gameover') { this.drawGameOver(ctx, G); return; }
    if (G.state === 'ending') { this.drawEnding(ctx, G); return; }
    this.drawHud(ctx, G);
    this.drawMinimap(ctx, G);
    if (G.state === 'paused') this.drawPaused(ctx, G);
    if (G.state === 'phone') this.drawPhone(ctx, G);
    if (G.state === 'shop') this.drawShop(ctx, G);
    if (G.state === 'choice') this.drawChoice(ctx, G);
    if (this.cardT > 0 && this.card) {
      const a = clamp(this.cardT, 0, 1);
      ctx.globalAlpha = a;
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(W / 2 - 320, 120, 640, 92);
      ctx.strokeStyle = '#ffc828'; ctx.lineWidth = 2;
      ctx.strokeRect(W / 2 - 320, 120, 640, 92);
      ctx.fillStyle = '#ffc828';
      ctx.font = 'bold 30px system-ui, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(this.card.title, W / 2, 158);
      ctx.fillStyle = '#fff';
      ctx.font = '18px system-ui, sans-serif';
      ctx.fillText(this.card.sub, W / 2, 190);
      ctx.globalAlpha = 1;
    }
    if (this.messageT > 0 && this.message) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      const tw = ctx.measureText(this.message).width + 30;
      ctx.fillRect(W / 2 - tw / 2, H - 108, tw, 30);
      ctx.fillStyle = '#fff';
      ctx.font = '16px system-ui, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(this.message, W / 2, H - 87);
    }
  },

  drawHud: function (ctx, G) {
    const W = CFG.VIEW_W, p = G.player;
    // Top-left: cash, health, armour.
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(14, 14, 250, 74);
    ctx.fillStyle = '#37e08a';
    ctx.font = 'bold 24px system-ui, sans-serif'; ctx.textAlign = 'left';
    ctx.fillText('$' + Math.floor(G.cash).toLocaleString('en-US'), 26, 42);
    ctx.fillStyle = '#fff';
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillText('RIKO VALE', 26, 62);
    ctx.fillStyle = '#333';
    ctx.fillRect(26, 70, 200, 8);
    ctx.fillStyle = p.hp > 40 ? '#37e08a' : '#ff4040';
    ctx.fillRect(26, 70, 200 * clamp(p.hp / 100, 0, 1), 8);
    if (p.car) {
      ctx.fillStyle = '#333';
      ctx.fillRect(26, 82, 200, 5);
      ctx.fillStyle = '#4aa8ff';
      ctx.fillRect(26, 82, 200 * clamp(p.car.hp / 100, 0, 1), 5);
    }
    // Top-right: wanted stars, clock, radio, district.
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(W - 264, 14, 250, 74);
    ctx.textAlign = 'left';
    let stars = '';
    for (let i = 0; i < 5; i++) stars += i < Police.wanted ? '\u2605' : '\u2606';
    ctx.fillStyle = Police.wanted > 0 ? '#ffc828' : '#888';
    ctx.font = 'bold 24px system-ui, sans-serif';
    ctx.fillText(stars, W - 252, 42);
    const hh = Math.floor(G.clockHour), mm = Math.floor(G.clockMin % 60);
    ctx.fillStyle = '#fff';
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillText((hh < 10 ? '0' : '') + hh + ':' + (mm < 10 ? '0' : '') + mm + '  ' + City.districtAt(p.x, p.y).name, W - 252, 66);
    ctx.fillStyle = '#ffc828';
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillText(Audio8.muted ? 'MUTED' : RADIO[Audio8.station].name + ' — ' + RADIO[Audio8.station].genre, W - 252, 84);
    // Bottom-centre: current objective.
    const obj = Missions.currentObjective(G);
    if (obj) {
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      const tw = ctx.measureText(obj.text).width + 40;
      ctx.fillRect(W / 2 - tw / 2, 96, tw, 30);
      ctx.fillStyle = '#ffc828';
      ctx.font = 'bold 15px system-ui, sans-serif';
      const d = Math.round(Math.sqrt(dist2(p.x, p.y, obj.x || p.x, obj.y || p.y)));
      ctx.fillText((obj.x !== undefined ? d + 'm  ' : '') + obj.text, W / 2, 116);
      // Off-screen objective arrow at the screen edge.
      if (obj.x !== undefined) this.drawObjectiveArrow(ctx, G, obj);
    }
    // Bottom-right: speed + weapon + controls hint.
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(W - 210, CFG.VIEW_H - 92, 196, 78);
    const kmh = p.onFoot ? Math.round(p.speed * 0.36) : Math.round((p.car ? Math.abs(p.car.speed) : 0) * 0.55);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 30px system-ui, sans-serif';
    ctx.fillText(kmh + ' km/h', W - 26, CFG.VIEW_H - 52);
    const w = WEAPONS.find(x => x.id === G.weapon);
    ctx.font = '14px system-ui, sans-serif';
    ctx.fillStyle = '#ffc828';
    ctx.fillText(w.name + (G.ammo[G.weapon] !== undefined && G.ammo[G.weapon] !== Infinity ? '  ' + G.ammo[G.weapon] : ''), W - 26, CFG.VIEW_H - 30);
    ctx.fillStyle = '#bbb';
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillText('E enter car · G autopilot · Tab phone · Esc pause', W - 26, CFG.VIEW_H - 16);
    // Compass strip.
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(W / 2 - 110, CFG.VIEW_H - 34, 220, 22);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 13px system-ui, sans-serif';
    const dirs = ['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE'];
    const di = Math.round((((p.angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI / 4)) % 8;
    ctx.fillText(dirs[di] + '  ·  ' + (G.mission ? 'MISSION ' + G.mission.def.id : 'FREE ROAM'), W / 2, CFG.VIEW_H - 18);
  },

  drawObjectiveArrow: function (ctx, G, obj) {
    // Project the objective; if it is behind the camera, point at the edge.
    const cam = Render.cam;
    if (!cam) return;
    const pr = Render.project(cam, obj.x, obj.y, 0);
    const W = CFG.VIEW_W, H = CFG.VIEW_H;
    let x, y, on = false;
    if (pr && pr.x > 40 && pr.x < W - 40 && pr.y > 130 && pr.y < H - 130) { x = pr.x; y = pr.y; on = true; }
    else {
      // Direction on screen from the player heading.
      const dx = obj.x - G.player.x, dy = obj.y - G.player.y;
      const rel = Math.atan2(dy, dx) - G.player.angle;
      const edge = 60;
      x = W / 2 + Math.cos(rel) * (W / 2 - edge);
      y = H / 2 + Math.sin(rel) * (H / 2 - edge);
      x = clamp(x, 40, W - 40); y = clamp(y, 140, H - 40);
    }
    if (on) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.atan2(obj.y - G.player.y, obj.x - G.player.x) - G.player.angle + Math.PI / 2);
    ctx.fillStyle = '#ffc828';
    ctx.beginPath();
    ctx.moveTo(0, -14); ctx.lineTo(10, 10); ctx.lineTo(-10, 10);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  },

  drawMinimap: function (ctx, G) {
    const mw = 220, mh = 160, mx = 14, my = CFG.VIEW_H - mh - 14;
    const sx = mw / CFG.WORLD_W, sy = mh / CFG.WORLD_H;
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(mx - 4, my - 4, mw + 8, mh + 8);
    ctx.fillStyle = '#1d2b1d';
    ctx.fillRect(mx, my, mw, mh);
    // Roads.
    ctx.strokeStyle = '#5a5a60'; ctx.lineWidth = 2;
    for (const rx of City.roadsX) {
      ctx.beginPath(); ctx.moveTo(mx + rx * sx, my); ctx.lineTo(mx + rx * sx, my + mh); ctx.stroke();
    }
    for (const ry of City.roadsY) {
      ctx.beginPath(); ctx.moveTo(mx, my + ry * sy); ctx.lineTo(mx + mw, my + ry * sy); ctx.stroke();
    }
    // Places.
    for (const k in City.places) {
      const pl = City.places[k];
      ctx.fillStyle = '#ffc828';
      ctx.beginPath(); ctx.arc(mx + pl.x * sx, my + pl.y * sy, 3, 0, Math.PI * 2); ctx.fill();
    }
    // Coins left.
    ctx.fillStyle = '#ffd94a';
    for (const c of City.coins) if (!c.taken) ctx.fillRect(mx + c.x * sx - 1, my + c.y * sy - 1, 2, 2);
    // Cops (red), mission marker (yellow diamond), player (white arrow).
    ctx.fillStyle = '#ff4040';
    for (const c of Police.cops) ctx.fillRect(mx + c.x * sx - 2, my + c.y * sy - 2, 4, 4);
    const obj = Missions.currentObjective(G);
    if (obj && obj.x !== undefined) {
      ctx.fillStyle = '#ffc828';
      const ox = mx + obj.x * sx, oy = my + obj.y * sy;
      ctx.beginPath();
      ctx.moveTo(ox, oy - 6); ctx.lineTo(ox + 6, oy); ctx.lineTo(ox, oy + 6); ctx.lineTo(ox - 6, oy);
      ctx.closePath(); ctx.fill();
    }
    const p = G.player;
    ctx.save();
    ctx.translate(mx + p.x * sx, my + p.y * sy);
    ctx.rotate(p.angle);
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(-5, -5); ctx.lineTo(-5, 5); ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = '#ffc828'; ctx.lineWidth = 1;
    ctx.strokeRect(mx - 4, my - 4, mw + 8, mh + 8);
  },

  drawMenu: function (ctx, G) {
    const W = CFG.VIEW_W, H = CFG.VIEW_H;
    ctx.fillStyle = 'rgba(5,8,20,0.45)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffc828';
    ctx.font = 'bold 64px system-ui, sans-serif';
    ctx.fillText('VELMARA', W / 2, 150);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 26px system-ui, sans-serif';
    ctx.fillText('STREETS OF GOLD', W / 2, 186);
    ctx.fillStyle = '#ffd9a0';
    ctx.font = '17px system-ui, sans-serif';
    ctx.fillText('An open-world crime story in the sun-soaked city of Velmara.', W / 2, 224);
    ctx.fillText('Riko Vale arrives broke. Twelve missions, three acts, one choice that changes everything.', W / 2, 248);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(W / 2 - 330, 280, 660, 200);
    ctx.fillStyle = '#fff';
    ctx.font = '15px system-ui, sans-serif';
    CONTROLS_TEXT.forEach((line, i) => ctx.fillText(line, W / 2, 308 + i * 24));
    ctx.fillStyle = '#37e08a';
    ctx.font = 'bold 24px system-ui, sans-serif';
    ctx.fillText(Economy.hasSave() ? 'ENTER — Continue your story' : 'ENTER — New game', W / 2, 530);
    ctx.fillStyle = '#bbb';
    ctx.font = '14px system-ui, sans-serif';
    ctx.fillText('12 missions · 8 cars · 7 districts · wanted 0–5★ · police, roadblocks & helicopter', W / 2, 560);
    ctx.fillText('Taxi fares · gold coins · street races · garage upgrades · gun shop · radio', W / 2, 582);
    ctx.fillStyle = '#888';
    ctx.fillText('Original game — no Rockstar content. Best played with sound on.', W / 2, 620);
  },

  drawPaused: function (ctx, G) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, CFG.VIEW_W, CFG.VIEW_H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 40px system-ui, sans-serif';
    ctx.fillText('PAUSED', CFG.VIEW_W / 2, 300);
    ctx.font = '17px system-ui, sans-serif';
    ctx.fillText('Esc — resume · M — mute · R — restart from save · Tab — phone', CFG.VIEW_W / 2, 340);
  },

  drawPhone: function (ctx, G) {
    const W = CFG.VIEW_W;
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, W, CFG.VIEW_H);
    ctx.fillStyle = '#101828';
    ctx.fillRect(W / 2 - 260, 80, 520, 520);
    ctx.strokeStyle = '#ffc828'; ctx.lineWidth = 2;
    ctx.strokeRect(W / 2 - 260, 80, 520, 520);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffc828';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.fillText('RIKO\u2019S PHONE', W / 2 - 240, 118);
    ctx.fillStyle = '#fff';
    ctx.font = '15px system-ui, sans-serif';
    const list = Missions.listFor(G.branch);
    list.forEach((m, i) => {
      const y = 150 + i * 30;
      const done = i < G.missionIndex || (G.ending && i === list.length - 1);
      const cur = G.mission && G.mission.def === m;
      ctx.fillStyle = done ? '#37e08a' : cur ? '#ffc828' : '#888';
      ctx.fillText((done ? '\u2713 ' : cur ? '\u25B6 ' : '\u25CB ') + m.id + '. ' + m.title + '  —  $' + m.reward, W / 2 - 240, y);
    });
    const y0 = 150 + list.length * 30 + 10;
    ctx.fillStyle = '#fff';
    ctx.fillText('Cash: $' + Math.floor(G.cash), W / 2 - 240, y0);
    ctx.fillText('Missions done: ' + G.stats.missionsDone + '   Fares: ' + G.stats.fares + '   Races: ' + G.stats.races, W / 2 - 240, y0 + 26);
    ctx.fillText('Gold coins: ' + G.stats.coins + '/24   Cars stolen: ' + G.stats.carsStolen, W / 2 - 240, y0 + 52);
    ctx.fillStyle = '#bbb';
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillText('Tab / Esc — close · F — retry failed mission', W / 2 - 240, 580);
  },

  drawShop: function (ctx, G) {
    const W = CFG.VIEW_W;
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(0, 0, W, CFG.VIEW_H);
    ctx.fillStyle = '#101828';
    ctx.fillRect(W / 2 - 280, 110, 560, 420);
    ctx.strokeStyle = '#ffc828'; ctx.lineWidth = 2;
    ctx.strokeRect(W / 2 - 280, 110, 560, 420);
    ctx.textAlign = 'left';
    const shop = G.shop;
    ctx.fillStyle = '#ffc828';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.fillText(shop.title, W / 2 - 260, 148);
    ctx.fillStyle = '#fff';
    ctx.font = '15px system-ui, sans-serif';
    shop.items.forEach((it, i) => {
      const y = 186 + i * 32;
      ctx.fillStyle = i === shop.sel ? '#ffc828' : '#fff';
      ctx.fillText((i === shop.sel ? '\u25B6 ' : '   ') + (i + 1) + '. ' + it.name + ' — $' + it.price + (it.desc ? '  (' + it.desc + ')' : ''), W / 2 - 260, y);
    });
    ctx.fillStyle = '#bbb';
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillText('Cash: $' + Math.floor(G.cash) + '   ·   Up/Down + Enter to buy · Esc to leave', W / 2 - 260, 500);
    if (shop.msg) {
      ctx.fillStyle = '#37e08a';
      ctx.font = '15px system-ui, sans-serif';
      ctx.fillText(shop.msg, W / 2 - 260, 470);
    }
  },

  drawChoice: function (ctx, G) {
    const W = CFG.VIEW_W;
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, W, CFG.VIEW_H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffc828';
    ctx.font = 'bold 34px system-ui, sans-serif';
    ctx.fillText('THE CHOICE', W / 2, 250);
    ctx.fillStyle = '#fff';
    ctx.font = '18px system-ui, sans-serif';
    ctx.fillText('The Broker offers fast money and no questions. Marisol offers loyalty — and the neighbourhood.', W / 2, 292);
    ctx.fillStyle = '#37e08a';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.fillText('1 — Stay with Marisol: Harbor Heist', W / 2, 350);
    ctx.fillStyle = '#ff8080';
    ctx.fillText('2 — Side with the Broker: Silent Partner', W / 2, 392);
    ctx.fillStyle = '#bbb';
    ctx.font = '15px system-ui, sans-serif';
    ctx.fillText('This changes missions 8 and 9. There is no going back.', W / 2, 440);
  },

  drawGameOver: function (ctx, G) {
    ctx.fillStyle = 'rgba(10,0,0,0.75)';
    ctx.fillRect(0, 0, CFG.VIEW_W, CFG.VIEW_H);
    ctx.textAlign = 'center';
    ctx.fillStyle = G.overReason === 'busted' ? '#4aa8ff' : '#ff4040';
    ctx.font = 'bold 64px system-ui, sans-serif';
    ctx.fillText(G.overReason === 'busted' ? 'BUSTED' : 'WASTED', CFG.VIEW_W / 2, 300);
    ctx.fillStyle = '#fff';
    ctx.font = '18px system-ui, sans-serif';
    ctx.fillText(G.overReason === 'busted' ? 'The Velmara PD took you in. $500 bail, weapons confiscated.' : 'You woke up in Velmara General. $300 hospital bill.', CFG.VIEW_W / 2, 344);
    ctx.fillStyle = '#37e08a';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.fillText('ENTER — back on the streets', CFG.VIEW_W / 2, 400);
  },

  drawEnding: function (ctx, G) {
    ctx.fillStyle = 'rgba(5,10,5,0.8)';
    ctx.fillRect(0, 0, CFG.VIEW_W, CFG.VIEW_H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffc828';
    ctx.font = 'bold 52px system-ui, sans-serif';
    ctx.fillText('KING OF VELMARA', CFG.VIEW_W / 2, 260);
    ctx.fillStyle = '#fff';
    ctx.font = '19px system-ui, sans-serif';
    ctx.fillText('Twelve missions. Three acts. One city that is finally yours.', CFG.VIEW_W / 2, 308);
    ctx.fillText('Missions: ' + G.stats.missionsDone + '   Fares: ' + G.stats.fares + '   Coins: ' + G.stats.coins + '/24', CFG.VIEW_W / 2, 344);
    ctx.fillText('Final cash: $' + Math.floor(G.cash), CFG.VIEW_W / 2, 376);
    ctx.fillStyle = '#37e08a';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.fillText('ENTER — keep playing free roam', CFG.VIEW_W / 2, 440);
  },
};
