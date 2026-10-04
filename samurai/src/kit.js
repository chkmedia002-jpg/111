// Geometry helpers shared by the samurai parts.
// Everything is built in the parent's local space; the bake step in samurai.js
// later flattens it into one skinned mesh.

export function createKit(THREE) {
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const Y = V(0, 1, 0);
  const TAU = Math.PI * 2;
  const clamp01 = (v) => Math.min(1, Math.max(0, v));
  const smooth = (a, b, v) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };
  const gauss = (v, c, w) => Math.exp(-(((v - c) / w) ** 2));

  function add(geo, mat, parent, name) {
    const m = new THREE.Mesh(geo, mat);
    if (name) m.name = name;
    parent.add(m);
    return m;
  }

  // Cylinder from a to b (radius r1 at a, r2 at b).
  function tube(a, b, r1, r2, mat, parent, seg = 18, open = false) {
    const len = a.distanceTo(b);
    const g = new THREE.CylinderGeometry(r2, r1, len, seg, 1, open);
    g.translate(0, len / 2, 0);
    const m = add(g, mat, parent);
    m.position.copy(a);
    m.quaternion.setFromUnitVectors(Y, b.clone().sub(a).normalize());
    return m;
  }

  function ball(p, r, mat, parent, s = [1, 1, 1], seg = [20, 14]) {
    const m = add(new THREE.SphereGeometry(r, seg[0], seg[1]), mat, parent);
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

  // Capsule from a to b; flat < 1 squashes it along the parent's local Z.
  function capsule(a, b, r, mat, parent, { radial = 6, cap = 2, flat = 1 } = {}) {
    const len = Math.max(1e-4, a.distanceTo(b));
    const g = new THREE.CapsuleGeometry(r, len, cap, radial);
    g.scale(1, 1, flat);
    const m = add(g, mat, parent);
    m.position.copy(a).add(b).multiplyScalar(0.5);
    // for a capsule lying in the XY plane this rotates about Z, so the flat side keeps facing +Z
    m.quaternion.setFromUnitVectors(Y, b.clone().sub(a).normalize());
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

  function group(parent, pos, rot, scale) {
    const g = new THREE.Group();
    if (pos) g.position.copy(pos);
    if (rot) g.rotation.set(...rot);
    if (scale) Array.isArray(scale) ? g.scale.set(...scale) : g.scale.setScalar(scale);
    parent.add(g);
    return g;
  }

  // Surface of revolution around local Y with per-vertex radial displacement.
  // profile: [[r, y], ...] from bottom to top; disp(theta, y, r) -> new radius.
  function revolve(profile, mat, parent, { seg = 48, disp = null, samples = 0, thetaStart = 0, thetaLength = TAU } = {}) {
    let pts = profile;
    if (samples) {
      const curve = new THREE.SplineCurve(profile.map(([r, y]) => new THREE.Vector2(r, y)));
      pts = curve.getPoints(samples).map((p) => [p.x, p.y]);
    }
    const closed = thetaLength >= TAU - 1e-6;
    const cols = closed ? seg : seg + 1;
    const pos = [];
    for (const [r0, y] of pts) {
      for (let i = 0; i < cols; i++) {
        const th = thetaStart + (i / seg) * thetaLength;
        const r = disp && r0 > 1e-4 ? disp(th, y, r0) : r0;
        pos.push(r * Math.sin(th), y, r * Math.cos(th));
      }
    }
    const idx = [];
    for (let j = 0; j < pts.length - 1; j++) {
      for (let i = 0; i < seg; i++) {
        const a = j * cols + i, b = j * cols + ((i + 1) % cols), c = (j + 1) * cols + i, d = (j + 1) * cols + ((i + 1) % cols);
        idx.push(a, c, b, b, c, d);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return add(g, mat, parent);
  }

  // Parallel-transport frames along a curve.
  function curveFrames(curve, n, closed = false) {
    const f = curve.computeFrenetFrames(n, closed);
    const out = [];
    for (let i = 0; i <= n; i++) out.push({ p: curve.getPointAt(i / n), t: f.tangents[i], n: f.normals[i], b: f.binormals[i] });
    return out;
  }

  // Sweep a 2D profile along frames. profile(i, s) -> [[u, v], ...] in (n, b) coordinates.
  function sweep(frames, profile, mat, parent, { closedPath = false, closedProfile = true, caps = false } = {}) {
    const n = frames.length;
    const pos = [];
    let m = 0;
    frames.forEach((f, i) => {
      const prof = profile(i, i / (n - 1));
      m = prof.length;
      for (const [u, v] of prof) pos.push(f.p.x + f.n.x * u + f.b.x * v, f.p.y + f.n.y * u + f.b.y * v, f.p.z + f.n.z * u + f.b.z * v);
    });
    const idx = [];
    const rows = closedPath ? n : n - 1;
    const colsN = closedProfile ? m : m - 1;
    for (let i = 0; i < rows; i++) {
      const i2 = (i + 1) % n;
      for (let j = 0; j < colsN; j++) {
        const j2 = (j + 1) % m;
        const a = i * m + j, b = i * m + j2, c = i2 * m + j, d = i2 * m + j2;
        idx.push(a, b, c, b, d, c);
      }
    }
    if (caps && !closedPath) {
      for (const [i, flip] of [[0, true], [n - 1, false]]) {
        const ci = pos.length / 3;
        let cx = 0, cy = 0, cz = 0;
        for (let j = 0; j < m; j++) { cx += pos[(i * m + j) * 3]; cy += pos[(i * m + j) * 3 + 1]; cz += pos[(i * m + j) * 3 + 2]; }
        pos.push(cx / m, cy / m, cz / m);
        for (let j = 0; j < m; j++) {
          const a = i * m + j, b = i * m + ((j + 1) % m);
          flip ? idx.push(ci, b, a) : idx.push(ci, a, b);
        }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return add(g, mat, parent);
  }

  const circleProfile = (r, k = 8, sx = 1, sy = 1) => Array.from({ length: k }, (_, j) => {
    const a = (j / k) * TAU;
    return [Math.cos(a) * r * sx, Math.sin(a) * r * sy];
  });

  // Smooth tube along points (CatmullRom).
  function cord(points, r, mat, parent, { seg = 0, radial = 6, closed = false, sx = 1, sy = 1 } = {}) {
    const curve = new THREE.CatmullRomCurve3(points, closed, 'centripetal');
    const n = seg || Math.max(4, Math.ceil(curve.getLength() / 0.006));
    return sweep(curveFrames(curve, n, closed), () => circleProfile(r, radial, sx, sy), mat, parent, { closedPath: closed, caps: !closed });
  }

  // Twisted rope: several helical strands around a path. mats can alternate per strand.
  function rope(points, r, mats, parent, { strands = 3, twist = 200, closed = false, radial = 4 } = {}) {
    const curve = new THREE.CatmullRomCurve3(points, closed, 'centripetal');
    const len = curve.getLength();
    const n = Math.max(8, Math.ceil(len / 0.0045));
    const fr = curveFrames(curve, n, closed);
    const ms = Array.isArray(mats) ? mats : [mats];
    for (let k = 0; k < strands; k++) {
      const pts = fr.map((f, i) => {
        const a = (k / strands) * TAU + (i / n) * len * twist;
        return f.p.clone().addScaledVector(f.n, Math.cos(a) * r * 0.5).addScaledVector(f.b, Math.sin(a) * r * 0.5);
      });
      if (closed) pts.pop();
      cord(pts, r * 0.58, ms[k % ms.length], parent, { seg: n, radial, closed });
    }
  }

  function ringPoints(r, n = 24, y = 0, sx = 1, sz = 1) {
    return Array.from({ length: n }, (_, i) => V(Math.sin((i / n) * TAU) * r * sx, y, Math.cos((i / n) * TAU) * r * sz));
  }

  // Bend geometry around a vertical axis at z = -R: flat X becomes an arc.
  function bendGeometry(g, R) {
    const p = g.attributes.position, n = g.attributes.normal;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i), th = x / R, rr = R + z;
      p.setXYZ(i, rr * Math.sin(th), p.getY(i), rr * Math.cos(th) - R);
      if (n) {
        const nx = n.getX(i), nz = n.getZ(i);
        n.setXYZ(i, nx * Math.cos(th) + nz * Math.sin(th), n.getY(i), -nx * Math.sin(th) + nz * Math.cos(th));
      }
    }
    p.needsUpdate = true;
    return g;
  }

  // Flatten a group's meshes (in the group's own space) into one mesh per material.
  function collapse(g, mergeGeometries) {
    g.updateMatrixWorld(true);
    const inv = g.matrixWorld.clone().invert();
    const byMat = new Map();
    g.traverse((o) => {
      if (!o.isMesh) return;
      let geo = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
      for (const k of Object.keys(geo.attributes)) if (k !== 'position' && k !== 'normal') geo.deleteAttribute(k);
      geo.applyMatrix4(inv.clone().multiply(o.matrixWorld));
      if (!byMat.has(o.material)) byMat.set(o.material, []);
      byMat.get(o.material).push(geo);
    });
    return [...byMat].map(([mat, geos]) => [mat, mergeGeometries(geos)]);
  }

  // Shape of a lamellar row: rectangle whose top edge is a row of rounded scale heads.
  function kozaneShape(w, h, lw = 0.02, head = 0.006) {
    const s = new THREE.Shape();
    s.moveTo(-w / 2, -h);
    s.lineTo(w / 2, -h);
    s.lineTo(w / 2, 0);
    const k = Math.max(1, Math.round(w / lw));
    const step = w / k;
    for (let i = k - 1; i >= 0; i--) {
      const x0 = -w / 2 + i * step;
      for (let j = 5; j >= 0; j--) {
        const u = j / 5;
        s.lineTo(x0 + u * step, head * Math.sqrt(Math.max(0, Math.sin(Math.PI * u))));
      }
    }
    s.closePath();
    return s;
  }

  function extrude(shape, depth, mat, parent, bevel = 0.0012, curveSegments = 6) {
    const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel * 0.8, bevelSegments: 1, curveSegments });
    g.translate(0, 0, -depth / 2);
    return add(g, mat, parent);
  }

  // Rosette fitting (gold kanamono): disc with petals.
  function rosette(r, mat, parent, pos, petals = 8) {
    const g = group(parent, pos);
    const s = new THREE.Shape();
    const n = petals * 8;
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * TAU;
      const rr = r * (0.78 + 0.22 * Math.abs(Math.cos((a * petals) / 2)));
      i === 0 ? s.moveTo(rr * Math.cos(a), rr * Math.sin(a)) : s.lineTo(rr * Math.cos(a), rr * Math.sin(a));
    }
    extrude(s, r * 0.25, mat, g, r * 0.08);
    ball(V(0, 0, r * 0.15), r * 0.32, mat, g, [1, 1, 0.6], [10, 6]);
    return g;
  }

  // Crescent opening to +X: outer circle r at the origin minus an inner circle shifted right.
  function crescentShape(r, shift = 0.32, inner = 0.84) {
    const d = r * shift, r2 = r * inner;
    const x = (r * r - r2 * r2 + d * d) / (2 * d), y = Math.sqrt(Math.max(0, r * r - x * x));
    const s = new THREE.Shape();
    const a0 = Math.atan2(y, x);
    s.absarc(0, 0, r, a0, TAU - a0, false);
    s.absarc(d, 0, r2, Math.atan2(-y, x - d), Math.atan2(y, x - d), true);
    return s;
  }

  return {
    crescentShape,
    V, Y, TAU, clamp01, smooth, gauss,
    add, tube, ball, box, capsule, frame, group, revolve, curveFrames, sweep, circleProfile,
    cord, rope, ringPoints, bendGeometry, collapse, kozaneShape, extrude, rosette,
  };
}
