import { buildQuery } from './query.js';
import {
  fetchAndRender, filterByTimespan, setSortOrder, loadMore, hasCachedData,
  setTranslateEnabled, toggleSelectMode, clearSelection, selectAll,
  getSelectedArticles, setSelectionChangeCallback,
  getFilteredArticles, setOnRenderCallback,
} from './headlines.js';
import { initMap, updateMap } from './mapview.js';

let currentView = 'headlines', currentTimespan = '7d';
let translateEnabled = true, lastBuiltQuery = '', selectModeOn = false;
const LS_KEY = 'nm_default';

const el  = id  => document.getElementById(id);
const qsa = sel => [...document.querySelectorAll(sel)];

function showToast(msg, ms = 2500) {
  const t = el('toast'); if (!t) return;
  t.textContent = msg; t.classList.add('toast-visible');
  setTimeout(() => t.classList.remove('toast-visible'), ms);
}

function switchView(view) {
  currentView = view;
  qsa('.view-btn').forEach(b => {
    const on = b.dataset.view === view;
    b.classList.toggle('active', on); b.setAttribute('aria-pressed', String(on));
  });
  qsa('.view-panel').forEach(p => {
    const on = p.id === `view${view[0].toUpperCase()}${view.slice(1)}`;
    p.classList.toggle('active', on);
  });
  if (view === 'map') showMap();
}

function showMap() {
  initMap('mapContainer');
  updateMap(getFilteredArticles());
}

function applyTranslate(enabled) {
  translateEnabled = enabled; setTranslateEnabled(enabled);
  el('translateToggleBtn')?.setAttribute('aria-pressed', String(enabled));
  el('translateToggleBtn')?.classList.toggle('active', enabled);
  const lbl = el('translateBtnLabel'); if (lbl) lbl.textContent = enabled ? 'EN' : 'OFF';
}

function readFormParams() {
  return {
    resource: el('resourceSelect')?.value ?? '',
    region:   el('regionSelect')?.value   ?? '',
    country:  el('countryInput')?.value   ?? '',
  };
}

function setActiveTimespanBtn(ts) {
  qsa('.time-btn').forEach(b => {
    const on = b.dataset.timespan === ts;
    b.classList.toggle('active', on); b.setAttribute('aria-pressed', String(on));
  });
  currentTimespan = ts;
}

function loadStoredDefault() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || 'null'); } catch { return null; }
}

function saveDefault() {
  const p = readFormParams();
  if (!buildQuery(p)) { showToast('Nothing to save — run a search first.'); return; }
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({
      resource: p.resource, region: p.region, country: p.country, timespan: currentTimespan,
    }));
    showToast('Default saved');
    el('setDefaultBtn')?.classList.add('saved');
  } catch { showToast('Could not save — storage unavailable.'); }
}

function showDefaultBadge(visible) {
  const badge = el('defaultBadge');
  if (badge) badge.style.display = visible ? 'inline-flex' : 'none';
  if (!visible) el('setDefaultBtn')?.classList.remove('saved');
}

function doSearch() {
  const params = readFormParams(), query = buildQuery(params);
  if (!query) { showToast('Please select a resource or enter a keyword.'); return; }
  lastBuiltQuery = query;
  showDefaultBadge(false);
  if (currentView !== 'headlines') switchView('headlines');
  hasCachedData(query) ? filterByTimespan(currentTimespan) : fetchAndRender(query, currentTimespan);
  const url = new URL(window.location.href);
  params.resource ? url.searchParams.set('r', params.resource) : url.searchParams.delete('r');
  params.region   ? url.searchParams.set('rg', params.region)  : url.searchParams.delete('rg');
  params.country  ? url.searchParams.set('c', params.country)  : url.searchParams.delete('c');
  url.searchParams.set('t', currentTimespan);
  window.history.replaceState({}, '', url.toString());
}

function restoreFromURL() {
  const p = new URLSearchParams(window.location.search);
  if (p.get('r')  && el('resourceSelect')) el('resourceSelect').value = p.get('r');
  if (p.get('rg') && el('regionSelect'))   el('regionSelect').value   = p.get('rg');
  if (p.get('c')  && el('countryInput'))   el('countryInput').value   = p.get('c');
  if (p.get('t')) setActiveTimespanBtn(p.get('t'));
  if (p.get('r') || p.get('c')) { doSearch(); return; }
  const dflt = loadStoredDefault();
  if (dflt) {
    if (dflt.resource && el('resourceSelect')) el('resourceSelect').value = dflt.resource;
    if (dflt.region   && el('regionSelect'))   el('regionSelect').value   = dflt.region;
    if (dflt.country  && el('countryInput'))   el('countryInput').value   = dflt.country;
    setActiveTimespanBtn(dflt.timespan || '7d');
    const q = buildQuery(readFormParams());
    if (q) { lastBuiltQuery = q; showDefaultBadge(true); fetchAndRender(q, currentTimespan); }
  }
}

function updateSelBar(count) {
  el('selBar')?.classList.toggle('sel-bar-visible', count > 0);
  const lbl = el('selBarCount'); if (lbl) lbl.textContent = `${count} selected`;
}

function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

