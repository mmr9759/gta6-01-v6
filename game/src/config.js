// config.js — VELMARA v6: every tunable number, district, car and weapon in one place.
// The city of Velmara is original: its districts, people and cars are invented here.
'use strict';

const CFG = {
  WORLD_W: 3600,
  WORLD_H: 2600,
  ROAD_STEP: 300,
  ROAD_W: 84,
  BLOCK: 216,
  SEED: 20261118,
  VIEW_W: 1280,
  VIEW_H: 720,
  FOV_DEG: 72,
  CAM_DIST_CAR: 330,
  CAM_DIST_FOOT: 210,
  CAM_HEIGHT_CAR: 215,
  CAM_HEIGHT_FOOT: 150,
  DRAW_DIST: 1150,
  GRAVITY: 0,
  SAVE_KEY: 'velmara-v6-save',
};

// Seven districts, each with its own palette, building style and mood.
const DISTRICTS = [
  { id: 0, name: 'Costa Dorada', x0: 0,    y0: 2250, x1: 3600, y1: 2600, ground: '#c9a86a', block: '#d8c08a', wall: '#e8d9b0', roof: '#c96f4a', style: 'beach',   desc: 'Beachfront, hotels and the boardwalk' },
  { id: 1, name: 'Marina Bay',   x0: 0,    y0: 0,    x1: 900,  y1: 900,  ground: '#7d8f7a', block: '#8fa08c', wall: '#b8c4c9', roof: '#4a7d8c', style: 'marina',  desc: 'Docks, warehouses and the fish market' },
  { id: 2, name: 'Old Town',     x0: 900,  y0: 0,    x1: 1800, y1: 900,  ground: '#8a7a5e', block: '#a08a68', wall: '#d9b48a', roof: '#a8543a', style: 'old',     desc: 'Cobbled lanes, cafes and the plaza' },
  { id: 3, name: 'Downtown',     x0: 1800, y0: 0,    x1: 3600, y1: 1200, ground: '#6e6e78', block: '#7d7d88', wall: '#9aa3b5', roof: '#3d4a63', style: 'towers',  desc: 'Glass towers, the bank and city hall' },
  { id: 4, name: 'Barrio Sol',   x0: 900,  y0: 900,  x1: 1800, y1: 1800, ground: '#96805c', block: '#ab9668', wall: '#e0a878', roof: '#b8542e', style: 'barrio',  desc: 'Murals, markets and Marisol\u2019s bar' },
  { id: 5, name: 'University',   x0: 0,    y0: 900,  x1: 900,  y1: 2250, ground: '#6f8563', block: '#7f9873', wall: '#c9b48a', roof: '#5a6e4a', style: 'campus',  desc: 'Green quads, dorms and the library' },
  { id: 6, name: 'Portside',     x0: 1800, y0: 1200, x1: 3600, y1: 2250, ground: '#5e5e66', block: '#6e6e76', wall: '#8a8f9a', roof: '#54423a', style: 'industrial', desc: 'Container yards, garages and the depot' },
];

// Eight drivable car models. Prices are what a stolen one fences for.
const CARS = [
  { id: 0, name: 'Pico',      len: 52, wid: 26, accel: 380, top: 330, grip: 2.6, color: '#d8d8d8', fence: 120 },
  { id: 1, name: 'Solano',    len: 58, wid: 28, accel: 420, top: 380, grip: 2.8, color: '#4a6fa5', fence: 220 },
  { id: 2, name: 'Comet GT',  len: 56, wid: 28, accel: 560, top: 520, grip: 3.4, color: '#e04040', fence: 900 },
  { id: 3, name: 'Vagabond',  len: 66, wid: 30, accel: 340, top: 300, grip: 2.2, color: '#7a6a4a', fence: 180 },
  { id: 4, name: 'Lobo',      len: 64, wid: 30, accel: 460, top: 400, grip: 2.6, color: '#3a5a3a', fence: 350 },
  { id: 5, name: 'Falcon',    len: 54, wid: 27, accel: 640, top: 600, grip: 3.8, color: '#f2c230', fence: 1500 },
  { id: 6, name: 'Taxi',      len: 58, wid: 28, accel: 420, top: 380, grip: 2.8, color: '#f2b705', fence: 150 },
  { id: 7, name: 'Cruiser',   len: 60, wid: 29, accel: 520, top: 470, grip: 3.2, color: '#1a1a2e', fence: 0 },
];

const WEAPONS = [
  { id: 'fists',  name: 'Fists',   price: 0,    damage: 25, range: 34,  rate: 0.35, ammo: Infinity, color: '#c9a186' },
  { id: 'pistol', name: 'P9 Pistol', price: 500,  damage: 34, range: 420, rate: 0.28, ammo: 120, color: '#3a3a3a' },
  { id: 'smg',    name: 'VK-9 SMG',  price: 1500, damage: 22, range: 380, rate: 0.09, ammo: 240, color: '#2e4a2e' },
  { id: 'shotgun',name: 'Boomstick', price: 1200, damage: 90, range: 220, rate: 0.85, ammo: 40,  color: '#6a3a1a' },
];

const GARAGE_UPGRADES = [
  { id: 'engine1', name: 'Stage 1 Engine', price: 800,  desc: '+15% top speed' },
  { id: 'engine2', name: 'Stage 2 Engine', price: 1800, desc: '+30% top speed', needs: 'engine1' },
  { id: 'armor1',  name: 'Armour Plating', price: 1000, desc: 'Car takes half damage' },
  { id: 'paint',   name: 'Gold Paint Job', price: 400,  desc: 'Fresh coat, fresh start' },
  { id: 'repair',  name: 'Full Repair',    price: 250,  desc: 'Restore car to mint' },
];

// Three radio stations, all synthesized live with WebAudio — no audio files.
const RADIO = [
  { id: 0, name: 'SOL FM 88.4',  genre: 'Synthwave', bpm: 112, root: 55.0,  minor: true },
  { id: 1, name: 'MAR FM 101.2', genre: 'Latin Heat', bpm: 96,  root: 65.41, minor: false },
  { id: 2, name: 'VELMARA TALK', genre: 'Talk & News', bpm: 0, root: 0, minor: false },
];

const CONTROLS_TEXT = [
  'W A S D / Arrows — walk & drive',
  'E — enter / exit car, talk, use places',
  'Mouse — aim, Click — shoot',
  'Shift — sprint / handbrake',
  'G — GPS autopilot to objective',
  '1 2 3 — radio station, M — mute',
  'Tab — phone (missions, stats)',
  'Esc — pause, H — honk',
];

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
function lerp(a, b, t) { return a + (b - a) * t; }
function dist2(ax, ay, bx, by) { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; }
function angDiff(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}
function shade(hex, f) {
  // Accepts '#rrggbb' or 'rgb(r,g,b)' (buildings store the latter after tinting).
  let r, g, b;
  if (hex[0] === '#') {
    const n = parseInt(hex.slice(1), 16);
    r = (n >> 16) & 255; g = (n >> 8) & 255; b = n & 255;
  } else {
    const m = /(\d+)[,\s]+(\d+)[,\s]+(\d+)/.exec(hex) || [0, 0, 0, 0];
    r = +m[1] || 0; g = +m[2] || 0; b = +m[3] || 0;
  }
  r = clamp(Math.round(r * f), 0, 255);
  g = clamp(Math.round(g * f), 0, 255);
  b = clamp(Math.round(b * f), 0, 255);
  return 'rgb(' + r + ',' + g + ',' + b + ')';
}
