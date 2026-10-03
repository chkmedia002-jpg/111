'use strict';
// ===== 明朝時代(1592 壬辰之役):中、日、韓三陣營 =====
FACTIONS.ac.era = FACTIONS.ep.era = '2050';
Object.assign(FACTIONS, {
  mg: {
    name: '大明', en: 'Great Ming', era: 'ming', color: '#d8382a', beam: '#ff9a30',
    desc: '火器與戚家軍陣法。鳥銃、佛郎機與大將軍砲火力強大,戰車陣穩固難破。',
    units: ['鳥銃手、狼筅長槍兵', '遼東鐵騎、偏廂戰車', '大將軍砲、火龍出水'],
    names: { conyard: '總兵府', power: '糧倉', refinery: '銀礦冶坊', barracks: '校場', factory: '軍器局', tech: '兵部書院', engineer: '工匠', harvester: '運銀牛車' }
  },
  jp: {
    name: '日本', en: 'Toyotomi Japan', era: 'ming', color: '#f0ebdc', beam: '#ff7020',
    desc: '戰國百戰之師。鐵砲足輕齊射,武士近戰無雙,騎馬武者衝鋒迅猛。',
    units: ['鐵砲足輕、武士', '騎馬武者、大筒車', '焙烙投石車、火攻之陣'],
    names: { conyard: '本丸天守', power: '米藏', refinery: '銀山吹屋', barracks: '足輕長屋', factory: '鍛冶場', tech: '軍學所', engineer: '工匠', harvester: '運銀牛車' }
  },
  kr: {
    name: '朝鮮', en: 'Joseon', era: 'ming', color: '#2f74dc', beam: '#ffb040',
    desc: '弓術冠絕東亞。華車一次齊射百支神機箭,震天雷可轟塌城牆。',
    units: ['弓手、殺手', '騎射手、華車', '震天雷砲、神機箭陣'],
    names: { conyard: '統制營', power: '軍倉', refinery: '銀店', barracks: '訓練院', factory: '軍器寺', tech: '承文院', engineer: '工匠', harvester: '運銀牛車' }
  }
});
FACTIONS.ac.units = ['脈衝步兵、雷射突擊兵', '獵鷹偵察車、赫利俄斯雷射戰車', '日冕光束砲車、天穹軌道雷射'];
FACTIONS.ep.units = ['突擊步兵、反坦克火箭兵', '狼獾突擊車、雷神重型戰車', '電磁軌道砲車、高超音速導彈井'];

const ERAS = {
  '2050': {
    name: '2050 稀土戰爭', title: '鋼鐵黎明 <span>2050</span>', factions: ['ac', 'ep'], players: 2,
    power: '電力', ore: '稀土', silver: false,
    story: '2050 年,稀土資源枯竭引爆全球危機。大西洋聯盟與歐亞協約為爭奪最後的稀土礦脈,在中亞荒原爆發全面衝突。雷射與電磁砲取代了火藥,但戰爭的本質從未改變。',
    start: '戰場控制,已上線'
  },
  ming: {
    name: '1592 壬辰之役', title: '烽火東亞 <span>1592</span>', factions: ['mg', 'jp', 'kr'], players: 3,
    power: '糧草', ore: '銀礦', silver: true,
    story: '萬曆二十年,豐臣秀吉渡海出兵朝鮮,意圖假道入明。朝鮮八道烽火連天,大明援軍東渡鴨綠江。三國大軍在朝鮮半島爭奪銀礦與糧道,一場決定東亞命運的大戰就此展開。',
    start: '烽火已燃,全軍備戰'
  }
};
// 語音與訊息的時代用語
const ERA_TEXT = {
  ming: [['電力不足', '糧草不足'], ['超級武器', '奇兵'], ['單位就緒', '兵馬就緒'], ['開始訓練', '開始操練'], ['建造完成', '營造完成'], ['我方基地遭受攻擊', '我方營寨遭受攻擊'], ['我方部隊遭受攻擊', '我軍遭受攻擊'], ['任務完成', '大獲全勝'], ['任務失敗', '全軍覆沒'], ['單位晉升', '將士晉升']]
};
function eraText(s) {
  const list = ERA_TEXT[G.era];
  if (list) for (const [a, b] of list) s = s.split(a).join(b);
  return s;
}
function dname(type, faction) {
  const f = FACTIONS[faction];
  return (f && f.names && f.names[type]) || getDef(type).name;
}

Object.assign(WARHEADS, {
  pike:  { inf: 0.8, light: 1.7, heavy: 0.5, bld: 0.2 },
  blade: { inf: 1.15, light: 0.8, heavy: 0.4, bld: 0.25 },
  fire:  { inf: 0.9, light: 0.9, heavy: 0.8, bld: 1.4 }
});

