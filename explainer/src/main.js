/**
 * main.js — boot. Loads assets + fonts, builds every scene once, then exposes
 * the deterministic seek API the frame renderer drives.
 */

import { FPS, DURATION, FRAME_COUNT, BEATS } from './script-da.js';
import TL, { build, seekToFrame, seekToTime } from './timeline.js';
import { loadManifest } from './assets.js';
import { mountPreview } from './preview.js';

const params = new URLSearchParams(location.search);
const RENDER_MODE = params.has('render');

if (RENDER_MODE) document.body.classList.add('render');

/** Make sure every weight we typeset in is rasterised before the first frame. */
async function ensureFonts() {
  const weights = [400, 500, 600, 700, 800, 900];
  const sizes = [24, 32, 46, 68, 104, 118];
  const jobs = [];
  for (const w of weights) for (const s of sizes) {
    jobs.push(document.fonts.load(`${w} ${s}px Inter`, 'AÆØÅaæøå0123456789·→'));
  }
  await Promise.all(jobs);
  await document.fonts.ready;
}

function fitPreview() {
  if (RENDER_MODE) return;
  const stage = document.getElementById('stage');
  const wrap = document.getElementById('stage-wrap');
  const uiH = 96;
  const sx = wrap.clientWidth / 1920;
  const sy = (wrap.clientHeight - uiH) / 1080;
  const s = Math.min(sx, sy);
  stage.style.transform = `scale(${s})`;
  stage.style.left = Math.max(0, (wrap.clientWidth - 1920 * s) / 2) + 'px';
  stage.style.top = Math.max(0, (wrap.clientHeight - uiH - 1080 * s) / 2) + 'px';
}

async function boot() {
  await loadManifest();
  await ensureFonts();

  const stage = document.getElementById('stage');
  build(stage);

  // Public, deterministic API — the only entry points the renderer uses.
  window.seekToFrame = (i) => seekToFrame(i);
  // The second argument is the playback speed at this instant, which
  // velocity-derived motion blur needs; a retimed render passes it per frame.
  // Forwarding it matters — an arrow that only took `s` would silently drop it
  // and every retimed frame would come out with full-speed blur.
  window.seekToTime = (s, timeScale) => seekToTime(s, timeScale);
  window.getDuration = () => DURATION;
  window.getFrameCount = () => FRAME_COUNT;
  window.getFps = () => FPS;
  window.getBeats = () => TL.getBeats();

  seekToFrame(Number(params.get('frame') || 0));

  if (!RENDER_MODE) {
    mountPreview({ seekToFrame, seekToTime, FPS, FRAME_COUNT, DURATION, BEATS });
    fitPreview();
    window.addEventListener('resize', fitPreview);
  }

  document.documentElement.dataset.ready = '1';
  window.__ready = true;
}

boot().catch((err) => {
  console.error('[boot] failed', err);
  document.documentElement.dataset.error = String(err && err.message || err);
  window.__bootError = String(err && err.stack || err);
});
