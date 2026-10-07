// 把 GLB 走路動畫渲染成 5 個方向 × N 格的等角精靈:
//   cd tools/render3d && npm install && node render.js <模型.glb> <代號> [格數]
// 輸出到 art/src/<代號>.dirs/:<方向>_NN.webp 與 meta.json,再執行 python3 tools/pack_sprites.py
// 方向以遊戲世界角度命名(dir 0 = 畫面右下);左邊三個方向由遊戲水平翻轉。
const path = require('path'), fs = require('fs');
const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
// 選項:--katana 右手持武士刀並渲染斬擊動畫(attack 格數 = --attack=N,預設 6)
const args = process.argv.slice(2), flags = args.filter(a => a.startsWith('--')), pos = args.filter(a => !a.startsWith('--'));
const [glb, code, nArg] = pos;
if (!glb || !code) { console.log('用法:node render.js <模型.glb> <代號> [格數] [--katana] [--attack=6]'); process.exit(1); }
const N = parseInt(nArg || '8', 10);
const KATANA = flags.includes('--katana');
const NA = KATANA ? parseInt((flags.find(f => f.startsWith('--attack=')) || '--attack=6').split('=')[1], 10) : 0;
const HERE = __dirname, OUT = path.join(HERE, '..', '..', 'art', 'src', code + '.dirs');
const DIRS = { se: 0, s: Math.PI / 4, e: -Math.PI / 4, ne: -Math.PI / 2, n: -3 * Math.PI / 4 };
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.glb': 'model/gltf-binary' };
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  for (const f of fs.readdirSync(OUT)) fs.unlinkSync(path.join(OUT, f));
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const pg = await b.newPage();
  pg.on('pageerror', e => console.log('頁面錯誤:' + e.message));
  // 以攔截請求提供檔案,不需要另外架伺服器
  await pg.route('http://render.local/**', route => {
    const rel = decodeURIComponent(new URL(route.request().url()).pathname);
    const file = rel === '/model.glb' ? path.resolve(glb) : path.join(HERE, rel);
    if (!fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
    route.fulfill({ status: 200, body: fs.readFileSync(file), contentType: TYPES[path.extname(file)] || 'application/octet-stream' });
  });
  await pg.goto('http://render.local/render.html');
  await pg.waitForFunction(() => window.ready, null, { timeout: 60000 });
  const info = await pg.evaluate(k => init('model.glb', { katana: k }), KATANA);
  console.log(`動畫 ${info.anim}(${info.duration.toFixed(2)} 秒),腳骨 ${info.feet.join(', ')}`);
  const meta = { anchor: info.anchor, size: info.size, frames: N, dirs: {} };
  for (const [name, dir] of Object.entries(DIRS)) {
    let best = 0, bestSpread = 1e9;
    for (let f = 0; f < N; f++) {
      const r = await pg.evaluate(([t, d]) => frame(t, d), [f / N, dir]);
      fs.writeFileSync(path.join(OUT, `${name}_${String(f + 1).padStart(2, '0')}.png`), Buffer.from(r.png.split(',')[1], 'base64'));
      if (r.spread < bestSpread) { bestSpread = r.spread; best = f; }
    }
    meta.dirs[name] = { dir, stand: best };
    // 斬擊
    for (let f = 0; f < NA; f++) {
      const r = await pg.evaluate(([t, d, st]) => attack(t, d, st), [f / NA, dir, best / N]);
      fs.writeFileSync(path.join(OUT, `atk-${name}_${String(f + 1).padStart(2, '0')}.png`), Buffer.from(r.png.split(',')[1], 'base64'));
    }
    if (NA) meta.dirs[name].attack = NA;
    console.log(`${name}:走路 ${N} 格(站立用第 ${best + 1} 格)${NA ? `,斬擊 ${NA} 格` : ''}`);
  }
  fs.writeFileSync(path.join(OUT, 'meta.json'), JSON.stringify(meta, null, 1));
  await b.close();
  // 裁成共同範圍並轉 WebP
  console.log(require('child_process').execFileSync('python3', [path.join(HERE, 'compact.py'), OUT]).toString().trim());
})();
