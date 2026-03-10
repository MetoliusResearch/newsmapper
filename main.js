import { setupDropdowns } from './js/dropdowns.js';
import { setupGdeltQuery, generateGdeltQuery } from './js/gdeltQuery.js';
import { setupPopups } from './js/popups.js';
import { setupIframes } from './js/iframes.js';

// Country centroid lookup (replaces discontinued GDELT geo/geo API).
// Keys match GDELT's sourcecountry field values (English country names).
const COUNTRY_CENTROIDS = {
  'Afghanistan':[33.93,67.71],'Albania':[41.15,20.17],'Algeria':[28.03,1.66],
  'Andorra':[42.55,1.60],'Angola':[-11.20,17.87],'Antigua and Barbuda':[17.06,-61.80],
  'Argentina':[-38.42,-63.62],'Armenia':[40.07,45.04],'Australia':[-25.27,133.78],
  'Austria':[47.52,14.55],'Azerbaijan':[40.14,47.58],
  'Bahamas':[25.03,-77.40],'Bahrain':[26.00,50.55],'Bangladesh':[23.68,90.36],
  'Barbados':[13.19,-59.54],'Belarus':[53.71,27.95],'Belgium':[50.50,4.47],
  'Belize':[17.19,-88.50],'Benin':[9.31,2.32],'Bhutan':[27.51,90.43],
  'Bolivia':[-16.29,-63.59],'Bosnia and Herzegovina':[43.92,17.68],
  'Botswana':[-22.33,24.68],'Brazil':[-14.24,-51.93],
  'Brunei':[4.54,114.73],'Bulgaria':[42.73,25.49],'Burkina Faso':[12.36,-1.53],
  'Burundi':[-3.37,29.92],
  'Cambodia':[12.57,104.99],'Cameroon':[7.37,12.35],'Canada':[56.13,-106.35],
  'Cape Verde':[16.54,-23.04],'Central African Republic':[6.61,20.94],
  'Chad':[15.45,18.73],'Chile':[-35.68,-71.54],'China':[35.86,104.20],
  'Colombia':[4.57,-74.30],'Comoros':[-11.65,43.33],'Congo':[-0.23,15.83],
  'Democratic Republic of the Congo':[-4.04,21.76],'Costa Rica':[9.75,-83.75],
  'Croatia':[45.10,15.20],'Cuba':[21.52,-77.78],'Cyprus':[35.13,33.43],
  'Czech Republic':[49.82,15.47],'Czechia':[49.82,15.47],
  'Denmark':[56.26,9.50],'Djibouti':[11.83,42.59],'Dominica':[15.41,-61.37],
  'Dominican Republic':[18.74,-70.16],
  'East Timor':[-8.87,125.73],'Ecuador':[-1.83,-78.18],'Egypt':[26.82,30.80],
  'El Salvador':[13.79,-88.90],'Equatorial Guinea':[1.65,10.27],
  'Eritrea':[15.18,39.78],'Estonia':[58.60,25.01],'Eswatini':[-26.52,31.47],
  'Ethiopia':[9.15,40.49],
  'Fiji':[-17.71,178.07],'Finland':[61.92,25.75],'France':[46.23,2.21],
  'Gabon':[-0.80,11.61],'Gambia':[13.44,-15.31],'Georgia':[42.32,43.36],
  'Germany':[51.17,10.45],'Ghana':[7.95,-1.02],'Greece':[39.07,21.82],
  'Grenada':[12.12,-61.68],'Guatemala':[15.78,-90.23],'Guinea':[9.95,-11.61],
  'Guinea-Bissau':[11.80,-15.18],'Guyana':[4.86,-58.93],
  'Haiti':[18.97,-72.29],'Honduras':[15.20,-86.24],'Hungary':[47.16,19.50],
  'Iceland':[64.96,-19.02],'India':[20.59,78.96],'Indonesia':[-0.79,113.92],
  'Iran':[32.43,53.69],'Iraq':[33.22,43.68],'Ireland':[53.41,-8.24],
  'Israel':[31.05,34.85],'Italy':[41.87,12.57],'Ivory Coast':[7.54,-5.55],
  'Jamaica':[18.11,-77.30],'Japan':[36.20,138.25],'Jordan':[30.59,36.24],
  'Kazakhstan':[48.02,66.92],'Kenya':[-0.02,37.91],'Kiribati':[-3.37,-168.73],
  'Kosovo':[42.60,20.90],'Kuwait':[29.31,47.48],'Kyrgyzstan':[41.20,74.77],
  'Laos':[19.86,102.50],'Latvia':[56.88,24.60],'Lebanon':[33.85,35.86],
  'Lesotho':[-29.61,28.23],'Liberia':[6.43,-9.43],'Libya':[26.34,17.23],
  'Liechtenstein':[47.14,9.55],'Lithuania':[55.17,23.88],'Luxembourg':[49.82,6.13],
  'Madagascar':[-18.77,46.87],'Malawi':[-13.25,34.30],'Malaysia':[4.21,108.96],
  'Maldives':[3.20,73.22],'Mali':[17.57,-4.00],'Malta':[35.94,14.38],
  'Mauritania':[21.01,-10.94],'Mauritius':[-20.35,57.55],'Mexico':[23.63,-102.55],
  'Moldova':[47.41,28.37],'Monaco':[43.73,7.40],'Mongolia':[46.86,103.85],
  'Montenegro':[42.71,19.37],'Morocco':[31.79,-7.09],'Mozambique':[-18.67,35.53],
  'Myanmar':[21.92,95.96],
  'Namibia':[-22.96,18.49],'Nepal':[28.39,84.12],'Netherlands':[52.13,5.29],
  'New Zealand':[-40.90,174.89],'Nicaragua':[12.87,-85.21],'Niger':[17.61,8.08],
  'Nigeria':[9.08,8.68],'North Korea':[40.34,127.51],'North Macedonia':[41.61,21.75],
  'Norway':[60.47,8.47],
  'Oman':[21.51,55.92],
  'Pakistan':[30.38,69.35],'Palau':[7.52,134.58],'Palestine':[31.95,35.23],
  'Panama':[8.54,-80.78],'Papua New Guinea':[-6.31,143.96],'Paraguay':[-23.44,-58.44],
  'Peru':[-9.19,-75.02],'Philippines':[12.88,121.77],'Poland':[51.92,19.15],
  'Portugal':[39.40,-8.22],
  'Qatar':[25.35,51.18],
  'Romania':[45.94,24.97],'Russia':[61.52,105.32],'Rwanda':[-1.94,29.87],
  'Saint Lucia':[13.91,-60.98],'Samoa':[-13.76,-172.10],'San Marino':[43.94,12.46],
  'Saudi Arabia':[23.89,45.08],'Senegal':[14.50,-14.45],'Serbia':[44.02,21.01],
  'Sierra Leone':[8.46,-11.78],'Singapore':[1.35,103.82],'Slovakia':[48.67,19.70],
  'Slovenia':[46.15,14.99],'Solomon Islands':[-9.64,160.16],'Somalia':[5.15,46.20],
  'South Africa':[-30.56,22.94],'South Korea':[35.91,127.77],
  'South Sudan':[6.88,31.31],'Spain':[40.46,-3.75],'Sri Lanka':[7.87,80.77],
  'Sudan':[12.86,30.22],'Suriname':[3.92,-56.03],'Sweden':[60.13,18.64],
  'Switzerland':[46.82,8.23],'Syria':[34.80,38.99],
  'Taiwan':[23.70,121.00],'Tajikistan':[38.86,71.28],'Tanzania':[-6.37,34.89],
  'Thailand':[15.87,100.99],'Togo':[8.62,0.82],'Trinidad and Tobago':[10.69,-61.22],
  'Tunisia':[33.89,9.54],'Turkey':[38.96,35.24],'Turkmenistan':[38.97,59.56],
  'Uganda':[1.37,32.29],'Ukraine':[48.38,31.17],'United Arab Emirates':[23.42,53.85],
  'United Kingdom':[55.38,-3.44],'United States':[37.09,-95.71],
  'Uruguay':[-32.52,-55.77],'Uzbekistan':[41.38,64.59],
  'Vanuatu':[-15.38,166.96],'Venezuela':[6.42,-66.59],'Vietnam':[14.06,108.28],
  'Yemen':[15.55,48.52],
  'Zambia':[-13.13,27.85],'Zimbabwe':[-19.02,29.15]
};

