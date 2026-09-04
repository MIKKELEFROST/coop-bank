/**
 * assets.js — optional-asset resolution with graceful fallbacks.
 *
 * The browser cannot stat the filesystem, so `scripts/scan-assets.mjs` writes
 * `assets/manifest.json` before any render. If the manifest is missing or an
 * entry is absent, every consumer falls back to a drawn substitute — a missing
 * asset must never block a render.
 */

export const EXPECTED = {
  reference: 'assets/reference/reference-saas-explainer.mp4',
  logoSvg: 'assets/brand/coop-bank-logo.svg',
  logoPng: 'assets/brand/coop-bank-logo.png',
  guidelines: 'assets/brand/brand-guidelines.pdf',
  fonts: 'assets/brand/fonts/',
  wfWebflow: 'assets/workflows/webflow-claude-mcp.png',
  wfContent: 'assets/workflows/nicole-content-agent.png',
  wfTone: 'assets/workflows/tonepilot.png',
  wfCmo: 'assets/workflows/cmo-copilot.png',
  personMikkel: 'assets/people/mikkel.png',
  personNicole: 'assets/people/nicole.png',
  audioWav: 'assets/audio/voiceover-da.wav',
  audioMp3: 'assets/audio/voiceover-da.mp3',
};

let manifest = { found: {}, missing: Object.keys(EXPECTED) };

export async function loadManifest() {
  try {
    const r = await fetch('./assets/manifest.json', { cache: 'no-store' });
    if (r.ok) manifest = await r.json();
  } catch (e) {
    // Keep the all-missing default; fallbacks below cover every consumer.
  }
  return manifest;
}

export const getManifest = () => manifest;
export const has = (key) => Boolean(manifest.found && manifest.found[key]);
export const url = (key) => (has(key) ? './' + manifest.found[key] : null);

/**
 * The wordmark. No official logo file is ever invented: when none is supplied
 * we set the name as clean type, which is the documented fallback.
 */
export function brandmark(parent, { dark = false, label = 'Coop Bank · Marketing' } = {}) {
  const n = document.createElement('div');
  n.className = 'brandmark' + (dark ? ' on-dark' : '');
  if (has('logoSvg') || has('logoPng')) {
    const img = document.createElement('img');
    img.src = url('logoSvg') || url('logoPng');
    img.style.height = '30px';
    img.alt = 'Coop Bank';
    n.appendChild(img);
    const sep = document.createElement('span');
    sep.textContent = 'Marketing';
    n.appendChild(sep);
  } else {
    const dot = document.createElement('span');
    dot.className = 'bm-dot';
    n.appendChild(dot);
    const t = document.createElement('span');
    t.textContent = label;
    n.appendChild(t);
  }
  if (parent) parent.appendChild(n);
  return n;
}

/**
 * Portrait avatar — optional by design. Falls back to a monogram disc so the
 * layout is identical whether or not photos were supplied.
 */
export function avatar(parent, personKey, initials, size = 44) {
  const n = document.createElement('div');
  n.style.cssText =
    `width:${size}px;height:${size}px;border-radius:50%;overflow:hidden;flex:none;` +
    `display:flex;align-items:center;justify-content:center;` +
    `background:#EAEAE4;border:1px solid #DEDED7;font-weight:700;font-size:${Math.round(size * 0.38)}px;color:#5A5A57`;
  if (has(personKey)) {
    const img = document.createElement('img');
    img.src = url(personKey);
    img.style.cssText = 'width:100%;height:100%;object-fit:cover';
    n.appendChild(img);
  } else {
    n.textContent = initials;
  }
  if (parent) parent.appendChild(n);
  return n;
}

export default { EXPECTED, loadManifest, getManifest, has, url, brandmark, avatar };
