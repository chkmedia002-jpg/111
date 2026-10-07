import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

// ---------- 常數 ----------
const MAP = 60;               // 地圖半寬
const UNIT_SCALE = 1.6;
const UNIT_STATS = { hp: 120, dmg: 22, cooldown: 1.0, range: 1.6, speed: 6, aggro: 11, radius: 0.65, cost: 100, buildTime: 3 };
const HQ_HP = 1600;
const INCOME = 9;             // 每秒資金
const POP_CAP = 25;
const TEAM_COLOR = [0x3d8bff, 0xff3030];
const BASE_POS = [new THREE.Vector3(-42, 0, 42), new THREE.Vector3(42, 0, -42)];

// ---------- 基本場景 ----------
const canvas = document.getElementById('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8fb4d8);
scene.fog = new THREE.Fog(0x8fb4d8, 90, 180);

const camera = new THREE.PerspectiveCamera(45, 1, 0.5, 400);
const camTarget = new THREE.Vector3();
let camZoom = 1;

scene.add(new THREE.HemisphereLight(0xdde8ff, 0x4a5a2a, 1.1));
const sun = new THREE.DirectionalLight(0xffffff, 2.2);
sun.position.set(30, 60, 20);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -75, right: 75, top: 75, bottom: -75, near: 1, far: 160 });
sun.shadow.bias = -0.0005;
scene.add(sun);

// 地面（程式產生草地貼圖）
function makeGroundTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#5d7a3a';
  g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 9000; i++) {
    const v = 70 + Math.random() * 60;
    g.fillStyle = `rgba(${v * 0.75 | 0},${v + 30 | 0},${v * 0.4 | 0},0.35)`;
    g.fillRect(Math.random() * 512, Math.random() * 512, 2 + Math.random() * 4, 2 + Math.random() * 4);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(10, 10);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(MAP * 3, MAP * 3),
  new THREE.MeshStandardMaterial({ map: makeGroundTexture(), roughness: 1 })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// 地圖邊界
const border = new THREE.LineLoop(
  new THREE.BufferGeometry().setFromPoints([[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, z]) => new THREE.Vector3(x * MAP, 0.05, z * MAP))),
  new THREE.LineBasicMaterial({ color: 0x223311 })
);
scene.add(border);

// 簡單亂數（固定種子，地形每次相同）
let seed = 7;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

// 樹與石頭（靜態障礙）
const obstacles = [];
{
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5a3a20 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x2f5d2a, flatShading: true });
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x777770, flatShading: true });
  const trunkGeo = new THREE.CylinderGeometry(0.25, 0.35, 1.6, 6);
  const leafGeo = new THREE.ConeGeometry(1.4, 3.4, 7);
  const rockGeo = new THREE.DodecahedronGeometry(1, 0);
  for (let i = 0; i < 70; i++) {
    const x = (rand() * 2 - 1) * (MAP - 3), z = (rand() * 2 - 1) * (MAP - 3);
    const p = new THREE.Vector3(x, 0, z);
    if (BASE_POS.some(b => b.distanceTo(p) < 18)) continue;
    if (Math.abs(x + z) < 12) continue; // 保留對角線主要通道
    const g = new THREE.Group();
    let r;
    if (rand() < 0.75) {
      const trunk = new THREE.Mesh(trunkGeo, trunkMat); trunk.position.y = 0.8;
      const leaf = new THREE.Mesh(leafGeo, leafMat); leaf.position.y = 3;
      const s = 0.8 + rand() * 0.6;
      g.add(trunk, leaf); g.scale.setScalar(s); r = 0.9 * s;
    } else {
      const rock = new THREE.Mesh(rockGeo, rockMat);
      const s = 0.7 + rand() * 1.0;
      rock.scale.set(s * 1.3, s * 0.8, s); rock.position.y = s * 0.4; rock.rotation.y = rand() * 6;
      g.add(rock); r = s * 1.1;
    }
    g.position.copy(p);
    g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    scene.add(g);
    obstacles.push({ pos: p, radius: r });
  }
}

// ---------- 共用幾何／材質 ----------
const ringGeo = new THREE.RingGeometry(0.85, 1.05, 32).rotateX(-Math.PI / 2);
const selRingGeo = new THREE.RingGeometry(1.05, 1.25, 32).rotateX(-Math.PI / 2);
const teamRingMat = TEAM_COLOR.map(c => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.6, depthWrite: false }));
const selRingMat = new THREE.MeshBasicMaterial({ color: 0x66ff66, transparent: true, opacity: 0.9, depthWrite: false });
const hpBgMat = new THREE.MeshBasicMaterial({ color: 0x220000, depthTest: false, transparent: true });
const hpFgMat = [
  new THREE.MeshBasicMaterial({ color: 0x55ff55, depthTest: false, transparent: true }),
  new THREE.MeshBasicMaterial({ color: 0xff4444, depthTest: false, transparent: true }),
];
const hpBgGeo = new THREE.PlaneGeometry(1, 0.14);
const hpFgGeo = new THREE.PlaneGeometry(1, 0.1).translate(0.5, 0, 0);

function makeHpBar(width, team) {
  const g = new THREE.Group();
  const bg = new THREE.Mesh(hpBgGeo, hpBgMat);
  bg.scale.x = width + 0.06;
  bg.renderOrder = 10;
  const fg = new THREE.Mesh(hpFgGeo, hpFgMat[team]);
  fg.position.x = -width / 2;
  fg.scale.x = width;
  fg.renderOrder = 11;
  g.add(bg, fg);
  g.userData = { fg, width };
  return g;
}
function setHpBar(bar, ratio) {
  bar.userData.fg.scale.x = Math.max(0.001, bar.userData.width * ratio);
}

