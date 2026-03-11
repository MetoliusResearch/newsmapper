import { buildArtListUrl } from './query.js';

const CACHE_TTL    = 10 * 60 * 1000;  // 10 minutes
const ATTEMPT_TIMEOUTS = [10000, 15000, 20000]; // per-attempt abort ms (3 tries)

const _articleCache = new Map();  // query → { articles, ts }

let _allArticles = [], _currentQuery = '', _currentTimespan = '7d';
let _pageSize = 40, _visibleCount = _pageSize, _sortOrder = 'date-desc';
let _translateEnabled = true;
let _selectMode = false, _selectedUrls = new Set(), _onSelectionChange = null, _onRenderCallback = null;
let _filteredArticles = [];
const _titleCache = new Map();

// ─ progress bar / countdown state ─
let _progressTimer = null, _countdownTimer = null;

function startProgress(totalMs) {
  stopProgress();
  const bar  = document.getElementById('fetchProgressBar');
  const lbl  = document.getElementById('fetchCountdown');
  if (!bar || !lbl) return;
  bar.classList.remove('error');
  bar.style.transition = 'none';
  bar.style.width = '0%';
  // force reflow so the transition fires
  void bar.offsetWidth;
  bar.style.transition = `width ${totalMs}ms linear`;
  bar.style.width = '90%';  // never quite reaches 100% until done
  let remaining = Math.ceil(totalMs / 1000);
  lbl.textContent = `${remaining}s…`;
  _countdownTimer = setInterval(() => {
    remaining--;
    lbl.textContent = remaining > 0 ? `${remaining}s…` : '';
  }, 1000);
}

function completeProgress(isError = false) {
  stopProgress();
  const bar = document.getElementById('fetchProgressBar');
  const lbl = document.getElementById('fetchCountdown');
  if (bar) {
    bar.style.transition = 'width 0.25s ease';
    bar.style.width = '100%';
    if (isError) bar.classList.add('error');
  }
  if (lbl) lbl.textContent = '';
}

function stopProgress() {
  clearInterval(_countdownTimer);
  clearTimeout(_progressTimer);
  _countdownTimer = null; _progressTimer = null;
}

const el = id => document.getElementById(id);

function getCached(query) {
  const c = _articleCache.get(query);
  if (!c) return null;
  if (Date.now() - c.ts > CACHE_TTL) { _articleCache.delete(query); return null; }
  return c.articles;
}

function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

async function attemptFetch(url, timeoutMs) {
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const resp = await fetch(url, { signal: ctrl.signal });
    return resp;
  } finally {
    clearTimeout(tid);
  }
}

export async function fetchAndRender(query, timespan) {
  _currentQuery = query; _currentTimespan = timespan; _visibleCount = _pageSize;

  // Serve from cache instantly if fresh
  const cached = getCached(query);
  if (cached) {
    _allArticles = cached;
    renderFiltered();
    return;
  }

  setState('loading');
  const url = buildArtListUrl(query, '30d', 250);
  const totalBudgetMs = ATTEMPT_TIMEOUTS.reduce((a, b) => a + b, 0) + 3000; // ~51s total
  startProgress(totalBudgetMs);

  let resp = null, lastErr = null;
  for (let i = 0; i < ATTEMPT_TIMEOUTS.length; i++) {
    // Small inter-attempt pause after the first try
    if (i > 0) {
      const msgEl = document.getElementById('hlLoadingMsg');
      if (msgEl) msgEl.textContent = `Retrying (attempt ${i + 1} of ${ATTEMPT_TIMEOUTS.length})…`;
      await wait(2000);
    }
    try {
      resp = await attemptFetch(url, ATTEMPT_TIMEOUTS[i]);
      break; // success — exit loop
    } catch (err) {
      lastErr = err;
      resp = null;
    }
  }

  if (!resp) {
    completeProgress(true);
    setState('error', 'Request timed out after 3 attempts. Please try again.');
    return;
  }

  try {
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    _allArticles = data.articles || [];
    _articleCache.set(query, { articles: _allArticles, ts: Date.now() });
    completeProgress(false);
    renderFiltered();
  } catch (err) {
    completeProgress(true);
    setState('error', err.message);
  }
}