let leafletMap = null;
let leafletGeoJsonLayer = null;
let leafletBaseLayer = null;
let mapUpdateTimer = null;

window.updateLeafletMapPoints = function (query, timespan, cachedArticles) {
  if (mapUpdateTimer) clearTimeout(mapUpdateTimer);
  mapUpdateTimer = setTimeout(() => {
    performMapUpdate(query, timespan, cachedArticles);
  }, 200);
};

function performMapUpdate(query, timespan, cachedArticles) {
  if (!leafletMap) return;
  const loader = document.getElementById('gdeltMapLoader');
  const noResults = document.getElementById('gdeltMapNoResults');
  if (loader) loader.style.display = 'flex';
  if (noResults) noResults.style.display = 'none';

  const docUrl = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(query)}&mode=ArtList&maxrecords=250&timespan=${timespan}&format=json`;
  window.lastMapUrl = docUrl;
  window.lastMapGeoJsonUrl = null;

  // Inner function: aggregate articles by sourcecountry and render Leaflet map.
  // The GeoJSON is generated entirely from article sourcecountry + COUNTRY_CENTROIDS —
  // no external geo API needed.
  function buildAndRenderMap(articles) {
      const countryCounts = {};
      const countryArticles = {};
      articles.forEach(art => {
        const country = art.sourcecountry;
        if (!country) return;
        const coords = COUNTRY_CENTROIDS[country];
        if (!coords) return;
        if (!countryCounts[country]) { countryCounts[country] = 0; countryArticles[country] = []; }
        countryCounts[country]++;
        if (countryArticles[country].length < 5) countryArticles[country].push({ title: art.title, url: art.url });
      });
      const geojson = {
        type: 'FeatureCollection',
        features: Object.entries(countryCounts).map(([country, count]) => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [COUNTRY_CENTROIDS[country][1], COUNTRY_CENTROIDS[country][0]] },
          properties: { name: country, count, articles: countryArticles[country] }
        }))
      };
      window.lastComputedMapGeoJson = geojson;
      console.log('[DEBUG] Map features (by country):', geojson.features.length);
      
      const noResults = document.getElementById('gdeltMapNoResults');
      if (!geojson.features || geojson.features.length === 0) {
        if (noResults) noResults.style.display = 'flex';
      } else {
        if (noResults) noResults.style.display = 'none';
      }

      if (leafletGeoJsonLayer) {
        leafletMap.removeLayer(leafletGeoJsonLayer);
      }
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
        if (count <= 1) return RADIUS_ONE;
        if (count >= x) return RADIUS_UPPER;
        return Math.round(RADIUS_ONE + (RADIUS_UPPER - RADIUS_ONE) * Math.sqrt((count - 1) / (x - 1)));
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

      leafletGeoJsonLayer.addTo(leafletMap);

      if (loader) loader.style.display = 'none';
  }

  if (cachedArticles) {
    // Reuse article data already fetched by the headlines load — no extra API call.
    buildAndRenderMap(cachedArticles);
  } else {
    fetch(docUrl)
      .then((r) => r.json())
      .then((docData) => buildAndRenderMap(docData.articles || []))
      .catch((err) => {
        if (loader) loader.style.display = 'none';
        console.error('[DEBUG] Map fetch error:', err);
      });
  }
}

// Parse GDELT seendate format: YYYYMMDDTHHMMSSZ → Date
function _parseGdeltDate(seendate) {
  if (!seendate || seendate.length < 8) return null;
  const y = seendate.slice(0, 4), mo = seendate.slice(4, 6), d = seendate.slice(6, 8);
  const h = seendate.length >= 11 ? seendate.slice(9, 11) : '00';
  const mi = seendate.length >= 13 ? seendate.slice(11, 13) : '00';
  return new Date(`${y}-${mo}-${d}T${h}:${mi}:00Z`);
}

function _timespanToDays(timespan) {
  if (timespan === '1d') return 1;
  if (timespan === '7d') return 7;
  if (timespan === '30d' || timespan === '1m') return 30;
  if (timespan === '365d' || timespan === '1y') return 365;
  const m = timespan && timespan.match(/^(\d+)d$/i);
  return m ? parseInt(m[1]) : 30;
}

// Filter the cached 30d article list to a shorter timespan and re-render — no API call.
window.filterHeadlinesByTime = function (timespan) {
  const container = document.getElementById('gdeltHeadlinesList');
  if (!container) return;
  const articles = window._allHeadlinesArticles || [];
  if (!articles.length) return;
  const cutoff = Date.now() - _timespanToDays(timespan) * 86400000;
  const filtered = articles.filter(art => {
    const d = _parseGdeltDate(art.seendate);
    return d && d.getTime() >= cutoff;
  });
  if (!filtered.length) {
    container.innerHTML = '<div style="padding:2em;text-align:center;color:#888;font-style:italic;">No articles found for this time range.</div>';
    return;
  }
  container.innerHTML = filtered.map(art => {
    const title = (art.title || 'Untitled')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const url = (art.url || '#').replace(/"/g, '%22');
    const meta = [art.domain, art.sourcecountry].filter(Boolean).join(' · ');
    return `<div class="headline-item"><a href="${url}" target="_blank" rel="noopener" class="headline-link">${title}</a>${meta ? `<div class="headline-meta">${meta}</div>` : ''}</div>`;
  }).join('');
};

// Store and render the full 30d article set (called once on load; cache used by filterHeadlinesByTime).
window.renderHeadlinesList = function (articles) {
  window._allHeadlinesArticles = articles;
  window.filterHeadlinesByTime(window._gdeltTimespanHeadlines || '30d');
};

const DEFAULT_MAP_QUERY = 'petroleum OR lng';
const DEFAULT_HEADLINES_QUERY = 'petroleum OR lng';
const DEFAULT_MAP_TIMESPAN = '1d';
const DEFAULT_HEADLINES_TIMESPAN = '30d';

window._gdeltTimespanMap = window._gdeltTimespanMap || DEFAULT_MAP_TIMESPAN;
window._gdeltTimespanHeadlines = window._gdeltTimespanHeadlines || DEFAULT_HEADLINES_TIMESPAN;

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
  const resourceInput = document.getElementById('resourceInput');
  if (resourceInput) {
    resourceInput.value = 'Oil';
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
          `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(query)}&mode=ArtList&maxrecords=250&timespan=${mapTimespan}&format=json`
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