// ---------- 特效 ----------
const effects = [];
const slashGeo = new THREE.RingGeometry(0.9, 1.5, 24, 1, -Math.PI * 0.45, Math.PI * 0.9);
function spawnSlash(pos, yaw, color) {
  const m = new THREE.Mesh(slashGeo, new THREE.MeshBasicMaterial({
    color, transparent: true, opacity: 0.95, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  m.position.copy(pos).setY(1.3);
  m.rotation.set(-Math.PI / 2 + 0.5, 0, 0, 'YXZ');
  m.rotation.y = yaw + Math.PI / 2;
  scene.add(m);
  effects.push({ obj: m, t: 0, life: 0.22, update(e, k) { e.obj.material.opacity = 0.95 * (1 - k); e.obj.scale.setScalar(1 + k * 0.4); } });
}
const sparkGeo = new THREE.SphereGeometry(0.25, 6, 4);
function spawnHit(pos) {
  const m = new THREE.Mesh(sparkGeo, new THREE.MeshBasicMaterial({ color: 0xffdd66, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  m.position.copy(pos).setY(1.2);
  scene.add(m);
  effects.push({ obj: m, t: 0, life: 0.25, update(e, k) { e.obj.scale.setScalar(1 + k * 3); e.obj.material.opacity = 1 - k; } });
}
const markerGeo = new THREE.RingGeometry(0.5, 0.75, 24).rotateX(-Math.PI / 2);
function spawnMarker(pos, color) {
  const m = new THREE.Mesh(markerGeo, new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false }));
  m.position.copy(pos).setY(0.08);
  scene.add(m);
  effects.push({ obj: m, t: 0, life: 0.6, update(e, k) { e.obj.scale.setScalar(1.6 - k); e.obj.material.opacity = 1 - k; } });
}
function updateEffects(dt) {
  for (let i = effects.length - 1; i >= 0; i--) {
    const e = effects[i];
    e.t += dt;
    const k = Math.min(1, e.t / e.life);
    e.update(e, k);
    if (k >= 1) {
      scene.remove(e.obj);
      e.obj.material.dispose();
      effects.splice(i, 1);
    }
  }
}

// ---------- 模型載入 ----------
let template = null, clips = {};
const enemyMaterials = new Map();

const loader = new GLTFLoader();
const startBtn = document.getElementById('startBtn');
loader.load('assets/samurai.glb', gltf => {
  template = gltf.scene;
  template.traverse(o => {
    if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; }
  });
  for (const c of gltf.animations) clips[c.name] = c;
  startBtn.disabled = false;
  startBtn.textContent = '開始戰鬥';
  showPreview();
}, xhr => {
  if (xhr.total) startBtn.textContent = `載入中… ${Math.round(xhr.loaded / xhr.total * 100)}%`;
}, err => {
  console.error(err);
  startBtn.textContent = '模型載入失敗';
});

function makeSamuraiModel(team) {
  const obj = SkeletonUtils.clone(template);
  obj.scale.setScalar(UNIT_SCALE);
  if (team === 1) {
    obj.traverse(o => {
      if (!o.isMesh) return;
      if (!enemyMaterials.has(o.material)) {
        const m = o.material.clone();
        m.color = new THREE.Color(1, 0.45, 0.45);
        enemyMaterials.set(o.material, m);
      }
      o.material = enemyMaterials.get(o.material);
    });
  }
  return obj;
}

function findBone(root, part) {
  let found = null;
  root.traverse(o => { if (!found && o.isBone && o.name.endsWith(part)) found = o; });
  return found;
}

// ---------- 實體 ----------
let entities = [];
let nextId = 1;

class Unit {
  constructor(team, pos) {
    this.id = nextId++;
    this.kind = 'unit';
    this.team = team;
    this.hp = this.maxHp = UNIT_STATS.hp;
    this.radius = UNIT_STATS.radius;
    this.pos = pos.clone();
    this.yaw = team === 0 ? Math.PI * 0.75 : -Math.PI * 0.25;
    this.order = null;       // {type:'move'|'amove'|'attack', point?, target?}
    this.resume = null;      // 攻擊後恢復的攻擊移動指令
    this.cooldown = 0;
    this.swing = -1;         // 攻擊揮砍動畫進度（<0 表示無）
    this.dead = false;
    this.deadT = 0;
    this.selected = false;

    this.root = new THREE.Group();
    this.model = makeSamuraiModel(team);
    this.root.add(this.model);
    this.ring = new THREE.Mesh(ringGeo, teamRingMat[team]);
    this.ring.position.y = 0.05;
    this.root.add(this.ring);
    this.selRing = new THREE.Mesh(selRingGeo, selRingMat);
    this.selRing.position.y = 0.06;
    this.selRing.visible = false;
    this.root.add(this.selRing);
    this.hpBar = makeHpBar(1.4, team);
    scene.add(this.hpBar);
    scene.add(this.root);

    this.mixer = new THREE.AnimationMixer(this.model);
    this.actions = {
      run: this.mixer.clipAction(clips.Running),
      walk: this.mixer.clipAction(clips.Walking),
    };
    this.actions.idle = this.mixer.clipAction(clips.Walking.clone());
    this.actions.idle.timeScale = 0;
    this.cur = null;
    this.setAnim('idle');
    this.mixer.update(Math.random());

    this.armR = findBone(this.model, 'RightArm');
    this.foreR = findBone(this.model, 'RightForeArm');
    this.spine = findBone(this.model, 'Spine2');
    this.sync();
  }

  setAnim(name) {
    if (this.curName === name) return;
    const next = this.actions[name];
    next.reset();
    if (name === 'idle') next.time = 0.28;
    next.play();
    if (this.cur) this.cur.crossFadeTo(next, 0.18, false);
    this.cur = next;
    this.curName = name;
  }

  setSelected(v) {
    this.selected = v;
    this.selRing.visible = v;
  }

  damage(amount, from) {
    if (this.dead) return;
    this.hp -= amount;
    if (this.hp <= 0) {
      this.hp = 0;
      this.die(from);
    } else if (!this.order || this.order.type === 'amove' || (this.order.type === 'move' && this.team === 1)) {
      // 被攻擊時反擊
      if (from && !from.dead) this.attack(from, true);
    }
  }

  die(from) {
    this.dead = true;
    this.setSelected(false);
    this.hpBar.visible = false;
    this.ring.visible = false;
    this.mixer.timeScale = 0;
    if (from) game.onKill(from.team, this);
  }

  attack(target, keepResume = false) {
    if (!keepResume) this.resume = null;
    else if (this.order && this.order.type === 'amove') this.resume = this.order;
    this.order = { type: 'attack', target };
  }

  moveTo(point, attackMove = false) {
    this.resume = null;
    this.order = { type: attackMove ? 'amove' : 'move', point: point.clone() };
  }

  stop() {
    this.order = null;
    this.resume = null;
  }

  update(dt) {
    if (this.dead) {
      this.deadT += dt;
      const k = Math.min(1, this.deadT / 0.5);
      this.root.rotation.x = 0;
      this.model.rotation.x = -k * Math.PI / 2 * 0.95;
      this.model.position.y = Math.max(-1.5, -(this.deadT - 1.2) * 0.8) * (this.deadT > 1.2 ? 1 : 0);
      this.sync();
      return this.deadT < 3;
    }

    this.cooldown -= dt;
    const S = UNIT_STATS;

    // 自動索敵
    if (!this.order || this.order.type === 'amove') {
      const foe = nearestEnemy(this, S.aggro);
      if (foe) this.attack(foe, true);
    }

    let moving = false;
    const o = this.order;
    if (o) {
      if (o.type === 'attack') {
        const t = o.target;
        if (t.dead) {
          this.order = this.resume;
          this.resume = null;
        } else {
          const d = flatDist(this.pos, t.pos) - t.radius - this.radius;
          if (d <= S.range) {
            this.face(t.pos, dt);
            if (this.cooldown <= 0) {
              this.cooldown = S.cooldown;
              this.swing = 0;
              this.pendingHit = t;
            }
          } else {
            // 追擊範圍：放棄追擊太遠的單位（自動索敵時）
            if (this.resume && d > S.aggro * 1.8) { this.order = this.resume; this.resume = null; }
            else { this.stepTowards(t.pos, dt); moving = true; }
          }
        }
      } else {
        const d = flatDist(this.pos, o.point);
        if (d < 0.35) {
          this.order = null;
        } else {
          this.stepTowards(o.point, dt);
          moving = true;
        }
      }
    }

    // 揮砍動畫與命中
    if (this.swing >= 0) {
      this.swing += dt / 0.45;
      if (this.pendingHit && this.swing >= 0.5) {
        const t = this.pendingHit;
        this.pendingHit = null;
        if (!t.dead && flatDist(this.pos, t.pos) - t.radius - this.radius <= S.range + 0.6) {
          t.damage(S.dmg * (0.85 + Math.random() * 0.3), this);
          spawnSlash(this.pos, this.yaw, this.team === 0 ? 0xbfe0ff : 0xffb0a0);
          spawnHit(new THREE.Vector3().lerpVectors(this.pos, t.pos, 0.7));
        }
      }
      if (this.swing >= 1) this.swing = -1;
    }

    this.setAnim(moving ? 'run' : 'idle');
    this.restorePose();
    this.mixer.update(dt);
    this.applySwingPose();
    this.sync();
    return true;
  }

  // 動畫混合器只在數值改變時寫入骨骼，因此先還原上一幀的揮砍偏移，避免旋轉累加
  restorePose() {
    if (!this.posed) return;
    for (const [bone, q] of this.posed) bone.quaternion.copy(q);
    this.posed = null;
  }

  applySwingPose() {
    let lunge = 0;
    if (this.swing >= 0) {
      this.posed = [this.armR, this.foreR, this.spine].filter(Boolean).map(b => [b, b.quaternion.clone()]);
      const s = this.swing;
      // 先舉刀（0~0.4），再劈下（0.4~0.65），最後收刀
      const raise = s < 0.4 ? s / 0.4 : s < 0.65 ? 1 - (s - 0.4) / 0.25 * 1.9 : -0.9 * (1 - (s - 0.65) / 0.35);
      if (this.armR) this.armR.rotateX(-raise * 1.6);
      if (this.foreR) this.foreR.rotateX(-Math.max(0, raise) * 0.6);
      if (this.spine) this.spine.rotateY(raise * 0.35);
      lunge = s < 0.4 ? -0.1 * s : s < 0.7 ? Math.sin((s - 0.4) / 0.3 * Math.PI) * 0.45 : 0;
    }
    this.model.position.set(Math.sin(this.yaw) * lunge, 0, Math.cos(this.yaw) * lunge);
  }

  face(p, dt) {
    const target = Math.atan2(p.x - this.pos.x, p.z - this.pos.z);
    let d = target - this.yaw;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.yaw += d * Math.min(1, dt * 12);
  }

  stepTowards(p, dt) {
    const dx = p.x - this.pos.x, dz = p.z - this.pos.z;
    const len = Math.hypot(dx, dz);
    if (len < 1e-4) return;
    const step = Math.min(len, UNIT_STATS.speed * dt);
    this.pos.x += dx / len * step;
    this.pos.z += dz / len * step;
    this.face(p, dt);
  }

  sync() {
    this.root.position.copy(this.pos);
    this.model.rotation.y = this.yaw;
    this.hpBar.position.set(this.pos.x, 3.6, this.pos.z);
    this.hpBar.quaternion.copy(camera.quaternion);
    setHpBar(this.hpBar, this.hp / this.maxHp);
  }

  dispose() {
    scene.remove(this.root);
    scene.remove(this.hpBar);
    this.mixer.stopAllAction();
  }
}

class HQ {
  constructor(team, pos) {
    this.id = nextId++;
    this.kind = 'hq';
    this.team = team;
    this.hp = this.maxHp = HQ_HP;
    this.radius = 3.6;
    this.pos = pos.clone();
    this.dead = false;
    this.deadT = 0;
    this.selected = false;
    this.queue = 0;
    this.buildT = 0;
    this.rally = pos.clone().add(new THREE.Vector3(team === 0 ? 7 : -7, 0, team === 0 ? -7 : 7));

    const color = TEAM_COLOR[team];
    const g = new THREE.Group();
    const wall = new THREE.MeshStandardMaterial({ color: 0x8a8378, roughness: 0.9 });
    const roof = new THREE.MeshStandardMaterial({ color, roughness: 0.6 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x333338 });
    const base = new THREE.Mesh(new THREE.BoxGeometry(6.5, 2.6, 6.5), wall); base.position.y = 1.3;
    const roof1 = new THREE.Mesh(new THREE.ConeGeometry(5.4, 2.2, 4), roof); roof1.position.y = 3.7; roof1.rotation.y = Math.PI / 4;
    const tower = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.2, 2.6), wall); tower.position.y = 5.3;
    const roof2 = new THREE.Mesh(new THREE.ConeGeometry(2.6, 1.6, 4), roof); roof2.position.y = 7.2; roof2.rotation.y = Math.PI / 4;
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.8, 0.2), dark);
    const dir = this.rally.clone().sub(pos).normalize();
    door.position.set(dir.x * 3.26, 0.9, dir.z * 3.26);
    door.lookAt(door.position.clone().add(dir));
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3), dark); pole.position.set(0, 9.2, 0);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1), new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide }));
    flag.position.set(0.8, 10.1, 0);
    g.add(base, roof1, tower, roof2, door, pole, flag);
    g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    g.position.copy(pos);
    this.flag = flag;
    this.root = g;
    scene.add(g);

    this.selRing = new THREE.Mesh(new THREE.RingGeometry(4.6, 5, 48).rotateX(-Math.PI / 2), selRingMat);
    this.selRing.position.copy(pos).setY(0.06);
    this.selRing.visible = false;
    scene.add(this.selRing);
    const teamRing = new THREE.Mesh(new THREE.RingGeometry(4.2, 4.5, 48).rotateX(-Math.PI / 2), teamRingMat[team]);
    teamRing.position.copy(pos).setY(0.05);
    scene.add(teamRing);
    this.teamRing = teamRing;
    this.hpBar = makeHpBar(5, team);
    this.hpBar.position.set(pos.x, 11.5, pos.z);
    scene.add(this.hpBar);
  }

  setSelected(v) { this.selected = v; this.selRing.visible = v; }

  damage(amount, from) {
    if (this.dead) return;
    this.hp -= amount;
    if (this.team === 0) game.flash('指揮中心遭到攻擊！');
    else if (from) game.enemyBaseAlarm(from);
    if (this.hp <= 0) {
      this.hp = 0;
      this.dead = true;
      this.hpBar.visible = false;
      this.setSelected(false);
      game.onHQDestroyed(this.team);
    }
  }

  train() {
    if (this.dead) return false;
    const credits = game.credits[this.team];
    if (credits < UNIT_STATS.cost || this.queue >= 9) return false;
    game.credits[this.team] -= UNIT_STATS.cost;
    this.queue++;
    return true;
  }

  update(dt) {
    if (this.dead) {
      this.deadT += dt;
      this.root.position.y = -Math.min(this.deadT, 4) * 1.6;
      this.root.rotation.z = Math.min(this.deadT, 4) * 0.05;
      return true;
    }
    this.flag.rotation.y = Math.sin(performance.now() / 300) * 0.3;
    this.hpBar.quaternion.copy(camera.quaternion);
    setHpBar(this.hpBar, this.hp / this.maxHp);
    if (this.queue > 0) {
      if (countUnits(this.team) >= POP_CAP) return true;
      this.buildT += dt;
      if (this.buildT >= UNIT_STATS.buildTime) {
        this.buildT = 0;
        this.queue--;
        const dir = this.rally.clone().sub(this.pos).normalize();
        const spawn = this.pos.clone().addScaledVector(dir, this.radius + 1);
        const u = new Unit(this.team, spawn);
        u.yaw = Math.atan2(dir.x, dir.z);
        const jitter = new THREE.Vector3((Math.random() - 0.5) * 3, 0, (Math.random() - 0.5) * 3);
        u.moveTo(this.rally.clone().add(jitter));
        entities.push(u);
      }
    }
    return true;
  }

  dispose() {
    scene.remove(this.root, this.selRing, this.teamRing, this.hpBar);
  }
}

