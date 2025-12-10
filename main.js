import { setupDropdowns } from './js/dropdowns.js';
import { setupGdeltQuery, generateGdeltQuery } from './js/gdeltQuery.js';
import { setupPopups } from './js/popups.js';
import { setupIframes } from './js/iframes.js';

let leafletMap = null;
let leafletGeoJsonLayer = null;
let leafletHeatLayer = null;
let currentMapMode = 'points'; // default to 'points' (Newsmap), not 'heatmap'
let leafletBaseLayer = null;
let mapUpdateTimer = null;

window.updateLeafletMapPoints = function (query, timespan) {
  if (mapUpdateTimer) clearTimeout(mapUpdateTimer);
  mapUpdateTimer = setTimeout(() => {
    performMapUpdate(query, timespan);
  }, 200);
};

function performMapUpdate(query, timespan) {
  if (!leafletMap) return;
  const loader = document.getElementById('gdeltMapLoader');
  const noResults = document.getElementById('gdeltMapNoResults');
  if (loader) loader.style.display = 'flex';
  if (noResults) noResults.style.display = 'none';
  
  // Ensure globals are set for download/link buttons
  const geoJsonUrl = `https://api.gdeltproject.org/api/v2/geo/geo?query=${encodeURIComponent(query)}&mode=PointData&timespan=${timespan}&format=geojson`;
  const mapUrl = `https://api.gdeltproject.org/api/v2/geo/geo?query=${encodeURIComponent(query)}&mode=PointData&timespan=${timespan}`;
  
  window.lastMapGeoJsonUrl = geoJsonUrl;
  window.lastMapUrl = mapUrl;

  const url = geoJsonUrl;
  console.log('[DEBUG] Fetching GeoJSON:', url);
  fetch(url)
    .then((r) => r.json())
    .then((geojson) => {
      console.log('[DEBUG] GeoJSON features:', geojson.features ? geojson.features.length : 'none');
      
      const noResults = document.getElementById('gdeltMapNoResults');
      if (!geojson.features || geojson.features.length === 0) {
        if (noResults) noResults.style.display = 'flex';
      } else {
        if (noResults) noResults.style.display = 'none';
      }

      if (leafletGeoJsonLayer) {
        leafletMap.removeLayer(leafletGeoJsonLayer);
      }
      if (leafletHeatLayer) {
        leafletMap.removeLayer(leafletHeatLayer);
      }
      const heatPoints = (geojson.features || [])
        .map((f) => {
          const coords = f.geometry && f.geometry.coordinates;
          if (!coords || coords.length < 2) return null;
          const lat = coords[1],
            lng = coords[0];
          if (Math.abs(lat) < 0.0001 && Math.abs(lng) < 0.0001) return null;
          const intensity = (f.properties && (f.properties.intensity || f.properties.count)) || 1;
          return [lat, lng, intensity];
        })
        .filter(Boolean);
      const counts = (geojson.features || []).map((f) =>
        f.properties && typeof f.properties.count === 'number' ? f.properties.count : 1
      );
      let x = 1;
      if (counts.length > 0) {
        const sorted = counts.slice().sort((a, b) => a - b);
        const idx = Math.floor(0.75 * sorted.length);
        x = sorted[idx];
      }
      if (x < 2) x = 2;
      const RADIUS_ONE = 5;
      const RADIUS_UPPER = 16;
      function getRadiusForCount(count) {
        if (count === 1) return RADIUS_ONE;
        if (count >= x) return RADIUS_UPPER;
        return RADIUS_ONE;
      }
      leafletGeoJsonLayer = L.geoJSON(geojson, {
        filter: (feature) => {
          const coords = feature.geometry && feature.geometry.coordinates;
          if (!coords || coords.length < 2) return false;
          // Filter out artifacts at 0,0
          if (Math.abs(coords[1]) < 0.0001 && Math.abs(coords[0]) < 0.0001) return false;
          return true;
        },
        pointToLayer: (feature, latlng) => {
          const count =
            feature.properties && typeof feature.properties.count === 'number'
              ? feature.properties.count
              : 1;
          let radius = getRadiusForCount(count);
          return L.circleMarker(latlng, {
            radius,
            fillColor: '#0074D9',
            color: undefined,
            weight: 0,
            opacity: 0.7,
            fillOpacity: 0.7
          });
        },
        onEachFeature: (feature, layer) => {
          let props = feature.properties || {};
          let html = '';
          let locationName = props.name || '';
          let eventCount = typeof props.count !== 'undefined' ? props.count : '';
          if (locationName) {
            let displayName = locationName;
            if (displayName.length > 70) displayName = displayName.slice(0, 67) + '...';
            displayName = displayName
              .replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;')
              .replace(/'/g, '&#39;');
            html += `<div class="popup-header">${displayName}<button class="popup-close-x" title="Close" onclick="(function(btn){var popup=btn.closest('.leaflet-popup');if(popup){var closeBtn=popup.querySelector('.leaflet-popup-close-button');if(closeBtn)closeBtn.click();else popup.style.display='none';}})(this)">&times;</button></div>`;
            if (eventCount) {
              html += `<div style='color:#888;font-size:0.97em;margin:0.5em 0 0.2em 1.1em;'>${eventCount} article${eventCount == 1 ? '' : 's'}</div>`;
            }
          }
          let locationSource = '';
          if (props.location) locationSource = props.location;
          else if (props.source) locationSource = props.source;
          else if (props.country) locationSource = props.country;
          else if (props.region) locationSource = props.region;
          let innerHtml = '';
          if (locationSource && locationSource !== 'Unknown') {
            innerHtml += `<div style="font-size:0.97em;color:#444;margin-bottom:0.3em;"><b>Location:</b> ${locationSource}</div>`;
          }
          if (props.html) {
            let htmlClean = props.html.replace(/<a /g, '<a class="popup-headline-link" ');
            htmlClean = htmlClean.replace(/<br\s*\/?\>/gi, '');
            htmlClean = htmlClean.replace(/<li>(\s|&nbsp;)*<\/li>/gi, '');
            htmlClean = htmlClean.replace(/<\/li>[\s\r\n]+<li>/g, '</li><li>');
            htmlClean = htmlClean.replace(/<ul>\s+/g, '<ul>');
            htmlClean = htmlClean.replace(/\s+<\/ul>/g, '</ul>');
            innerHtml += `<div>${htmlClean}</div>`;
          } else if (Array.isArray(props.articles) && props.articles.length > 0) {
            innerHtml += '<b>News Headlines:</b><ul style="margin:0.5em 0 0.5em 1.1em;padding:0;">';
            props.articles.forEach((article) => {
              let title = article.title || 'Untitled';
              if (title.length > 70) title = title.slice(0, 67) + '...';
              let url = article.url || '#';
              title = title
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
              innerHtml += `<li style='margin-bottom:0.3em;'><a href='${url}' target='_blank' rel='noopener' class='popup-headline-link'>${title}</a></li>`;
            });
            innerHtml += '</ul>';
          } else if (props.title && props.url) {
            let title = props.title;
            if (title.length > 70) title = title.slice(0, 67) + '...';
            title = title
              .replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;')
              .replace(/'/g, '&#39;');
            innerHtml += `<b><a href='${props.url}' target='_blank' rel='noopener' class='popup-headline-link'>${title}</a></b>`;
          } else if (props.title) {
            let title = props.title;
            if (title.length > 70) title = title.slice(0, 67) + '...';
            title = title
              .replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;')
              .replace(/'/g, '&#39;');
            innerHtml += `<b class='popup-headline-link'>${title}</b>`;
          } else if (props.url) {
            innerHtml += `<a href='${props.url}' target='_blank' rel='noopener' class='popup-headline-link'>Open Article</a>`;
          } else {
            innerHtml += `<b>No headlines available</b>`;
          }
          if (props.date) innerHtml += `Date: ${props.date}`;
          if (props.mentionthemes) innerHtml += `Themes: ${props.mentionthemes}`;
          html += `<div class='popup-inner'>${innerHtml}</div>`;
          layer.bindPopup(html, { closeButton: false });

          const count = typeof props.count !== 'undefined' ? props.count : 1;
          let hoverTooltip;
          layer.on('mouseover', function (e) {
            hoverTooltip = L.DomUtil.create('div', 'leaflet-hover-tooltip');
            hoverTooltip.style.position = 'absolute';
            hoverTooltip.style.pointerEvents = 'none';
            hoverTooltip.style.background = '#fff';
            hoverTooltip.style.border = '1px solid #888';
            hoverTooltip.style.borderRadius = '6px';
            hoverTooltip.style.padding = '0.25em 0.7em';
            hoverTooltip.style.fontSize = '1em';
            hoverTooltip.style.color = '#222';
            hoverTooltip.style.boxShadow = '0 2px 8px rgba(34,34,59,0.13)';
            hoverTooltip.style.zIndex = 10000;
            hoverTooltip.innerHTML = `${count} event${count == 1 ? '' : 's'}`;
            document.body.appendChild(hoverTooltip);
            function moveTooltip(ev) {
              hoverTooltip.style.left = ev.originalEvent.pageX + 12 + 'px';
              hoverTooltip.style.top = ev.originalEvent.pageY - 18 + 'px';
            }
            moveTooltip(e);
            layer.on('mousemove', moveTooltip);
            layer._moveTooltip = moveTooltip;
          });
          layer.on('mouseout', function () {
            if (hoverTooltip && hoverTooltip.parentNode)
              hoverTooltip.parentNode.removeChild(hoverTooltip);
            if (layer._moveTooltip) layer.off('mousemove', layer._moveTooltip);
            hoverTooltip = null;
          });
        }
      });
      leafletHeatLayer = L.heatLayer(heatPoints, {
        radius: 12, // keep smaller radius
        blur: 16,
        maxZoom: 12,
        minOpacity: 0.65,
        gradient: { 0.2: '#ffcccc', 0.4: '#ff8888', 0.7: '#ff3333', 1.0: '#ff2d2d' }
      });

      if (window._leafletPointSizeLegend) {
        leafletMap.removeControl(window._leafletPointSizeLegend);
        window._leafletPointSizeLegend = null;
      }
      const oldLegend = document.querySelector('.point-size-legend');
      if (oldLegend && oldLegend.parentNode) oldLegend.parentNode.removeChild(oldLegend);
      const PointSizeLegend = L.Control.extend({
        options: { position: 'bottomright' },
        onAdd: function () {
          const div = L.DomUtil.create('div', 'leaflet-control leaflet-legend point-size-legend');
          div.style.background = '#fff';
          div.style.padding = '1em 1.2em 1em 1.2em';
          div.style.borderRadius = '10px';
          div.style.boxShadow = '0 2px 8px rgba(34,34,59,0.13)';
          div.style.fontSize = '1em';
          div.style.lineHeight = '1.4';
          div.style.marginBottom = '1.2em';
          div.style.color = '#222';
          div.style.display = 'flex';
          div.style.flexDirection = 'column';
          div.style.alignItems = 'flex-start';
          const mapModePanel = document.querySelector('.leaflet-control-custom');
          let legendWidth = '210px';
          if (mapModePanel) {
            const computed = window.getComputedStyle(mapModePanel);
            legendWidth = computed.width;
          }
          div.style.width = legendWidth;
          div.innerHTML =
            `<div style="font-weight:600;margin-bottom:0.5em;text-align:center;">Events</div>` +
            [
              { label: '1', radius: RADIUS_ONE },
              { label: `≥${x}`, radius: RADIUS_UPPER }
            ]
              .map((bin) => {
                const r = bin.radius;
                return `
              <div style="display:flex;align-items:center;justify-content:center;margin-bottom:0.3em;width:100%;">
                <div style="display:flex;justify-content:center;align-items:center;width:${r * 2}px;">
                  <svg width="${r * 2}" height="${r * 2}" style="display:block;vertical-align:middle;">
                    <circle cx="${r}" cy="${r}" r="${r}" fill="#0074D9" opacity="0.7" />
                  </svg>
                </div>
                <span style="min-width:3.5em;display:inline-block;text-align:left;margin-left:1.2em;vertical-align:middle;">${bin.label}</span>
              </div>
            `;
              })
              .join('');
          return div;
        }
      });
      const legendInstance = new PointSizeLegend();
      leafletMap.addControl(legendInstance);
      window._leafletPointSizeLegend = legendInstance;

      if (currentMapMode === 'heatmap') {
        leafletHeatLayer.addTo(leafletMap);
        console.log('[DEBUG] Added heat layer to map');
      } else {
        leafletGeoJsonLayer.addTo(leafletMap);
        console.log('[DEBUG] Added GeoJSON layer to map');
      }

      if (loader) loader.style.display = 'none';
    })
    .catch((err) => {
      if (loader) loader.style.display = 'none';
      console.error('[DEBUG] GeoJSON fetch error:', err);
    });
};

const DEFAULT_MAP_QUERY = 'petroleum OR lng';
const DEFAULT_HEADLINES_QUERY = 'petroleum OR lng';
const DEFAULT_SENTIMENT_QUERY = 'petroleum OR lng';
const DEFAULT_MAP_TIMESPAN = '1d';
const DEFAULT_HEADLINES_TIMESPAN = '1d';
const DEFAULT_SENTIMENT_TIMESPAN = '1y';

window._gdeltTimespanMap = window._gdeltTimespanMap || DEFAULT_MAP_TIMESPAN;
window._gdeltTimespanHeadlines = window._gdeltTimespanHeadlines || DEFAULT_HEADLINES_TIMESPAN;
window._gdeltTimespanSentiment = window._gdeltTimespanSentiment || DEFAULT_SENTIMENT_TIMESPAN;

document.addEventListener('DOMContentLoaded', () => {
  setupDropdowns();
  setupGdeltQuery();
  setupPopups();
  setupIframes();

  const querySection = document.getElementById('gdeltQuerySection');
  const queryTitle = document.getElementById('sectionTitleQuery');
  const infoBtn = document.getElementById('queryInfoBtn');
  if (querySection && queryTitle && infoBtn) {
    if (infoBtn.parentNode) infoBtn.parentNode.removeChild(infoBtn);
    if (queryTitle.parentNode) queryTitle.parentNode.removeChild(queryTitle);
    const titleBar = document.createElement('div');
    titleBar.style.display = 'flex';
    titleBar.style.alignItems = 'center';
    titleBar.style.gap = '0.7em';
    titleBar.appendChild(queryTitle);
    titleBar.appendChild(infoBtn);
    querySection.insertBefore(titleBar, querySection.firstChild);
  }

  const resetBtn = document.getElementById('resetQueryBtn');
  const gdeltQueryResultBox = document.getElementById('gdeltQueryResultBox');
  const geojsonUrlBox = document.getElementById('geojsonUrlBox');
  const headlinesUrlBox = document.getElementById('headlinesUrlBox');
  const timelineUrlBox = document.getElementById('timelineUrlBox');
  const resourceInput = document.getElementById('resourceInput');
  if (resourceInput) {
    resourceInput.value = 'Oil';
    // Dispatch change event to trigger updateGdeltIframes in gdeltQuery.js
    // This ensures all iframes (Map, Headlines, Sentiment) are updated on load
    setTimeout(() => {
      resourceInput.dispatchEvent(new Event('change'));
    }, 100);
  }
  const regionInput = document.getElementById('regionInput');
  const countryInput = document.getElementById('countryInput');
  const customInput = document.getElementById('customInput');
  const gdeltMapQuery = document.getElementById('gdeltMapQuery');

  const defaultQuery = 'petroleum OR lng';
  const defaultTimespan = '7d';

  function buildQueryFromInputs() {
    const resource = resourceInput ? resourceInput.value : '';
    const region = regionInput ? regionInput.value : '';
    const country = countryInput ? countryInput.value.trim() : '';
    const custom = customInput ? customInput.value.trim() : '';
    
    const finalQuery = generateGdeltQuery(resource, region, country, custom);
    return finalQuery || defaultQuery;
  }

  function updateQueryResultsWindow(query = defaultQuery, mapTimespan = defaultTimespan) {
    const headlinesTimespan = window._gdeltTimespanHeadlines || mapTimespan;
    const sentimentTimespan = window._gdeltTimespanSentiment || '1y';

    if (gdeltQueryResultBox) gdeltQueryResultBox.textContent = query;
    function createResultRow(url) {
      const row = document.createElement('div');
      row.className = 'query-result-row';
      const urlSpan = document.createElement('span');
      urlSpan.textContent = url;
      urlSpan.className = 'query-result-url';
      const openBtn = document.createElement('button');
      openBtn.textContent = 'Open';
      openBtn.className = 'query-result-open-btn';
      openBtn.style.marginLeft = '1em';
      openBtn.onclick = () => window.open(url, '_blank', 'noopener');
      row.appendChild(urlSpan);
      row.appendChild(openBtn);
      return row;
    }
    if (geojsonUrlBox) {
      geojsonUrlBox.innerHTML = '';
      geojsonUrlBox.appendChild(
        createResultRow(
          `https://api.gdeltproject.org/api/v2/geo/geo?query=${encodeURIComponent(query)}&mode=PointData&timespan=${mapTimespan}&format=geojson`
        )
      );
    }
    if (headlinesUrlBox) {
      headlinesUrlBox.innerHTML = '';
      headlinesUrlBox.appendChild(
        createResultRow(
          `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(query)}&mode=ArtList&maxrecords=50&timespan=${headlinesTimespan}`
        )
      );
    }
    if (timelineUrlBox) {
      timelineUrlBox.innerHTML = '';
      timelineUrlBox.appendChild(
        createResultRow(
          `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(query)}&mode=TimelineVolInfo&timespan=${sentimentTimespan}`
        )
      );
    }
  }
  window.updateQueryResultsWindow = updateQueryResultsWindow;

  // Redundant listeners removed. Logic is handled in js/gdeltQuery.js
  // Initial update
  const initialQuery = buildQueryFromInputs();
  updateQueryResultsWindow(initialQuery, defaultTimespan);

  resetBtn.addEventListener('click', () => {
    if (resourceInput) resourceInput.value = '';
    if (regionInput) regionInput.value = '';
    if (countryInput) countryInput.value = '';
    if (customInput) customInput.value = '';
    if (gdeltMapQuery) gdeltMapQuery.value = defaultQuery;
    window._gdeltTimespanMap = defaultTimespan;
    // updateAllFromInputs(); // Removed
    // updateSectionTitles(defaultQuery, defaultTimespan); // Handled by gdeltQuery.js
    // Trigger change to update everything via gdeltQuery.js listeners
    if (resourceInput) resourceInput.dispatchEvent(new Event('change'));
  });

  const oldDebug = document.getElementById('queryDebugBox');
  if (oldDebug && oldDebug.parentNode) oldDebug.parentNode.removeChild(oldDebug);

  window.updateLeafletMapPoints(initialQuery, DEFAULT_MAP_TIMESPAN);

  function addMapAttribution() {
    let attr = document.getElementById('leaflet-map-attribution');
    if (!attr) {
      attr = document.createElement('div');
      attr.id = 'leaflet-map-attribution';
      attr.style.position = 'relative';
      attr.style.width = '100%';
      attr.style.textAlign = 'center';
      attr.style.fontSize = '0.98em';
      attr.style.background = 'rgba(255,255,255,0.92)';
      attr.style.padding = '0.3em 0.5em 0.3em 0.5em';
      attr.style.zIndex = 10002;
      attr.style.pointerEvents = 'auto';
      attr.innerHTML = `Map: <a href="https://leafletjs.com/" target="_blank" rel="noopener">Leaflet</a> | Tiles: <a href="https://www.esri.com/en-us/home" target="_blank" rel="noopener">ESRI</a> | Data: <a href="https://www.gdeltproject.org/" target="_blank" rel="noopener">GDELT</a>`;
      var mapDivLocal = document.getElementById('map');
      if (mapDivLocal) mapDivLocal.parentNode.insertBefore(attr, mapDivLocal.nextSibling);
    }
  }
  setTimeout(addMapAttribution, 800);

  var translateBtnLocal = document.getElementById('translateBtn');
  if (translateBtnLocal && translateBtnLocal.parentNode)
    translateBtnLocal.parentNode.removeChild(translateBtnLocal);

  const mapDiv = document.getElementById('map');
  if (mapDiv && !window._leafletMapInitialized) {
    window._leafletMapInitialized = true;
    leafletMap = L.map('map', {
      zoomControl: true,
      attributionControl: false,
      scrollWheelZoom: true,
      doubleClickZoom: true,
      boxZoom: true,
      keyboard: true,
      dragging: true,
      zoomSnap: 0.1,
      zoomDelta: 0.5
    }).setView([20, 10], 1.6);
    leafletBaseLayer = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
      {
        attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ',
        maxZoom: 16
      }
    );
    leafletBaseLayer.addTo(leafletMap);
    const MapModeControl = L.Control.extend({
      options: { position: 'topright' },
      onAdd: function () {
        const container = L.DomUtil.create(
          'div',
          'leaflet-bar leaflet-control leaflet-control-custom'
        );
        container.id = 'mapModePanel';
        container.style.background = '#fff';
        container.style.padding = '0.3em 0.7em';
        container.style.fontSize = '1em';
        container.style.cursor = 'pointer';
        container.style.boxShadow = '0 2px 8px rgba(34,34,59,0.13)';
        container.style.borderRadius = '6px';
        container.style.userSelect = 'none';
        container.style.display = 'block';
        function updateColors() {
          container.querySelector('#mapModeHeatmap').style.color =
            currentMapMode === 'heatmap' ? '#ff2d2d' : '#888';
          container.querySelector('#mapModePoints').style.color =
            currentMapMode === 'points' ? '#0074D9' : '#888';
        }
        container.innerHTML = `<b id="mapModeHeatmap" style="color:${currentMapMode === 'heatmap' ? '#ff2d2d' : '#888'};margin-right:0.7em;cursor:pointer;">Heatmap</b> <span style="color:#bbb;">|</span> <b id="mapModePoints" style="color:${currentMapMode === 'points' ? '#0074D9' : '#888'};margin-left:0.7em;cursor:pointer;">Newsmap</b>`;
        container.onclick = function (e) {
          if (e.target && e.target.id === 'mapModeHeatmap' && currentMapMode !== 'heatmap') {
            currentMapMode = 'heatmap';
            window.updateLeafletMapPoints(
              (document.getElementById('gdeltMapQuery') || {}).value || 'petroleum AND lng',
              window._gdeltTimespanMap || '7d'
            );
            updateColors();
          } else if (e.target && e.target.id === 'mapModePoints' && currentMapMode !== 'points') {
            currentMapMode = 'points';
            window.updateLeafletMapPoints(
              (document.getElementById('gdeltMapQuery') || {}).value || 'petroleum AND lng',
              window._gdeltTimespanMap || '7d'
            );
            updateColors();
          }
        };
        setTimeout(updateColors, 0);
        L.DomEvent.disableClickPropagation(container);
        return container;
      }
    });
    leafletMap.addControl(new MapModeControl());

    const queryBox = document.getElementById('gdeltMapQuery');
    const initialQuery = queryBox && queryBox.value ? queryBox.value : 'petroleum OR lng';
    window.updateLeafletMapPoints(initialQuery, '7d');
    setTimeout(() => {
      leafletMap.invalidateSize();
    }, 500);
    window.addEventListener('resize', () => {
      setTimeout(() => {
        leafletMap.invalidateSize();
      }, 200);
    });
  }

});