Object.assign(WEAPONS, {
  musket:      { kind: 'bullet',  dmg: 28, range: 4.2, rof: 2.0, wh: 'ap',    snd: 'musket', color: '#ffe0a0', smoke: true },
  bow:         { kind: 'arrow',   dmg: 13, range: 5.0, rof: 1.1, wh: 'ap',    snd: 'bow', speed: 12, arc: 14 },
  horseBow:    { kind: 'arrow',   dmg: 14, range: 4.5, rof: 1.0, wh: 'ap',    snd: 'bow', speed: 12, arc: 10 },
  spear:       { kind: 'melee',   dmg: 24, range: 0.8, rof: 1.1, wh: 'pike',  snd: 'clang' },
  katana:      { kind: 'melee',   dmg: 34, range: 0.7, rof: 0.9, wh: 'blade', snd: 'clang' },
  sword:       { kind: 'melee',   dmg: 26, range: 0.7, rof: 0.9, wh: 'blade', snd: 'clang' },
  lance:       { kind: 'melee',   dmg: 36, range: 0.85, rof: 1.2, wh: 'blade', snd: 'clang' },
  frankiGun:   { kind: 'shell',   dmg: 55, range: 5.2, rof: 2.4, wh: 'at',    snd: 'cannonOld', speed: 12, splash: 0.4, ball: true, smoke: true },
  oozutsu:     { kind: 'shell',   dmg: 70, range: 5.0, rof: 2.8, wh: 'at',    snd: 'cannonOld', speed: 12, splash: 0.5, ball: true, smoke: true },
  hwacha:      { kind: 'volley',  dmg: 16, range: 6.5, rof: 6.0, wh: 'fire',  snd: 'rocket', speed: 8, splash: 0.5, n: 10, arc: 22 },
  bigCannon:   { kind: 'shell',   dmg: 140, range: 8.0, rof: 4.2, wh: 'siege', snd: 'cannonOld', speed: 11, splash: 0.8, arc: 14, ball: true, smoke: true },
  mortar:      { kind: 'shell',   dmg: 125, range: 7.5, rof: 4.0, wh: 'siege', snd: 'cannonOld', speed: 6, splash: 1.0, arc: 48, ball: true, smoke: true },
  catapult:    { kind: 'shell',   dmg: 115, range: 7.0, rof: 4.0, wh: 'fire',  snd: 'whoosh', speed: 6, splash: 0.9, arc: 42, firepot: true },
  towerArrow:  { kind: 'arrow',   dmg: 22, range: 6.5, rof: 0.8, wh: 'ap',    snd: 'bow', speed: 13, arc: 10 },
  towerMusket: { kind: 'bullet',  dmg: 32, range: 6.0, rof: 1.3, wh: 'ap',    snd: 'musket', color: '#ffe0a0', smoke: true },
  towerCannon: { kind: 'shell',   dmg: 70, range: 6.5, rof: 2.3, wh: 'at',    snd: 'cannonOld', speed: 12, splash: 0.45, ball: true, smoke: true }
});