// ---------- 工具函式 ----------
function flatDist(a, b) { return Math.hypot(a.x - b.x, a.z - b.z); }
function countUnits(team) { let n = 0; for (const e of entities) if (e.kind === 'unit' && e.team === team && !e.dead) n++; return n; }
function nearestEnemy(u, range) {
  let best = null, bd = range;
  for (const e of entities) {
    if (e.dead || e.team === u.team) continue;
    const d = flatDist(u.pos, e.pos) - e.radius;
    // 優先攻擊單位，建築物距離加權
    const w = e.kind === 'hq' ? d + 2 : d;
    if (w < bd) { bd = w; best = e; }
  }
  return best;
}

// 單位之間互相推開，並避開建築與障礙物
function resolveCollisions() {
  const units = entities.filter(e => e.kind === 'unit' && !e.dead);
  for (let i = 0; i < units.length; i++) {
    const a = units[i];
    for (let j = i + 1; j < units.length; j++) {
      const b = units[j];
      const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z;
      const min = a.radius + b.radius;
      const d2 = dx * dx + dz * dz;
      if (d2 < min * min) {
        const d = Math.sqrt(d2) || 0.01;
        const push = (min - d) / 2;
        const nx = d2 ? dx / d : Math.random() - 0.5, nz = d2 ? dz / d : Math.random() - 0.5;
        a.pos.x -= nx * push; a.pos.z -= nz * push;
        b.pos.x += nx * push; b.pos.z += nz * push;
      }
    }
    const statics = [...obstacles, ...entities.filter(e => e.kind === 'hq' && !e.dead)];
    for (const s of statics) {
      const dx = a.pos.x - s.pos.x, dz = a.pos.z - s.pos.z;
      const min = a.radius + s.radius;
      const d = Math.hypot(dx, dz);
      if (d < min && d > 1e-4) {
        a.pos.x = s.pos.x + dx / d * min;
        a.pos.z = s.pos.z + dz / d * min;
      }
    }
    a.pos.x = THREE.MathUtils.clamp(a.pos.x, -MAP + 1, MAP - 1);
    a.pos.z = THREE.MathUtils.clamp(a.pos.z, -MAP + 1, MAP - 1);
  }
}

