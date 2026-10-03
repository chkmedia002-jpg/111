'use strict';
// ===== 基本常數 =====
const TW = 40, TH = 20;            // 等角磚塊尺寸(低解析度像素)
const HW = TW / 2, HH = TH / 2;
const MAP_W = 64, MAP_H = 64;
const SCALE = 2;                   // 低解析度畫面放大倍率 → 像素風
const BUILD_RADIUS = 5;            // 建築需距離己方建築幾格內
const START_CREDITS = 5000;

// ===== 陣營 =====
const FACTIONS = {
  ac: {
    name: '大西洋聯盟', en: 'Atlantic Coalition',
    color: '#2f7fff', beam: '#ff3048',
    desc: '高能雷射武器與精密電子戰。單位精準、射速快,但裝甲較薄。'
  },
  ep: {
    name: '歐亞協約', en: 'Eurasian Pact',
    color: '#e0392b', beam: '#9fe3ff',
    desc: '電磁軌道砲與重裝甲。單位厚重、火力強大,但速度較慢。'
  }
};

// ===== 彈頭 vs 裝甲倍率 =====
const WARHEADS = {
  ap:    { inf: 1.0, light: 0.55, heavy: 0.25, bld: 0.25 },
  at:    { inf: 0.3, light: 0.9,  heavy: 1.0,  bld: 0.6 },
  laser: { inf: 0.8, light: 1.0,  heavy: 0.85, bld: 0.6 },
  rail:  { inf: 0.6, light: 1.0,  heavy: 1.0,  bld: 0.8 },
  siege: { inf: 0.6, light: 0.8,  heavy: 0.8,  bld: 1.5 }
};

// ===== 武器 =====
// kind: bullet(曳光彈) / shell(砲彈) / missile(飛彈) / laser(雷射) / rail(電磁砲)
const WEAPONS = {
  pulseRifle:  { kind: 'bullet',  dmg: 16,  range: 4.2, rof: 0.9, wh: 'ap',    snd: 'gun',    color: '#aef' },
  assaultRifle:{ kind: 'bullet',  dmg: 17,  range: 4.0, rof: 0.9, wh: 'ap',    snd: 'gun',    color: '#ffd27a' },
  laserRifle:  { kind: 'laser',   dmg: 40,  range: 5.0, rof: 1.8, wh: 'laser', snd: 'laserS', width: 1 },
  rocket:      { kind: 'missile', dmg: 55,  range: 5.5, rof: 2.2, wh: 'at',    snd: 'rocket', speed: 8 },
  pulseGun:    { kind: 'bullet',  dmg: 14,  range: 5.0, rof: 0.45, wh: 'ap',   snd: 'gun',    color: '#aef' },
  autocannon:  { kind: 'bullet',  dmg: 22,  range: 5.0, rof: 0.7, wh: 'ap',    snd: 'cannonS',color: '#ffcf6a' },
  heliosLaser: { kind: 'laser',   dmg: 62,  range: 5.5, rof: 1.7, wh: 'laser', snd: 'laser',  width: 2 },
  cannon125:   { kind: 'shell',   dmg: 85,  range: 5.2, rof: 2.2, wh: 'at',    snd: 'cannon', speed: 14, splash: 0.6 },
  solarLance:  { kind: 'laser',   dmg: 150, range: 8.5, rof: 3.6, wh: 'siege', snd: 'laserB', width: 3, splash: 0.9 },
  railgun:     { kind: 'rail',    dmg: 160, range: 8.5, rof: 3.8, wh: 'siege', snd: 'rail',   splash: 0.5 },
  laserTurret: { kind: 'laser',   dmg: 60,  range: 7.0, rof: 1.3, wh: 'laser', snd: 'laser',  width: 2 },
  railTurret:  { kind: 'rail',    dmg: 100, range: 7.0, rof: 2.4, wh: 'rail',  snd: 'rail' }
};

