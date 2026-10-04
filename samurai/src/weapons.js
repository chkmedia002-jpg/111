// Katana (on the Katana bone), scabbard (hips) and wakizashi (spine).

export function createWeapons(ctx) {
  const { THREE, kit, M } = ctx;
  const { V, TAU, add, ball, tube, cord, rope, group, revolve, sweep, extrude } = kit;

  // Hilt along +Y from y0 to y1: rayskin core, crossing silk wrap, gold menuki.
  function hilt(parent, y0, y1, r, turns, { menuki = true } = {}) {
    revolve([[r * 0.96, y0], [r, y0 + 0.01], [r * 1.02, (y0 + y1) / 2], [r, y1 - 0.01], [r * 0.98, y1]], M.same, group(parent, null, null, [1, 1, 0.82]), {
      seg: 40, samples: 24, disp: (th, y, rr) => rr * (1 + 0.035 * Math.abs(Math.sin(th * 23) * Math.sin(y * 900))),
    });
    const len = y1 - y0;
    for (const dirn of [1, -1]) {
      const pts = [];
      const n = Math.round(turns * 24);
      for (let k = 0; k <= n; k++) {
        const t = k / n, a = dirn * t * turns * TAU;
        pts.push(V(Math.sin(a) * (r + 0.0012), y0 + 0.004 + t * (len - 0.008), Math.cos(a) * (r + 0.0012) * 0.82));
      }
      cord(pts, 0.0042, M.hilt, parent, { radial: 6, sx: 0.4, sy: 1.25 });
    }
    if (menuki) {
      for (const [y, z] of [[y0 + len * 0.62, 1], [y0 + len * 0.38, -1]]) {
        const g = group(parent, V(0, y, z * (r * 0.82 + 0.002)));
        for (let k = 0; k < 4; k++) ball(V(0, (k - 1.5) * 0.007, 0), 0.0045, M.gold, g, [0.9, 1.3, 0.5], [10, 6]);
      }
    }
  }

  function katana(kb) {
    const hiltLen = 0.27, hr = 0.0165;
    // kashira (pommel cap) and fuchi (collar)
    revolve([[0.001, -0.012], [0.015, -0.011], [0.0185, -0.004], [0.0185, 0.006], [0.017, 0.01]], M.gold, group(kb, null, null, [1, 1, 0.82]), { seg: 32 });
    rope([V(-0.012, -0.004, 0), V(0, -0.014, 0), V(0.012, -0.004, 0)], 0.003, M.hilt, kb, { radial: 4 });
    hilt(kb, 0.006, hiltLen - 0.012, hr, 5.5);
    revolve([[0.017, hiltLen - 0.014], [0.0185, hiltLen - 0.01], [0.0185, hiltLen], [0.016, hiltLen + 0.001]], M.gold, group(kb, null, null, [1, 1, 0.82]), { seg: 32 });
    // seppa and pierced round tsuba
    for (const dy of [0.0015, 0.0115]) tube(V(0, hiltLen + dy - 0.0015, 0), V(0, hiltLen + dy + 0.0015, 0), 0.02, 0.02, M.gold, group(kb, null, null, [1, 1, 0.7]), 24);
    const tg = group(kb, V(0, hiltLen + 0.0065, 0), [Math.PI / 2, 0, 0]);
    const ts = new THREE.Shape(); ts.absellipse(0, 0, 0.043, 0.037, 0, TAU, false);
    const nak = new THREE.Path(); nak.moveTo(-0.004, -0.013); nak.lineTo(0.009, -0.011); nak.lineTo(0.009, 0.011); nak.lineTo(-0.004, 0.013); nak.closePath(); ts.holes.push(nak);
    for (const s of [-1, 1]) {
      const h = new THREE.Path();
      h.absarc(0, s * 0.024, 0.008, 0, TAU, true);
      ts.holes.push(h);
    }
    extrude(ts, 0.005, M.iron, tg, 0.0008, 24);
    cord(Array.from({ length: 48 }, (_, k) => { const a = (k / 48) * TAU; return V(Math.cos(a) * 0.043, Math.sin(a) * 0.037, 0); }), 0.0022, M.gold, tg, { closed: true, radial: 5 });
    // habaki
    const hb = new THREE.Shape(); hb.moveTo(-0.017, 0); hb.lineTo(0.016, 0); hb.lineTo(0.014, 0.03); hb.lineTo(-0.015, 0.03); hb.closePath();
    extrude(hb, 0.011, M.gold, group(kb, V(0.0, hiltLen + 0.012, 0)), 0.0015, 4);

    // blade: shinogi-zukuri section swept along the curved centre line, with kissaki
    const L = 0.72, w0 = 0.031, w1 = 0.022, sori = -0.03, b0 = hiltLen + 0.012, K = 0.05;
    const N = 110;
    const sec = (t) => {
      const cx = sori * (t / L) ** 2;
      let w = w0 + (w1 - w0) * (t / L);
      const kt = t > L - K ? (t - (L - K)) / K : 0;
      const xm = cx - (w0 + (w1 - w0) * (t / L)) / 2; // back stays straight
      if (kt) w *= Math.sqrt(Math.max(0.0004, 1 - kt * kt));
      const tk = 0.0072 * (1 - 0.4 * (t / L)) * (kt ? Math.sqrt(Math.max(0.01, 1 - kt * kt)) : 1);
      return { xm, xs: xm + 0.32 * w, xe: xm + w, tk };
    };
    const frames = Array.from({ length: N + 1 }, (_, i) => ({ p: V(0, b0 + (i / N) * L, 0), n: V(1, 0, 0), b: V(0, 0, 1) }));
    const dup = (pts) => pts.flatMap((q) => [q, q]);
    sweep(frames, (i) => {
      const { xm, xs, xe, tk } = sec((i / N) * L);
      return dup([[xm, tk * 0.3], [xs, tk / 2], [xe, 0], [xs, -tk / 2], [xm, -tk * 0.3]]);
    }, M.steel, kb, { caps: true });
    // hamon: frosted temper line on both bevels
    for (const sd of [1, -1]) {
      sweep(frames.slice(0, N), (i) => {
        const t = (i / N) * L;
        const { xs, xe, tk } = sec(t);
        const f = 0.5 + 0.12 * Math.sin(t * 55) + 0.06 * Math.sin(t * 140 + 1);
        const pts = [];
        for (let k = 0; k <= 3; k++) {
          const u = f + (1 - f) * (k / 3) * 0.97;
          pts.push([xs + (xe - xs) * u, sd * (tk / 2) * (1 - u) + sd * 0.00025]);
        }
        return pts;
      }, M.hamon, kb, { closedProfile: false });
    }
  }

  // Scabbard in the waist group: lacquered, oval section, with fittings and a cord.
  function saya(w) {
    const A = V(0.2, 0.0, 0.12), B = V(0.42, -0.15, -0.6);
    const curve = new THREE.CatmullRomCurve3([A, A.clone().lerp(B, 0.5).add(V(0.0, 0.015, 0)), B]);
    const fr = kit.curveFrames(curve, 60);
    sweep(fr, (i, s) => kit.circleProfile(1, 16).map(([u, v]) => [u * 0.0125 * (1 - 0.15 * s), v * 0.019 * (1 - 0.15 * s)]), M.lacquer, w, { caps: true });
    const ring = (s, r, len, mat) => {
      const f = fr[Math.round(s * 60)];
      const g = kit.frame(f.p, f.t, f.n, w);
      revolve([[r * 0.9, -len / 2], [r, -len / 2 + 0.002], [r, len / 2 - 0.002], [r * 0.9, len / 2]], mat, group(g, null, null, [0.68, 1, 1]), { seg: 24 });
      return g;
    };
    ring(0.0, 0.0215, 0.016, M.horn);
    ring(0.97, 0.018, 0.05, M.gold);
    // kurikata knob with sageo cord
    const k = ring(0.12, 0.015, 0.012, M.lacquer);
    ball(V(0.012, 0, 0), 0.006, M.lacquer, k, [1.4, 1, 0.8]);
    rope([V(0.016, 0, 0), V(0.05, -0.04, 0.01), V(0.06, -0.12, 0.02), V(0.05, -0.2, 0.0), V(0.03, -0.25, -0.02)], 0.0045, M.red, k, { radial: 4 });
  }

  // Wakizashi tucked in the sash (spine group).
  function wakizashi(sp) {
    const g = kit.frame(V(0.12, 0.02, 0.15), V(0.4, 0.3, 0.86), V(1, 0, 0), sp);
    tube(V(0, -0.2, 0), V(0, 0.0, 0), 0.016, 0.018, M.lacquer, group(g, null, null, [1, 1, 0.65]), 20);
    revolve([[0.02, 0], [0.021, 0.004], [0.02, 0.016], [0.018, 0.018]], M.horn, group(g, null, null, [1, 1, 0.7]), { seg: 24 });
    const tg = group(g, V(0, 0.022, 0), [Math.PI / 2, 0, 0]);
    const ts = new THREE.Shape(); ts.absellipse(0, 0, 0.032, 0.027, 0, TAU, false);
    extrude(ts, 0.004, M.iron, tg, 0.0007, 20);
    revolve([[0.0145, 0.026], [0.016, 0.03], [0.016, 0.034]], M.gold, group(g, null, null, [1, 1, 0.82]), { seg: 24 });
    hilt(g, 0.034, 0.16, 0.0145, 3, { menuki: false });
    revolve([[0.016, 0.158], [0.016, 0.168], [0.012, 0.172], [0.001, 0.173]], M.gold, group(g, null, null, [1, 1, 0.82]), { seg: 24 });
  }

  return { katana, saya, wakizashi };
}
