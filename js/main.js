'use strict';
// ===== 主迴圈與啟動 =====
const SIDEBAR_W = 268;

function resize() {
  const cv = $('view');
  const w = Math.max(160, window.innerWidth - SIDEBAR_W), h = window.innerHeight;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.style.width = w + 'px'; cv.style.height = h + 'px';
  cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
  R.w = w / R.zoom; R.h = h / R.zoom;
  R.res = R.zoom * dpr * (cv.width / (w * dpr));
  R.ctx = cv.getContext('2d');
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
    updateSidebar();
    drawMinimap(rdt);
  }
  requestAnimationFrame(frame);
}

let menuEra = '2050';
function buildMenu(era) {
  menuEra = era;
  const E = ERAS[era];
  $('menu-title').innerHTML = E.title;
  $('menu-story').textContent = E.story;
  $('menu-hint').textContent = (E.players > 2 ? '三國混戰:另外兩個陣營由電腦控制,彼此也會交戰。' : '') + '目標:摧毀所有敵方建築。按 F1 查看操作說明。';
  document.body.dataset.era = era;
  const box = $('factions');
  box.innerHTML = '';
  E.factions.forEach((f, i) => {
    const F = FACTIONS[f];
    const el = document.createElement('div');
    el.className = 'faction' + (i === 0 ? ' sel' : '');
    el.dataset.f = f;
    el.innerHTML = `<div class="flag" style="background:linear-gradient(90deg, ${F.color}, ${shade(F.color, 0.55)})"></div><h2>${F.name}</h2><small>${F.en}</small><p>${F.desc}</p><ul>${F.units.map(u => `<li>${u}</li>`).join('')}</ul>`;
    el.onclick = () => { box.querySelectorAll('.faction').forEach(o => o.classList.remove('sel')); el.classList.add('sel'); };
    box.appendChild(el);
  });
}

function startGame() {
  const faction = document.querySelector('.faction.sel').dataset.f;
  launchGame({ faction, difficulty: $('difficulty').value, era: menuEra });
}
function launchGame(opts) {
  audioInit();
  UI.lastOpts = Object.assign({}, opts);
  G.paused = false;
  $('pause').classList.add('hidden');
  newGame(Object.assign({}, opts));
  buildTerrain();
  initSidebar();
  MM.t = 0;
  UI.mouse.in = false;
  $('menu').classList.add('hidden');
  $('end').classList.add('hidden');
  $('game').classList.remove('hidden');
  const s = G.map.starts[me().startIdx];
  centerCamera(s.x + 1.5, s.y + 1.5);
  eva(ERAS[G.era].start);
}

window.addEventListener('load', () => {
  R.cv = $('view');
  resize();
  window.addEventListener('resize', resize);
  initInput();
  document.querySelectorAll('#eras button').forEach(b => {
    b.onclick = () => { document.querySelectorAll('#eras button').forEach(o => o.classList.toggle('sel', o === b)); buildMenu(b.dataset.era); };
  });
  buildMenu('2050');
  $('start').onclick = startGame;
  $('again').onclick = backToMainMenu;
  $('speed').onchange = e => { G.speed = parseFloat(e.target.value); syncSettingsUI(); saveSettings(); };
  initGameMenu();
  $('replay').onclick = () => { $('end').classList.add('hidden'); launchGame(UI.lastOpts); };
  $('pause').onclick = togglePause;
  $('help').onclick = toggleHelp;
  if (window.speechSynthesis) speechSynthesis.getVoices();
  requestAnimationFrame(frame);
});
