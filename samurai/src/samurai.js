// Procedural, rigged 3D model of an armoured samurai (o-yoroi style).
// Units are metres, +Y is up and the figure faces +Z.
//
// buildSamurai(THREE, { mergeGeometries, mergeVertices }) returns
//   { model, clips, report }
// model  - Group holding the bone hierarchy (root bone "Hips") and one SkinnedMesh
// clips  - AnimationClips: Idle, Walk, Attack, Pose_Reference
// report - max IK reach error per clip (metres), for sanity checks
//
// Most armour is rigid, so most vertices are bound 100% to one bone. Parts that
// sit across a joint (hakama at the hip, kusazuri over the thighs, sode over the
// shoulder) blend between two bones.

export function buildSamurai(THREE, { mergeGeometries, mergeVertices }) {
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const Y = V(0, 1, 0);
  const clamp01 = (v) => Math.min(1, Math.max(0, v));

  const std = (name, color, roughness, metalness = 0, extra = {}) =>
    new THREE.MeshStandardMaterial({ name, color, roughness, metalness, ...extra });

  const M = {
    lacquer: std('black_lacquer', 0x17181c, 0.3, 0.35),
    lacquerDull: std('black_lacquer_dull', 0x1d1e22, 0.55, 0.2),
    lace: std('white_lacing', 0xe8e1cc, 0.85),
    cloth: std('white_cloth', 0xdcd5c2, 0.95, 0, { side: THREE.DoubleSide }),
    hakama: std('hakama', 0x26272e, 0.9),
    gold: std('gold', 0xc9a04a, 0.32, 1),
    skin: std('skin', 0xb9805c, 0.7),
    hair: std('hair', 0x16120f, 0.8),
    eye: std('eye', 0x080808, 0.4),
    steel: std('steel', 0xd8dde2, 0.16, 1),
    hilt: std('hilt_wrap', 0x231a14, 0.8),
    rope: std('rope', 0xe3dccb, 0.9),
    straw: std('straw', 0x7d6142, 0.9),
    banner: std('banner', 0xece6d6, 0.95, 0, { side: THREE.DoubleSide }),
    pole: std('pole', 0x101010, 0.45, 0.1),
  };

  const root = new THREE.Group();
  root.name = 'Samurai';

  // ---------- geometry helpers (all coordinates are in the parent's local space) ----------
  function add(geo, mat, parent, name) {
    const m = new THREE.Mesh(geo, mat);
    if (name) m.name = name;
    parent.add(m);
    return m;
  }

  // Cylinder from a to b (radius r1 at a, r2 at b).
  function tube(a, b, r1, r2, mat, parent, seg = 18) {
    const len = a.distanceTo(b);
    const g = new THREE.CylinderGeometry(r2, r1, len, seg, 1);
    g.translate(0, len / 2, 0);
    const m = add(g, mat, parent);
    m.position.copy(a);
    m.quaternion.setFromUnitVectors(Y, b.clone().sub(a).normalize());
    return m;
  }

  function ball(p, r, mat, parent, s = [1, 1, 1]) {
    const m = add(new THREE.SphereGeometry(r, 20, 14), mat, parent);
    m.position.copy(p);
    m.scale.set(...s);
    return m;
  }

  function box(w, h, d, mat, parent, pos, rot) {
    const m = add(new THREE.BoxGeometry(w, h, d), mat, parent);
    if (pos) m.position.copy(pos);
    if (rot) m.rotation.set(...rot);
    return m;
  }

  // Group whose local +Y points along yDir and local +X as close to xHint as possible.
  function frame(origin, yDir, xHint, parent) {
    const y = yDir.clone().normalize();
    const x = xHint.clone().sub(y.clone().multiplyScalar(xHint.dot(y))).normalize();
    const z = new THREE.Vector3().crossVectors(x, y);
    const g = new THREE.Group();
    g.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
    g.position.copy(origin);
    parent.add(g);
    return g;
  }

  // Lathe along local Y: profile is [[radius, y], ...].
  function lathe(profile, mat, parent, seg = 24) {
    const pts = profile.map(([r, y]) => new THREE.Vector2(r, y));
    return add(new THREE.LatheGeometry(pts, seg), mat, parent);
  }

  // Lamellar panel (rows of lacquered plates with white lacing), hanging down from local y=0.
  function lamellarPanel(parent, w, rows, rowH, { flare = 0.006, cols = 7, edge = true } = {}) {
    for (let i = 0; i < rows; i++) {
      const y = -(i + 0.5) * rowH;
      const z = i * flare;
      box(w, rowH * 1.12, 0.014, M.lacquer, parent, V(0, y, z));
      for (let c = 0; c < cols; c++) {
        const x = -w / 2 + (w / cols) * (c + 0.5);
        box(0.012, rowH * 0.42, 0.006, M.lace, parent, V(x, y + rowH * 0.12, z + 0.009));
        box(0.012, rowH * 0.2, 0.006, M.lace, parent, V(x, y - rowH * 0.3, z + 0.009));
      }
    }
    if (edge) {
      box(w + 0.01, 0.022, 0.02, M.lacquer, parent, V(0, 0.004, -0.002));
      box(w + 0.012, 0.004, 0.022, M.gold, parent, V(0, 0.016, -0.002));
    }
    for (const sx of [-1, 1]) {
      box(0.008, rows * rowH, 0.006, M.lace, parent, V(sx * (w / 2 - 0.004), -rows * rowH / 2, rows * flare / 2 + 0.01),
        [Math.atan2(-rows * flare, rows * rowH), 0, 0]);
    }
  }

  // Ring of lacing marks on an elliptical band.
  function laceRing(parent, y, r, zs, from, to, step, h) {
    for (let t = from; t <= to + 1e-6; t += step) {
      const m = box(0.012, h, 0.006, M.lace, parent, V(r * Math.sin(t), y, r * Math.cos(t) * zs));
      m.rotation.y = Math.atan2(Math.sin(t) * zs, Math.cos(t));
    }
  }

  // ---------- skeleton ----------
  // Limb bones point their local +Y along the limb and their local +Z towards the
  // direction the joint bends (knee forward, elbow down/out).
  const LEN = { thigh: 0.44, shin: 0.44, upper: 0.3, fore: 0.28, clav: 0.15 };
  const bones = [];
  function bone(name, parent, pos) {
    const b = new THREE.Bone();
    b.name = name;
    b.position.copy(pos);
    parent.add(b);
    bones.push(b);
    return b;
  }
  const hips = bone('Hips', root, V(0, 0.93, 0));
  const spine = bone('Spine', hips, V(0, 0.05, 0));
  const neck = bone('Neck', spine, V(0, 0.49, 0.01));
  const head = bone('Head', neck, V(0, 0.12, 0.01));
  const clav = {}, upperArm = {}, lowerArm = {}, hand = {}, upperLeg = {}, lowerLeg = {}, foot = {};
  const SIDES = [['R', -1], ['L', 1]]; // figure's right is -X
  for (const [s, sx] of SIDES) {
    clav[s] = bone(`Shoulder_${s}`, spine, V(sx * 0.05, 0.43, 0));
    clav[s].quaternion.setFromUnitVectors(Y, V(sx, 0, 0));
    upperArm[s] = bone(`UpperArm_${s}`, clav[s], V(0, LEN.clav, 0));
    lowerArm[s] = bone(`LowerArm_${s}`, upperArm[s], V(0, LEN.upper, 0));
    hand[s] = bone(`Hand_${s}`, lowerArm[s], V(0, LEN.fore, 0));
    upperLeg[s] = bone(`UpperLeg_${s}`, hips, V(sx * 0.1, -0.05, 0));
    lowerLeg[s] = bone(`LowerLeg_${s}`, upperLeg[s], V(0, LEN.thigh, 0));
    foot[s] = bone(`Foot_${s}`, lowerLeg[s], V(0, LEN.shin, 0));
  }
  // Hands share the sword's frame (+Y along the blade, +X towards the edge).
  // The wrist sits behind the grip point, on the back (mune) side.
  const WRIST = V(-0.04, -0.03, 0); // wrist relative to grip, sword frame
  const GRIP = { R: 0.19, L: 0.07 }; // grip distance from the pommel
  const katana = bone('Katana', hand.R, V(-WRIST.x, -WRIST.y - GRIP.R, 0)); // origin = pommel

  // ---------- posing (controls -> bone rotations, with 2-bone IK) ----------
  function ik(A, C, a, b, pole) {
    const dir = C.clone().sub(A);
    const d = Math.min(dir.length(), a + b - 1e-4);
    dir.normalize();
    const x = (a * a - b * b + d * d) / (2 * d);
    const h = Math.sqrt(Math.max(0, a * a - x * x));
    const p = pole.clone().sub(dir.clone().multiplyScalar(pole.dot(dir))).normalize();
    return A.clone().add(dir.multiplyScalar(x)).add(p.multiplyScalar(h));
  }
  const basisQuat = (x, y, z) => new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
  function aimQuat(yDir, zHint) {
    const y = yDir.clone().normalize();
    const z = zHint.clone().sub(y.clone().multiplyScalar(zHint.dot(y))).normalize();
    return basisQuat(new THREE.Vector3().crossVectors(y, z), y, z);
  }
  const _pq = new THREE.Quaternion();
  function setWorldQuat(b, q) {
    b.parent.getWorldQuaternion(_pq);
    b.quaternion.copy(_pq.invert().multiply(q));
    b.updateMatrixWorld(true);
  }
  const vec = (a) => V(a[0], a[1], a[2]);
  const eul = (a) => new THREE.Euler(a[0], a[1], a[2], 'YXZ');
  const worldPos = (o) => o.getWorldPosition(V(0, 0, 0));

  // Returns the IK reach error (m): how far the chains fell short of their targets.
  function applyPose(c) {
    hips.position.copy(vec(c.hips.pos));
    hips.quaternion.setFromEuler(eul(c.hips.rot));
    spine.quaternion.setFromEuler(eul(c.spine));
    neck.quaternion.identity();
    head.quaternion.setFromEuler(eul(c.head));
    root.updateMatrixWorld(true);
    let err = 0;

    for (const [s] of SIDES) {
      const f = c.feet[s];
      const hip = worldPos(upperLeg[s]);
      const ankle = vec(f.pos);
      const pole = vec(f.pole).normalize();
      const knee = ik(hip, ankle, LEN.thigh, LEN.shin, pole);
      setWorldQuat(upperLeg[s], aimQuat(knee.clone().sub(hip), pole));
      setWorldQuat(lowerLeg[s], aimQuat(ankle.clone().sub(knee), pole));
      const fwd = V(Math.sin(f.yaw), 0, Math.cos(f.yaw));
      const right = new THREE.Vector3().crossVectors(fwd, Y);
      const q = new THREE.Quaternion().setFromAxisAngle(right, -f.pitch).multiply(basisQuat(right, fwd, Y));
      setWorldQuat(foot[s], q);
      err = Math.max(err, worldPos(foot[s]).distanceTo(ankle));
    }

    const sw = c.sword;
    const P = vec(sw.pommel), d = vec(sw.dir).normalize(), e = vec(sw.edge);
    const poles = { R: vec(sw.poleR), L: vec(sw.poleL) };
    if (sw.space === 'spine') {
      const sq = spine.getWorldQuaternion(new THREE.Quaternion());
      P.applyMatrix4(spine.matrixWorld);
      for (const v of [d, e, poles.R, poles.L]) v.applyQuaternion(sq);
    }
    const x = e.sub(d.clone().multiplyScalar(e.dot(d))).normalize();
    const swordQ = basisQuat(x, d, new THREE.Vector3().crossVectors(x, d));
    for (const [s] of SIDES) {
      const grip = P.clone().add(d.clone().multiplyScalar(GRIP[s]));
      const wrist = grip.add(WRIST.clone().applyQuaternion(swordQ));
      const sh = worldPos(upperArm[s]);
      const pole = poles[s].normalize();
      const elbow = ik(sh, wrist, LEN.upper, LEN.fore, pole);
      setWorldQuat(upperArm[s], aimQuat(elbow.clone().sub(sh), pole));
      setWorldQuat(lowerArm[s], aimQuat(wrist.clone().sub(elbow), pole));
      setWorldQuat(hand[s], swordQ);
      err = Math.max(err, worldPos(hand[s]).distanceTo(wrist));
    }
    return err;
  }

  // ---------- poses and motion ----------
  const TAU = Math.PI * 2;
  const clone = (o) => JSON.parse(JSON.stringify(o));
  function merge(a, b) {
    for (const k in b) {
      if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k])) merge(a[k], b[k]);
      else a[k] = b[k];
    }
    return a;
  }
  function mix(a, b, s) {
    if (typeof a === 'number') return a + (b - a) * s;
    if (typeof a === 'string') return a;
    if (Array.isArray(a)) return a.map((v, i) => mix(v, b[i], s));
    const o = {};
    for (const k in a) o[k] = mix(a[k], b[k], s);
    return o;
  }
  const EASE = {
    linear: (s) => s,
    inout: (s) => s * s * (3 - 2 * s),
    in: (s) => s * s * s,
    out: (s) => 1 - (1 - s) ** 2,
  };

  // Chudan-no-kamae: sword held in front, tip at throat height, right foot forward.
  function idle(t) {
    const b = Math.sin((TAU * t) / 2.4);
    return {
      hips: { pos: [0, 0.925 + 0.004 * b, 0], rot: [0, 0, 0] },
      spine: [0.06 + 0.012 * b, 0, 0],
      head: [-0.04 - 0.01 * b, 0, 0],
      feet: {
        R: { pos: [-0.11, 0.1, 0.14], yaw: -0.05, pitch: 0, pole: [-0.15, 0, 1] },
        L: { pos: [0.12, 0.1 + 0.17 * Math.sin(0.12), -0.17], yaw: 0.2, pitch: 0.12, pole: [0.25, 0, 1] },
      },
      sword: {
        space: 'spine', pommel: [0, 0.06 + 0.006 * b, 0.2], dir: [0, 0.45, 1], edge: [0, -1, 0],
        poleR: [-0.6, -1, 0], poleL: [0.6, -1, 0],
      },
    };
  }

  // In-place walk, sword kept in chudan. Ground speed = 2*S / (stance * T).
  const WALK = { T: 1.0, S: 0.2, stance: 0.6 };
  function walkLeg(ph, x, sx) {
    ph = ((ph % 1) + 1) % 1;
    let z, y = 0.1, pitch = 0;
    if (ph < WALK.stance) {
      const s = ph / WALK.stance;
      z = WALK.S - 2 * WALK.S * s;
      if (s < 0.15) pitch = -0.15 * (1 - s / 0.15); // heel strike, settling flat
      if (s > 0.75) pitch = 0.4 * ((s - 0.75) / 0.25); // heel rises, toe pushes off
    } else {
      const s = (ph - WALK.stance) / (1 - WALK.stance);
      z = -WALK.S + 2 * WALK.S * EASE.inout(s);
      y += 0.075 * Math.sin(Math.PI * s);
      pitch = 0.4 + (-0.15 - 0.4) * s;
    }
    y += 0.17 * Math.sin(Math.max(pitch, 0));
    return { pos: [x, y, z], yaw: sx * 0.06, pitch, pole: [sx * 0.1, 0, 1] };
  }
  function walk(t) {
    const p = (t / WALK.T) % 1;
    const c = TAU * p;
    const mid = c - TAU * 0.3; // right leg mid-stance
    return {
      hips: { pos: [-0.018 * Math.cos(mid), 0.912 + 0.012 * Math.cos(2 * mid), 0], rot: [0.03, 0.07 * Math.cos(c), 0.03 * Math.cos(mid)] },
      spine: [0.08, -0.1 * Math.cos(c), -0.03 * Math.cos(mid)],
      head: [-0.06, 0.03 * Math.cos(c), 0],
      feet: { R: walkLeg(p, -0.11, -1), L: walkLeg(p + 0.5, 0.11, 1) },
      sword: {
        space: 'spine', pommel: [0, 0.06 + 0.008 * Math.cos(2 * mid), 0.2], dir: [0, 0.45, 1], edge: [0, -1, 0],
        poleR: [-0.6, -1, 0], poleL: [0.6, -1, 0],
      },
    };
  }

  // Attack: raise over the right shoulder, step in, diagonal kesa-giri cut, hold, return.
  const base = idle(0);
  const K = (o) => merge(clone(base), o);
  const strike = K({
    hips: { pos: [0.02, 0.85, 0.22], rot: [0, 0.25, 0] },
    spine: [0.22, 0.2, 0.05],
    head: [-0.15, -0.3, 0],
    feet: { R: { pos: [-0.11, 0.1, 0.5], pitch: 0 }, L: { pos: [0.12, 0.12, -0.1], pitch: 0.15, yaw: 0.3 } },
    sword: { pommel: [-0.01, 0.18, 0.16], dir: [0.31, -0.31, 0.9], edge: [0.3, -1, -0.2], poleR: [-0.4, -1, -0.4], poleL: [0.8, -1, 0] },
  });
  const attackKeys = [
    [0.0, base],
    [0.4, K({
      hips: { pos: [0, 0.935, -0.04], rot: [0, -0.12, 0] },
      spine: [-0.05, -0.1, 0],
      head: [-0.12, 0.1, 0],
      feet: { L: { pos: [0.12, 0.1, -0.19], pitch: 0 } },
      sword: { pommel: [-0.2, 0.62, 0.22], dir: [-0.33, 0.57, -0.66], edge: [0.2, 0.7, 0.6], poleR: [-1, -0.2, -0.2], poleL: [1, -0.4, 0] },
    }), 'inout'],
    [0.52, K({
      hips: { pos: [0, 0.92, 0.1], rot: [0, 0, 0] },
      spine: [0.08, 0.05, 0],
      head: [-0.08, 0, 0],
      feet: { R: { pos: [-0.11, 0.17, 0.36], pitch: -0.2 }, L: { pos: [0.12, 0.13, -0.15], pitch: 0.2 } },
      sword: { pommel: [-0.08, 0.5, 0.32], dir: [-0.15, 0.75, 0.6], edge: [0.1, -0.4, 1], poleR: [-1, -0.6, 0], poleL: [1, -0.6, 0] },
    }), 'in'],
    [0.64, strike, 'out'],
    [0.95, merge(clone(strike), { hips: { pos: [0.02, 0.86, 0.21] }, sword: { pommel: [-0.01, 0.2, 0.17] } }), 'inout'],
    [1.5, base, 'inout'],
  ];
  function attack(t) {
    let i = 1;
    while (i < attackKeys.length - 1 && t > attackKeys[i][0]) i++;
    const [t0, a] = attackKeys[i - 1];
    const [t1, b, ease] = attackKeys[i];
    return mix(a, b, EASE[ease](clamp01((t - t0) / (t1 - t0))));
  }

  // The pose from the reference image: wide lunge, sword raised to the upper right.
  function reference(t) {
    const b = Math.sin((TAU * t) / 2.4);
    return {
      hips: { pos: [0, 0.8 + 0.004 * b, 0], rot: [0, 0.3, 0] },
      spine: [0.12 + 0.01 * b, 0.2, -0.16],
      head: [0.22, 0.32, 0.08],
      feet: {
        R: { pos: [-0.58, 0.1, -0.08], yaw: -0.64, pitch: 0, pole: [-0.5, 0, 0.9] },
        L: { pos: [0.52, 0.1, 0.12], yaw: 0.64, pitch: 0, pole: [0.7, 0.2, 0.6] },
      },
      sword: {
        space: 'world', pommel: [0.3, 0.86 + 0.004 * b, 0.32], dir: [0.55, 1, -0.3], edge: [1, -0.55, 0],
        poleR: [-0.3, -1, 0.4], poleL: [0.6, -1, -0.3],
      },
    };
  }

  // ---------- rest (bind) pose ----------
  applyPose(idle(0));
  const restSpineX = V(1, 0, 0).applyQuaternion(spine.getWorldQuaternion(new THREE.Quaternion()));

  // ---------- legs ----------
  for (const [s, sx] of SIDES) {
    const tl = LEN.thigh, sl = LEN.shin;
    const thighFrame = upperLeg[s], shinFrame = lowerLeg[s];
    // baggy hakama thigh; the top blends into the hips so the seat does not tear
    const th = lathe([[0.001, -0.02], [0.12, 0.0], [0.15, tl * 0.3], [0.165, tl * 0.65], [0.15, tl * 0.95], [0.12, tl + 0.06], [0.001, tl + 0.08]], M.hakama, thighFrame);
    th.userData.skin = (lp) => {
      const w = clamp01(1 - lp.y / 0.14) * 0.5;
      return [[upperLeg[s], 1 - w], [hips, w]];
    };
    lathe([[0.001, -0.04], [0.135, -0.02], [0.13, sl * 0.12], [0.09, sl * 0.3], [0.001, sl * 0.32]], M.hakama, shinFrame);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const m = box(0.012, tl * 0.75, 0.02, M.hakama, thighFrame, V(Math.sin(a) * 0.155, tl * 0.5, Math.cos(a) * 0.155));
      m.rotation.y = a;
    }
    // suneate (shin guard): splinted plates on the front (+Z)
    lathe([[0.075, sl * 0.08], [0.07, sl * 0.4], [0.055, sl * 0.95], [0.05, sl * 1.0]], M.lacquer, shinFrame, 16);
    for (let i = -2; i <= 2; i++) {
      const a = i * 0.45;
      const m = box(0.022, sl * 0.86, 0.01, M.lacquer, shinFrame, V(Math.sin(a) * 0.072, sl * 0.52, Math.cos(a) * 0.072));
      m.rotation.set(-0.03, a, 0);
      box(0.004, sl * 0.86, 0.012, M.gold, shinFrame, V(Math.sin(a) * 0.072 + Math.cos(a) * 0.011, sl * 0.52, Math.cos(a) * 0.072 - Math.sin(a) * 0.011)).rotation.set(-0.03, a, 0);
    }
    const kg = add(new THREE.SphereGeometry(0.095, 20, 12, -1.1, 2.2, 0.25, 1.2), M.lacquer, shinFrame);
    kg.position.set(0, 0.03, 0.01);
    kg.scale.set(1, 1.15, 0.9);
    for (const t of [0.1, 0.42, 0.8]) {
      const r = 0.08 - t * 0.025;
      for (const [dy, rr, tt] of [[0, r, 0.009], [0.018, r + 0.002, 0.007]]) {
        const tor = add(new THREE.TorusGeometry(rr, tt, 8, 28), M.rope, shinFrame);
        tor.position.set(0, sl * t + dy, 0);
        tor.rotation.x = Math.PI / 2;
      }
    }
    ball(V(0, sl * 0.42, 0.085), 0.016, M.rope, shinFrame);

    // foot: black tabi on a straw waraji. Helper frame: +X forward, +Y up, origin on the ground.
    const fh = new THREE.Group();
    fh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(V(0, 1, 0), V(0, 0, 1), V(1, 0, 0)));
    fh.position.set(0, 0, -0.1);
    foot[s].add(fh);
    ball(V(0.06, 0.055, 0), 0.06, M.lacquerDull, fh, [1.9, 0.75, 1.0]);
    ball(V(-0.02, 0.07, 0), 0.055, M.lacquerDull, fh, [1.1, 1.0, 1.0]);
    box(0.28, 0.018, 0.11, M.straw, fh, V(0.05, 0.009, 0));
    for (const x of [0.12, 0.03, -0.05]) {
      const tor = add(new THREE.TorusGeometry(0.06, 0.008, 6, 20), M.rope, fh);
      tor.position.set(x, 0.05, 0);
      tor.rotation.y = Math.PI / 2;
      tor.scale.set(1, 0.65, 1);
    }
    void sx;
  }

  // ---------- hips: hakama seat, kusazuri, scabbard ----------
  const waist = new THREE.Group(); // same origin as the spine, but follows the hips
  waist.position.set(0, 0.05, 0);
  hips.add(waist);
  const zs = 0.78;
  lathe([[0.001, -0.25], [0.2, -0.24], [0.21, -0.12], [0.18, 0.0], [0.001, 0.02]], M.hakama, waist);

  // kusazuri (tassets): lower rows follow the nearest thigh
  const tassets = [[-1.85, 0.32], [-0.95, 0.24], [0, 0.18], [0.95, 0.24], [1.85, 0.32], [Math.PI, 0.25]];
  for (const [a, splay] of tassets) {
    const g = new THREE.Group();
    g.position.set(Math.sin(a) * 0.175, -0.035, Math.cos(a) * 0.175 * zs);
    g.rotation.set(0, a, 0);
    const inner = new THREE.Group();
    inner.rotation.x = splay;
    g.add(inner);
    waist.add(g);
    lamellarPanel(inner, 0.17, 5, 0.056, { cols: 6, flare: 0.005 });
    const isBack = Math.abs(a) > 2.5;
    const isSide = Math.abs(Math.sin(a)) > 0.5;
    g.userData.skin = (lp) => {
      if (isBack) return [[hips, 1]];
      const s = isSide ? (Math.sin(a) < 0 ? 'R' : 'L') : (lp.x < 0 ? 'R' : 'L');
      const w = clamp01((0.015 - lp.y) / 0.29) * (isSide ? 0.5 : 0.6);
      return [[hips, 1 - w], [upperLeg[s], w]];
    };
  }

  // saya (scabbard) at the left hip, tip pointing back
  const sayaA = V(0.2, 0.0, 0.12), sayaB = V(0.42, -0.15, -0.6);
  tube(sayaA, sayaB, 0.02, 0.018, M.lacquer, waist, 12);
  tube(sayaA, sayaA.clone().lerp(sayaB, 0.03), 0.022, 0.022, M.gold, waist, 12);
  tube(sayaB.clone().lerp(sayaA, 0.04), sayaB, 0.02, 0.019, M.gold, waist, 12);

  // ---------- spine: cuirass, sash, banner ----------
  const torso = spine;
  const doProfile = (y) => 0.16 + 0.035 * Math.sin(Math.min(1, y / 0.36) * Math.PI * 0.6);
  const bandH = 0.052;
  for (let i = 0; i < 7; i++) {
    const y0 = 0.02 + i * bandH * 0.92;
    const r0 = doProfile(y0), r1 = doProfile(y0 + bandH);
    const band = add(new THREE.CylinderGeometry(r1, r0 + 0.004, bandH, 32, 1), M.lacquer, torso);
    band.position.y = y0 + bandH / 2;
    band.scale.z = zs;
    laceRing(torso, y0 + bandH * 0.55, (r0 + r1) / 2 + 0.006, zs, -2.6, 2.6, 0.2, bandH * 0.5);
  }
  const chestY = 0.02 + 7 * bandH * 0.92;
  const mune = add(new THREE.CylinderGeometry(0.15, 0.185, 0.07, 32, 1), M.lacquer, torso);
  mune.position.y = chestY + 0.035; mune.scale.z = zs;
  const trim = add(new THREE.TorusGeometry(0.184, 0.005, 6, 40), M.gold, torso);
  trim.position.y = chestY + 0.002; trim.rotation.x = Math.PI / 2; trim.scale.y = zs;
  ball(V(0, 0.44, 0), 0.13, M.lacquer, torso, [1.35, 0.55, 0.9]);
  const collar = add(new THREE.TorusGeometry(0.075, 0.025, 10, 24), M.cloth, torso);
  collar.position.y = 0.5; collar.rotation.x = Math.PI / 2;
  for (const sx of [-1, 1]) {
    box(0.06, 0.02, 0.28, M.lacquer, torso, V(sx * 0.1, 0.49, 0), [0, 0, sx * -0.35]);
    for (let k = -2; k <= 2; k++) box(0.012, 0.006, 0.02, M.lace, torso, V(sx * 0.1, 0.502, k * 0.05), [0, 0, sx * -0.35]);
  }

  // sash (obi) with front knot and hanging tails
  const obi = add(new THREE.TorusGeometry(0.175, 0.028, 10, 40), M.cloth, torso);
  obi.rotation.x = Math.PI / 2; obi.scale.set(1, zs + 0.04, 1.2);
  const knot = ball(V(0.03, -0.01, 0.15), 0.04, M.cloth, torso, [1.3, 1.0, 0.8]);
  knot.rotation.z = 0.3;
  for (const [x, rz, len] of [[0.0, 0.25, 0.26], [0.06, -0.12, 0.3]]) {
    const tail = add(new THREE.BoxGeometry(0.06, len, 0.012, 1, 6, 1), M.cloth, waist);
    tail.geometry.translate(0, -len / 2, 0);
    const pos = tail.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const yy = pos.getY(i);
      pos.setZ(i, pos.getZ(i) + 0.05 * Math.sin(-yy * 9) + yy * -0.12);
      pos.setX(i, pos.getX(i) * (1 + -yy * 1.2));
    }
    tail.geometry.computeVertexNormals();
    tail.position.set(x, -0.03, 0.17);
    tail.rotation.z = rz;
  }

  // wakizashi hilt tucked into the sash
  const wakA = V(0.12, 0.02, 0.15), wakB = wakA.clone().add(V(0.08, 0.05, 0.12));
  tube(wakA, wakB, 0.015, 0.015, M.hilt, torso, 10);
  tube(wakA.clone().lerp(wakB, -0.05), wakA.clone().lerp(wakB, 0.03), 0.026, 0.026, M.gold, torso, 14);

  // sashimono: pole on the back with a crossbar and banner
  const poleBase = V(-0.02, 0.05, -0.19), poleTop = V(-0.3, 1.22, -0.3);
  tube(poleBase, poleTop, 0.014, 0.012, M.pole, torso, 10);
  box(0.06, 0.05, 0.05, M.lacquer, torso, V(-0.03, 0.36, -0.2));
  box(0.06, 0.05, 0.05, M.lacquer, torso, V(-0.01, 0.1, -0.19));
  const poleDir = poleTop.clone().sub(poleBase).normalize();
  const barEnd = poleTop.clone().add(V(-0.34, 0.03, 0.02));
  tube(poleTop.clone().add(V(0.03, -0.015, 0)), barEnd, 0.011, 0.011, M.pole, torso, 10);
  ball(barEnd, 0.014, M.pole, torso);
  const bannerW = 0.3, bannerH = 0.75;
  const bannerG = frame(poleTop.clone().add(V(-0.02, -0.01, 0.01)), poleDir.clone().negate(), V(-1, 0, 0), torso);
  const bg = new THREE.PlaneGeometry(bannerW, bannerH, 12, 24);
  bg.translate(bannerW / 2 + 0.015, bannerH / 2 + 0.005, 0);
  const bp = bg.attributes.position;
  for (let i = 0; i < bp.count; i++) {
    const x = bp.getX(i), y = bp.getY(i);
    bp.setZ(i, 0.018 * Math.sin(x * 22 + y * 5) * Math.min(1, x * 6) + 0.012 * Math.sin(y * 14));
  }
  bg.computeVertexNormals();
  add(bg, M.banner, bannerG, 'Banner');
  for (let i = 0; i < 5; i++) box(0.035, 0.03, 0.03, M.banner, bannerG, V(0.012, 0.06 + i * 0.17, 0), [0, 0.2, 0]);
  for (let i = 0; i < 2; i++) box(0.03, 0.035, 0.03, M.banner, bannerG, V(0.08 + i * 0.16, -0.008, 0));

  // ---------- head ----------
  const hs = new THREE.Group();
  hs.scale.setScalar(1.15);
  head.add(hs);
  tube(V(0, -0.15, 0), V(0, -0.02, 0), 0.05, 0.048, M.skin, hs);
  ball(V(0, 0, 0), 0.092, M.skin, hs, [0.88, 1.05, 0.98]);
  ball(V(0, -0.055, 0.02), 0.065, M.skin, hs, [0.95, 0.8, 1.05]);
  const nose = add(new THREE.ConeGeometry(0.017, 0.045, 4), M.skin, hs);
  nose.position.set(0, -0.012, 0.094); nose.rotation.x = 0.35;
  for (const sx of [-1, 1]) {
    ball(V(sx * 0.031, 0.012, 0.081), 0.011, M.eye, hs, [1.4, 0.6, 0.5]);
    box(0.034, 0.008, 0.012, M.hair, hs, V(sx * 0.031, 0.03, 0.086), [0.1, 0, sx * -0.18]);
    box(0.022, 0.008, 0.012, M.hair, hs, V(sx * 0.025, -0.052, 0.083), [0.1, 0, sx * 0.6]);
    tube(V(sx * 0.075, 0.0, 0.0), V(sx * 0.02, -0.12, 0.06), 0.008, 0.008, M.rope, hs, 6);
  }
  box(0.05, 0.008, 0.012, M.hair, hs, V(0, -0.045, 0.086), [0.15, 0, 0]);
  const beard = add(new THREE.ConeGeometry(0.022, 0.05, 6), M.hair, hs);
  beard.position.set(0, -0.11, 0.06); beard.rotation.x = Math.PI + 0.3;
  ball(V(0, -0.125, 0.065), 0.016, M.rope, hs);
  add(new THREE.SphereGeometry(0.1, 20, 10, Math.PI * 0.3, Math.PI * 1.4, 0.3, 1.5), M.cloth, hs).position.set(0, 0, -0.005);

  // kabuto (helmet)
  const kab = new THREE.Group(); kab.position.set(0, 0.045, -0.01); hs.add(kab);
  add(new THREE.SphereGeometry(0.128, 32, 14, 0, Math.PI * 2, 0, Math.PI / 2), M.lacquer, kab).scale.set(1, 0.92, 1.06);
  for (let i = 0; i < 20; i++) {
    const rib = add(new THREE.TorusGeometry(0.129, 0.0035, 4, 20, Math.PI / 2), i % 5 === 0 ? M.gold : M.lacquer, kab);
    rib.rotation.y = (i / 20) * Math.PI * 2;
    rib.scale.set(1, 0.92, 1.06);
  }
  add(new THREE.CylinderGeometry(0.016, 0.02, 0.012, 16), M.gold, kab).position.y = 0.118;
  const rim = add(new THREE.TorusGeometry(0.129, 0.007, 8, 40), M.gold, kab);
  rim.rotation.x = Math.PI / 2; rim.scale.set(1, 1.06, 1);
  add(new THREE.CylinderGeometry(0.132, 0.165, 0.045, 32, 1, true, -1.1, 2.2), M.lacquer, kab).position.set(0, -0.005, 0.008);
  for (let i = 0; i < 4; i++) {
    const rt = 0.135 + i * 0.027, rb = 0.16 + i * 0.03, h = 0.05;
    const y = -0.015 - i * 0.042;
    add(new THREE.CylinderGeometry(rt, rb, h, 36, 1, true, 1.0, Math.PI * 2 - 2.0), M.lacquer, kab).position.y = y;
    for (let t = 1.1; t < Math.PI * 2 - 1.0; t += 0.24) {
      const r = (rt + rb) / 2 + 0.004;
      const m = box(0.013, 0.025, 0.006, M.lace, kab, V(r * Math.sin(t), y + 0.004, r * Math.cos(t)));
      m.rotation.set(-Math.atan2(rb - rt, h), t, 0, 'YXZ');
    }
  }
  for (const sx of [-1, 1]) {
    const w = new THREE.Group();
    w.position.set(sx * 0.125, -0.03, 0.07);
    w.rotation.set(0, sx * 0.55, 0);
    kab.add(w);
    lamellarPanel(w, 0.06, 3, 0.04, { cols: 2, flare: 0.004, edge: false });
    box(0.064, 0.012, 0.018, M.gold, w, V(0, 0.002, 0));
  }
  // crescent maedate
  const crescent = new THREE.Shape();
  const R = 0.12, c = 0.04;
  const tipA = (20 * Math.PI) / 180;
  const ri = Math.hypot(R * Math.cos(tipA), R * Math.sin(tipA) - c);
  const phi0 = Math.atan2(R * Math.sin(tipA) - c, R * Math.cos(tipA));
  const N = 40;
  for (let i = 0; i <= N; i++) {
    const th = Math.PI - tipA + (i / N) * (Math.PI + 2 * tipA);
    const p = [R * Math.cos(th), R * Math.sin(th)];
    i === 0 ? crescent.moveTo(...p) : crescent.lineTo(...p);
  }
  for (let i = 1; i < N; i++) {
    const ph = phi0 - (i / N) * (Math.PI + 2 * phi0);
    crescent.lineTo(ri * Math.cos(ph), c + ri * Math.sin(ph));
  }
  crescent.closePath();
  const cg = new THREE.ExtrudeGeometry(crescent, { depth: 0.006, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 1, curveSegments: 8 });
  cg.translate(0, 0, -0.003);
  const maedate = add(cg, M.gold, kab, 'Maedate');
  maedate.position.set(0, 0.165, 0.135);
  maedate.rotation.x = -0.22;
  maedate.scale.setScalar(1.15);
  box(0.05, 0.035, 0.012, M.gold, kab, V(0, 0.045, 0.133), [-0.3, 0, 0]);

  // ---------- arms ----------
  for (const [s, sx] of SIDES) {
    const ul = LEN.upper, fl = LEN.fore;
    // sode (large shoulder guard): halfway between the shoulder and the upper arm
    const sh = worldPos(upperArm[s]);
    const elbow = worldPos(lowerArm[s]);
    const hang = V(0, -1, 0).lerp(elbow.clone().sub(sh).normalize(), 0.45).normalize();
    const out = restSpineX.clone().multiplyScalar(sx).add(V(0, 0.3, 0)).normalize();
    const sy = hang.clone().negate();
    const sodeF = frame(sh.clone().add(out.clone().multiplyScalar(0.07)).add(V(0, 0.05, 0)), sy, new THREE.Vector3().crossVectors(sy, out), root);
    lamellarPanel(sodeF, 0.2, 6, 0.045, { cols: 7, flare: 0.008 });
    clav[s].attach(sodeF);
    sodeF.userData.skin = () => [[clav[s], 0.5], [upperArm[s], 0.5]];

    // white sleeve with a few armoured bands
    lathe([[0.001, -0.04], [0.06, -0.02], [0.075, ul * 0.4], [0.07, ul * 0.85], [0.055, ul + 0.03], [0.001, ul + 0.05]], M.cloth, upperArm[s], 16);
    for (let i = 0; i < 3; i++) {
      add(new THREE.CylinderGeometry(0.074, 0.074, 0.03, 16, 1, true, -1.2, 2.4), M.lacquer, upperArm[s]).position.y = ul * (0.35 + i * 0.2);
    }
    // kote (forearm guard)
    const ff = lowerArm[s];
    lathe([[0.001, -0.03], [0.05, -0.01], [0.052, fl * 0.35], [0.042, fl * 0.85], [0.036, fl], [0.001, fl + 0.005]], M.lacquer, ff, 16);
    for (let i = 0; i < 5; i++) {
      const a = -1.0 + i * 0.5 + Math.PI;
      box(0.004, fl * 0.85, 0.006, M.gold, ff, V(Math.sin(a) * 0.05, fl * 0.47, Math.cos(a) * 0.05), [0, a, 0]);
    }
    for (const t of [0.15, 0.95]) {
      const band = add(new THREE.TorusGeometry(0.052 - t * 0.014, 0.007, 6, 20), M.rope, ff);
      band.position.y = fl * t; band.rotation.x = Math.PI / 2;
    }
    ball(V(0, 0, 0), 0.06, M.lacquer, ff);
    // hand (origin at the wrist): gloved fist closed around the hilt
    const g = WRIST.clone().negate();
    tube(V(0, -0.01, 0), g, 0.036, 0.038, M.skin, hand[s], 12);
    ball(g, 0.036, M.skin, hand[s], [1.0, 1.15, 1.0]);
    ball(g.clone().add(V(-0.012, 0, 0)), 0.038, M.lacquerDull, hand[s], [0.85, 1.1, 1.05]);
  }

  // ---------- katana (origin at the pommel, +Y along the blade, edge towards +X) ----------
  const hiltLen = 0.27;
  tube(V(0, 0, 0), V(0, hiltLen, 0), 0.016, 0.017, M.hilt, katana, 12).scale.z = 0.8;
  for (let i = 0; i < 8; i++) {
    for (const z of [0.0145, -0.0145]) box(0.012, 0.012, 0.004, M.lace, katana, V(0, 0.03 + i * 0.03, z), [0, 0, Math.PI / 4]);
  }
  tube(V(0, -0.012, 0), V(0, 0.012, 0), 0.019, 0.018, M.gold, katana, 14);
  tube(V(0, hiltLen - 0.012, 0), V(0, hiltLen, 0), 0.018, 0.019, M.gold, katana, 14);
  const tsuba = add(new THREE.CylinderGeometry(0.044, 0.044, 0.008, 28), M.gold, katana);
  tsuba.position.y = hiltLen + 0.004; tsuba.scale.z = 0.85;
  const tsubaRim = add(new THREE.TorusGeometry(0.044, 0.004, 6, 28), M.lacquer, katana);
  tsubaRim.position.y = hiltLen + 0.004; tsubaRim.rotation.x = Math.PI / 2; tsubaRim.scale.y = 0.85;
  box(0.032, 0.03, 0.012, M.gold, katana, V(0.002, hiltLen + 0.022, 0));
  const bladeLen = 0.72, w0 = 0.031, w1 = 0.024, sori = -0.03;
  const b0 = hiltLen + 0.008;
  const cx = (t) => sori * (t / bladeLen) ** 2; // curves away from the edge
  const blade = new THREE.Shape();
  const S = 30;
  blade.moveTo(-w0 / 2, b0);
  for (let i = 1; i <= S; i++) {
    const t = (i / S) * (bladeLen - 0.05);
    blade.lineTo(cx(t) - (w0 + (w1 - w0) * (t / bladeLen)) / 2, b0 + t);
  }
  blade.lineTo(cx(bladeLen) - 0.004, b0 + bladeLen);
  for (let i = S; i >= 0; i--) {
    const t = (i / S) * (bladeLen - 0.05);
    blade.lineTo(cx(t) + (w0 + (w1 - w0) * (t / bladeLen)) / 2, b0 + t);
  }
  blade.closePath();
  const bgeo = new THREE.ExtrudeGeometry(blade, { depth: 0.004, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.0035, bevelSegments: 1, curveSegments: 4 });
  bgeo.translate(0, 0, -0.002);
  add(bgeo, M.steel, katana, 'Blade');

  // ---------- bake to one skinned mesh ----------
  root.updateMatrixWorld(true);
  const boneIndex = new Map(bones.map((b, i) => [b, i]));
  const parts = [];
  root.traverse((o) => { if (o.isMesh) parts.push(o); });
  const byMat = new Map();
  const wp = V(0, 0, 0), lp = V(0, 0, 0);
  for (const o of parts) {
    let owner = o.parent;
    while (!owner.isBone) owner = owner.parent;
    let rule = null;
    for (let p = o; p && !rule; p = p.parent) rule = p.userData.skin || null;
    const ownerInv = owner.matrixWorld.clone().invert();
    const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    const pos = g.attributes.position;
    const si = new Uint16Array(pos.count * 4), swt = new Float32Array(pos.count * 4);
    for (let i = 0; i < pos.count; i++) {
      wp.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
      lp.copy(wp).applyMatrix4(ownerInv);
      const ws = (rule ? rule(lp, wp) : [[owner, 1]]).filter(([, w]) => w > 1e-4);
      const sum = ws.reduce((acc, [, w]) => acc + w, 0);
      ws.forEach(([b, w], j) => { si[i * 4 + j] = boneIndex.get(b); swt[i * 4 + j] = w / sum; });
    }
    g.applyMatrix4(o.matrixWorld);
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(swt, 4));
    if (!byMat.has(o.material)) byMat.set(o.material, []);
    byMat.get(o.material).push(g);
  }
  for (const b of bones) for (const ch of [...b.children]) if (!ch.isBone) b.remove(ch);

  const mats = [...byMat.keys()];
  const geometry = mergeGeometries(mats.map((m) => mergeVertices(mergeGeometries(byMat.get(m)), 1e-5)), true);
  const mesh = new THREE.SkinnedMesh(geometry, mats);
  mesh.name = 'SamuraiMesh';
  root.add(mesh);
  root.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton(bones));

  // ---------- animation clips ----------
  const report = {};
  function makeClip(name, duration, poseAt, fps = 30) {
    const n = Math.round(duration * fps) + 1;
    const times = [], q = bones.map(() => []), hp = [];
    const prev = bones.map(() => null);
    let maxErr = 0;
    for (let i = 0; i < n; i++) {
      const t = Math.min(duration, i / fps);
      times.push(t);
      maxErr = Math.max(maxErr, applyPose(poseAt(t)));
      bones.forEach((b, j) => {
        const bq = b.quaternion.clone();
        if (prev[j] && prev[j].dot(bq) < 0) bq.set(-bq.x, -bq.y, -bq.z, -bq.w);
        prev[j] = bq;
        q[j].push(bq.x, bq.y, bq.z, bq.w);
      });
      hp.push(hips.position.x, hips.position.y, hips.position.z);
    }
    report[name] = maxErr;
    const tracks = bones.map((b, j) => new THREE.QuaternionKeyframeTrack(`${b.name}.quaternion`, times, q[j]));
    tracks.push(new THREE.VectorKeyframeTrack('Hips.position', times, hp));
    return new THREE.AnimationClip(name, duration, tracks);
  }
  const clips = [
    makeClip('Idle', 2.4, idle),
    makeClip('Walk', WALK.T, walk),
    makeClip('Attack', 1.5, attack),
    makeClip('Pose_Reference', 2.4, reference),
  ];
  applyPose(idle(0));
  root.updateMatrixWorld(true);

  root.userData.walkSpeed = (2 * WALK.S) / (WALK.stance * WALK.T);
  return { model: root, clips, report };
}
