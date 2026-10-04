'use strict';
// ===== 合成音效與語音 =====
const Audio2 = { ctx: null, master: null, on: true, vol: 0.7, voice: true, last: {}, noise: null };

function audioInit() {
  if (Audio2.ctx) return;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    Audio2.ctx = new AC();
    Audio2.master = Audio2.ctx.createGain();
    Audio2.master.gain.value = 0.5 * Audio2.vol;
    Audio2.master.connect(Audio2.ctx.destination);
    const len = Audio2.ctx.sampleRate;
    const buf = Audio2.ctx.createBuffer(1, len, Audio2.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    Audio2.noise = buf;
    // 解碼錄音語音
    Audio2.clips = {};
    for (const k in (typeof VOICE_DATA !== 'undefined' ? VOICE_DATA : {})) {
      const bin = atob(VOICE_DATA[k]), arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      Audio2.ctx.decodeAudioData(arr.buffer, b => { Audio2.clips[k] = b; }, () => {});
    }
  } catch (e) { Audio2.ctx = null; }
}

function _env(g, t, a, peak, dec) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec);
}
function _osc(type, f0, f1, dur, vol, dest) {
  const c = Audio2.ctx, t = c.currentTime;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  _env(g, t, 0.005, vol, dur);
  o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.05);
}
function _noise(dur, vol, freq, q, dest, type = 'lowpass') {
  const c = Audio2.ctx, t = c.currentTime;
  const s = c.createBufferSource(); s.buffer = Audio2.noise;
  const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q || 1;
  const g = c.createGain(); _env(g, t, 0.005, vol, dur);
  s.connect(f); f.connect(g); g.connect(dest);
  s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
}

// x,y:世界座標;畫面外音量降低
function sfx(name, x, y) {
  if (!Audio2.on || !Audio2.ctx) return;
  const now = performance.now();
  const gap = { gun: 70, laserS: 70, laser: 80, cannonS: 70, chop: 220, pick: 220 }[name] || 50;
  if (Audio2.last[name] && now - Audio2.last[name] < gap) return;
  Audio2.last[name] = now;
  let vol = 1;
  if (x !== undefined) {
    const [sx, sy] = worldToScreen(x, y);
    const off = Math.max(0, -sx, sx - R.w, -sy, sy - R.h);
    vol = clamp(1 - off / 300, 0.08, 1);
  }
  const c = Audio2.ctx, out = c.createGain(); out.gain.value = vol; out.connect(Audio2.master);
  switch (name) {
    case 'gun': _noise(0.07, 0.5, 2500, 1, out, 'bandpass'); break;
    case 'cannonS': _noise(0.1, 0.6, 1200, 1, out, 'bandpass'); _osc('square', 180, 60, 0.08, 0.15, out); break;
    case 'laserS': _osc('sawtooth', 1800, 300, 0.15, 0.18, out); break;
    case 'laser': _osc('sawtooth', 1400, 120, 0.25, 0.25, out); _osc('sine', 900, 200, 0.25, 0.2, out); break;
    case 'laserB': _osc('sawtooth', 600, 40, 0.7, 0.35, out); _osc('sine', 2400, 300, 0.5, 0.15, out); _noise(0.5, 0.3, 600, 1, out); break;
    case 'rail': _osc('sine', 3000, 200, 0.35, 0.25, out); _noise(0.25, 0.7, 3000, 0.7, out, 'highpass'); _osc('square', 90, 30, 0.3, 0.2, out); break;
    case 'rocket': _noise(0.35, 0.4, 900, 1, out); _osc('sawtooth', 300, 900, 0.2, 0.06, out); break;
    case 'cannon': _noise(0.4, 0.9, 500, 1, out); _osc('sine', 120, 40, 0.3, 0.5, out); break;
    case 'hit': _noise(0.3, 0.6, 700, 1, out); break;
    case 'boom': _noise(0.8, 1.0, 400, 1, out); _osc('sine', 90, 30, 0.6, 0.6, out); break;
    case 'bigboom': _noise(1.6, 1.0, 300, 1, out); _osc('sine', 70, 20, 1.2, 0.8, out); break;
    case 'die': _osc('triangle', 500, 150, 0.2, 0.1, out); break;
    case 'click': _osc('square', 900, 700, 0.04, 0.08, out); break;
    case 'ready': _osc('sine', 660, 660, 0.12, 0.15, out); setTimeout(() => Audio2.ctx && _osc('sine', 990, 990, 0.15, 0.15, out), 120); break;
    case 'place': _noise(0.3, 0.5, 300, 1, out); _osc('square', 200, 100, 0.15, 0.1, out); break;
    case 'sell': _osc('sine', 1200, 600, 0.3, 0.15, out); break;
    case 'musket': _noise(0.25, 0.9, 900, 0.8, out); _noise(0.06, 0.7, 3000, 1, out, 'highpass'); break;
    case 'bow': _osc('triangle', 220, 120, 0.12, 0.12, out); _noise(0.15, 0.15, 2500, 1, out, 'bandpass'); break;
    case 'clang': _osc('square', 1400, 1100, 0.08, 0.06, out); _osc('triangle', 2600, 2200, 0.15, 0.06, out); _noise(0.05, 0.3, 4000, 2, out, 'bandpass'); break;
    case 'cannonOld': _noise(0.9, 1.0, 350, 1, out); _osc('sine', 80, 25, 0.7, 0.7, out); break;
    case 'whoosh': _noise(0.5, 0.4, 600, 0.6, out, 'bandpass'); break;
    case 'chop': _noise(0.08, 0.5, 1200, 2, out, 'bandpass'); _osc('triangle', 300, 180, 0.06, 0.12, out); break;
    case 'pick': _osc('square', 1800, 1500, 0.05, 0.05, out); _noise(0.06, 0.4, 3500, 2, out, 'bandpass'); break;
    case 'treefall': _noise(0.9, 0.7, 500, 1, out); _osc('sine', 120, 50, 0.6, 0.3, out); break;
    case 'ack': _osc('square', 500, 800, 0.06, 0.06, out); break;
  }
}

