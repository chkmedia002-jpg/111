'use strict';
// ===== 主迴圈與啟動 =====
const SIDEBAR_W = 268;
let lowCv = null, viewCtx = null;

function resize() {
  const cv = $('view');
  const w = Math.max(160, window.innerWidth - SIDEBAR_W), h = window.innerHeight;
  cv.style.width = w + 'px'; cv.style.height = h + 'px';
  cv.width = w; cv.height = h;
  R.w = Math.ceil(w / SCALE); R.h = Math.ceil(h / SCALE);
  lowCv.width = R.w; lowCv.height = R.h;
  R.ctx = lowCv.getContext('2d');
  R.ctx.imageSmoothingEnabled = false;
  viewCtx = cv.getContext('2d');
  viewCtx.imageSmoothingEnabled = false;
  if (G.map) clampCamera();
}

let lastT = performance.now();
function frame(now) {
  const rdt = Math.min(0.05, (now - lastT) / 1000);
  lastT = now;
  if (G.map) {
    updateCamera(rdt);
    if (!G.paused) {
      // 子步進,讓高速也穩定
      const dt = rdt * G.speed, n = Math.ceil(dt / 0.034);
      for (let i = 0; i < n; i++) updateGame(dt / n);
    }
    updateHover();
    render();
    viewCtx.drawImage(lowCv, 0, 0, R.w * SCALE, R.h * SCALE);
    updateSidebar();
    drawMinimap(rdt);
  }
  requestAnimationFrame(frame);
}

function startGame() {
  audioInit();
  const faction = document.querySelector('.faction.sel').dataset.f;
  const difficulty = $('difficulty').value;
  newGame({ faction, difficulty });
  buildTerrain();
  initSidebar();
  MM.t = 0;
  UI.mouse.in = false;
  $('menu').classList.add('hidden');
  $('end').classList.add('hidden');
  $('game').classList.remove('hidden');
  const s = G.map.starts[me().startIdx];
  centerCamera(s.x + 1.5, s.y + 1.5);
  eva('戰場控制,已上線');
}

window.addEventListener('load', () => {
  lowCv = document.createElement('canvas');
  R.cv = $('view');
  resize();
  window.addEventListener('resize', resize);
  initInput();
  document.querySelectorAll('.faction').forEach(el => {
    el.onclick = () => { document.querySelectorAll('.faction').forEach(o => o.classList.remove('sel')); el.classList.add('sel'); };
  });
  $('start').onclick = startGame;
  $('again').onclick = () => { $('end').classList.add('hidden'); $('menu').classList.remove('hidden'); };
  $('speed').onchange = e => { G.speed = parseFloat(e.target.value); };
  $('pause').onclick = togglePause;
  $('help').onclick = toggleHelp;
  if (window.speechSynthesis) speechSynthesis.getVoices();
  requestAnimationFrame(frame);
});
