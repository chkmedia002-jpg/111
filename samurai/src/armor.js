// Lacquered lamellar armour (do, kusazuri, sode), sash and the back banner.

export function createArmor(ctx) {
  const { THREE, kit, M, mergeGeometries } = ctx;
  const { V, TAU, group, extrude, kozaneShape, capsule, rope, cord, bendGeometry, collapse, rosette, add, ball, box, tube, revolve, smooth } = kit;
  const val = (v, i) => (typeof v === 'function' ? v(i) : v);
  const laceOpt = { flat: 0.55, radial: 5, cap: 1 };

  // Collapse a flat build group, bend it around an axis at z = -R and add it to parent.
  function bake(tmp, parent, R, dz = 0) {
    for (const [mat, g] of collapse(tmp, mergeGeometries)) {
      if (Number.isFinite(R)) bendGeometry(g, R);
      add(g, mat, parent).position.z = dz;
    }
  }

  // Flat panel built by fn(tmp), bent with radius R. The returned group's origin is
  // on the bend axis, so the panel's front centre sits at z = R.
  function bent(parent, R, fn) {
    const out = group(parent);
    const tmp = new THREE.Group();
    fn(tmp);
    bake(tmp, out, R, Number.isFinite(R) ? R : 0);
    return out;
  }

  // Gold edge trim (fukurin) along a polyline.
  function fukurin(points, parent, r = 0.0026) {
    cord(points, r, M.gold, parent, { radial: 6 });
  }

  // Lamellar panel: rows of scale-headed plates hanging down from y = 0, laced with
  // pairs of white cords (sugake odoshi). The bottom row gets red cross stitches
  // (hishinui) and a braided edge cord (mimi-ito). width/radius may vary per row.
  // With a finite radius the group's origin is on the bend axis.
  function lamellarPanel(parent, o) {
    const { rows, rowH, width, radius = Infinity, colSpace = 0.03, lw = 0.02, thick = 0.006, hishi = true, crown = 0 } = o;
    const out = group(parent);
    const R0 = val(radius, 0);
    const h = rowH * 1.2;
    for (let i = 0; i < rows; i++) {
      const w = val(width, i), R = val(radius, i);
      const tmp = new THREE.Group();
      const y0 = -i * rowH;
      extrude(kozaneShape(w, h, lw, 0.0055), thick, M.lacquer, tmp, 0.0012, 4).position.y = y0;
      const zt = thick / 2 + 0.0016;
      const cols = Math.max(2, Math.round(w / colSpace));
      const cs = w / cols;
      const last = i === rows - 1;
      for (let c = 0; c < cols; c++) {
        const x = -w / 2 + cs * (c + 0.5);
        for (const dx of [-0.0034, 0.0034]) {
          capsule(V(x + dx, y0 - 0.1 * h, zt), V(x + dx, y0 - 0.5 * h, zt), 0.0024, M.lace, tmp, laceOpt);
          if (!last) capsule(V(x + dx, y0 - 0.74 * h, zt), V(x + dx, y0 - 1.0 * h, zt), 0.0024, M.lace, tmp, laceOpt);
        }
        if (last && hishi) {
          const cy = y0 - 0.74 * h, s = 0.0065;
          capsule(V(x - s, cy - s, zt), V(x + s, cy + s, zt), 0.0021, M.red, tmp, laceOpt);
          capsule(V(x + s, cy - s, zt), V(x - s, cy + s, zt), 0.0021, M.red, tmp, laceOpt);
        }
      }
      if (last) {
        const pts = Array.from({ length: 13 }, (_, k) => V(-w / 2 + (w * k) / 12, y0 - h + 0.004, thick / 2 + 0.001));
        rope(pts, 0.0042, [M.red, M.lace, M.red], tmp, { strands: 3, twist: 220, radial: 4 });
      }
      bake(tmp, out, R, Number.isFinite(R) ? R : 0);
    }
    if (crown) {
      // kanmuri-ita: solid top plate with gold trim and two rosette fittings
      const w = val(width, 0) + 0.006;
      const tmp = new THREE.Group();
      const s = new THREE.Shape();
      s.moveTo(-w / 2, -0.006);
      s.lineTo(w / 2, -0.006);
      s.lineTo(w / 2, crown * 0.7);
      s.quadraticCurveTo(w / 2, crown, w / 2 - 0.015, crown);
      s.lineTo(-w / 2 + 0.015, crown);
      s.quadraticCurveTo(-w / 2, crown, -w / 2, crown * 0.7);
      s.closePath();
      extrude(s, thick * 1.5, M.lacquer, tmp, 0.0016);
      const z = thick * 0.75 + 0.0012;
      fukurin([V(-w / 2, -0.006, z), V(-w / 2, crown * 0.7, z), V(-w / 2 + 0.004, crown * 0.93, z), V(-w / 2 + 0.015, crown, z),
        V(w / 2 - 0.015, crown, z), V(w / 2 - 0.004, crown * 0.93, z), V(w / 2, crown * 0.7, z), V(w / 2, -0.006, z)], tmp);
      for (const x of [-w * 0.3, w * 0.3]) rosette(0.008, M.gold, tmp, V(x, crown * 0.45, z));
      bake(tmp, out, R0, Number.isFinite(R0) ? R0 : 0);
    }
    return out;
  }

  // ---------- torso (spine-local; origin at the waist) ----------
  function torso(spine) {
    const zs = 0.8;
    const doR = (y) => 0.165 + 0.03 * Math.sin(Math.min(1, y / 0.36) * Math.PI * 0.6);
    // white hitatare shoulders under the armour
    ball(V(0, 0.42, -0.01), 0.14, M.cloth, spine, [1.32, 0.5, 0.82], [32, 16]);

    // do: seven laced rows wrapping the body, widening towards the chest
    const rows = 7, rowH = 0.048, top = 0.37;
    const doG = group(spine, V(0, top, 0), null, [1, 1, zs]);
    lamellarPanel(doG, {
      rows, rowH, colSpace: 0.032,
      radius: (i) => doR(top - (i + 0.5) * rowH) + 0.006,
      width: (i) => 5.9 * (doR(top - (i + 0.5) * rowH) + 0.006),
    });

    // munaita (chest plate) and back plate, with gold trim and fittings
    for (const [rotY, hTop] of [[0, 0.07], [Math.PI, 0.1]]) {
      const g = group(spine, V(0, top - 0.004, 0), [0, rotY, 0], [1, 1, zs]);
      bent(g, 0.19, (tmp) => {
        const w = 0.3;
        const s = new THREE.Shape();
        s.moveTo(-w / 2, 0);
        s.lineTo(w / 2, 0);
        s.lineTo(w / 2, hTop);
        s.quadraticCurveTo(0, hTop - 0.055, -w / 2, hTop);
        s.closePath();
        extrude(s, 0.008, M.lacquer, tmp, 0.0018, 24);
        const z = 0.0055;
        const pts = [];
        for (let k = 0; k <= 16; k++) {
          const u = k / 16, x = w / 2 - u * w;
          pts.push(V(x, hTop - 0.055 * 2 * u * (1 - u) * 2, z));
        }
        fukurin([V(w / 2, 0.002, z), ...pts, V(-w / 2, 0.002, z)], tmp);
        for (const x of [-0.11, 0.11]) rosette(0.011, M.gold, tmp, V(x, hTop * 0.42, z));
        if (rotY === 0) for (let k = -3; k <= 3; k++) ball(V(k * 0.035, 0.012, z), 0.0028, M.gold, tmp, [1, 1, 0.6], [8, 6]);
      });
    }

    // watagami: shoulder straps over the hitatare, with lacing and gold fittings
    for (const sx of [-1, 1]) {
      const pts = [V(sx * 0.085, top + 0.05, 0.13), V(sx * 0.1, top + 0.11, 0.06), V(sx * 0.105, top + 0.125, -0.02), V(sx * 0.1, top + 0.1, -0.11), V(sx * 0.085, top + 0.06, -0.15)];
      cord(pts, 0.03, M.lacquer, spine, { radial: 12, sx: 0.28, sy: 1 });
      for (let k = 0; k < 5; k++) ball(pts[k].clone().add(V(0, 0.012, 0)), 0.004, M.gold, spine, [1, 0.6, 1], [8, 6]);
      rope([pts[0].clone().add(V(sx * 0.02, -0.01, 0.01)), V(sx * 0.15, top + 0.04, 0.1), V(sx * 0.2, top + 0.0, 0.07)], 0.004, M.lace, spine, { radial: 4 });
    }
    // nodowa: padded throat collar
    revolve([[0.06, 0.47], [0.085, 0.49], [0.085, 0.53], [0.06, 0.55], [0.055, 0.51]], M.cloth, spine, {
      seg: 40, samples: 16, disp: (th, y, r) => r * (1 + 0.06 * Math.sin(th * 9 + y * 40)),
    });

    // agemaki: decorative knot on the back plate
    const ag = group(spine, V(0, 0.27, -0.165 * zs - 0.02));
    for (const sx of [-1, 1]) {
      const loop = Array.from({ length: 10 }, (_, k) => {
        const a = (k / 10) * TAU;
        return V(sx * (0.035 + 0.032 * Math.cos(a)), 0.012 * Math.sin(a) + 0.01, -0.004 * Math.cos(a));
      });
      rope(loop, 0.0055, M.lace, ag, { closed: true, radial: 4 });
      rope([V(sx * 0.008, -0.005, 0), V(sx * 0.03, -0.06, -0.006), V(sx * 0.038, -0.12, -0.004)], 0.0055, M.lace, ag, { radial: 4 });
      ball(V(sx * 0.038, -0.125, -0.004), 0.007, M.lace, ag);
    }
    ball(V(0, 0.005, 0), 0.012, M.lace, ag, [1.2, 1, 0.8]);

    // obi (sash) with wrinkles, bow knot and hanging ends
    const obiCurve = new THREE.CatmullRomCurve3(kit.ringPoints(1, 48, 0, 0.18, 0.18 * (zs + 0.06)), true);
    kit.sweep(kit.curveFrames(obiCurve, 160, true), (i, s) => kit.circleProfile(1, 12).map(([u, v]) => [
      u * 0.012 * (1 + 0.35 * Math.sin(s * 41) + 0.2 * Math.sin(s * 97 + v)), v * 0.03 * (1 + 0.08 * Math.sin(s * 63)),
    ]), M.cloth, spine, { closedPath: true });
    const knot = group(spine, V(0.05, -0.005, 0.16), [0, 0.25, 0.25]);
    ball(V(0, 0, 0), 0.026, M.cloth, knot, [1.2, 1, 0.75]);
    for (const sx of [-1, 1]) {
      const loop = Array.from({ length: 14 }, (_, k) => {
        const a = (k / 14) * TAU;
        return V(sx * (0.04 + 0.038 * Math.cos(a)), 0.02 * Math.sin(a), 0.01 * Math.cos(a));
      });
      cord(loop, 0.009, M.cloth, knot, { closed: true, radial: 10, sx: 0.5, sy: 1.6 });
    }
    for (const [x, rz, len, ph] of [[-0.01, 0.2, 0.28, 0], [0.02, -0.15, 0.32, 1.7]]) {
      const g = new THREE.PlaneGeometry(0.055, len, 6, 30);
      g.translate(0, -len / 2, 0);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const xx = p.getX(i), yy = -p.getY(i);
        p.setXYZ(i, xx * (1 + yy * 1.4) + 0.02 * Math.sin(yy * 7 + ph), -yy, 0.03 * Math.sin(yy * 9 + ph) + yy * 0.12 + 0.006 * Math.sin(xx * 120));
      }
      g.computeVertexNormals();
      const m = add(g, M.cloth, knot);
      m.position.set(x, -0.01, 0.01);
      m.rotation.z = rz;
    }
  }

  // ---------- hips (waist group: same origin as the spine, follows the hips) ----------
  function waist(w, hips, upperLeg) {
    const zs = 0.8;
    // hakama seat with pleats
    revolve([[0.001, -0.25], [0.2, -0.245], [0.215, -0.15], [0.2, -0.05], [0.18, 0.0], [0.001, 0.02]], M.hakama, w, {
      seg: 72, samples: 20, disp: (th, y, r) => r * (1 + 0.05 * Math.sin(th * 10) * smooth(0, -0.2, y)),
    });
    // kusazuri: lower rows follow the nearest thigh
    const tassets = [[-1.85, 0.34], [-0.95, 0.26], [0, 0.2], [0.95, 0.26], [1.85, 0.34], [Math.PI, 0.25]];
    for (const [a, splay] of tassets) {
      const g = group(w, V(Math.sin(a) * 0.175, -0.035, Math.cos(a) * 0.175 * zs), [0, a, 0]);
      const inner = group(g, null, [splay, 0, 0]);
      const panel = lamellarPanel(inner, { rows: 5, rowH: 0.056, width: 0.175, radius: 0.36, colSpace: 0.029, crown: 0.02 });
      panel.position.z = -0.36;
      const isBack = Math.abs(a) > 2.5;
      const isSide = Math.abs(Math.sin(a)) > 0.5;
      g.userData.skin = (lp) => {
        if (isBack) return [[hips, 1]];
        const s = isSide ? (Math.sin(a) < 0 ? 'R' : 'L') : (lp.x < 0 ? 'R' : 'L');
        const k = kit.clamp01((0.015 - lp.y) / 0.29) * (isSide ? 0.5 : 0.6);
        return [[hips, 1 - k], [upperLeg[s], k]];
      };
    }
  }

  // ---------- sode (shoulder guard) ----------
  function sode(parent) {
    const p = lamellarPanel(parent, { rows: 6, rowH: 0.046, width: 0.21, radius: 0.55, colSpace: 0.03, crown: 0.034 });
    p.position.z = -0.55;
    return p;
  }

  // ---------- sashimono pole and banner (spine-local) ----------
  function banner(spine) {
    const poleBase = V(-0.02, 0.05, -0.2), poleTop = V(-0.3, 1.22, -0.31);
    const poleDir = poleTop.clone().sub(poleBase).normalize();
    tube(poleBase, poleTop, 0.014, 0.012, M.pole, spine, 16);
    for (const t of [0.12, 0.3, 0.55, 0.8, 0.99]) {
      const p = poleBase.clone().lerp(poleTop, t);
      tube(p.clone().addScaledVector(poleDir, -0.006), p.clone().addScaledVector(poleDir, 0.006), 0.0155, 0.0145, M.gold, spine, 16);
    }
    // uketsubo (cup at the waist) and gattari (bracket at the shoulder blades)
    const cup = kit.frame(poleBase.clone().addScaledVector(poleDir, -0.03), poleDir, V(1, 0, 0), spine);
    revolve([[0.001, 0], [0.024, 0.004], [0.026, 0.05], [0.03, 0.055], [0.022, 0.055]], M.lacquer, cup, { seg: 24 });
    tube(V(0, 0.048, 0), V(0, 0.056, 0), 0.031, 0.031, M.gold, cup, 24);
    const gat = poleBase.clone().lerp(poleTop, 0.26);
    box(0.09, 0.03, 0.03, M.lacquer, spine, V(gat.x + 0.02, gat.y, gat.z + 0.02));
    for (const sx of [-1, 1]) ball(V(gat.x + 0.02 + sx * 0.045, gat.y, gat.z + 0.02), 0.008, M.gold, spine);
    tube(poleTop.clone().addScaledVector(poleDir, -0.005), poleTop.clone().addScaledVector(poleDir, 0.05), 0.012, 0.004, M.gold, spine, 12);

    // crossbar
    const barStart = poleTop.clone().add(V(0.03, -0.02, 0)), barEnd = poleTop.clone().add(V(-0.36, 0.01, 0.02));
    tube(barStart, barEnd, 0.011, 0.011, M.pole, spine, 12);
    ball(barEnd, 0.015, M.gold, spine);

    // cloth with folds; the crest follows the same surface on both sides
    const bannerW = 0.32, bannerH = 0.78;
    const bannerG = kit.frame(poleTop.clone().add(V(-0.02, -0.03, 0.01)), poleDir.clone().negate(), V(-1, 0, 0), spine);
    const fold = (x, y) => 0.02 * Math.sin(x * 20 + y * 4) * Math.min(1, x * 5) + 0.012 * Math.sin(y * 13 + x * 3) + 0.004 * Math.sin(x * 61 + y * 23) + 0.03 * (y / bannerH) ** 2;
    const bg = new THREE.PlaneGeometry(bannerW, bannerH, 32, 72);
    bg.translate(bannerW / 2 + 0.015, bannerH / 2 + 0.005, 0);
    const bp = bg.attributes.position;
    for (let i = 0; i < bp.count; i++) bp.setZ(i, fold(bp.getX(i), bp.getY(i)));
    bg.computeVertexNormals();
    add(bg, M.banner, bannerG, 'Banner');
    // hem stitching along the edges
    for (const [a, b] of [[V(0.02, 0.01, 0), V(0.02, bannerH, 0)], [V(bannerW + 0.01, 0.01, 0), V(bannerW + 0.01, bannerH, 0)]]) {
      const pts = Array.from({ length: 30 }, (_, k) => { const p = a.clone().lerp(b, k / 29); p.z = fold(p.x, p.y) + 0.001; return p; });
      cord(pts, 0.0035, M.banner, bannerG, { radial: 5 });
    }
    // maru-ni-mikazuki crest: ring with a crescent, printed through the cloth
    const cx = bannerW / 2 + 0.015, cy = bannerH * 0.3, R = 0.085;
    const ringS = new THREE.Shape(); ringS.absarc(0, 0, R, 0, TAU, false);
    const hole = new THREE.Path(); hole.absarc(0, 0, R * 0.84, 0, TAU, true); ringS.holes.push(hole);
    const moon = kit.crescentShape(R * 0.62);
    for (const side of [1, -1]) {
      const g = new THREE.ShapeGeometry([ringS, moon], 24);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i) + cx, y = p.getY(i) + cy;
        p.setXYZ(i, x, y, fold(x, y) + side * 0.0012);
      }
      g.computeVertexNormals();
      add(g, M.ink, bannerG);
    }
    // ties (chichi) around the pole and the crossbar
    for (let i = 0; i < 6; i++) {
      const y = 0.04 + i * 0.145;
      const loop = Array.from({ length: 12 }, (_, k) => {
        const a = (k / 12) * TAU;
        return V(0.0 + 0.02 * Math.cos(a), y + 0.004 * Math.sin(a * 2), 0.02 * Math.sin(a));
      });
      cord(loop, 0.005, M.banner, bannerG, { closed: true, radial: 6, sx: 0.5, sy: 1.8 });
    }
    for (let i = 0; i < 3; i++) {
      const x = 0.09 + i * 0.11;
      const loop = Array.from({ length: 12 }, (_, k) => {
        const a = (k / 12) * TAU;
        return V(x + 0.003 * Math.sin(a * 2), -0.02 + 0.02 * Math.cos(a), 0.02 * Math.sin(a));
      });
      cord(loop, 0.005, M.banner, bannerG, { closed: true, radial: 6, sx: 0.5, sy: 1.8 });
    }
  }

  return { lamellarPanel, bent, fukurin, torso, waist, sode, banner };
}
