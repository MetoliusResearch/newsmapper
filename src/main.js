import { buildQuery } from './query.js';
import {
  fetchAndRender, filterByTimespan, setSortOrder, loadMore, hasCachedData,
  setTranslateEnabled, setTranslateLanguage, toggleSelectMode, clearSelection, selectAll,
  getSelectedArticles, setSelectionChangeCallback,
  setOnRenderCallback, setOnTranslateCallback,
  setCountryFilter, getCountryFilter,
  getDisplayArticles, buildArticleRowsHtml, getMapArticles,
} from './headlines.js';
import { initHybridMap, updateHybridMap, setMapCountryClickHandler } from './mapview.js';
import { COUNTRY_COORDS } from './countries.js';

let currentView = 'hybrid', currentTimespan = '7d';
let translateEnabled = true, lastBuiltQuery = '', selectModeOn = false;
const LS_KEY = 'nm_default';
let countryNames = [];
let activeCountrySuggestion = -1;
let _hybridStatusActive = false;

const el  = id  => document.getElementById(id);
const qsa = sel => [...document.querySelectorAll(sel)];

function countryLabelFromKey(key) {
  return String(key)
    .split(/\s+/)
    .filter(Boolean)
    .map(part => part[0].toUpperCase() + part.slice(1))
    .join(' ');
}

function hydrateCountrySelect() {
  countryNames = [...new Set(Object.keys(COUNTRY_COORDS).map(countryLabelFromKey))].sort((a, b) => a.localeCompare(b));
}

function hideCountrySuggestions() {
  const box = el('countrySuggest');
  if (!box) return;
  box.hidden = true;
  box.innerHTML = '';
  activeCountrySuggestion = -1;
}

function applyCountrySuggestion(value) {
  const input = el('countryInput');
  if (!input) return;
  input.value = value;
  hideCountrySuggestions();
}

function highlightCountrySuggestion(index) {
  const box = el('countrySuggest');
  if (!box || box.hidden) return;
  const items = [...box.querySelectorAll('.country-suggest-item')];
  items.forEach((node, i) => node.classList.toggle('active', i === index));
}

function showCountrySuggestions(query) {
  const box = el('countrySuggest');
  if (!box) return;
  const q = String(query || '').trim().toLowerCase();
  if (!q) { hideCountrySuggestions(); return; }
  const matches = countryNames.filter(name => name.toLowerCase().startsWith(q))
    .concat(countryNames.filter(name => !name.toLowerCase().startsWith(q) && name.toLowerCase().includes(q)))
    .slice(0, 12);
  if (!matches.length) { hideCountrySuggestions(); return; }
  activeCountrySuggestion = -1;
  box.innerHTML = matches.map((name, idx) => `<button type="button" class="country-suggest-item" data-idx="${idx}" data-country="${esc(name)}">${esc(name)}</button>`).join('');
  box.hidden = false;
}

function moveCountrySuggestion(delta) {
  const box = el('countrySuggest');
  if (!box || box.hidden) return;
  const items = [...box.querySelectorAll('.country-suggest-item')];
  if (!items.length) return;
  activeCountrySuggestion = (activeCountrySuggestion + delta + items.length) % items.length;
  highlightCountrySuggestion(activeCountrySuggestion);
}

function chooseActiveCountrySuggestion() {
  const box = el('countrySuggest');
  if (!box || box.hidden) return false;
  const items = [...box.querySelectorAll('.country-suggest-item')];
  if (!items.length) return false;
  const idx = activeCountrySuggestion >= 0 ? activeCountrySuggestion : 0;
  const item = items[idx];
  if (!item) return false;
  applyCountrySuggestion(item.dataset.country || item.textContent || '');
  return true;
}

function showToast(msg, ms = 2500) {
  const t = el('toast'); if (!t) return;
  t.textContent = msg; t.classList.add('toast-visible');
  setTimeout(() => t.classList.remove('toast-visible'), ms);
}

function setHybridStatus(state) {
  const container = el('hybridHeadlines');
  if (!container) return;
  _hybridStatusActive = !!state;
  if (!state) return;
  const msg = state === 'downloading' ? 'Downloading\u2026' : 'Translating\u2026';
  container.innerHTML = `<div class="hybrid-status"><div class="spinner"></div><span class="hybrid-status-msg">${msg}</span></div>`;
}

function setSearchLoading(on) {
  const btn = el('searchBtn');
  if (!btn) return;
  btn.classList.toggle('loading', !!on);
  btn.setAttribute('aria-busy', String(!!on));
  btn.disabled = !!on;
}

