import { buildArtListUrl } from './query.js';

const CACHE_TTL        = 10 * 60 * 1000;
const ATTEMPT_TIMEOUTS = [8000, 12000, 18000]; // 3 attempts: ~38s total budget

const _articleCache = new Map();

let _allArticles = [], _currentQuery = '', _currentTimespan = '7d';
let _pageSize = 40, _visibleCount = _pageSize, _sortOrder = 'date-desc';
let _translateEnabled = true;
let _countryFilterKey = '', _countryFilterLabel = '';
let _selectMode = false, _selectedUrls = new Set(), _onSelectionChange = null, _onRenderCallback = null;
let _filteredArticles = [];
let _displayArticles = [];
let _mapArticles = [];
const _titleCache = new Map();

// ─ fetch state ─
let _cancelCtrl = null;   // AbortController for the current in-flight fetch

const el = id => document.getElementById(id);

function getCached(query) {
  const c = _articleCache.get(query);
  if (!c) return null;
  if (Date.now() - c.ts > CACHE_TTL) { _articleCache.delete(query); return null; }
  return c.articles;
}

async function attemptFetch(url, timeoutMs) {
  // fresh controller each attempt
  _cancelCtrl = new AbortController();
  const tid = setTimeout(() => _cancelCtrl.abort('timeout'), timeoutMs);
  try {
    const resp = await fetch(url, { signal: _cancelCtrl.signal });
    return resp;
  } finally {
    clearTimeout(tid);
  }
}