// ---------- 遊戲狀態 ----------
const ui = {
  menu: document.getElementById('menu'),
  hud: document.getElementById('hud'),
  end: document.getElementById('end'),
  credits: document.getElementById('credits'),
  myCount: document.getElementById('myCount'),
  enemyCount: document.getElementById('enemyCount'),
  msg: document.getElementById('msg'),
  selInfo: document.getElementById('selInfo'),
  trainBtn: document.getElementById('trainBtn'),
  trainProg: document.getElementById('trainProg'),
  queueCount: document.getElementById('queueCount'),
  amoveBtn: document.getElementById('amoveBtn'),
  selbox: document.getElementById('selbox'),
  minimap: document.getElementById('minimap'),
};

const game = {
  running: false,
  over: false,
  difficulty: 1,
  credits: [0, 0],
  hq: [null, null],
  ai: { timer: 0, waveSize: 3, waveTimer: 0 },
  msgT: 0,
  lastAlarm: 0,

  start() {
    for (const e of entities) e.dispose();
    entities = [];
    selection.clear();
    clearPreview();
    this.over = false;
    this.credits = [300, 300];
    this.hq = [new HQ(0, BASE_POS[0]), new HQ(1, BASE_POS[1])];
    entities.push(...this.hq);
    for (let t = 0; t < 2; t++) {
      for (let i = 0; i < 4; i++) {
        const hq = this.hq[t];
        const p = hq.rally.clone().add(new THREE.Vector3((i % 2) * 2 - 1, 0, (i >> 1) * 2 - 1));
        const u = new Unit(t, p);
        entities.push(u);
      }
    }
    this.ai = { timer: 0, waveSize: 4, waveTimer: 40 };
    camTarget.copy(BASE_POS[0]).add(new THREE.Vector3(6, 0, -6));
    camZoom = 0.8;
    ui.menu.classList.add('hidden');
    ui.end.classList.add('hidden');
    ui.hud.classList.remove('hidden');
    this.running = true;
    resize();
    this.flash('擊毀紅色指揮中心！');
  },

  flash(text) {
    ui.msg.textContent = text;
    this.msgT = 3;
  },

  onKill(team) {
    this.credits[team] += 25;
  },

  enemyBaseAlarm(attacker) {
    const now = performance.now();
    if (now - this.lastAlarm < 2000) return;
    this.lastAlarm = now;
    // 敵方全軍回防
    for (const e of entities) {
      if (e.kind === 'unit' && e.team === 1 && !e.dead && (!e.order || e.order.type !== 'attack')) e.attack(attacker);
    }
  },

  onHQDestroyed(team) {
    if (this.over) return;
    this.over = true;
    setTimeout(() => {
      document.getElementById('endTitle').textContent = team === 1 ? '勝利！' : '戰敗…';
      document.getElementById('endText').textContent = team === 1 ? '你的武士部隊摧毀了敵方指揮中心。' : '我方指揮中心被摧毀了。';
      ui.end.classList.remove('hidden');
    }, 2200);
  },

  updateAI(dt) {
    const ai = this.ai;
    const hq = this.hq[1];
    if (hq.dead) return;
    ai.timer -= dt;
    if (ai.timer <= 0) {
      ai.timer = 1;
      while (hq.queue < 2 && hq.train()) { /* 盡量排程 */ }
    }
    // 集結足夠兵力就發動攻勢
    ai.waveTimer -= dt;
    const idle = entities.filter(e => e.kind === 'unit' && e.team === 1 && !e.dead && !e.order);
    if (idle.length >= ai.waveSize || (ai.waveTimer <= 0 && idle.length >= 2)) {
      const target = this.hq[0].pos;
      for (const u of idle) {
        u.moveTo(target.clone().add(new THREE.Vector3((Math.random() - 0.5) * 6, 0, (Math.random() - 0.5) * 6)), true);
      }
      ai.waveSize = Math.min(12, ai.waveSize + 1);
      ai.waveTimer = 45;
    }
  },

  update(dt) {
    if (!this.over) {
      this.credits[0] += INCOME * dt;
      this.credits[1] += INCOME * dt * this.difficulty;
      this.updateAI(dt);
    }
    for (let i = entities.length - 1; i >= 0; i--) {
      if (!entities[i].update(dt)) {
        entities[i].dispose();
        selection.delete(entities[i]);
        entities.splice(i, 1);
      }
    }
    resolveCollisions();
    updateEffects(dt);
    if (this.msgT > 0 && (this.msgT -= dt) <= 0) ui.msg.textContent = '';
    this.updateHud();
  },

  updateHud() {
    ui.credits.textContent = Math.floor(this.credits[0]);
    const my = countUnits(0), en = countUnits(1);
    ui.myCount.textContent = `${my}/${POP_CAP}`;
    ui.enemyCount.textContent = en;
    const hq = this.hq[0];
    ui.trainProg.style.width = hq.queue ? `${hq.buildT / UNIT_STATS.buildTime * 100}%` : '0';
    ui.queueCount.textContent = hq.queue ? hq.queue : '';
    ui.trainBtn.disabled = hq.dead || this.credits[0] < UNIT_STATS.cost;
    const sel = [...selection];
    if (!sel.length) ui.selInfo.textContent = '未選取';
    else if (sel[0].kind === 'hq') ui.selInfo.textContent = `指揮中心 ${Math.ceil(sel[0].hp)}/${sel[0].maxHp}`;
    else {
      const hp = sel.reduce((s, u) => s + u.hp, 0) / sel.length;
      ui.selInfo.textContent = `武士 ×${sel.length}　平均生命 ${Math.ceil(hp)}`;
    }
    drawMinimap();
  },
};

