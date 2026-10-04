// Head: sculpted face, eyes, facial hair, padded hood and the kabuto helmet.
// Built in the Head bone's space (origin at the centre of the skull, +Z = face).

export function createHead(ctx, armor) {
  const { THREE, kit, M } = ctx;
  const { V, TAU, add, ball, tube, cord, rope, group, revolve, smooth, gauss, extrude, rosette } = kit;

  // Unit-sphere face sculpt: returns displaced [x, y, z] for a point on the sphere.
  function sculpt(ux, uy, uz) {
    const front = smooth(0.0, 0.55, uz);
    let dz = 0, dx = 0;
    dz += 0.07 * gauss(uy, 0.22, 0.07) * gauss(ux, 0, 0.55) * front; // brow ridge
    for (const s of [-1, 1]) {
      dz -= 0.1 * gauss(ux, s * 0.35, 0.13) * gauss(uy, 0.07, 0.085) * front; // eye socket
      dz += 0.05 * gauss(ux, s * 0.5, 0.15) * gauss(uy, -0.12, 0.12) * front; // cheekbone
      dx += s * 0.03 * gauss(ux, s * 0.7, 0.2) * gauss(uy, -0.15, 0.15);
      dz += 0.055 * gauss(ux, s * 0.12, 0.05) * gauss(uy, -0.34, 0.045) * front; // nostril wings
      dz -= 0.02 * gauss(ux, s * 0.25, 0.05) * gauss(uy, -0.42, 0.1) * front; // nasolabial fold
    }
    const p = smooth(0.17, -0.33, uy) * (uy > -0.36 ? 1 : gauss(uy, -0.36, 0.035));
    dz += 0.27 * p * gauss(ux, 0, 0.075 + 0.06 * p) * front; // nose
    dz += 0.05 * gauss(uy, -0.5, 0.035) * gauss(ux, 0, 0.22) * front; // upper lip
    dz += 0.055 * gauss(uy, -0.6, 0.04) * gauss(ux, 0, 0.17) * front; // lower lip
    dz -= 0.035 * gauss(uy, -0.552, 0.012) * gauss(ux, 0, 0.24) * front; // mouth line
    dz += 0.07 * gauss(uy, -0.86, 0.12) * gauss(ux, 0, 0.3) * front; // chin
    let x = ux + dx, y = uy, z = uz + dz;
    if (uy < 0) {
      y *= 1.22;
      x *= 1 - 0.3 * smooth(-0.1, -1, uy); // narrower jaw
    }
    if (uz < 0) z *= 0.96;
    return [x, y, z];
  }
  const HS = [0.079, 0.093, 0.088]; // head radii

  function build(headBone) {
    const hs = group(headBone, null, null, 1.15);

    // neck
    revolve([[0.046, -0.16], [0.047, -0.1], [0.044, -0.06], [0.04, -0.03]], M.skin, hs, { seg: 32, samples: 8 });

    // face
    const sg = new THREE.SphereGeometry(1, 112, 84);
    const p = sg.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const [x, y, z] = sculpt(p.getX(i), p.getY(i), p.getZ(i));
      p.setXYZ(i, x * HS[0], y * HS[1] - 0.004, z * HS[2]);
    }
    sg.deleteAttribute('normal');
    sg.computeVertexNormals();
    add(sg, M.skin, hs, 'Face');

    // eyes with lids
    for (const s of [-1, 1]) {
      const e = group(hs, V(s * 0.0285, 0.0058, 0.066));
      ball(V(0, 0, 0), 0.0115, M.eyeWhite, e, [1, 1, 1], [20, 14]);
      ball(V(s * -0.001, 0, 0.0098), 0.0058, M.eye, e, [1, 1, 0.35], [16, 10]);
      ball(V(s * -0.001, 0.001, 0.0118), 0.0012, M.eyeWhite, e, [1, 1, 0.4], [6, 4]); // catch light
      const lid = add(new THREE.SphereGeometry(0.0123, 24, 10, 0, TAU, 0, Math.PI * 0.42), M.skin, e);
      lid.rotation.x = 0.28; // cap mostly above the eye so it stays open
      const low = add(new THREE.SphereGeometry(0.0122, 24, 8, 0, TAU, 0, Math.PI * 0.3), M.skin, e);
      low.rotation.x = Math.PI / 2 + 1.25;
      // eyebrow strands
      for (let k = 0; k < 16; k++) {
        const u = k / 15;
        const x = s * (0.011 + u * 0.03), y = 0.021 + 0.004 * Math.sin(u * Math.PI) - u * 0.002, z = 0.0815 - u * u * 0.012;
        cord([V(x - s * 0.002, y - 0.0015, z), V(x + s * 0.003, y + 0.0012, z + 0.0012), V(x + s * 0.007, y + 0.0002 - u * 0.0015, z)], 0.0011, M.hair, hs, { radial: 4, seg: 4 });
      }
    }
    // mustache: strands flowing out and down from under the nose
    for (const s of [-1, 1]) {
      for (let k = 0; k < 20; k++) {
        const u = k / 19;
        const x0 = s * (0.002 + u * 0.016), y0 = -0.039 - u * 0.002;
        cord([V(x0, y0, 0.089 - u * 0.006), V(x0 + s * 0.012, y0 - 0.008, 0.084 - u * 0.006), V(x0 + s * 0.018, y0 - 0.02 - u * 0.004, 0.074 - u * 0.006)], 0.00095, M.hair, hs, { radial: 4, seg: 6 });
      }
    }
    // goatee
    for (let k = 0; k < 26; k++) {
      const a = (k / 26) * TAU;
      const x0 = Math.cos(a) * 0.009, z0 = 0.071 + Math.sin(a) * 0.005;
      cord([V(x0, -0.097, z0), V(x0 * 0.7, -0.112, z0 - 0.003), V(x0 * 0.15, -0.132, z0 - 0.01)], 0.0011, M.hair, hs, { radial: 4, seg: 6 });
    }

    // padded hood under the helmet, with soft folds
    const hood = new THREE.SphereGeometry(0.098, 72, 36, Math.PI * 0.92, Math.PI * 1.16, 0.25, 1.6) // sides and back; the face (phi = pi/2) stays open;
    const hp = hood.attributes.position;
    for (let i = 0; i < hp.count; i++) {
      const v = V(hp.getX(i), hp.getY(i), hp.getZ(i));
      const ph = Math.atan2(v.x, v.z);
      v.multiplyScalar(1 + 0.04 * Math.sin(ph * 14 + v.y * 60) * smooth(0.04, -0.06, v.y));
      hp.setXYZ(i, v.x, v.y, v.z);
    }
    hood.computeVertexNormals();
    add(hood, M.cloth, hs).position.set(0, 0, -0.006);

    // chin cord tied under the jaw
    for (const s of [-1, 1]) rope([V(s * 0.085, 0.01, 0.0), V(s * 0.07, -0.06, 0.035), V(s * 0.03, -0.11, 0.06), V(s * 0.006, -0.124, 0.066)], 0.0055, M.rope, hs, { radial: 4 });
    ball(V(0, -0.125, 0.067), 0.009, M.rope, hs);
    for (const s of [-1, 1]) {
      const loop = Array.from({ length: 10 }, (_, k) => { const a = (k / 10) * TAU; return V(s * (0.016 + 0.012 * Math.cos(a)), -0.126 + 0.007 * Math.sin(a), 0.068); });
      rope(loop, 0.0045, M.rope, hs, { closed: true, radial: 4 });
      rope([V(s * 0.003, -0.13, 0.068), V(s * 0.008, -0.15, 0.066), V(s * 0.006, -0.17, 0.062)], 0.0045, M.rope, hs, { radial: 4 });
    }

    kabuto(group(hs, V(0, 0.045, -0.01)));
  }

  function kabuto(kab) {
    const SC = [1, 0.92, 1.06];
    // suji-bachi bowl: 32 raised ribs
    const bowl = new THREE.SphereGeometry(0.128, 224, 30, 0, TAU, 0, Math.PI / 2);
    const bp = bowl.attributes.position;
    for (let i = 0; i < bp.count; i++) {
      const v = V(bp.getX(i), bp.getY(i), bp.getZ(i));
      const ph = Math.atan2(v.x, v.z);
      const ridge = (0.5 + 0.5 * Math.cos(ph * 32)) ** 6 * smooth(0.122, 0.09, v.y);
      v.multiplyScalar(1 + 0.022 * ridge);
      bp.setXYZ(i, v.x * SC[0], v.y * SC[1], v.z * SC[2]);
    }
    bowl.computeVertexNormals();
    add(bowl, M.lacquer, kab, 'Kabuto');
    // tehen kanamono: stacked gold rosette at the crown
    revolve([[0.028, 0], [0.028, 0.004], [0.022, 0.006], [0.02, 0.01], [0.013, 0.012], [0.009, 0.016], [0.001, 0.017]], M.gold, kab, {
      seg: 64, disp: (th, y, r) => r * (1 + 0.12 * Math.abs(Math.cos(th * 8)) * (y < 0.008 ? 1 : 0.4)),
    }).position.y = 0.108;
    // shinodare: three gold strips running down the front
    const surf = (pol, ph, out = 0.002) => V(Math.sin(pol) * Math.sin(ph) * (0.13 + out) * SC[0], Math.cos(pol) * (0.13 + out) * SC[1], Math.sin(pol) * Math.cos(ph) * (0.13 + out) * SC[2]);
    for (const ph of [-0.16, 0, 0.16]) {
      const pts = Array.from({ length: 10 }, (_, k) => surf(0.2 + (k / 9) * (ph === 0 ? 0.95 : 0.8), ph));
      cord(pts, 0.0032, M.gold, kab, { radial: 6, sx: 0.5 });
      ball(pts[9], 0.005, M.gold, kab, [1, 1.6, 0.6], [10, 8]);
    }
    // koshimaki band with rivets and gold rim
    tube(V(0, -0.002, 0), V(0, 0.018, 0), 0.1305, 0.1295, M.lacquer, group(kab, null, null, [1, 1, SC[2]]), 64, true);
    for (let k = 0; k < 28; k++) {
      const a = (k / 28) * TAU;
      ball(V(Math.sin(a) * 0.1315, 0.008, Math.cos(a) * 0.1315 * SC[2]), 0.0028, M.gold, kab, [1, 1, 1], [8, 6]);
    }
    cord(kit.ringPoints(0.131, 64, 0.0, 1, SC[2]), 0.0045, M.gold, kab, { closed: true, radial: 8 });

    // mabizashi (visor) with gold edge
    const vg = group(kab, null, null, [1, 1, SC[2]]);
    revolve([[0.128, 0.004], [0.15, -0.006], [0.17, -0.019], [0.172, -0.022], [0.168, -0.022], [0.146, -0.01], [0.126, 0.0]], M.lacquer, vg, { seg: 64, thetaStart: -1.15, thetaLength: 2.3 });
    cord(Array.from({ length: 30 }, (_, k) => { const th = -1.15 + (k / 29) * 2.3; return V(Math.sin(th) * 0.172, -0.021, Math.cos(th) * 0.172); }), 0.0026, M.gold, vg, { radial: 6 });

    // shikoro: five laced lames flaring around the back of the head
    const sh = group(kab, V(0, -0.014, 0), [0, Math.PI, 0], [1, 1, SC[2]]);
    armor.lamellarPanel(sh, { rows: 5, rowH: 0.036, radius: (i) => 0.136 + i * 0.026, width: (i) => 3.9 * (0.136 + i * 0.026), colSpace: 0.027, lw: 0.018 });

    // fukigaeshi: wings turned back at the temples, with gold crest
    for (const s of [-1, 1]) {
      const a = 1.19;
      const g = group(kab, V(s * Math.sin(a) * 0.14, -0.035, Math.cos(a) * 0.14 * SC[2] + 0.008), [0, s * 0.95, 0]);
      armor.bent(g, 0.2, (tmp) => {
        const w = 0.06, h = 0.078;
        const sp = new THREE.Shape();
        sp.moveTo(-w / 2, -h); sp.lineTo(w / 2, -h * 0.8); sp.quadraticCurveTo(w / 2 + 0.008, 0, w / 2 - 0.01, 0.008);
        sp.lineTo(-w / 2, 0.008); sp.closePath();
        extrude(sp, 0.006, M.lacquer, tmp, 0.0012, 12);
        armor.fukurin([V(-w / 2, -h, 0.0045), V(w / 2, -h * 0.8, 0.0045), V(w / 2 + 0.005, -h * 0.3, 0.0045), V(w / 2 - 0.01, 0.008, 0.0045), V(-w / 2, 0.008, 0.0045)], tmp, 0.0022);
        const c = group(tmp, V(0.002, -h * 0.45, 0.0045));
        cord(kit.ringPoints(0.016, 32, 0, 1, 1).map((v) => V(v.x, v.z, 0)), 0.0022, M.gold, c, { closed: true, radial: 6 });
        extrude(kit.crescentShape(0.011), 0.002, M.gold, c, 0.0006, 16);
      }).position.z = -0.2;
    }

    // maedate: gold crescent on a gold holder
    const crescent = new THREE.Shape();
    const R = 0.12, c = 0.04, tipA = (20 * Math.PI) / 180;
    const ri = Math.hypot(R * Math.cos(tipA), R * Math.sin(tipA) - c);
    const phi0 = Math.atan2(R * Math.sin(tipA) - c, R * Math.cos(tipA));
    const N = 72;
    for (let i = 0; i <= N; i++) {
      const th = Math.PI - tipA + (i / N) * (Math.PI + 2 * tipA);
      i === 0 ? crescent.moveTo(R * Math.cos(th), R * Math.sin(th)) : crescent.lineTo(R * Math.cos(th), R * Math.sin(th));
    }
    for (let i = 1; i < N; i++) {
      const ph = phi0 - (i / N) * (Math.PI + 2 * phi0);
      crescent.lineTo(ri * Math.cos(ph), c + ri * Math.sin(ph));
    }
    crescent.closePath();
    const cg = new THREE.ExtrudeGeometry(crescent, { depth: 0.007, bevelEnabled: true, bevelThickness: 0.0025, bevelSize: 0.0025, bevelSegments: 3, curveSegments: 12 });
    cg.translate(0, 0, -0.0035);
    const md = add(cg, M.gold, kab, 'Maedate');
    md.position.set(0, 0.168, 0.137);
    md.rotation.x = -0.22;
    md.scale.setScalar(1.15);
    // kuwagata-dai holder
    const hold = group(kab, V(0, 0.04, 0.137), [-0.32, 0, 0]);
    const hsh = new THREE.Shape();
    hsh.moveTo(-0.03, -0.012); hsh.lineTo(0.03, -0.012); hsh.quadraticCurveTo(0.034, 0.02, 0.012, 0.03);
    hsh.lineTo(-0.012, 0.03); hsh.quadraticCurveTo(-0.034, 0.02, -0.03, -0.012);
    extrude(hsh, 0.006, M.gold, hold, 0.0015, 12);
    for (const x of [-0.018, 0, 0.018]) rosette(0.0055, M.gold, hold, V(x, 0.006, 0.004), 6);
  }

  return { build };
}