const _inf = (gun, extra) => Object.assign({ kind: 'inf', gun }, extra || {});
Object.assign(UNITS, {
  // 大明
  mg_inf:   { name: '鳥銃手', faction: 'mg', cat: 'inf', cost: 150, hp: 100, armor: 'inf', speed: 1.2, sight: 5, weapon: 'musket', req: ['barracks'], look: _inf('musket'), desc: '戚家軍鳥銃手,齊射威力驚人。' },
  mg_inf2:  { name: '狼筅長槍兵', faction: 'mg', cat: 'inf', cost: 250, hp: 150, armor: 'inf', speed: 1.15, sight: 4, weapon: 'spear', req: ['barracks'], look: _inf('spear'), desc: '長兵器克制騎兵與車輛。' },
  mg_light: { name: '遼東鐵騎', faction: 'mg', cat: 'veh', cost: 550, hp: 290, armor: 'light', speed: 3.0, sight: 6, weapon: 'lance', req: ['factory'], look: { kind: 'horse', L: 0.8, W: 0.35, H: 7, rider: 'lance' }, desc: '快速衝鋒的重騎兵。' },
  mg_tank:  { name: '偏廂戰車', faction: 'mg', cat: 'veh', cost: 900, hp: 680, armor: 'heavy', speed: 1.4, sight: 5, weapon: 'frankiGun', req: ['factory'], look: { kind: 'cart', variant: 'warcart', L: 0.95, W: 0.6, H: 6 }, desc: '車廂設佛郎機砲,車陣堅不可摧。' },
  mg_art:   { name: '大將軍砲', faction: 'mg', cat: 'veh', cost: 1500, hp: 380, armor: 'light', speed: 1.1, sight: 7, weapon: 'bigCannon', req: ['factory', 'tech'], look: { kind: 'cart', variant: 'cannon', L: 1.0, W: 0.55, H: 5, big: true }, desc: '重型火砲,專門摧毀城寨。' },
  // 日本
  jp_inf:   { name: '鐵砲足輕', faction: 'jp', cat: 'inf', cost: 150, hp: 95, armor: 'inf', speed: 1.25, sight: 5, weapon: 'musket', req: ['barracks'], look: _inf('musket', { hat: 'jingasa' }), desc: '三段擊的火繩槍足輕。' },
  jp_inf2:  { name: '武士', faction: 'jp', cat: 'inf', cost: 300, hp: 175, armor: 'inf', speed: 1.35, sight: 5, weapon: 'katana', req: ['barracks'], look: _inf('katana', { hat: 'kabuto' }), desc: '精銳近戰,刀法凌厲。' },
  jp_light: { name: '騎馬武者', faction: 'jp', cat: 'veh', cost: 600, hp: 300, armor: 'light', speed: 3.1, sight: 6, weapon: 'lance', req: ['factory'], look: { kind: 'horse', L: 0.8, W: 0.35, H: 7, rider: 'yari' }, desc: '持長槍衝鋒的騎馬武士。' },
  jp_tank:  { name: '大筒車', faction: 'jp', cat: 'veh', cost: 850, hp: 520, armor: 'heavy', speed: 1.5, sight: 5, weapon: 'oozutsu', req: ['factory'], look: { kind: 'cart', variant: 'cannon', L: 0.85, W: 0.5, H: 5 }, desc: '搭載大筒的砲車。' },
  jp_art:   { name: '焙烙投石車', faction: 'jp', cat: 'veh', cost: 1500, hp: 380, armor: 'light', speed: 1.1, sight: 7, weapon: 'catapult', req: ['factory', 'tech'], look: { kind: 'cart', variant: 'catapult', L: 1.0, W: 0.6, H: 5 }, desc: '拋擲焙烙火罐,焚燒敵營。' },
  // 朝鮮
  kr_inf:   { name: '弓手', faction: 'kr', cat: 'inf', cost: 130, hp: 90, armor: 'inf', speed: 1.25, sight: 6, weapon: 'bow', req: ['barracks'], look: _inf('bow', { hat: 'gat' }), desc: '朝鮮角弓,射程遠。' },
  kr_inf2:  { name: '殺手', faction: 'kr', cat: 'inf', cost: 250, hp: 155, armor: 'inf', speed: 1.25, sight: 4, weapon: 'sword', req: ['barracks'], look: _inf('sword', { hat: 'gat' }), desc: '刀牌近戰兵。' },
  kr_light: { name: '騎射手', faction: 'kr', cat: 'veh', cost: 600, hp: 260, armor: 'light', speed: 3.0, sight: 7, weapon: 'horseBow', req: ['factory'], look: { kind: 'horse', L: 0.8, W: 0.35, H: 7, rider: 'bow' }, desc: '邊移動邊射箭的輕騎兵。' },
  kr_tank:  { name: '華車', faction: 'kr', cat: 'veh', cost: 1000, hp: 420, armor: 'light', speed: 1.4, sight: 6, weapon: 'hwacha', req: ['factory'], look: { kind: 'cart', variant: 'hwacha', L: 0.9, W: 0.55, H: 5 }, desc: '一次齊射大量神機箭。' },
  kr_art:   { name: '震天雷砲', faction: 'kr', cat: 'veh', cost: 1500, hp: 380, armor: 'light', speed: 1.1, sight: 7, weapon: 'mortar', req: ['factory', 'tech'], look: { kind: 'cart', variant: 'mortar', L: 0.85, W: 0.55, H: 5 }, desc: '發射飛擊震天雷,範圍爆炸。' }
});

Object.assign(BUILDINGS, {
  mg_turret: { name: '敵台', faction: 'mg', cat: 'def', w: 1, h: 1, hp: 850, power: -40, cost: 900, sight: 7, req: ['barracks'], weapon: 'towerCannon', desc: '磚砌砲台,配置佛郎機。' },
  jp_turret: { name: '鐵砲櫓', faction: 'jp', cat: 'def', w: 1, h: 1, hp: 750, power: -40, cost: 900, sight: 7, req: ['barracks'], weapon: 'towerMusket', desc: '木造箭櫓,鐵砲射擊。' },
  kr_turret: { name: '箭樓', faction: 'kr', cat: 'def', w: 1, h: 1, hp: 700, power: -40, cost: 900, sight: 8, req: ['barracks'], weapon: 'towerArrow', desc: '高聳箭樓,射速快。' },
  mg_super:  { name: '火龍出水', faction: 'mg', cat: 'def', w: 2, h: 2, hp: 1500, power: -100, cost: 3000, sight: 5, req: ['tech'], super: 'missile', vis: 'firedragon', charge: 300, unique: true, desc: '奇兵:發射巨型火龍火箭,大範圍毀滅。充能 5 分鐘。' },
  jp_super:  { name: '火攻之陣', faction: 'jp', cat: 'def', w: 2, h: 2, hp: 1500, power: -100, cost: 3000, sight: 5, req: ['tech'], super: 'orbital', vis: 'firestorm', charge: 300, unique: true, desc: '奇兵:忍者縱火,目標區域陷入烈焰。充能 5 分鐘。' },
  kr_super:  { name: '神機箭陣', faction: 'kr', cat: 'def', w: 2, h: 2, hp: 1500, power: -100, cost: 3000, sight: 5, req: ['tech'], super: 'orbital', vis: 'arrowrain', charge: 300, unique: true, desc: '奇兵:百台華車齊射,箭雨覆蓋目標。充能 5 分鐘。' }
});