// ---------- 選取與指令 ----------
const selection = new Set();
let attackMoveMode = false;

function setSelection(list) {
  for (const e of selection) e.setSelected(false);
  selection.clear();
  for (const e of list) { e.setSelected(true); selection.add(e); }
}
function selectedUnits() { return [...selection].filter(e => e.kind === 'unit' && !e.dead); }

function issueCommand(point, target, attackMove) {
  const units = selectedUnits();
  if (!units.length) {
    // 選取指揮中心時右鍵 = 設定集結點
    const hq = [...selection].find(e => e.kind === 'hq');
    if (hq && point) { hq.rally.copy(point); spawnMarker(point, 0xffff66); }
    return;
  }
  if (target && target.team !== 0) {
    for (const u of units) u.attack(target);
    spawnMarker(target.pos, 0xff4444);
    return;
  }
  if (!point) return;
  // 方陣隊形
  const cols = Math.ceil(Math.sqrt(units.length));
  const sp = 1.5;
  const center = units.reduce((v, u) => v.add(u.pos), new THREE.Vector3()).divideScalar(units.length);
  const dir = point.clone().sub(center).setY(0).normalize();
  const right = new THREE.Vector3(-dir.z, 0, dir.x);
  units.forEach((u, i) => {
    const r = Math.floor(i / cols), c = i % cols;
    const off = right.clone().multiplyScalar((c - (cols - 1) / 2) * sp).addScaledVector(dir, -r * sp);
    u.moveTo(point.clone().add(off), attackMove);
  });
  spawnMarker(point, attackMove ? 0xff8844 : 0x66ff66);
}