export function filterByTimespan(timespan) {
  _currentTimespan = timespan; _visibleCount = _pageSize; renderFiltered();
}
export function setSortOrder(order) {
  _sortOrder = order; _visibleCount = _pageSize; renderFiltered();
}
export function loadMore() { _visibleCount += _pageSize; renderFiltered(); }
export function hasCachedData(query) { return getCached(query) !== null; }
export function setTranslateEnabled(enabled) {
  _translateEnabled = enabled;
  if (enabled && _allArticles.length) renderFiltered();
}
export function toggleSelectMode(on) {
  _selectMode = on ?? !_selectMode;
  el('hlGrid')?.classList.toggle('select-mode', _selectMode);
  if (!_selectMode) clearSelection();
}
export function clearSelection() {
  _selectedUrls.clear();
  el('hlGrid')?.querySelectorAll('.art-row.selected').forEach(r => {
    r.classList.remove('selected');
    const cb = r.querySelector('.art-check-input'); if (cb) cb.checked = false;
  });
  _onSelectionChange?.(0, []);
}
export function selectAll() {
  el('hlGrid')?.querySelectorAll('.art-row').forEach(r => {
    const url = r.dataset.artUrl; if (!url) return;
    _selectedUrls.add(url); r.classList.add('selected');
    const cb = r.querySelector('.art-check-input'); if (cb) cb.checked = true;
  });
  _onSelectionChange?.(_selectedUrls.size, getSelectedArticles());
}
export function getSelectedArticles() {
  return [...(el('hlGrid')?.querySelectorAll('.art-row.selected') ?? [])].map(r => ({
    title:   r.querySelector('.art-title')?.textContent.trim() || r.dataset.artTitle || '',
    url:     r.dataset.artUrl     || '',
    domain:  r.dataset.artDomain  || '',
    country: r.dataset.artCountry || '',
    date:    r.dataset.artDate    || '',
  }));
}
export function setSelectionChangeCallback(fn) { _onSelectionChange = fn; }
export function setOnRenderCallback(fn) { _onRenderCallback = fn; }
export function getFilteredArticles() { return _filteredArticles; }

document.addEventListener('DOMContentLoaded', () => {
  el('hlGrid')?.addEventListener('click', e => {
    if (!_selectMode) return;
    const row = e.target.closest('.art-row'); if (!row) return;
    e.preventDefault();
    const url = row.dataset.artUrl; if (!url) return;
    const checked = _selectedUrls.has(url);
    checked ? _selectedUrls.delete(url) : _selectedUrls.add(url);
    row.classList.toggle('selected', !checked);
    const cb = row.querySelector('.art-check-input'); if (cb) cb.checked = !checked;
    _onSelectionChange?.(_selectedUrls.size, getSelectedArticles());
  });
});

function renderFiltered() {
  const cutoff = timespanToMs(_currentTimespan), now = Date.now();
  let arts = _allArticles.filter(a => { const d = parseDate(a.seendate); return d && (now - d) <= cutoff; });
  if (!arts.length) { _filteredArticles = []; setState('empty'); return; }
  arts = arts.slice().sort((a, b) => {
    const da = parseDate(a.seendate) ?? 0, db = parseDate(b.seendate) ?? 0;
    return _sortOrder === 'date-asc' ? da - db : db - da;
  });
  _filteredArticles = arts;
  setState('results');
  renderGrid(arts.slice(0, _visibleCount));
  const cnt = el('hlCount');
  const cacheEntry = _articleCache.get(_currentQuery);
  const ageMin = cacheEntry ? Math.floor((Date.now() - cacheEntry.ts) / 60000) : null;
  const cacheLabel = ageMin !== null ? ` · cached ${ageMin === 0 ? '<1' : ageMin}m` : '';
  if (cnt) cnt.textContent = `${arts.length.toLocaleString()} article${arts.length === 1 ? '' : 's'}${cacheLabel}`;
  const wrap = el('hlLoadMoreWrap');
  if (wrap) wrap.style.display = _visibleCount < arts.length ? 'flex' : 'none';
  if (_translateEnabled) translateNewTitles();
  _onRenderCallback?.(_filteredArticles);
}

function renderGrid(arts) {
  const grid = el('hlGrid'); if (!grid) return;
  grid.innerHTML = arts.map(articleRow).join('');
  grid.classList.toggle('select-mode', _selectMode);
  if (_selectedUrls.size) {
    grid.querySelectorAll('.art-row').forEach(r => {
      if (_selectedUrls.has(r.dataset.artUrl)) {
        r.classList.add('selected');
        const cb = r.querySelector('.art-check-input'); if (cb) cb.checked = true;
      }
    });
  }
}

