import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { COUNTRY_COORDS } from './countries.js';

const TILE_URL  = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}';
const TILE_OPTS = {
  attribution: 'Tiles &copy; <a href="https://www.esri.com/">Esri</a>',
  maxZoom: 16,
};

let _uiText = {
  articleSingular: 'article',
  articlePlural: 'articles',
  more: 'more',
};

function createMapInstance() {
  let map = null;
  let circleLayer = null;
  let onCountryClick = null;
  let preserveViewNextUpdate = false;

  function init(containerId) {
    if (map) {
      setTimeout(() => map.invalidateSize(), 0);
      return;
    }
    map = L.map(containerId, {
      center: [20, 0],
      zoom: 2,
      minZoom: 1,
      maxZoom: 8,
      zoomControl: true,
      attributionControl: true,
    });
    L.tileLayer(TILE_URL, TILE_OPTS).addTo(map);
    circleLayer = L.layerGroup().addTo(map);
  }

  function update(articles, selectedCountry = '') {
    if (!map || !circleLayer) return;
    circleLayer.clearLayers();
    if (!articles.length) return;
    const selectedKey = String(selectedCountry || '').trim().toLowerCase();

    const counts    = new Map();
    const byCountry = new Map();
    for (const a of articles) {
      const raw = (a.sourcecountry || '').trim();
      if (!raw) continue;
      const key = raw.toLowerCase();
      counts.set(key, (counts.get(key) || 0) + 1);
      if (!byCountry.has(key)) byCountry.set(key, { name: raw, articles: [] });
      byCountry.get(key).articles.push(a);
    }
    if (!counts.size) return;

    const maxCount = Math.max(...counts.values());
    const MIN_R = 6, MAX_R = 40;
    const points = [];

    for (const [key, count] of counts) {
      const coords = COUNTRY_COORDS[key];
      if (!coords) continue;
      points.push(coords);

      const isSelected = !!selectedKey && key === selectedKey;
      const isDimmed = !!selectedKey && key !== selectedKey;
      const rBase = MIN_R + (MAX_R - MIN_R) * Math.sqrt(count / maxCount);
      const r = isSelected ? Math.max(28, rBase) : rBase;
      const info = byCountry.get(key);

      const circle = L.circleMarker(coords, {
        radius:      r,
        fillColor:   isDimmed ? '#b0b5c0' : '#0074D9',
        fillOpacity: isDimmed ? 0.42 : 0.5,
        stroke:      isSelected,
        color:       '#ffffff',
        weight:      isSelected ? 1.25 : 0,
      });

      const top   = info.articles.slice(0, 6);
      const links = top.map(a => {
        const t = truncate(a.title || 'Article', 72);
        const u = safeUrl(a.url);
        return `<li><a href="${h(u)}" target="_blank" rel="noopener noreferrer">${h(t)}</a></li>`;
      }).join('');
      const more = info.articles.length > 6
        ? `<p class="map-popup-more">+${info.articles.length - 6} ${_uiText.more}</p>` : '';

      const articleCountLabel = `${count} ${count === 1 ? _uiText.articleSingular : _uiText.articlePlural}`;

      circle.bindPopup(
        `<div class="map-popup">
          <div class="map-popup-header">
            <strong class="map-popup-country">${h(info.name)}</strong>
            <span class="map-popup-count">${articleCountLabel}</span>
          </div>
          <ul class="map-popup-links">${links}</ul>
          ${more}
        </div>`,
        { maxWidth: 300, className: 'map-popup-wrap' }
      );
      if (isSelected) {
        circle.bindTooltip(
          `<div class="map-dot-selected-label"><strong>${h(info.name)}</strong><span>${articleCountLabel}</span></div>`,
          { direction: 'center', permanent: true, className: 'map-dot-selected-wrap', opacity: 1 }
        );
      } else {
        circle.bindTooltip(
          `<div class="map-dot-selected-label"><strong>${h(info.name)}</strong><span>${articleCountLabel}</span></div>`,
          { direction: 'center', sticky: true, className: 'map-dot-selected-wrap', opacity: 1 }
        );
      }
      circle.on('click', () => {
        preserveViewNextUpdate = true;
        onCountryClick?.({ country: info.name, key, count, articles: info.articles.slice() });
      });

      circleLayer.addLayer(circle);
    }

    if (!points.length) return;
    if (preserveViewNextUpdate) {
      preserveViewNextUpdate = false;
      return;
    }
    if (points.length === 1) {
      map.setView(points[0], 6);
      return;
    }
    const bounds = L.latLngBounds(points.map(([lat, lng]) => L.latLng(lat, lng)));
    map.fitBounds(bounds, { padding: [10, 10], maxZoom: 3 });
  }

  function setOnCountryClick(handler) {
    onCountryClick = typeof handler === 'function' ? handler : null;
  }

  return { init, update, setOnCountryClick };
}

const _main   = createMapInstance();
const _hybrid = createMapInstance();

export function initMap(containerId)       { _main.init(containerId); }
export function updateMap(articles, selectedCountry) { _main.update(articles, selectedCountry); }
export function initHybridMap(containerId) { _hybrid.init(containerId); }
export function updateHybridMap(articles, selectedCountry) { _hybrid.update(articles, selectedCountry); }
export function setMapCountryClickHandler(handler) {
  _main.setOnCountryClick(handler);
  _hybrid.setOnCountryClick(handler);
}
export function setMapUiStrings(uiText = {}) {
  _uiText = { ..._uiText, ...uiText };
}

function truncate(s, n) { return s.length > n ? s.slice(0, n) + '…' : s; }
function h(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function safeUrl(url) {
  try {
    const u = new URL(url);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return '#';
    return u.href.replace(/"/g, '%22').replace(/'/g, '%27');
  } catch { return '#'; }
}