async function shareSelected() {
  const arts = getSelectedArticles(); if (!arts.length) return;
  const header = `${arts.length} article${arts.length === 1 ? '' : 's'} on: ${lastBuiltQuery}`;
  const lines  = arts.map((a, i) => `${i + 1}. ${a.title}\n   ${a.url}`).join('\n\n');
  const payload = arts.length === 1
    ? { title: arts[0].title, text: `${header}\n\n${arts[0].title}`, url: arts[0].url }
    : { title: `NewsMapper — ${lastBuiltQuery}`, text: `${header}\n\n${lines}` };
  const canShare = typeof navigator.share === 'function' &&
    (typeof navigator.canShare !== 'function' || navigator.canShare(payload));
  if (canShare) {
    try { await navigator.share(payload); return; }
    catch (e) { if (e?.name === 'AbortError') return; }
  }
  try {
    await navigator.clipboard.writeText(arts.length === 1 ? `${arts[0].title}\n${arts[0].url}` : `${payload.title}\n\n${lines}`);
    showToast('Copied to clipboard');
  } catch { showToast('Could not share — try Export instead'); }
}

function exportSelectedHtml() {
  const arts = getSelectedArticles(); if (!arts.length) return;
  const rows = arts.map((a, i) => `\n    <li><a href="${esc(a.url)}" target="_blank">${esc(a.title)}</a><div class="meta">${[a.country,a.domain,a.date].filter(Boolean).map(esc).join(' &middot; ')}</div></li>`).join('');
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>NewsMapper — ${esc(lastBuiltQuery)}</title><style>body{font-family:system-ui,sans-serif;max-width:700px;margin:2rem auto;padding:0 1rem;color:#1a1d2e;line-height:1.5}h1{font-size:1.1rem;color:#2a52be;margin-bottom:.2rem}.sub{font-size:.8rem;color:#888;margin:0 0 1.5rem}ol{padding-left:1.3rem}li{margin-bottom:1rem}a{color:#2a52be;font-weight:600;text-decoration:none}a:hover{text-decoration:underline}.meta{font-size:.75rem;color:#888;margin-top:.2rem}</style></head><body><h1>NewsMapper — ${esc(lastBuiltQuery)}</h1><p class="sub">${arts.length} article${arts.length===1?'':'s'} &middot; exported ${new Date().toLocaleString()}</p><ol>${rows}\n</ol></body></html>`;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
  a.download = `newsmapper-${lastBuiltQuery.replace(/[^a-z0-9]+/gi,'-').toLowerCase().slice(0,40)}.html`;
  a.click(); URL.revokeObjectURL(a.href);
}

function wireEvents() {
  qsa('.view-btn[data-view]').forEach(b => b.addEventListener('click', () => switchView(b.dataset.view)));
  el('translateToggleBtn')?.addEventListener('click', () => applyTranslate(!translateEnabled));
  qsa('.time-btn').forEach(b => b.addEventListener('click', () => {
    const ts = b.dataset.timespan; setActiveTimespanBtn(ts);
    if (lastBuiltQuery) hasCachedData(lastBuiltQuery) ? filterByTimespan(ts) : fetchAndRender(lastBuiltQuery, ts);
  }));
  el('setDefaultBtn')?.addEventListener('click', saveDefault);
  el('hlSelectBtn')?.addEventListener('click', () => {
    selectModeOn = !selectModeOn;
    toggleSelectMode(selectModeOn);
    el('hlSelectBtn')?.classList.toggle('active', selectModeOn);
    el('hlSelectBtn')?.setAttribute('aria-pressed', String(selectModeOn));
    if (!selectModeOn) updateSelBar(0);
  });
  el('selSelectAllBtn')?.addEventListener('click', selectAll);
  el('selShareBtn')?.addEventListener('click', shareSelected);
  el('selExportBtn')?.addEventListener('click', exportSelectedHtml);
  el('selClearBtn')?.addEventListener('click', () => { clearSelection(); updateSelBar(0); });
  setSelectionChangeCallback(count => updateSelBar(count));
  el('searchBtn')?.addEventListener('click', doSearch);
  el('countryInput')?.addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });
  el('hlSortSelect')?.addEventListener('change', e => setSortOrder(e.target.value));
  el('hlLoadMoreBtn')?.addEventListener('click', loadMore);
  el('hlRetryBtn')?.addEventListener('click', () => { if (lastBuiltQuery) fetchAndRender(lastBuiltQuery, currentTimespan); });
}

function setupPullToRefresh() {
  let startY = 0, mayPull = false;
  document.addEventListener('touchstart', e => {
    const grid = el('hlGrid');
    mayPull = (grid ? grid.scrollTop : 0) === 0;
    startY = e.touches[0].clientY;
  }, { passive: true });
  document.addEventListener('touchend', e => {
    if (!mayPull) return;
    if (e.changedTouches[0].clientY - startY > 90) window.location.reload(true);
  }, { passive: true });
}

document.addEventListener('DOMContentLoaded', () => {
  wireEvents(); applyTranslate(true);
  setOnRenderCallback(articles => { if (currentView === 'map') updateMap(articles); });
  setupPullToRefresh();
  restoreFromURL();
});
