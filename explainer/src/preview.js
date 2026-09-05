/**
 * preview.js — local scrub/playback chrome.
 *
 * requestAnimationFrame appears here and ONLY here: it drives nothing on its
 * own, it merely calls the same deterministic seekToTime() the renderer calls.
 * The exported video is never produced from this playback path.
 */

export function mountPreview({ seekToFrame, FPS, FRAME_COUNT, DURATION, BEATS }) {
  const ui = document.getElementById('preview-ui');
  if (!ui) return;

  const btnPlay = document.getElementById('btn-play');
  const btnBack = document.getElementById('btn-back');
  const btnFwd = document.getElementById('btn-fwd');
  const btnGuides = document.getElementById('btn-guides');
  const scrub = document.getElementById('scrub');
  const readout = document.getElementById('readout');
  const markers = document.getElementById('markers');

  scrub.max = String(FRAME_COUNT - 1);

  let frame = 0;
  let playing = false;
  let rafId = 0;
  let anchorWall = 0;   // wall-clock at play start
  let anchorFrame = 0;

  const fmt = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec - m * 60;
    return `${String(m).padStart(2, '0')}:${s.toFixed(2).padStart(5, '0')}`;
  };

  const beatOf = (f) => {
    const t = f / FPS;
    let k = 0;
    BEATS.forEach((b, i) => { if (t >= b.start) k = i; });
    return k;
  };

  function paint(f, { fromScrub = false } = {}) {
    frame = Math.max(0, Math.min(FRAME_COUNT - 1, Math.round(f)));
    seekToFrame(frame);
    if (!fromScrub) scrub.value = String(frame);
    const k = beatOf(frame);
    readout.textContent =
      `${fmt(frame / FPS)} · frame ${String(frame).padStart(4, '0')} / ${FRAME_COUNT} · beat ${k + 1} — ${BEATS[k].title}`;
    markers.querySelectorAll('.mk').forEach((m, i) => m.classList.toggle('active', i === k));
  }

  // Beat markers, proportional to the timeline.
  BEATS.forEach((b, i) => {
    const mk = document.createElement('div');
    mk.className = 'mk';
    mk.style.left = (b.start / DURATION) * 100 + '%';
    mk.style.width = ((b.end - b.start) / DURATION) * 100 + '%';
    mk.innerHTML = `<b>${i + 1}</b>${b.start.toFixed(1)}s`;
    mk.title = `Beat ${i + 1} — ${b.title}`;
    mk.addEventListener('click', () => { stop(); paint(Math.round(b.start * FPS)); });
    markers.appendChild(mk);
  });

  function tick() {
    if (!playing) return;
    // Wall clock is used only to pick WHICH frame to show; the frame's content
    // is still a pure function of its index.
    const elapsed = (performance.now() - anchorWall) / 1000;
    let f = anchorFrame + Math.round(elapsed * FPS);
    if (f >= FRAME_COUNT) { paint(FRAME_COUNT - 1); stop(); return; }
    paint(f);
    rafId = requestAnimationFrame(tick);
  }

  function play() {
    if (playing) return;
    if (frame >= FRAME_COUNT - 1) frame = 0;
    playing = true;
    anchorWall = performance.now();
    anchorFrame = frame;
    btnPlay.textContent = 'Pause';
    rafId = requestAnimationFrame(tick);
  }
  function stop() {
    playing = false;
    cancelAnimationFrame(rafId);
    btnPlay.textContent = 'Afspil';
  }

  btnPlay.addEventListener('click', () => (playing ? stop() : play()));
  btnBack.addEventListener('click', () => { stop(); paint(frame - 1); });
  btnFwd.addEventListener('click', () => { stop(); paint(frame + 1); });
  btnGuides.addEventListener('click', () => document.body.classList.toggle('guides'));
  scrub.addEventListener('input', () => { stop(); paint(Number(scrub.value), { fromScrub: true }); });

  window.addEventListener('keydown', (e) => {
    if (e.key === ' ') { e.preventDefault(); playing ? stop() : play(); }
    if (e.key === 'ArrowRight') { stop(); paint(frame + (e.shiftKey ? 10 : 1)); }
    if (e.key === 'ArrowLeft') { stop(); paint(frame - (e.shiftKey ? 10 : 1)); }
    if (e.key === 'Home') { stop(); paint(0); }
    if (e.key === 'End') { stop(); paint(FRAME_COUNT - 1); }
    if (/^[1-9]$/.test(e.key)) { stop(); paint(Math.round(BEATS[Number(e.key) - 1].start * FPS)); }
    if (e.key === '0') { stop(); paint(Math.round(BEATS[9].start * FPS)); }
  });

  paint(0);
}

export default { mountPreview };