// 螢幕座標 → 地面座標
const raycaster = new THREE.Raycaster();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
function screenToGround(x, y) {
  const ndc = new THREE.Vector2(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const p = new THREE.Vector3();
  return raycaster.ray.intersectPlane(groundPlane, p) ? p : null;
}
function worldToScreen(p, h = 0) {
  const v = new THREE.Vector3(p.x, h, p.z).project(camera);
  return { x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight, z: v.z };
}
function pickEntity(x, y) {
  let best = null, bd = Infinity;
  for (const e of entities) {
    if (e.dead) continue;
    if (e.kind === 'unit') {
      // 以單位身體中段為點擊判定
      for (const h of [0.5, 1.5, 2.5]) {
        const s = worldToScreen(e.pos, h);
        const d = Math.hypot(s.x - x, s.y - y);
        const tol = 34 / camZoom;
        if (d < tol && d < bd) { bd = d; best = e; }
      }
    }
  }
  if (best) return best;
  const g = screenToGround(x, y);
  if (g) for (const e of entities) if (e.kind === 'hq' && !e.dead && flatDist(g, e.pos) < e.radius + 0.5) return e;
  return null;
}

// ---------- 輸入 ----------
const keys = new Set();
const pointers = new Map();
let drag = null;       // {x0,y0,x,y,button,type,moved}
let pinch = null;
let mouse = { x: innerWidth / 2, y: innerHeight / 2, inside: false };

canvas.addEventListener('contextmenu', e => e.preventDefault());

canvas.addEventListener('pointerdown', e => {
  if (!game.running) return;
  canvas.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), zoom: camZoom };
    drag = null;
    return;
  }
  drag = { x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, button: e.button, type: e.pointerType, moved: false };
});