function articleRow(art) {
  const title   = esc(art.title || 'Untitled');
  const url     = safeUrl(art.url || '#');
  const domain  = esc(art.domain || '');
  const country = esc(art.sourcecountry || '');
  const lang    = esc(art.language || '');
  const date    = fmtDate(art.seendate);
  const isEn    = !lang || lang.toLowerCase() === 'english';
  const meta    = [country, domain].filter(Boolean).join(' · ');
  const cached  = _titleCache.get(art.title);
  const display = cached ? esc(cached) : title;
  const origAttr = (!isEn && !cached) ? ` data-orig="${title}"` : '';
  const imgUrl  = art.socialimage ? safeUrl(art.socialimage) : '';
  const thumb   = imgUrl && imgUrl !== '#' ? `<span class="art-thumb"><img src="${imgUrl}" loading="lazy" alt="" onerror="this.closest('.art-thumb').style.display='none'"></span>` : '';
  return `<a class="art-row" href="${url}" data-art-url="${url}" data-art-title="${display}" data-art-domain="${domain}" data-art-country="${country}" data-art-date="${date}" target="_blank" rel="noopener noreferrer"><div class="art-row-body"><span class="art-title"${origAttr}>${display}</span><span class="art-row-meta">${meta ? `<span class="art-meta">${meta}</span>` : ''}${!isEn ? `<span class="art-lang">${lang}</span>` : ''}<span class="art-date">${date}</span></span></div>${thumb}<span class="art-check" aria-hidden="true"><input class="art-check-input" type="checkbox" tabindex="-1"></span></a>`;
}

async function translateNewTitles() {
  const grid = el('hlGrid'); if (!grid) return;
  const pending = [...grid.querySelectorAll('.art-title[data-orig]')];
  if (!pending.length) return;
  const unique = [...new Set(pending.map(s => s.dataset.orig).filter(t => !_titleCache.has(t)))];
  const BATCH = 8;
  for (let i = 0; i < unique.length; i += BATCH) {
    await Promise.all(unique.slice(i, i + BATCH).map(async t => {
      try { const r = await gtxTranslate(t); if (r) _titleCache.set(t, r); } catch {}
    }));
  }
  pending.forEach(s => {
    const tr = _titleCache.get(s.dataset.orig);
    if (tr) { s.textContent = tr; s.removeAttribute('data-orig'); }
  });
}

async function gtxTranslate(text) {
  const r = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=${encodeURIComponent(text)}`);
  if (!r.ok) return null;
  const j = await r.json();
  return Array.isArray(j?.[0]) ? j[0].map(s => s[0] || '').join('') : null;
}

function setState(state, msg = '') {
  ['hlStatePlaceholder','hlStateLoading','hlStateEmpty','hlStateError'].forEach(id => {
    const n = el(id); if (n) n.style.display = 'none';
  });
  const grid = el('hlGrid'); if (grid) grid.style.display = 'none';
  const wrap = el('hlLoadMoreWrap'); if (wrap) wrap.style.display = 'none';
  const cnt = el('hlCount');
  if (state === 'results') {
    if (grid) grid.style.display = '';
  } else if (state === 'error') {
    const em = el('hlStateErrorMsg'); if (em) em.textContent = `Failed to load: ${msg}`;
    const ee = el('hlStateError'); if (ee) ee.style.display = 'flex';
    if (cnt) cnt.textContent = '';
  } else {
    const map = { placeholder: 'hlStatePlaceholder', loading: 'hlStateLoading', empty: 'hlStateEmpty' };
    const p = map[state] && el(map[state]); if (p) p.style.display = 'flex';
    if (cnt) cnt.textContent = '';
  }
}

function parseDate(s) {
  if (!s || s.length < 8) return null;
  return new Date(`${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}T${s.length>=11?s.slice(9,11):'00'}:${s.length>=13?s.slice(11,13):'00'}:00Z`).getTime();
}
function timespanToMs(ts) { return ({ '1d':1,'7d':7,'30d':30,'1y':365 }[ts] ?? 7) * 86400000; }
function fmtDate(s) {
  const ms = parseDate(s); if (!ms) return '';
  return new Date(ms).toLocaleDateString(undefined, { month:'short', day:'numeric', year:'numeric' });
}
function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function safeUrl(url) {
  try {
    const u = new URL(url);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return '#';
    return u.href.replace(/"/g,'%22').replace(/'/g,'%27');
  } catch { return '#'; }
}