export async function fetchAndRender(query, timespan) {
  _currentQuery = query; _currentTimespan = timespan; _visibleCount = _pageSize;

  const cached = getCached(query);
  if (cached) { _allArticles = cached; renderFiltered(); return; }

  // Immediately show loading feedback while waiting on network.
  setState('loading');

  // Wire up Cancel button
  const cancelBtn = document.getElementById('fetchCancelBtn');
  const onCancel = () => { _cancelCtrl?.abort('user'); };
  cancelBtn?.addEventListener('click', onCancel, { once: true });

  const url = buildArtListUrl(query, '30d', 250);
  let resp = null, cancelled = false;

  for (let i = 0; i < ATTEMPT_TIMEOUTS.length; i++) {
    try {
      resp = await attemptFetch(url, ATTEMPT_TIMEOUTS[i]);
      break;
    } catch (err) {
      if (err?.message === 'user' || _cancelCtrl?.signal?.reason === 'user') {
        cancelled = true; break;
      }
      resp = null;
    }
  }

  cancelBtn?.removeEventListener('click', onCancel);

  if (cancelled) { setState('placeholder'); return; }

  if (!resp) {
    setState('error', 'Unable to load headlines right now. Please try again.');
    return;
  }

  try {
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    _allArticles = data.articles || [];
    _articleCache.set(query, { articles: _allArticles, ts: Date.now() });
    renderFiltered();
  } catch (err) {
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
  el('hybridHeadlines')?.classList.toggle('select-mode', _selectMode);
  if (!_selectMode) clearSelection();
}
export function clearSelection() {
  _selectedUrls.clear();
  document.querySelectorAll('#hlGrid .art-row.selected, #hybridHeadlines .art-row.selected').forEach(r => {
    r.classList.remove('selected');
    const cb = r.querySelector('.art-check-input'); if (cb) cb.checked = false;
  });
  _onSelectionChange?.(0, []);
}
export function selectAll() {
  document.querySelectorAll('.view-panel.active .art-row').forEach(r => {
    const url = r.dataset.artUrl; if (!url) return;
    _selectedUrls.add(url); r.classList.add('selected');
    const cb = r.querySelector('.art-check-input'); if (cb) cb.checked = true;
  });
  _onSelectionChange?.(_selectedUrls.size, getSelectedArticles());
}
export function getSelectedArticles() {
  const rows = [...document.querySelectorAll('#hlGrid .art-row.selected, #hybridHeadlines .art-row.selected')];
  const seen = new Set();
  const out = [];
  for (const r of rows) {
    const url = r.dataset.artUrl || '';
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push({
      title:   r.querySelector('.art-title')?.textContent.trim() || r.dataset.artTitle || '',
      url,
      domain:  r.dataset.artDomain  || '',
      country: r.dataset.artCountry || '',
      date:    r.dataset.artDate    || '',
    });
  }
  return out;
}
export function setSelectionChangeCallback(fn) { _onSelectionChange = fn; }
export function setOnRenderCallback(fn) { _onRenderCallback = fn; }
export function getFilteredArticles() { return _filteredArticles; }
export function getDisplayArticles() { return _displayArticles; }
export function getMapArticles() { return _mapArticles; }
export function buildArticleRowsHtml(articles) { return (articles || []).map(articleRow).join(''); }
export function setCountryFilter(country) {
  const raw = String(country || '').trim();
  _countryFilterLabel = raw;
  _countryFilterKey = raw.toLowerCase();
  _visibleCount = _pageSize;
  renderFiltered();
}
export function clearCountryFilter() {
  _countryFilterKey = '';
  _countryFilterLabel = '';
  _visibleCount = _pageSize;
  renderFiltered();
}
export function getCountryFilter() { return _countryFilterLabel; }

document.addEventListener('DOMContentLoaded', () => {
  const bindSelectHandler = id => {
    el(id)?.addEventListener('click', e => {
      if (!_selectMode) return;
      const row = e.target.closest('.art-row'); if (!row) return;
      e.preventDefault();
      const url = row.dataset.artUrl; if (!url) return;
      const checked = _selectedUrls.has(url);
      checked ? _selectedUrls.delete(url) : _selectedUrls.add(url);
      const nowOn = !checked;
      document.querySelectorAll(`.art-row[data-art-url="${cssEsc(url)}"]`).forEach(r => {
        r.classList.toggle('selected', nowOn);
        const cb = r.querySelector('.art-check-input'); if (cb) cb.checked = nowOn;
      });
      _onSelectionChange?.(_selectedUrls.size, getSelectedArticles());
    });
  };
  const bindExpandHandler = id => {
    el(id)?.addEventListener('click', e => {
      if (_selectMode) return;
      const toggle = e.target.closest('.art-source-pill, .art-title-btn');
      if (!toggle) return;
      const row = e.target.closest('.art-row');
      if (!row || row.dataset.hasSources !== '1') return;
      e.preventDefault();
      toggleSources(row);
    });
  };
  bindSelectHandler('hlGrid');
  bindSelectHandler('hybridHeadlines');
  bindExpandHandler('hlGrid');
  bindExpandHandler('hybridHeadlines');
});

function renderFiltered() {
  const cutoff = timespanToMs(_currentTimespan), now = Date.now();
  let arts = _allArticles.filter(a => { const d = parseDate(a.seendate); return d && (now - d) <= cutoff; });
  _mapArticles = arts.slice();
  if (_countryFilterKey) {
    arts = arts.filter(a => (a.sourcecountry || '').trim().toLowerCase() === _countryFilterKey);
  }
  if (!arts.length) { _filteredArticles = []; _displayArticles = []; setState('empty'); _onRenderCallback?.(_filteredArticles); return; }
  arts = arts.slice().sort((a, b) => {
    const da = parseDate(a.seendate) ?? 0, db = parseDate(b.seendate) ?? 0;
    return _sortOrder === 'date-asc' ? da - db : db - da;
  });
  _filteredArticles = arts;
  _displayArticles = consolidateArticles(arts);
  setState('results');
  renderGrid(_displayArticles.slice(0, _visibleCount));
  const cnt = el('hlCount');
  const cacheEntry = _articleCache.get(_currentQuery);
  const ageMin = cacheEntry ? Math.floor((Date.now() - cacheEntry.ts) / 60000) : null;
  const cacheLabel = ageMin !== null ? ` · cached ${ageMin === 0 ? '<1' : ageMin}m` : '';
  const countryLabel = _countryFilterLabel ? ` · ${_countryFilterLabel}` : '';
  if (cnt) cnt.textContent = `${_displayArticles.length.toLocaleString()} article${_displayArticles.length === 1 ? '' : 's'}${countryLabel}${cacheLabel}`;
  const wrap = el('hlLoadMoreWrap');
  if (wrap) wrap.style.display = _visibleCount < _displayArticles.length ? 'flex' : 'none';
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
  const sourceCount = Number(art.sourceCount || 1);
  const isEn    = !lang || lang.toLowerCase() === 'english';
  const meta    = [country, domain].filter(Boolean).join(' · ');
  const cached  = _titleCache.get(art.title);
  const display = cached ? esc(cached) : title;
  const origAttr = (!isEn && !cached) ? ` data-orig="${title}"` : '';
  const imgUrl  = art.socialimage ? safeUrl(art.socialimage) : '';
  const thumb   = imgUrl && imgUrl !== '#' ? `<span class="art-thumb"><img src="${imgUrl}" loading="lazy" alt="" onerror="this.closest('.art-thumb').style.display='none'"></span>` : '';
  const sourcePill = sourceCount > 1
    ? `<button class="art-source-pill" type="button" aria-label="Show ${sourceCount} sources">${sourceCount} sources</button>`
    : '';
  const langLine = !isEn ? `<span class="art-row-submeta"><span class="art-lang">${lang}</span></span>` : '';
  const titleBlock = sourceCount > 1
    ? `<button class="art-title art-title-btn" type="button"${origAttr}>${display}</button>`
    : `<a class="art-title art-title-link" href="${url}" target="_blank" rel="noopener noreferrer"${origAttr}>${display}</a>`;
  const sourcesHtml = sourceCount > 1
    ? `<div class="art-sources" hidden>${renderSources(art.sources || [])}</div>`
    : '';
  return `<div class="art-row" data-has-sources="${sourceCount > 1 ? '1' : '0'}" data-art-url="${url}" data-art-title="${display}" data-art-domain="${domain}" data-art-country="${country}" data-art-date="${date}"><div class="art-row-body">${titleBlock}<span class="art-row-meta">${meta ? `<span class="art-meta">${meta}</span>` : ''}${sourcePill}<span class="art-date">${date}</span></span>${langLine}${sourcesHtml}</div>${thumb}<span class="art-check" aria-hidden="true"><input class="art-check-input" type="checkbox" tabindex="-1"></span></div>`;
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

function cssEsc(s) {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') return CSS.escape(String(s));
  return String(s).replace(/(["\\])/g, '\\$1');
}

function toggleSources(row) {
  const panel = row.querySelector('.art-sources');
  if (!panel) return;
  const open = panel.hidden;
  panel.hidden = !open;
  row.classList.toggle('expanded', open);
}

function renderSources(sources) {
  const list = Array.isArray(sources) ? sources : [];
  return list.map((s, i) => {
    const u = safeUrl(s.url || '#');
    const t = esc(s.title || `Source ${i + 1}`);
    const d = esc(s.domain || '');
    const dt = fmtDate(s.seendate);
    const meta = [d, dt].filter(Boolean).join(' · ');
    return `<a class="art-source-link" href="${u}" target="_blank" rel="noopener noreferrer"><span class="art-source-title">${t}</span><span class="art-source-domain">${meta}</span></a>`;
  }).join('');
}

function normalizeTitle(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function sourceKey(a) {
  if (a.domain) return String(a.domain).toLowerCase();
  try { return new URL(a.url || '').hostname.toLowerCase(); } catch { return String(a.url || '').toLowerCase(); }
}

function consolidateArticles(articles) {
  const groups = new Map();
  const ordered = [];
  for (const a of articles) {
    const key = normalizeTitle(a.title);
    if (!key) {
      ordered.push({ ...a, sourceCount: 1 });
      continue;
    }
    let g = groups.get(key);
    if (!g) {
      g = { representative: a, sourceMap: new Map([[sourceKey(a), a]]) };
      groups.set(key, g);
      ordered.push(g);
      continue;
    }
    const sk = sourceKey(a);
    if (!g.sourceMap.has(sk)) g.sourceMap.set(sk, a);
  }
  return ordered.map(item => {
    if (item.representative) {
      const sources = [...item.sourceMap.values()];
      return {
        ...item.representative,
        sourceCount: Math.max(1, sources.length),
        sources,
      };
    }
    return { ...item, sources: [item], sourceCount: 1 };
  });
}
