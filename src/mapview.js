import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { COUNTRY_COORDS } from './countries.js';

let _map = null;
let _circleLayer = null;

export function initMap(containerId) {
  if (_map) {
    // Leaflet needs a size recalc after the panel becomes visible
    setTimeout(() => _map.invalidateSize(), 0);
    return;
  }
  _map = L.map(containerId, {
    center: [20, 0],
    zoom: 2,
    minZoom: 1,
    maxZoom: 8,
    zoomControl: true,
    attributionControl: true,
  });

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  }).addTo(_map);

  _circleLayer = L.layerGroup().addTo(_map);
}

export function updateMap(articles) {
  if (!_map || !_circleLayer) return;
  _circleLayer.clearLayers();
  if (!articles.length) return;

  // Aggregate by source country
  const counts = new Map();      // key → count
  const byCountry = new Map();   // key → { name, articles[] }
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

  for (const [key, count] of counts) {
    const coords = COUNTRY_COORDS[key];
    if (!coords) continue;

    // sqrt-scaled radius: small countries don't become invisible
    const r = MIN_R + (MAX_R - MIN_R) * Math.sqrt(count / maxCount);
    const info = byCountry.get(key);

    const circle = L.circleMarker(coords, {
      radius: r,
      fillColor: '#2a52be',
      fillOpacity: 0.4,   // 60% transparent
      color: '#2a52be',
      weight: 1.5,
      opacity: 0.7,
    });

    // Build popup: up to 6 article links
    const top = info.articles.slice(0, 6);
    const links = top.map(a => {
      const t = truncate(a.title || 'Article', 72);
      const u = safeUrl(a.url);
      return `<li><a href="${h(u)}" target="_blank" rel="noopener noreferrer">${h(t)}</a></li>`;
    }).join('');
    const more = info.articles.length > 6
      ? `<p class="map-popup-more">+${info.articles.length - 6} more</p>` : '';

    circle.bindPopup(
      `<div class="map-popup">
        <div class="map-popup-header">
          <strong class="map-popup-country">${h(info.name)}</strong>
          <span class="map-popup-count">${count} article${count === 1 ? '' : 's'}</span>
        </div>
        <ul class="map-popup-links">${links}</ul>
        ${more}
      </div>`,
      { maxWidth: 300, className: 'map-popup-wrap' }
    );

    _circleLayer.addLayer(circle);
  }
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