// 語音播報 + 畫面訊息
let _evaVoice = null, _evaLast = {};
// 播放錄音語音(VOICE_DATA 內的代號),成功回傳 true
function playClip(name) {
  const b = Audio2.ctx && Audio2.clips && Audio2.clips[name];
  if (!b) return false;
  const src = Audio2.ctx.createBufferSource(), g = Audio2.ctx.createGain();
  src.buffer = b; g.gain.value = 1.6;
  src.connect(g); g.connect(Audio2.master); src.start();
  return true;
}
const CLIP_TEXT = { unit_ready: 'Unit ready' };

// say:錄音語音代號(畫面訊息仍為中文);錄音不可用時改以英語合成語音唸出
let _evaVoiceEn = null;
function eva(text, speak = true, say = null) {
  text = eraText(text);
  UI.message(text);
  if (!speak || !Audio2.on || !Audio2.voice || (!say && !('speechSynthesis' in window))) return;
  const now = performance.now();
  if (_evaLast[text] && now - _evaLast[text] < 4000) return;
  _evaLast[text] = now;
  try {
    if (say) {
      if ('speechSynthesis' in window) speechSynthesis.cancel();
      if (playClip(say)) return;
      say = CLIP_TEXT[say] || say;
      if (!_evaVoiceEn) _evaVoiceEn = speechSynthesis.getVoices().find(v => /^en[-_]US/i.test(v.lang)) || speechSynthesis.getVoices().find(v => /^en/i.test(v.lang)) || null;
      const u = new SpeechSynthesisUtterance(say);
      u.lang = 'en-US'; if (_evaVoiceEn) u.voice = _evaVoiceEn;
      u.rate = 1.0; u.pitch = 0.8; u.volume = 0.8;
      speechSynthesis.cancel();
      speechSynthesis.speak(u);
      return;
    }
    if (!_evaVoice) {
      const vs = speechSynthesis.getVoices();
      _evaVoice = vs.find(v => /zh[-_]TW/i.test(v.lang)) || vs.find(v => /zh/i.test(v.lang)) || null;
    }
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'zh-TW'; if (_evaVoice) u.voice = _evaVoice;
    u.rate = 1.1; u.pitch = 0.8; u.volume = 0.8;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  } catch (e) { /* 無語音支援 */ }
}