// ===== 單位 =====
// cat: inf 步兵 / veh 載具
const UNITS = {
  harvester: { name: '稀土採集車', faction: null, cat: 'veh', cost: 1200, hp: 900, armor: 'heavy', speed: 1.5, sight: 4,
    weapon: null, req: ['refinery'], harvester: true, look: { kind: 'harv', L: 1.0, W: 0.7, H: 7 },
    desc: '自動採集稀土礦並運回精煉廠。' },

  ac_inf: { name: '脈衝步兵', faction: 'ac', cat: 'inf', cost: 150, hp: 100, armor: 'inf', speed: 1.25, sight: 5,
    weapon: 'pulseRifle', req: ['barracks'], look: { kind: 'inf', gun: 'rifle' }, desc: '標準步兵,擅長對付步兵。' },
  ac_laser: { name: '雷射突擊兵', faction: 'ac', cat: 'inf', cost: 350, hp: 110, armor: 'inf', speed: 1.2, sight: 5,
    weapon: 'laserRifle', req: ['barracks'], look: { kind: 'inf', gun: 'laser' }, desc: '攜帶攜行式雷射,可對付載具。' },
  ac_light: { name: '獵鷹偵察車', faction: 'ac', cat: 'veh', cost: 600, hp: 320, armor: 'light', speed: 3.2, sight: 7,
    weapon: 'pulseGun', req: ['factory'], look: { kind: 'veh', L: 0.75, W: 0.5, H: 4, tur: 'mg', wheels: true }, desc: '高速偵察車,克制步兵。' },
  ac_tank: { name: '赫利俄斯雷射戰車', faction: 'ac', cat: 'veh', cost: 950, hp: 560, armor: 'heavy', speed: 2.0, sight: 6,
    weapon: 'heliosLaser', req: ['factory'], look: { kind: 'veh', L: 0.95, W: 0.65, H: 5, tur: 'laser' }, desc: '主力戰車,搭載高能雷射砲。' },
  ac_art: { name: '日冕光束砲車', faction: 'ac', cat: 'veh', cost: 1600, hp: 420, armor: 'light', speed: 1.5, sight: 8,
    weapon: 'solarLance', req: ['factory', 'tech'], look: { kind: 'veh', L: 1.05, W: 0.65, H: 5, tur: 'lance' }, desc: '超遠程聚焦光束,摧毀建築的利器。' },

  ep_inf: { name: '突擊步兵', faction: 'ep', cat: 'inf', cost: 150, hp: 110, armor: 'inf', speed: 1.2, sight: 5,
    weapon: 'assaultRifle', req: ['barracks'], look: { kind: 'inf', gun: 'rifle' }, desc: '標準步兵,擅長對付步兵。' },
  ep_rocket: { name: '反坦克火箭兵', faction: 'ep', cat: 'inf', cost: 300, hp: 100, armor: 'inf', speed: 1.1, sight: 5,
    weapon: 'rocket', req: ['barracks'], look: { kind: 'inf', gun: 'rocket' }, desc: '肩扛式導引飛彈,反裝甲專家。' },
  ep_light: { name: '狼獾突擊車', faction: 'ep', cat: 'veh', cost: 650, hp: 380, armor: 'light', speed: 2.8, sight: 6,
    weapon: 'autocannon', req: ['factory'], look: { kind: 'veh', L: 0.8, W: 0.55, H: 5, tur: 'mg', wheels: true }, desc: '裝甲突擊車,搭載30mm機砲。' },
  ep_tank: { name: '雷神重型戰車', faction: 'ep', cat: 'veh', cost: 1100, hp: 780, armor: 'heavy', speed: 1.6, sight: 6,
    weapon: 'cannon125', req: ['factory'], look: { kind: 'veh', L: 1.05, W: 0.75, H: 6, tur: 'cannon' }, desc: '重型主戰車,125mm主砲。' },
  ep_art: { name: '電磁軌道砲車', faction: 'ep', cat: 'veh', cost: 1700, hp: 450, armor: 'light', speed: 1.4, sight: 8,
    weapon: 'railgun', req: ['factory', 'tech'], look: { kind: 'veh', L: 1.1, W: 0.65, H: 5, tur: 'rail' }, desc: '超音速電磁彈丸,射程極遠。' }
};

// ===== 建築 =====
// cat: bld 建築 / def 防禦
const BUILDINGS = {
  conyard:  { name: '建造中心', faction: null, cat: 'bld', w: 3, h: 3, hp: 2200, power: 20, cost: 3000, sight: 7, buildable: false, req: [] },
  power:    { name: '聚變電廠', faction: null, cat: 'bld', w: 2, h: 2, hp: 750, power: 100, cost: 600, sight: 4, req: [],
    desc: '小型核聚變反應爐,提供 100 電力。' },
  refinery: { name: '稀土精煉廠', faction: null, cat: 'bld', w: 3, h: 3, hp: 1100, power: -30, cost: 1800, sight: 5, req: ['power'],
    freeUnit: 'harvester', desc: '處理稀土礦。附贈一輛採集車。' },
  barracks: { name: '兵營', faction: null, cat: 'bld', w: 2, h: 2, hp: 800, power: -15, cost: 500, sight: 5, req: ['power'],
    desc: '訓練步兵。' },
  factory:  { name: '戰車工廠', faction: null, cat: 'bld', w: 3, h: 3, hp: 1300, power: -40, cost: 2000, sight: 5, req: ['refinery'],
    desc: '生產各式載具。' },
  tech:     { name: '先進科技中心', faction: null, cat: 'bld', w: 2, h: 2, hp: 900, power: -80, cost: 2000, sight: 6, req: ['factory', 'barracks'],
    desc: '解鎖先進武器。' },
  ac_turret:{ name: '雷射防禦塔', faction: 'ac', cat: 'def', w: 1, h: 1, hp: 750, power: -40, cost: 900, sight: 7, req: ['barracks'],
    weapon: 'laserTurret', desc: '高射速雷射塔,需要電力。' },
  ep_turret:{ name: '電磁砲塔', faction: 'ep', cat: 'def', w: 1, h: 1, hp: 850, power: -40, cost: 900, sight: 7, req: ['barracks'],
    weapon: 'railTurret', desc: '穿甲電磁砲塔,需要電力。' }
};

const CATS = ['bld', 'def', 'inf', 'veh'];
const CAT_NAMES = { bld: '建築', def: '防禦', inf: '步兵', veh: '載具' };

function getDef(type) { return UNITS[type] || BUILDINGS[type]; }
function isBuildingType(type) { return !!BUILDINGS[type]; }

// 建造時間(秒)
function buildTime(type) {
  const d = getDef(type);
  return Math.max(4, d.cost / (isBuildingType(type) ? 140 : 110));
}

// ===== 小工具 =====
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }
function angDiff(a, b) { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; }
function rotateTo(a, b, step) { const d = angDiff(a, b); return Math.abs(d) <= step ? b : a + Math.sign(d) * step; }

const _shadeCache = new Map();
function shade(hex, f) {
  const key = hex + f;
  let v = _shadeCache.get(key);
  if (v) return v;
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const n = parseInt(h, 16);
  const r = clamp(Math.round(((n >> 16) & 255) * f), 0, 255);
  const g = clamp(Math.round(((n >> 8) & 255) * f), 0, 255);
  const b = clamp(Math.round((n & 255) * f), 0, 255);
  v = `rgb(${r},${g},${b})`;
  _shadeCache.set(key, v);
  return v;
}