async function runQuery(query, timespan) {
  setSearchLoading(true);
  try {
    if (hasCachedData(query, timespan)) {
      filterByTimespan(timespan);
    } else {
      setHybridStatus('downloading');
      await fetchAndRender(query, timespan);
    }
  } finally {
    setSearchLoading(false);
  }
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
  const th = el('toolbarHeadlines'), thh = el('toolbarHybrid');
  if (th)  th.style.display  = view === 'headlines' ? '' : 'none';
  if (thh) thh.style.display = view === 'hybrid'    ? '' : 'none';
  if (view === 'hybrid') showHybrid();
  positionSelBar();
}

function renderHybridList(articles) {
  _hybridStatusActive = false;
  const container = el('hybridHeadlines');
  if (!container) return;
  if (!articles.length) {
    container.innerHTML = '<p class="hybrid-empty">Run a search above.</p>';
    return;
  }
  container.innerHTML = buildArticleRowsHtml(articles);
  container.classList.toggle('select-mode', selectModeOn);
}

function showHybrid() {
  initHybridMap('hybridMapContainer');
  const rawArts = getMapArticles();
  const displayArts = getDisplayArticles();
  updateHybridMap(rawArts, getCountryFilter());
  renderHybridList(displayArts);
  updateViewStatus('hybrid', displayArts.length);
}

function updateViewStatus(view, count) {
  if (view !== 'hybrid') return;
  const hc = el('hybridHlCount');
  if (hc) {
    const c = Number(count) || 0;
    const filter = getCountryFilter();
    const suffix = filter ? ` · ${filter}` : '';
    hc.textContent = `${c.toLocaleString()} article${c === 1 ? '' : 's'}${suffix}`;
  }
}

function applyCountryFilterFromMap(country) {
  const raw = String(country || '').trim();
  if (!raw) return;
  setCountryFilter(raw);
  const input = el('countryInput');
  if (input) input.value = raw;
  showToast(`Filtered to ${raw}`);
}

function clearCountryFilterFromBar() {
  setCountryFilter('');
  const input = el('countryInput');
  if (input) input.value = '';
  showToast('Country filter cleared');
}

function applyTranslate(enabled) {
  translateEnabled = enabled; setTranslateEnabled(enabled);
  el('translateToggleBtn')?.setAttribute('aria-pressed', String(enabled));
  el('translateToggleBtn')?.classList.toggle('active', enabled);
  const lbl = el('translateBtnLabel'); if (lbl) lbl.textContent = enabled ? 'EN' : 'OFF';
}

