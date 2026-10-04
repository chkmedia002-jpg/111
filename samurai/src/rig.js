// Skeleton, posing and animation for the samurai.
// Bones are posed from high-level controls (hips, feet, sword) with two-bone IK,
// and clips are baked from those controls at 30 fps.

export function createRig(THREE, root) {
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const Y = V(0, 1, 0);
  const clamp01 = (v) => Math.min(1, Math.max(0, v));

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

  // ---------- animation clips ----------
  function makeClips() {
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
    return { clips, report };
  }

  return {
    bones, SIDES, LEN, WRIST, GRIP,
    hips, spine, neck, head, clav, upperArm, lowerArm, hand, upperLeg, lowerLeg, foot, katana,
    applyPose, idle, makeClips, worldPos,
    walkSpeed: (2 * WALK.S) / (WALK.stance * WALK.T),
  };
}
