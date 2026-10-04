// Arms (sleeve, sode, kote, hands with fingers) and legs (hakama, suneate, tabi, waraji).

export function createLimbs(ctx, armor) {
  const { THREE, kit, M, rig } = ctx;
  const { V, TAU, add, ball, tube, cord, rope, group, revolve, smooth, capsule, box } = kit;
  const { LEN, WRIST, SIDES, clav, upperArm, lowerArm, hand, upperLeg, lowerLeg, foot, hips, worldPos } = rig;

  // Mail texture: small bumps on a cylinder (kusari).
  const mail = (amp = 0.06, nTh = 22, nY = 160) => (th, y, r) => r * (1 + amp * Math.abs(Math.sin(th * nTh) * Math.sin(y * nY)));

  // Split splint plates (tsutsu) around the +Z side of a limb, with gold edges.
  function splints(parent, y0, y1, r0, r1, n, span, gold = true) {
    const gap = 0.05;
    const w = span / n;
    for (let k = 0; k < n; k++) {
      const t0 = -span / 2 + k * w + gap / 2, tl = w - gap;
      revolve([[r0, y0], [r0 + 0.004, y0], [r1 + 0.004, y1], [r1, y1], [r0, y0]], M.lacquer, parent, { seg: 10, thetaStart: t0, thetaLength: tl });
      if (!gold) continue;
      for (const th of [t0, t0 + tl]) {
        cord([V(Math.sin(th) * (r0 + 0.004), y0, Math.cos(th) * (r0 + 0.004)), V(Math.sin(th) * (r1 + 0.004), y1, Math.cos(th) * (r1 + 0.004))], 0.0016, M.gold, parent, { radial: 4, seg: 4 });
      }
      for (const [y, r] of [[y0, r0], [y1, r1]]) {
        cord(Array.from({ length: 6 }, (_, j) => { const th = t0 + (j / 5) * tl; return V(Math.sin(th) * (r + 0.004), y, Math.cos(th) * (r + 0.004)); }), 0.0016, M.gold, parent, { radial: 4 });
      }
    }
  }

  function ropeRing(parent, y, r, bow = false) {
    rope(kit.ringPoints(r, 28, y), 0.006, M.rope, parent, { closed: true, radial: 4 });
    if (!bow) return;
    const z = r + 0.004;
    for (const s of [-1, 1]) {
      const loop = Array.from({ length: 10 }, (_, k) => { const a = (k / 10) * TAU; return V(s * (0.012 + 0.01 * Math.cos(a)), y + 0.007 * Math.sin(a), z); });
      rope(loop, 0.0045, M.rope, parent, { closed: true, radial: 4 });
      rope([V(s * 0.003, y, z), V(s * 0.008, y - 0.02, z + 0.003), V(s * 0.006, y - 0.04, z + 0.002)], 0.0045, M.rope, parent, { radial: 4 });
    }
    ball(V(0, y, z), 0.006, M.rope, parent);
  }

  // ---------- arms ----------
  function arms() {
    const restSpineX = V(1, 0, 0).applyQuaternion(rig.spine.getWorldQuaternion(new THREE.Quaternion()));
    for (const [s, sx] of SIDES) {
      const ul = LEN.upper, fl = LEN.fore;
      // sode: hangs from the shoulder, half-way towards the raised arm
      const sh = worldPos(upperArm[s]), elbow = worldPos(lowerArm[s]);
      const hang = V(0, -1, 0).lerp(elbow.clone().sub(sh).normalize(), 0.45).normalize();
      const out = restSpineX.clone().multiplyScalar(sx).add(V(0, 0.3, 0)).normalize();
      const sy = hang.clone().negate();
      const sodeF = kit.frame(sh.clone().addScaledVector(out, 0.075).add(V(0, 0.05, 0)), sy, new THREE.Vector3().crossVectors(sy, out), ctx.root);
      armor.sode(sodeF);
      // cords tying the sode to the shoulder strap
      rope([V(-0.06, 0.03, 0.0), V(-0.03, 0.06, -0.03), V(0.0, 0.07, -0.06)], 0.004, M.lace, sodeF, { radial: 4 });
      clav[s].attach(sodeF);
      sodeF.userData.skin = () => [[clav[s], 0.5], [upperArm[s], 0.5]];

      // white sleeve with cloth folds
      const ua = upperArm[s];
      revolve([[0.001, -0.045], [0.055, -0.03], [0.074, ul * 0.25], [0.078, ul * 0.55], [0.07, ul * 0.85], [0.056, ul + 0.03], [0.001, ul + 0.05]], M.cloth, ua, {
        seg: 48, samples: 28, disp: (th, y, r) => r * (1 + 0.07 * Math.sin(th * 5 + y * 9) * smooth(0, ul * 0.4, y) + 0.03 * Math.sin(th * 11 - y * 25)),
      });
      // armoured panel on the outside of the upper arm: mail with gold-rimmed plates
      revolve([[0.08, ul * 0.25], [0.081, ul * 0.6], [0.075, ul * 0.95]], M.iron, ua, { seg: 40, samples: 24, thetaStart: -1.1, thetaLength: 2.2, disp: mail(0.05, 20, 140) });
      for (const [y, th] of [[ul * 0.42, 0], [ul * 0.72, -0.5], [ul * 0.72, 0.5]]) {
        const g = group(ua, V(Math.sin(th) * 0.084, y, Math.cos(th) * 0.084), [0, th, 0]);
        const hex = new THREE.Shape();
        for (let k = 0; k <= 6; k++) { const a = (k / 6) * TAU + Math.PI / 6; k === 0 ? hex.moveTo(Math.cos(a) * 0.016, Math.sin(a) * 0.016) : hex.lineTo(Math.cos(a) * 0.016, Math.sin(a) * 0.016); }
        kit.extrude(hex, 0.004, M.lacquer, g, 0.001, 6);
        cord(Array.from({ length: 6 }, (_, k) => { const a = (k / 6) * TAU + Math.PI / 6; return V(Math.cos(a) * 0.016, Math.sin(a) * 0.016, 0.003); }), 0.0015, M.gold, g, { closed: true, radial: 4 });
        ball(V(0, 0, 0.003), 0.004, M.gold, g, [1, 1, 0.6], [8, 6]);
      }

      // kote (forearm guard): mail sleeve, three splints, cords
      const fa = lowerArm[s];
      revolve([[0.001, -0.03], [0.05, -0.012], [0.052, fl * 0.3], [0.044, fl * 0.8], [0.038, fl], [0.001, fl + 0.006]], M.iron, fa, { seg: 40, samples: 24, disp: mail(0.05, 18, 150) });
      splints(fa, fl * 0.12, fl * 0.86, 0.053, 0.043, 3, 2.5);
      ropeRing(fa, fl * 0.1, 0.055);
      ropeRing(fa, fl * 0.93, 0.042, true);
      // elbow cop
      const eg = group(fa, V(0, 0.0, 0.035), [Math.PI / 2, 0, 0]);
      revolve([[0.001, 0.012], [0.02, 0.01], [0.032, 0.0], [0.034, -0.002]], M.lacquer, eg, { seg: 32 });
      cord(kit.ringPoints(0.033, 32, -0.001), 0.0022, M.gold, eg, { closed: true, radial: 5 });
      ball(V(0, 0.012, 0), 0.006, M.gold, eg, [1, 0.6, 1], [10, 6]);
      ball(V(0, 0, 0), 0.058, M.iron, fa, [1, 1, 1], [24, 16]);

      handMesh(hand[s], s);
    }
  }

  // Fist closed around the hilt. Hand space = sword space: +Y along the blade,
  // +X towards the edge; the grip point is at -WRIST.
  function handMesh(hb, s) {
    const g = WRIST.clone().negate();
    const mir = s === 'R' ? 1 : -1; // right hand wraps through +Z first, left through -Z
    const dir = (a) => V(Math.cos(a), 0, Math.sin(a) * mir);
    const hiltR = 0.0175;
    const at = (a, y, r) => g.clone().addScaledVector(dir(a), r).add(V(0, y, 0));
    // fingers: index (nearest the guard) to little finger
    const fr = [0.0085, 0.0088, 0.0085, 0.0074];
    for (let j = 0; j < 4; j++) {
      const y = (1.5 - j) * 0.0195;
      const r = fr[j], R = hiltR + r;
      const pts = [at(0.72 * Math.PI, y, R + 0.014), at(1.15 * Math.PI, y, R + 0.002), at(1.55 * Math.PI, y, R), at(1.86 * Math.PI, y, R - 0.001)];
      for (let k = 0; k < 3; k++) {
        capsule(pts[k], pts[k + 1], r * (1 - k * 0.08), M.skin, hb, { radial: 10, cap: 3 });
        ball(pts[k + 1], r * (0.98 - k * 0.08), M.skin, hb, [1, 1, 1], [12, 8]);
      }
      ball(pts[3].clone().addScaledVector(dir(1.86 * Math.PI), 0.0045), 0.004, M.nail, hb, [1, 1, 0.5], [8, 6]);
    }
    // thumb wraps the other way under the grip
    const tp = [at(0.5 * Math.PI, -0.03, hiltR + 0.022), at(0.3 * Math.PI, -0.006, hiltR + 0.011), at(0.08 * Math.PI, 0.008, hiltR + 0.009), at(-0.12 * Math.PI, 0.014, hiltR + 0.009)];
    for (let k = 0; k < 3; k++) capsule(tp[k], tp[k + 1], 0.0098 - k * 0.0008, M.skin, hb, { radial: 10, cap: 3 });
    // palm and back of the hand
    const palm = group(hb, at(0.7 * Math.PI, -0.004, hiltR + 0.016), [0, -0.7 * Math.PI * mir, 0]);
    ball(V(0, 0, 0), 1, M.skin, palm, [0.017, 0.045, 0.033], [24, 16]);
    // tekko: lacquered plate over the back of the hand with gold trim and a finger loop
    const t0 = Math.PI / 2 - 1.05 * Math.PI, t1 = Math.PI / 2 - 0.5 * Math.PI;
    const th0 = mir > 0 ? t0 : Math.PI - t1, thl = t1 - t0; // left hand mirrors Z
    const tg = group(hb, g);
    revolve([[0.036, -0.045], [0.04, -0.045], [0.041, 0.0], [0.04, 0.03], [0.036, 0.03], [0.036, -0.045]], M.lacquer, tg, { seg: 16, thetaStart: th0, thetaLength: thl });
    cord(Array.from({ length: 8 }, (_, k) => { const th = th0 + (k / 7) * thl; return V(Math.sin(th) * 0.0405, 0.03, Math.cos(th) * 0.0405); }), 0.0016, M.gold, tg, { radial: 4 });
    const mid = th0 + thl / 2;
    ball(V(Math.sin(mid) * 0.042, -0.008, Math.cos(mid) * 0.042), 0.005, M.gold, tg, [1, 1, 1], [10, 6]);
    // wrist
    tube(V(0, -0.012, 0), at(0.7 * Math.PI, -0.03, hiltR + 0.012), 0.032, 0.03, M.skin, hb, 20);
  }

  // ---------- legs ----------
  function legs() {
    for (const [s, sx] of SIDES) {
      const tl = LEN.thigh, sl = LEN.shin;
      const th = upperLeg[s], sh = lowerLeg[s];
      // baggy hakama with folds; the top blends into the hips
      const hk = revolve([[0.001, -0.02], [0.12, 0.0], [0.15, tl * 0.3], [0.165, tl * 0.65], [0.152, tl * 0.95], [0.12, tl + 0.06], [0.001, tl + 0.08]], M.hakama, th, {
        seg: 72, samples: 40,
        disp: (a, y, r) => r * (1 + 0.075 * Math.sin(a * 5 + y * 4 + sx) * smooth(0, tl * 0.3, y) + 0.035 * Math.sin(a * 11 - y * 13) + 0.015 * Math.sin(a * 23 + y * 31)),
      });
      hk.userData.skin = (lp) => {
        const w = kit.clamp01(1 - lp.y / 0.14) * 0.5;
        return [[upperLeg[s], 1 - w], [hips, w]];
      };
      revolve([[0.001, -0.04], [0.135, -0.02], [0.13, sl * 0.12], [0.09, sl * 0.3], [0.001, sl * 0.32]], M.hakama, sh, {
        seg: 64, samples: 20, disp: (a, y, r) => r * (1 + 0.12 * Math.sin(a * 9 + y * 8) * smooth(sl * 0.02, sl * 0.26, y) + 0.03 * Math.sin(a * 17)),
      });

      // suneate: mail base, five splints with gold caps, knee guard
      revolve([[0.072, sl * 0.08], [0.069, sl * 0.4], [0.056, sl * 0.95], [0.052, sl]], M.iron, sh, { seg: 40, samples: 24, disp: mail(0.05, 22, 160) });
      const rAt = (y) => 0.075 - 0.022 * (y / sl);
      for (let i = -2; i <= 2; i++) {
        const a = i * 0.42;
        const pts = [0.09, 0.5, 0.93].map((t) => { const y = sl * t; const r = rAt(y); return V(Math.sin(a) * r, y, Math.cos(a) * r); });
        cord(pts, 0.0085, M.lacquer, sh, { radial: 8 });
        for (const p of [pts[0], pts[2]]) ball(p, 0.0092, M.gold, sh, [1, 0.55, 1], [10, 6]);
      }
      const knee = group(sh, V(0, 0.09, 0));
      armor.bent(knee, 0.095, (tmp) => {
        const w = 0.13, h = 0.16;
        const sp = new THREE.Shape();
        sp.moveTo(-w / 2 + 0.01, -h); sp.lineTo(w / 2 - 0.01, -h); sp.lineTo(w / 2, -h * 0.4);
        sp.quadraticCurveTo(w / 2, 0.02, 0, 0.025); sp.quadraticCurveTo(-w / 2, 0.02, -w / 2, -h * 0.4); sp.closePath();
        kit.extrude(sp, 0.006, M.lacquer, tmp, 0.0015, 16);
        armor.fukurin([V(-w / 2 + 0.01, -h, 0.0045), V(-w / 2, -h * 0.4, 0.0045), V(-w * 0.35, -0.01, 0.0045), V(0, 0.025, 0.0045), V(w * 0.35, -0.01, 0.0045), V(w / 2, -h * 0.4, 0.0045), V(w / 2 - 0.01, -h, 0.0045)], tmp, 0.0022);
        for (let r = 0; r < 4; r++) for (let c = -2; c <= 2; c++) {
          capsule(V(c * 0.02 - 0.003, -0.03 - r * 0.03, 0.005), V(c * 0.02 - 0.003, -0.045 - r * 0.03, 0.005), 0.002, M.lace, tmp, { flat: 0.55, radial: 5, cap: 1 });
          capsule(V(c * 0.02 + 0.003, -0.03 - r * 0.03, 0.005), V(c * 0.02 + 0.003, -0.045 - r * 0.03, 0.005), 0.002, M.lace, tmp, { flat: 0.55, radial: 5, cap: 1 });
        }
      }).position.z = -0.095 + 0.07;
      for (const [t, bow] of [[0.1, true], [0.45, true], [0.82, false]]) ropeRing(sh, sl * t, rAt(sl * t) + 0.012, bow);

      footMesh(foot[s], s);
    }
  }

  // Foot helper frame: +X forward, +Y up, origin on the ground under the ankle.
  function footMesh(fb, s) {
    const fh = new THREE.Group();
    fh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(V(0, 1, 0), V(0, 0, 1), V(1, 0, 0)));
    fh.position.set(0, 0, -0.1);
    fb.add(fh);
    const inner = s === 'R' ? -1 : 1; // +Z of this frame is the foot's right side
    // tabi: split-toe sock
    ball(V(-0.03, 0.05, 0), 0.05, M.tabi, fh, [1.05, 0.95, 0.95], [28, 18]);
    ball(V(0.05, 0.04, 0), 0.05, M.tabi, fh, [1.5, 0.7, 1.0], [28, 18]);
    ball(V(0.14, 0.03, -inner * 0.012), 0.04, M.tabi, fh, [1.0, 0.65, 0.85], [24, 14]);
    ball(V(0.155, 0.032, inner * 0.03), 0.022, M.tabi, fh, [1.3, 0.9, 0.9], [20, 12]);
    revolve([[0.045, 0.06], [0.047, 0.1], [0.045, 0.14]], M.tabi, group(fh, V(-0.01, 0, 0)), { seg: 28 });
    for (let k = 0; k < 3; k++) box(0.012, 0.006, 0.004, M.gold, fh, V(-0.035, 0.08 + k * 0.022, -inner * 0.046), [0, inner * 0.5, 0]);
    // waraji: woven straw sole with ridges, side loops and straps
    const sole = new THREE.Shape();
    sole.moveTo(-0.08, -0.042); sole.lineTo(0.15, -0.045); sole.quadraticCurveTo(0.2, -0.045, 0.2, 0); sole.quadraticCurveTo(0.2, 0.05, 0.15, 0.05);
    sole.lineTo(-0.08, 0.044); sole.quadraticCurveTo(-0.11, 0.044, -0.11, 0); sole.quadraticCurveTo(-0.11, -0.042, -0.08, -0.042);
    const sg = group(fh, V(0, 0.008, 0), [-Math.PI / 2, 0, 0]);
    kit.extrude(sole, 0.014, M.straw, sg, 0.003, 12);
    for (let k = -2; k <= 2; k++) cord([V(-0.1, k * 0.016, 0.008), V(0.05, k * 0.017, 0.008), V(0.19, k * 0.008, 0.008)], 0.0035, M.straw, sg, { radial: 5 });
    for (let k = 0; k < 14; k++) {
      const x = -0.09 + k * 0.021;
      cord([V(x, -0.04, 0.009), V(x, 0, 0.0105), V(x, 0.042, 0.009)], 0.0022, M.straw, sg, { radial: 4, seg: 6 });
    }
    // straps
    const loops = [[0.1, 0.05], [0.1, -0.05], [-0.03, 0.05], [-0.03, -0.05]];
    for (const [x, z] of loops) rope(kit.ringPoints(0.008, 10).map((v) => V(x + v.x, 0.02 + v.z, z)), 0.003, M.rope, fh, { closed: true, radial: 4 });
    rope([V(0.18, 0.02, 0), V(0.14, 0.055, 0.0), V(0.1, 0.03, 0.05)], 0.0045, M.rope, fh, { radial: 4 });
    rope([V(0.18, 0.02, 0), V(0.14, 0.055, 0.0), V(0.1, 0.03, -0.05)], 0.0045, M.rope, fh, { radial: 4 });
    for (const sz of [-1, 1]) rope([V(0.1, 0.03, sz * 0.05), V(0.04, 0.07, sz * 0.045), V(-0.03, 0.03, sz * 0.05), V(-0.06, 0.09, sz * 0.045), V(-0.03, 0.12, 0)], 0.0045, M.rope, fh, { radial: 4 });
    rope(kit.ringPoints(0.05, 24, 0.12, 1, 1).map((v) => v.add(V(-0.015, 0, 0))), 0.0045, M.rope, fh, { closed: true, radial: 4 });
  }

  return { arms, legs };
}