canvas.addEventListener('pointermove', e => {
  mouse = { x: e.clientX, y: e.clientY, inside: true };
  if (!pointers.has(e.pointerId)) return;
  const prev = pointers.get(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pinch && pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    camZoom = THREE.MathUtils.clamp(pinch.zoom * pinch.d / Math.max(10, Math.hypot(a.x - b.x, a.y - b.y)), 0.45, 2.2);
    return;
  }
  if (!drag) return;
  drag.x = e.clientX; drag.y = e.clientY;
  if (Math.hypot(drag.x - drag.x0, drag.y - drag.y0) > 8) drag.moved = true;
  if (!drag.moved) return;
  if (drag.type === 'touch' || drag.button === 1) {
    // 觸控拖曳／中鍵：平移鏡頭
    const a = screenToGround(prev.x, prev.y), b = screenToGround(e.clientX, e.clientY);
    if (a && b) camTarget.add(a.sub(b));
  } else if (drag.button === 0) {
    const x = Math.min(drag.x0, drag.x), y = Math.min(drag.y0, drag.y);
    Object.assign(ui.selbox.style, { display: 'block', left: x + 'px', top: y + 'px', width: Math.abs(drag.x - drag.x0) + 'px', height: Math.abs(drag.y - drag.y0) + 'px' });
  }
});

function endPointer(e) {
  pointers.delete(e.pointerId);
  if (pinch) { if (pointers.size < 2) pinch = null; drag = null; return; }
  const d = drag;
  drag = null;
  ui.selbox.style.display = 'none';
  if (!d || e.type === 'pointercancel') return;

  if (d.button === 2) {
    // 右鍵：下達指令
    issueCommand(screenToGround(e.clientX, e.clientY), pickEntity(e.clientX, e.clientY), attackMoveMode || keys.has('a'));
    setAttackMove(false);
    return;
  }
  if (d.button !== 0) return;

  if (d.moved && d.type !== 'touch') {
    // 框選
    const x0 = Math.min(d.x0, d.x), x1 = Math.max(d.x0, d.x), y0 = Math.min(d.y0, d.y), y1 = Math.max(d.y0, d.y);
    const list = entities.filter(u => u.kind === 'unit' && u.team === 0 && !u.dead).filter(u => {
      const s = worldToScreen(u.pos, 1);
      return s.x >= x0 && s.x <= x1 && s.y >= y0 && s.y <= y1;
    });
    if (e.shiftKey) setSelection([...selection, ...list]);
    else setSelection(list);
    return;
  }
  if (d.moved) return;

  // 點擊
  const hit = pickEntity(e.clientX, e.clientY);
  if (attackMoveMode) {
    issueCommand(screenToGround(e.clientX, e.clientY), hit, true);
    setAttackMove(false);
    return;
  }
  if (hit && hit.team === 0) {
    if (e.shiftKey && hit.kind === 'unit') {
      if (selection.has(hit)) { hit.setSelected(false); selection.delete(hit); }
      else { hit.setSelected(true); selection.add(hit); }
    } else setSelection([hit]);
    return;
  }
  if (d.type === 'touch' && selectedUnits().length) {
    // 觸控：點地面或敵人直接下指令
    issueCommand(screenToGround(e.clientX, e.clientY), hit, false);
    return;
  }
  setSelection([]);
}
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);
canvas.addEventListener('pointerleave', () => { mouse.inside = false; });

canvas.addEventListener('wheel', e => {
  e.preventDefault();
  camZoom = THREE.MathUtils.clamp(camZoom * (1 + Math.sign(e.deltaY) * 0.1), 0.45, 2.2);
}, { passive: false });

addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  keys.add(k);
  if (!game.running) return;
  if ((e.ctrlKey || e.metaKey) && k === 'a') { e.preventDefault(); selectAll(); return; }
  if (k === 'q') trainPlayer();
  if (k === 'x') for (const u of selectedUnits()) u.stop();
  if (k === ' ') { camTarget.copy(game.hq[0].pos); }
});
addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
addEventListener('blur', () => keys.clear());

function selectAll() { setSelection(entities.filter(e => e.kind === 'unit' && e.team === 0 && !e.dead)); }
function trainPlayer() {
  if (!game.hq[0].train()) game.flash(game.hq[0].queue >= 9 ? '訓練佇列已滿' : '資金不足');
}
function setAttackMove(v) {
  attackMoveMode = v;
  ui.amoveBtn.classList.toggle('selected', v);
}