function applyTranslationLanguage(language) {
  const normalized = String(language || 'en').trim().toLowerCase() || 'en';
  const select = el('languageSelect');
  if (select) select.value = normalized;
  setTranslateLanguage(normalized);
  applyTranslate(true);
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

async function doSearch() {
  const params = readFormParams(), query = buildQuery(params);
  if (!query) { showToast('Please select a resource or enter a keyword.'); return; }
  lastBuiltQuery = query;
  showDefaultBadge(false);
  await runQuery(query, currentTimespan);
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
  const bar = el('selBar');
  if (!bar) return;
  bar.classList.toggle('sel-bar-visible', count > 0);
  positionSelBar();
  const lbl = el('selBarCount'); if (lbl) lbl.textContent = `${count} selected`;
}

function positionSelBar() {
  const bar = el('selBar');
  if (!bar) return;
  if (currentView === 'hybrid' && bar.classList.contains('sel-bar-visible')) {
    const mapEl = el('hybridMapContainer');
    if (!mapEl) return;
    const mapTop = mapEl.getBoundingClientRect().top;
    const barH = bar.getBoundingClientRect().height || 48;
    bar.classList.add('sel-bar-over-map');
    bar.style.top = `${Math.max(0, mapTop - Math.round(barH / 2))}px`;
    bar.style.bottom = 'auto';
    return;
  }
  bar.classList.remove('sel-bar-over-map');
  bar.style.top = '';
  bar.style.bottom = '0';
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

function fullPageReset() {
  const cleanUrl = `${window.location.origin}${window.location.pathname}`;
  window.location.assign(cleanUrl);
}

function wireEvents() {
  qsa('.view-btn[data-view]').forEach(b => b.addEventListener('click', () => switchView(b.dataset.view)));
  el('translateToggleBtn')?.addEventListener('click', () => applyTranslate(!translateEnabled));
  el('languageSelect')?.addEventListener('change', e => applyTranslationLanguage(e.target.value));
  qsa('.time-btn').forEach(b => b.addEventListener('click', () => {
    const ts = b.dataset.timespan; setActiveTimespanBtn(ts);
    const hs = el('hybridSortSelect'); if (hs) hs.value = el('hlSortSelect')?.value || 'date-desc';
    if (lastBuiltQuery) runQuery(lastBuiltQuery, ts);
  }));
  el('setDefaultBtn')?.addEventListener('click', saveDefault);
  el('hybridSetDefaultBtn')?.addEventListener('click', saveDefault);
  el('hlSelectBtn')?.addEventListener('click', () => {
    selectModeOn = !selectModeOn;
    toggleSelectMode(selectModeOn);
    el('hlSelectBtn')?.classList.toggle('active', selectModeOn);
    el('hlSelectBtn')?.setAttribute('aria-pressed', String(selectModeOn));
    el('hybridSelectBtn')?.classList.toggle('active', selectModeOn);
    el('hybridSelectBtn')?.setAttribute('aria-pressed', String(selectModeOn));
    if (!selectModeOn) updateSelBar(0);
  });
  el('hybridSelectBtn')?.addEventListener('click', () => {
    selectModeOn = !selectModeOn;
    toggleSelectMode(selectModeOn);
    el('hlSelectBtn')?.classList.toggle('active', selectModeOn);
    el('hlSelectBtn')?.setAttribute('aria-pressed', String(selectModeOn));
    el('hybridSelectBtn')?.classList.toggle('active', selectModeOn);
    el('hybridSelectBtn')?.setAttribute('aria-pressed', String(selectModeOn));
    if (!selectModeOn) updateSelBar(0);
  });
  el('selSelectAllBtn')?.addEventListener('click', selectAll);
  el('selShareBtn')?.addEventListener('click', shareSelected);
  el('selExportBtn')?.addEventListener('click', exportSelectedHtml);
  el('selClearBtn')?.addEventListener('click', () => { clearSelection(); updateSelBar(0); });
  setSelectionChangeCallback(count => updateSelBar(count));
  el('searchBtn')?.addEventListener('click', () => { void doSearch(); });
  el('resetBtn')?.addEventListener('click', fullPageReset);
  const countryInput = el('countryInput');
  const countrySuggest = el('countrySuggest');
  countryInput?.addEventListener('input', e => showCountrySuggestions(e.target.value));
  countryInput?.addEventListener('focus', e => { if (e.target.value) showCountrySuggestions(e.target.value); });
  countryInput?.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); moveCountrySuggestion(1); return; }
    if (e.key === 'ArrowUp')   { e.preventDefault(); moveCountrySuggestion(-1); return; }
    if (e.key === 'Escape')    { hideCountrySuggestions(); return; }
    if (e.key === 'Enter') {
      if (chooseActiveCountrySuggestion()) e.preventDefault();
      void doSearch();
    }
  });
  countryInput?.addEventListener('blur', () => setTimeout(hideCountrySuggestions, 150));
  countrySuggest?.addEventListener('mousedown', e => e.preventDefault());
  countrySuggest?.addEventListener('click', e => {
    const btn = e.target.closest('.country-suggest-item');
    if (!btn) return;
    applyCountrySuggestion(btn.dataset.country || btn.textContent || '');
  });
  el('hlSortSelect')?.addEventListener('change', e => {
    const value = e.target.value;
    const hs = el('hybridSortSelect'); if (hs) hs.value = value;
    setSortOrder(value);
  });
  el('hybridSortSelect')?.addEventListener('change', e => {
    const value = e.target.value;
    const hs = el('hlSortSelect'); if (hs) hs.value = value;
    setSortOrder(value);
  });
  el('hlLoadMoreBtn')?.addEventListener('click', loadMore);
  el('hlRetryBtn')?.addEventListener('click', () => { if (lastBuiltQuery) runQuery(lastBuiltQuery, currentTimespan); });
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

function isPageReload() {
  const nav = performance.getEntriesByType('navigation');
  if (Array.isArray(nav) && nav[0] && typeof nav[0].type === 'string') {
    return nav[0].type === 'reload';
  }
  return typeof performance.navigation !== 'undefined' && performance.navigation.type === 1;
}

document.addEventListener('DOMContentLoaded', () => {
  hydrateCountrySelect();
  wireEvents();
  applyTranslationLanguage(el('languageSelect')?.value || 'en');
  setMapCountryClickHandler(({ country }) => applyCountryFilterFromMap(country));
  setOnRenderCallback(articles => {
    updateViewStatus('hybrid', getDisplayArticles().length);
    if (currentView === 'hybrid') { updateHybridMap(getMapArticles(), getCountryFilter()); renderHybridList(getDisplayArticles()); }
  });
  setOnTranslateCallback(state => {
    if (state === 'start' && _hybridStatusActive) setHybridStatus('translating');
  });
  setupPullToRefresh();
  switchView('hybrid');
  if (isPageReload()) {
    const cleanUrl = `${window.location.origin}${window.location.pathname}`;
    if (window.location.search) window.history.replaceState({}, '', cleanUrl);
    window.addEventListener('resize', positionSelBar, { passive: true });
    return;
  }
  restoreFromURL();
  window.addEventListener('resize', positionSelBar, { passive: true });
});
