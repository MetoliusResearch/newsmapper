import { setupDropdowns } from './js/dropdowns.js';
import { setupGdeltQuery } from './js/gdeltQuery.js';
import { setupPopups } from './js/popups.js';
import { setupIframes } from './js/iframes.js';

let leafletMap = null;
let leafletGeoJsonLayer = null;
let leafletHeatLayer = null;
let currentMapMode = 'points'; // default to 'points' (Newsmap), not 'heatmap'
let leafletBaseLayer = null;

// Helper to update the Leaflet map points based on query and timespan
window.updateLeafletMapPoints = function (query, timespan) {
  if (!leafletMap) return;
  const loader = document.getElementById('gdeltMapLoader');
  if (loader) loader.style.display = 'flex';
  // Always encode query for geojson endpoint
  const url = `https://api.gdeltproject.org/api/v2/geo/geo?query=${encodeURIComponent(query)}&mode=PointData&timespan=${timespan}&format=geojson`;
  console.log('[DEBUG] Fetching GeoJSON:', url);
  fetch(url)
    .then((r) => r.json())
    .then((geojson) => {
      console.log('[DEBUG] GeoJSON features:', geojson.features ? geojson.features.length : 'none');
      if (leafletGeoJsonLayer) {
        leafletMap.removeLayer(leafletGeoJsonLayer);
      }
      if (leafletHeatLayer) {
        leafletMap.removeLayer(leafletHeatLayer);
      }
      // Prepare heatmap points once
      const heatPoints = (geojson.features || [])
        .map((f) => {
          const coords = f.geometry && f.geometry.coordinates;
          if (!coords || coords.length < 2) return null;
          const lat = coords[1],
            lng = coords[0];
          const intensity = (f.properties && (f.properties.intensity || f.properties.count)) || 1;
          return [lat, lng, intensity];
        })
        .filter(Boolean);
      // --- SIMPLIFIED TWO-BIN POINT SIZE AND LEGEND (count=1, and count≥75th percentile) ---
      // Collect all counts
      const counts = (geojson.features || []).map((f) =>
        f.properties && typeof f.properties.count === 'number' ? f.properties.count : 1
      );
      // Calculate 75th percentile (x)
      let x = 1;
      if (counts.length > 0) {
        const sorted = counts.slice().sort((a, b) => a - b);
        const idx = Math.floor(0.75 * sorted.length);
        x = sorted[idx];
      }
      // Ensure x is at least 2 (so count=1 is always the lower bin)
      if (x < 2) x = 2;
      // Define radii
      const RADIUS_ONE = 5; // px for count=1
      const RADIUS_UPPER = 16; // px for count≥x
      // Point size function: only two bins
      function getRadiusForCount(count) {
        if (count === 1) return RADIUS_ONE;
        if (count >= x) return RADIUS_UPPER;
        // All other counts (2..x-1) use small dot for visual clarity
        return RADIUS_ONE;
      }
      // Replace pointToLayer to use only two dot sizes
      leafletGeoJsonLayer = L.geoJSON(geojson, {
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
          // Popup header with location name, full width, ellipsis if long
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

          // --- Remove the fixed info box: it is not needed, only show floating tooltip on hover ---
          // (Remove all code that creates or updates 'leaflet-hover-info-box')
          // --- Add hover event to show number of events as a floating tooltip ---
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
        minOpacity: 0.65, // slightly increased from 0.55
        gradient: { 0.2: '#ffcccc', 0.4: '#ff8888', 0.7: '#ff3333', 1.0: '#ff2d2d' } // slightly more vivid
      });

      // Build legend bins and radii for display
      // const legendBreaks = [
      //   { label: '1', radius: RADIUS_ONE },
      //   { label: `≥${x}`, radius: RADIUS_UPPER }
      // ];
      // --- LEGEND: Only two entries ---
      // Remove any existing legend
      if (window._leafletPointSizeLegend) {
        leafletMap.removeControl(window._leafletPointSizeLegend);
        window._leafletPointSizeLegend = null;
      }
      const oldLegend = document.querySelector('.point-size-legend');
      if (oldLegend && oldLegend.parentNode) oldLegend.parentNode.removeChild(oldLegend);
      // Add new legend
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
          // Dynamically match legend width to map mode selection bar
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

      // Only add the selected layer
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

// --- Default queries for each section ---
const DEFAULT_MAP_QUERY = 'petroleum OR lng'; // geojson endpoint format
const DEFAULT_HEADLINES_QUERY = 'petroleum OR lng'; // GDELT iframe format
const DEFAULT_SENTIMENT_QUERY = 'petroleum OR lng'; // GDELT iframe format
const DEFAULT_MAP_TIMESPAN = '1d';
const DEFAULT_HEADLINES_TIMESPAN = '1d';
const DEFAULT_SENTIMENT_TIMESPAN = '1y';
const DEFAULT_HEADLINES_MAX = 50;

// --- Track current timespans for each section ---
window._gdeltTimespanMap = window._gdeltTimespanMap || DEFAULT_MAP_TIMESPAN;
window._gdeltTimespanHeadlines = window._gdeltTimespanHeadlines || DEFAULT_HEADLINES_TIMESPAN;
window._gdeltTimespanSentiment = window._gdeltTimespanSentiment || DEFAULT_SENTIMENT_TIMESPAN;

// Helper to update all section titles
function updateSectionTitles(query, timespan) {
  const mapTitle = document.getElementById('sectionTitleMap');
  if (mapTitle) mapTitle.textContent = `Map: ${query} (${timespan})`;
  const headlinesTitle = document.getElementById('sectionTitleHeadlines');
  if (headlinesTitle) headlinesTitle.textContent = `Headlines: ${query} (${timespan})`;
  const sentimentTitle = document.getElementById('sectionTitleSentiment');
  if (sentimentTitle)
    sentimentTitle.textContent = `Sentiment: ${query} (${timespan === '1y' ? 'last year' : timespan})`;
}

// --- Query Window logic ---
document.addEventListener('DOMContentLoaded', () => {
  // --- Restore Query Dropdowns and Query Box logic ---
  setupDropdowns();
  setupGdeltQuery();
  setupPopups();
  setupIframes();

  // --- Move Query title and info button to top of query section ---
  const querySection = document.getElementById('gdeltQuerySection');
  const queryTitle = document.getElementById('sectionTitleQuery');
  const infoBtn = document.getElementById('queryInfoBtn');
  if (querySection && queryTitle && infoBtn) {
    // Remove infoBtn from its current parent
    if (infoBtn.parentNode) infoBtn.parentNode.removeChild(infoBtn);
    // Remove queryTitle from its current parent
    if (queryTitle.parentNode) queryTitle.parentNode.removeChild(queryTitle);
    // Create a flex container for title and info button
    const titleBar = document.createElement('div');
    titleBar.style.display = 'flex';
    titleBar.style.alignItems = 'center';
    titleBar.style.gap = '0.7em';
    titleBar.appendChild(queryTitle);
    titleBar.appendChild(infoBtn);
    // Insert at the top of the query section
    querySection.insertBefore(titleBar, querySection.firstChild);
  }

  // --- Query Window logic ---
  const resetBtn = document.getElementById('resetQueryBtn');
  const gdeltQueryResultBox = document.getElementById('gdeltQueryResultBox');
  const geojsonUrlBox = document.getElementById('geojsonUrlBox');
  const headlinesUrlBox = document.getElementById('headlinesUrlBox');
  const timelineUrlBox = document.getElementById('timelineUrlBox');
  const resourceInput = document.getElementById('resourceInput');
  const regionInput = document.getElementById('regionInput');
  const countryInput = document.getElementById('countryInput');
  const customInput = document.getElementById('customInput');
  const gdeltMapQuery = document.getElementById('gdeltMapQuery');

  // Default query and timespan
  const defaultQuery = 'petroleum OR lng';
  const defaultTimespan = '7d';

  // --- Query logic from gdelt.js ---
  const resourceMap = {
    'Fossil Fuels': '(oil OR petroleum OR gas OR lng OR coal)',
    'Oil & Gas': '(oil OR gas)',
    Petroleum: 'petroleum',
    LNG: 'lng',
    Coal: 'coal',
    Mining: '(mining)',
    'Any Mining': '(mining)',
    ETMs: '(lithium OR cobalt OR nickel OR copper OR graphite OR manganese OR "rare earths" OR platinum OR palladium OR antimony)',
    'Aluminum/Bauxite': '(aluminum OR bauxite)',
    Agroindustry: '(palm oil OR soy OR cattle OR beef)',
    'Cattle/Beef': '(cattle OR beef)',
    Logging: '(logging OR timber AND forest)',
    'Any Logging': '(logging OR timber AND forest)',
    Timber: 'timber',
    Biofuels: 'biofuels'
  };

  function buildQueryFromInputs() {
    const resource = resourceInput ? resourceInput.value : '';
    const region = regionInput ? regionInput.value : '';
    const country = countryInput ? countryInput.value.trim() : '';
    const custom = customInput ? customInput.value.trim() : '';
    let queryTerm = resourceMap[resource] || resource;
    let locationTerm = '';
    if (region && region !== 'Global') {
      if (region === 'Amazon') {
        locationTerm =
          'Amazon AND (Brazil OR Peru OR Colombia OR Bolivia OR Venezuela OR Ecuador OR Guyana OR Suriname OR "French Guiana")';
      } else {
        locationTerm = region;
      }
    }
    if (country) {
      locationTerm = locationTerm ? `(${locationTerm} OR ${country})` : country;
    }
    let finalQuery = '';
    if (custom) {
      finalQuery = custom.includes(' OR ') ? `(${custom})` : custom;
    } else {
      const parts = [];
      if (locationTerm) parts.push(locationTerm);
      if (queryTerm) parts.push(queryTerm);
      finalQuery = parts.join(' AND ');
    }
    return finalQuery || defaultQuery;
  }

  // Helper to update the Query Results window
  function updateQueryResultsWindow(query = defaultQuery, timespan = defaultTimespan) {
    gdeltQueryResultBox.textContent = query;
    // Helper to create a result row with an Open button (no label at start)
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
    // Clear previous content
    geojsonUrlBox.innerHTML = '';
    headlinesUrlBox.innerHTML = '';
    timelineUrlBox.innerHTML = '';
    // Add new rows with Open buttons (no label)
    geojsonUrlBox.appendChild(
      createResultRow(
        `https://api.gdeltproject.org/api/v2/geo/geo?query=${encodeURIComponent(query)}&mode=PointData&timespan=${timespan}&format=geojson`
      )
    );
    headlinesUrlBox.appendChild(
      createResultRow(
        `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(query)}&mode=ArtList&maxrecords=50&timespan=${timespan}`
      )
    );
    timelineUrlBox.appendChild(
      createResultRow(
        `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(query)}&mode=TimelineVolInfo&timespan=1y`
      )
    );
  }

  // --- Dropdowns and custom input logic ---
  // function clearOtherInputs(active) {
  //   if (active !== resourceInput) resourceInput.value = '';
  //   if (active !== regionInput) regionInput.value = '';
  //   if (active !== countryInput) countryInput.value = '';
  //   if (active !== customInput) customInput.value = '';
  // }

  function updateAllFromInputs() {
    const query = buildQueryFromInputs();
    const timespan = window._gdeltTimespanMap || defaultTimespan;
    if (gdeltMapQuery) gdeltMapQuery.value = query;
    updateQueryResultsWindow(query, timespan);
    window.updateLeafletMapPoints(query, timespan);
    if (window.updateHeadlinesSection) window.updateHeadlinesSection(query, timespan, 50, true);
    if (window.updateSentimentSection) window.updateSentimentSection(query, timespan);
    updateSectionTitles(query, timespan);
  }

  // Attach event listeners to dropdowns and custom input
  function handleDropdownInput(activeInput) {
    // If custom is filled, clear dropdowns
    if (activeInput === customInput && customInput.value.trim() !== '') {
      if (resourceInput) resourceInput.value = '';
      if (regionInput) regionInput.value = '';
      if (countryInput) countryInput.value = '';
    }
    updateAllFromInputs();
  }
  if (resourceInput) {
    resourceInput.addEventListener('change', () => handleDropdownInput(resourceInput));
    resourceInput.addEventListener('input', () => handleDropdownInput(resourceInput));
  }
  if (regionInput) {
    regionInput.addEventListener('change', () => handleDropdownInput(regionInput));
    regionInput.addEventListener('input', () => handleDropdownInput(regionInput));
  }
  if (countryInput) {
    countryInput.addEventListener('change', () => handleDropdownInput(countryInput));
    countryInput.addEventListener('input', () => handleDropdownInput(countryInput));
  }
  if (customInput) {
    customInput.addEventListener('input', () => handleDropdownInput(customInput));
  }

  // On page load, set query from any pre-filled input
  updateAllFromInputs();

  // Reset button logic: always reset to default and update all
  resetBtn.addEventListener('click', () => {
    if (resourceInput) resourceInput.value = '';
    if (regionInput) regionInput.value = '';
    if (countryInput) countryInput.value = '';
    if (customInput) customInput.value = '';
    if (gdeltMapQuery) gdeltMapQuery.value = defaultQuery;
    window._gdeltTimespanMap = defaultTimespan;
    updateAllFromInputs();
    updateSectionTitles(defaultQuery, defaultTimespan);
  });

  // --- Remove any old query debug/info boxes ---
  const oldDebug = document.getElementById('queryDebugBox');
  if (oldDebug && oldDebug.parentNode) oldDebug.parentNode.removeChild(oldDebug);

  // --- On page load, set all three sections to their default queries/formats ---
  window.updateLeafletMapPoints(DEFAULT_MAP_QUERY, DEFAULT_MAP_TIMESPAN);
  if (window.updateHeadlinesSection)
    window.updateHeadlinesSection(
      DEFAULT_HEADLINES_QUERY,
      DEFAULT_HEADLINES_TIMESPAN,
      DEFAULT_HEADLINES_MAX,
      true
    );
  if (window.updateSentimentSection)
    window.updateSentimentSection(DEFAULT_SENTIMENT_QUERY, DEFAULT_SENTIMENT_TIMESPAN);
  updateSectionTitles(
    DEFAULT_MAP_QUERY,
    DEFAULT_MAP_TIMESPAN,
    DEFAULT_HEADLINES_TIMESPAN,
    DEFAULT_SENTIMENT_TIMESPAN
  );

  // Add map attribution after map is initialized (append to mapDiv, not inside map tiles)
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

  // Remove translate button below the map if present
  var translateBtnLocal = document.getElementById('translateBtn');
  if (translateBtnLocal && translateBtnLocal.parentNode)
    translateBtnLocal.parentNode.removeChild(translateBtnLocal);

  // Leaflet map initialization
  const mapDiv = document.getElementById('map');
  if (mapDiv) {
    if (window._leafletMapInitialized) return;
    window._leafletMapInitialized = true;
    leafletMap = L.map('map', {
      zoomControl: true,
      attributionControl: false,
      scrollWheelZoom: true,
      doubleClickZoom: true,
      boxZoom: true,
      keyboard: true,
      dragging: true,
      zoomSnap: 0.1, // Allow smooth/fractional zoom
      zoomDelta: 0.5 // Each click/keypress changes zoom by 0.5
    }).setView([20, 10], 1.6); // Set initial zoom level to 1.5 (fractional allowed)
    // Only ESRI Gray base layer
    leafletBaseLayer = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
      {
        attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ',
        maxZoom: 16
      }
    );
    leafletBaseLayer.addTo(leafletMap);
    // Remove OSM and base layer selector
    // Add custom toggle control
    const MapModeControl = L.Control.extend({
      options: { position: 'topright' },
      onAdd: function () {
        const container = L.DomUtil.create(
          'div',
          'leaflet-bar leaflet-control leaflet-control-custom'
        );
        container.id = 'mapModePanel'; // Add ID for width calculation
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
        // Ensure color updates on re-render
        setTimeout(updateColors, 0);
        L.DomEvent.disableClickPropagation(container);
        return container;
      }
    });
    leafletMap.addControl(new MapModeControl());

    // --- Add Point Size Legend (vertical, matching map point sizes) ---
    // REMOVE STATIC LEGEND CODE: Only use dynamic legend after data load
    // Initial points: petroleum OR lng, 7d
    // Use the same logic as the dropdowns: get the value from the query box if present, else use default
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

  // --- Hook into query/timespan changes to update map points ---
  // Listen for query changes
  const queryBox = document.getElementById('gdeltMapQuery');
  if (queryBox) {
    let lastQuery = queryBox.value || 'petroleum OR lng';
    let lastTimespan = window._gdeltTimespanMap || '1d';
    const updateMapFromQuery = () => {
      const query = queryBox.value || 'petroleum OR lng';
      const timespan = window._gdeltTimespanMap || '1d';
      // Only update if query or timespan actually changed
      if (query !== lastQuery || timespan !== lastTimespan) {
        window.updateLeafletMapPoints(query, timespan);
        if (window.updateHeadlinesSection) window.updateHeadlinesSection(query, timespan);
        if (window.updateSentimentSection) window.updateSentimentSection(query, '1y');
        updateSectionTitles(query, timespan);
        lastQuery = query;
        lastTimespan = timespan;
      }
    };
    // Use both input and change events, but debounce to avoid double calls
    let debounceTimer = null;
    const debouncedUpdate = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(updateMapFromQuery, 120);
    };
    queryBox.addEventListener('input', debouncedUpdate);
    queryBox.addEventListener('change', debouncedUpdate);
  }

  // Listen for map time button changes
  const mapTimeButtons = document.getElementById('mapTimeButtons');
  if (mapTimeButtons) {
    mapTimeButtons.addEventListener('click', function (e) {
      if (e.target && e.target.tagName === 'BUTTON') {
        setTimeout(() => {
          const query =
            (document.getElementById('gdeltMapQuery') || {}).value || 'petroleum OR lng';
          const timespan = window._gdeltTimespanMap || '1d';
          window.updateLeafletMapPoints(query, timespan);
          // Update section titles
          updateSectionTitles(
            query,
            timespan,
            window._gdeltTimespanHeadlines || timespan,
            window._gdeltTimespanSentiment || '1y'
          );
        }, 80);
      }
    });
  }

  // --- In the legend, change label above points to just 'Events' ---
  // (This was already set in the PointSizeLegend code above)

  // Dynamic section title updating and default query already handled above
});

// Listen for map query/timespan changes and update points
window.setMapTime = function (timespan) {
  window._gdeltTimespanMap = timespan;
  const queryBox = document.getElementById('gdeltMapQuery');
  const query = queryBox ? queryBox.value : 'petroleum OR lng';
  window.updateLeafletMapPoints(query, timespan);
  if (window.updateHeadlinesSection) window.updateHeadlinesSection(query, timespan);
  if (window.updateSentimentSection) window.updateSentimentSection(query, '1y');
  updateSectionTitles(query, timespan);
};

// --- Query Window logic: moved inside DOMContentLoaded ---