ui.trainBtn.addEventListener('click', trainPlayer);
document.getElementById('selAllBtn').addEventListener('click', selectAll);
document.getElementById('stopBtn').addEventListener('click', () => { for (const u of selectedUnits()) u.stop(); });
ui.amoveBtn.addEventListener('click', () => setAttackMove(!attackMoveMode));

// 小地圖
const mm = ui.minimap.getContext('2d');
function drawMinimap() {
  const W = ui.minimap.width;
  const s = W / (MAP * 2);
  mm.fillStyle = '#3d5228';
  mm.fillRect(0, 0, W, W);
  mm.fillStyle = '#2a3a1c';
  for (const o of obstacles) mm.fillRect((o.pos.x + MAP) * s - 1, (o.pos.z + MAP) * s - 1, 2, 2);
  for (const e of entities) {
    if (e.dead) continue;
    mm.fillStyle = e.team === 0 ? (e.selected ? '#9f9' : '#4af') : '#f44';
    const x = (e.pos.x + MAP) * s, z = (e.pos.z + MAP) * s;
    if (e.kind === 'hq') mm.fillRect(x - 5, z - 5, 10, 10);
    else mm.fillRect(x - 1.5, z - 1.5, 3, 3);
  }
  // 視野框
  const corners = [[0, 0], [innerWidth, 0], [innerWidth, innerHeight], [0, innerHeight]].map(([x, y]) => screenToGround(x, y));
  if (corners.every(Boolean)) {
    mm.strokeStyle = '#fff';
    mm.beginPath();
    corners.forEach((p, i) => mm[i ? 'lineTo' : 'moveTo']((p.x + MAP) * s, (p.z + MAP) * s));
    mm.closePath();
    mm.stroke();
  }
}
function minimapToWorld(e) {
  const r = ui.minimap.getBoundingClientRect();
  return new THREE.Vector3(((e.clientX - r.left) / r.width * 2 - 1) * MAP, 0, ((e.clientY - r.top) / r.height * 2 - 1) * MAP);
}
ui.minimap.addEventListener('pointerdown', e => {
  e.preventDefault();
  if (e.button === 2) issueCommand(minimapToWorld(e), null, keys.has('a'));
  else { camTarget.copy(minimapToWorld(e)); ui.minimap.setPointerCapture(e.pointerId); }
});
ui.minimap.addEventListener('pointermove', e => { if (e.buttons & 1) camTarget.copy(minimapToWorld(e)); });
ui.minimap.addEventListener('contextmenu', e => e.preventDefault());

// ---------- 鏡頭 ----------
function updateCamera(dt) {
  if (game.running) {
    const speed = 40 * camZoom * dt;
    let dx = 0, dz = 0;
    if (keys.has('arrowup')) dz -= 1;
    if (keys.has('arrowdown')) dz += 1;
    if (keys.has('arrowleft')) dx -= 1;
    if (keys.has('arrowright')) dx += 1;
    const edge = 12;
    if (mouse.inside && !drag && matchMedia('(pointer: fine)').matches) {
      if (mouse.x < edge) dx -= 1;
      if (mouse.x > innerWidth - edge) dx += 1;
      if (mouse.y < edge) dz -= 1;
      if (mouse.y > innerHeight - edge) dz += 1;
    }
    camTarget.x = THREE.MathUtils.clamp(camTarget.x + dx * speed, -MAP, MAP);
    camTarget.z = THREE.MathUtils.clamp(camTarget.z + dz * speed, -MAP, MAP);
    camera.position.set(camTarget.x, 34 * camZoom, camTarget.z + 24 * camZoom);
    camera.lookAt(camTarget);
  } else {
    // 選單畫面：環繞預覽角色
    const t = performance.now() / 1000;
    camera.position.set(Math.sin(t * 0.3) * 7, 3.4, Math.cos(t * 0.3) * 7);
    camera.lookAt(0, 1.6, 0);
  }
}

// ---------- 選單預覽 ----------
let preview = null;
function showPreview() {
  if (game.running) return;
  preview = new Unit(0, new THREE.Vector3(0, 0, 0));
  preview.ring.visible = false;
  preview.hpBar.visible = false;
  preview.setAnim('walk');
}
function clearPreview() {
  if (preview) { preview.dispose(); preview = null; }
}

// ---------- 選單 ----------
document.querySelectorAll('.diff button').forEach(b => b.addEventListener('click', () => {
  document.querySelectorAll('.diff button').forEach(x => x.classList.remove('selected'));
  b.classList.add('selected');
  game.difficulty = parseFloat(b.dataset.diff);
}));
startBtn.addEventListener('click', () => game.start());
document.getElementById('againBtn').addEventListener('click', () => game.start());

// ---------- 主迴圈 ----------
function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  // 選單時把預覽角色推到畫面右側（寬螢幕）
  if (!game.running && innerWidth > 900) camera.setViewOffset(innerWidth, innerHeight, -innerWidth * 0.22, 0, innerWidth, innerHeight);
  else camera.clearViewOffset();
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  updateCamera(dt);
  if (game.running) game.update(dt);
  else if (preview) { preview.mixer.update(dt); preview.sync(); }
  renderer.render(scene, camera);
});

// 供除錯使用
window.__game = { game, entities: () => entities, camera, camTarget, setSelection, issueCommand, THREE,
  step(n, dt = 1 / 30) { for (let i = 0; i < n; i++) game.update(dt); } };
