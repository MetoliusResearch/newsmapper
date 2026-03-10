const resourceMap = {
  'Fossil Fuels': '("fossil fuels" OR "crude oil" OR oil OR gas OR coal OR "natural gas")',
  Oil: '("crude oil" OR petroleum OR "oil production" OR "oil spill" OR "oil pipeline")',
  Petroleum: 'petroleum',
  LNG: '("natural gas" OR fracking OR "hydraulic fracturing" OR "liquefied natural gas")',
  Coal: 'coal',
  Mining: 'mining',
  'Any Mining': 'mining',
  Gold: 'gold AND (mining OR mine OR production OR exploration OR mineral OR metal OR concession OR permit OR disaster OR ore)',
  Silver: 'silver AND (mining OR mine OR production OR exploration OR mineral OR metal OR concession OR permit OR disaster OR ore)',
  Iron: 'iron AND ("iron ore" OR ore OR mining OR mine OR production OR exploration OR mineral OR metal OR concession OR permit OR disaster)',
  Copper: 'copper AND (mining OR mine OR production OR exploration OR mineral OR metal OR concession OR permit OR disaster OR ore)',
  Nickel: 'nickel AND (mining OR mine OR production OR exploration OR mineral OR metal OR concession OR permit OR disaster OR ore)',
  Cobalt: 'cobalt AND (mining OR mine OR production OR exploration OR mineral OR metal OR concession OR permit OR disaster OR ore)',
  Zinc: 'zinc AND (mining OR mine OR production OR exploration OR mineral OR metal OR concession OR permit OR disaster OR ore)',
  Lead: 'lead AND (mining OR mine OR production OR exploration OR mineral OR metal OR concession OR permit OR disaster OR ore)',
  Platinum: 'platinum AND (mining OR mine OR production OR exploration OR mineral OR metal OR concession OR permit OR disaster OR ore)',
  Palladium: 'palladium AND (mining OR mine OR production OR exploration OR mineral OR metal OR concession OR permit OR disaster OR ore)',
  Lithium: 'lithium AND (mining OR mine OR production OR exploration OR mineral OR metal OR concession OR permit OR disaster OR ore)',
  Graphite: 'graphite AND (mining OR mine OR production OR exploration OR mineral OR metal OR concession OR permit OR disaster OR ore)',
  Tin: 'tin AND (mining OR mine OR production OR exploration OR mineral OR metal OR concession OR permit OR disaster OR ore)',
  Tantalum: 'tantalum',
  Tantalium: 'tantalum',
  Tungsten: 'tungsten',
  Manganese: 'manganese',
  Chromium: 'chromium AND (mining OR mine OR production OR exploration OR mineral OR metal OR concession OR permit OR disaster OR ore)',
  Molybdenum: 'molybdenum',
  Vanadium: 'vanadium',
  Niobium: 'niobium',
  Uranium: 'uranium',
  Antimony: 'antimony',
  ETMs: '(lithium OR cobalt OR nickel OR copper OR graphite OR manganese OR "rare earths" OR platinum OR palladium OR antimony)',
  'Aluminum/Bauxite': '(aluminum OR bauxite) AND (mining OR mine OR production OR exploration OR mineral OR metal OR concession OR permit OR disaster OR ore)',
  Agroindustry: '("palm oil" OR soy OR cattle OR beef)',
  'Palm Oil': '("palm oil" OR "oil palm" OR "palm plantation")',
  Soy: '(soy OR soybean OR "soy production")',
  'Cattle/Beef': '(cattle OR beef)',
  Logging: '((logging OR timber) AND forest)',
  'Any Logging': '((logging OR timber) AND forest)',
  Timber: 'timber AND (logging OR forest OR harvest OR concession OR permit OR illegal)',
  Biofuels: 'biofuels'
};

export function generateGdeltQuery(resource, region, country, custom) {
  resource = resource ? resource.trim() : '';
  region = region ? region : '';
  country = country ? country.trim() : '';
  custom = custom ? custom.trim() : '';

  // Handle comma-separated values in custom field as OR
  if (custom && custom.includes(',') && !custom.includes(' AND ') && !custom.includes(' OR ') && !custom.includes('(')) {
    const parts = custom.split(',').map(p => {
      let part = p.trim();
      if (part.includes(' ') && !part.startsWith('"')) {
        return `"${part}"`;
      }
      return part;
    }).filter(p => p);
    
    if (parts.length > 1) {
      custom = `(${parts.join(' OR ')})`;
    }
  }
  
  if (custom && !custom.startsWith('"') && !custom.includes('(') && !custom.includes(' AND ') && !custom.includes(' OR ')) {
    // Removed auto-quoting for spaces to allow implicit AND (e.g. "Gold Mali")
  }

  // Case-insensitive resource lookup
  let queryTerm = resource;
  if (resource) {
    const resourceKey = Object.keys(resourceMap).find(
      key => key.toLowerCase() === resource.toLowerCase()
    );
    if (resourceKey) {
      queryTerm = resourceMap[resourceKey];
    }
  }
  
  let locationTerm = '';
  if (region && region !== 'Global') {
    if (region === 'Amazon') {
      locationTerm = '(Brazil OR Peru OR Colombia OR Bolivia OR Venezuela OR Ecuador OR Guyana OR Suriname OR "French Guiana")';
    } else {
      locationTerm = region;
    }
  }
  if (country) {
    // Only wrap country names in quotes if they contain spaces or special characters
    // Single words like Mali should not be quoted to avoid "phrase too short" errors
    let quotedCountry = country;
    if (!country.startsWith('"') && (country.includes(' ') || country.includes('-') || country.includes(','))) {
      quotedCountry = `"${country}"`;
    }
    locationTerm = locationTerm ? `(${locationTerm} OR ${quotedCountry})` : quotedCountry;
  }
  let finalQuery = '';
  const parts = [];
  if (locationTerm) parts.push(locationTerm);
  if (queryTerm) parts.push(queryTerm);
  if (custom) parts.push(custom);
  finalQuery = parts.join(' AND ');
  return finalQuery;
}

export function setupGdeltQuery() {
  const resourceInput = document.getElementById('resourceInput');
  const regionInput = document.getElementById('regionInput');
  const countryInput = document.getElementById('countryInput');
  const customInput = document.getElementById('customInput');
  const queryBox = document.getElementById('gdeltMapQuery');

  // (no stagger timer needed — sentiment iframe removed)

  window.openQuery = function (inputId) {
    const input = document.getElementById(inputId);
    if (input && input.value) {
      window.open(input.value, '_blank');
    }
  };

  function buildQuery() {
    let resource = resourceInput ? resourceInput.value.trim() : '';
    let region = regionInput ? regionInput.value : '';
    let country = countryInput ? countryInput.value.trim() : '';
    let custom = customInput ? customInput.value.trim() : '';
    
    const finalQuery = generateGdeltQuery(resource, region, country, custom);
    
    console.log('[buildQuery] Resource:', resource, 'Country:', country, 'Final:', finalQuery);
    if (queryBox) queryBox.value = finalQuery;
    return finalQuery;
  }
  function getMapUrl(query, timespan) {
    // geo/geo API discontinued — use DOC ArtList endpoint
    return `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(query)}&mode=ArtList&maxrecords=250&timespan=${timespan}&format=json`;
  }
  function getMapGeoJsonUrl(query, timespan) {
    // GeoJSON is built in-memory from the DOC API response
    return `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(query)}&mode=ArtList&maxrecords=250&timespan=${timespan}&format=json`;
  }
  function getHeadlinesUrl(query, timespan) {
    // Include Google Translate by default
    return `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(query)}&mode=ArtList&maxrecords=100&timespan=${timespan}&trans=googtrans#googtrans(auto|en)`;
  }
  function getHumanReadableQuery(resource, region, country, custom) {
    if (custom && custom.trim() !== '') {
      return custom;
    }
    let parts = [];
    if (resource && resource !== '') parts.push(resource);
    if (region && region !== 'Global' && region !== '') parts.push(region);
    if (country && country !== '') parts.push(country);
    return parts.length ? parts.join(', ') : 'All News';
  }
  function updateSectionTitles(query, mapTimespan, headlinesTimespan) {
    const resource = resourceInput ? resourceInput.value : '';
    const region = regionInput ? regionInput.value : '';
    const country = countryInput ? countryInput.value.trim() : '';
    const custom = customInput ? customInput.value.trim() : '';
    const readable = getHumanReadableQuery(resource, region, country, custom);
    const mapTitle = document.getElementById('mapTitle');
    if (mapTitle) {
      mapTitle.textContent = `News Map: ${readable} ${getTimespanLabel(mapTimespan)}`;
    }
    const headlinesTitle = document.getElementById('headlinesTitle');
    if (headlinesTitle) {
      headlinesTitle.textContent = `Headlines: ${readable} ${getTimespanLabel(headlinesTimespan)}`;
    }
  }
  function getTimespanLabel(timespan) {
    switch (timespan) {
      case '1d':
        return '- today';
      case '7d':
        return '- past week';
      case '30d':
      case '1m':
        return '- past month';
      case '365d':
      case '1y':
        return '- past year';
      default:
        return timespan ? `(${timespan})` : '';
    }
  }
  window.setMapTime = function (timespan) {
    window._gdeltTimespanMap = timespan;
    const query = buildQuery();
    updateSectionTitles(query, timespan, window._gdeltTimespanHeadlines || '30d');
    const mapPh = document.getElementById('gdeltMapPlaceholder');
    if (mapPh) mapPh.style.display = 'flex';
  };
  window.setHeadlinesTime = function (timespan) {
    window._gdeltTimespanHeadlines = timespan;
    const query = buildQuery();
    updateSectionTitles(query, window._gdeltTimespanMap || '1d', timespan);
    if (window.filterHeadlinesByTime) window.filterHeadlinesByTime(timespan);
  };

  function clearCustomIfNeeded() {
    if (customInput && customInput.value.trim() !== '') {
      customInput.value = '';
    }
  }

  if (resourceInput)
    resourceInput.addEventListener('change', function () {
      clearCustomIfNeeded();
      refreshQueryAndResetPlaceholders();
    });
  if (regionInput)
    regionInput.addEventListener('change', function () {
      if (regionInput.value && regionInput.value !== 'Global') {
        if (countryInput) countryInput.value = '';
      }
      refreshQueryAndResetPlaceholders();
    });
  if (countryInput) {
    countryInput.addEventListener('input', function () {
      if (countryInput.value && countryInput.value.trim() !== '') {
        if (regionInput) regionInput.value = 'Global';
      }
      refreshQueryAndResetPlaceholders();
    });
    countryInput.addEventListener('change', function () {
      if (countryInput.value && countryInput.value.trim() !== '') {
        if (regionInput) regionInput.value = 'Global';
      }
      refreshQueryAndResetPlaceholders();
    });
  }
  if (customInput)
    customInput.addEventListener('input', function () {
      if (customInput.value.trim() !== '') {
        if (resourceInput) resourceInput.value = '';
      }
      refreshQueryAndResetPlaceholders();
    });

  // Query Time Buttons Logic
  const queryTime1d = document.getElementById('queryTime1d');
  const queryTime7d = document.getElementById('queryTime7d');
  const queryTime30d = document.getElementById('queryTime30d');
  
  function setQueryTime(timespan) {
    window._gdeltTimespanHeadlines = timespan;
    window._gdeltTimespanMap = timespan;

    // Update button states
    [queryTime1d, queryTime7d, queryTime30d].forEach(btn => {
      if (btn) {
        const isActive = btn.id === `queryTime${timespan}`;
        btn.setAttribute('aria-pressed', isActive);
        if (isActive) btn.classList.add('active');
        else btn.classList.remove('active');
      }
    });

    // Reset map placeholder (needs re-fetch with new timespan)
    const mapPh = document.getElementById('gdeltMapPlaceholder');
    if (mapPh) mapPh.style.display = 'flex';
    const mapNoResults = document.getElementById('gdeltMapNoResults');
    if (mapNoResults) mapNoResults.style.display = 'none';

    // Filter cached headlines locally — no API call
    if (window.filterHeadlinesByTime) window.filterHeadlinesByTime(timespan);

    const query = buildQuery();
    updateSectionTitles(query, timespan, timespan);
    if (window.updateQueryResultsWindow) window.updateQueryResultsWindow(query, timespan);
  }

  if (queryTime1d) {
    queryTime1d.addEventListener('click', () => setQueryTime('1d'));
  }
  if (queryTime7d) {
    queryTime7d.addEventListener('click', () => setQueryTime('7d'));
  }
  if (queryTime30d) {
    queryTime30d.addEventListener('click', () => setQueryTime('30d'));
  }

  const resetBtn = document.getElementById('resetCountry');
  if (resetBtn) {
    resetBtn.addEventListener('click', function () {
      if (resourceInput) resourceInput.value = 'Oil & Gas';
      if (regionInput) regionInput.value = 'Global';
      if (countryInput) countryInput.value = '';
      if (customInput) customInput.value = '';
      window._gdeltTimespanMap = '1d';
      window._gdeltTimespanHeadlines = '30d';
      refreshQueryAndResetPlaceholders();
    });
  }

  // Updates query text + section titles and re-shows placeholders.
  // Called on every input/query change. Does NOT fire any API requests.
  function refreshQueryAndResetPlaceholders() {
    const query = buildQuery();
    const mapTimespan = window._gdeltTimespanMap || '1d';
    const headlinesTimespan = window._gdeltTimespanHeadlines || '30d';
    updateSectionTitles(query, mapTimespan, headlinesTimespan);
    const mapPh = document.getElementById('gdeltMapPlaceholder');
    const headlinesPh = document.getElementById('gdeltHeadlinesPlaceholder');
    const mapNoResults = document.getElementById('gdeltMapNoResults');
    const hlList = document.getElementById('gdeltHeadlinesList');
    if (mapPh) mapPh.style.display = 'flex';
    if (headlinesPh) headlinesPh.style.display = 'flex';
    if (mapNoResults) mapNoResults.style.display = 'none';
    if (hlList) hlList.innerHTML = '';
    // Invalidate headline cache since query changed
    window._allHeadlinesArticles = null;
    window._cachedArticlesKey = null;
    if (window.updateQueryResultsWindow) window.updateQueryResultsWindow(query, mapTimespan);
  }

  // Load only the News Map (GeoJSON + Leaflet). Called when user clicks the map placeholder.
  // Uses cached article data from triggerHeadlinesLoad if query + timespan match.
  window.triggerMapLoad = function () {
    const query = buildQuery();
    if (!query || !query.trim()) return;
    const mapTimespan = window._gdeltTimespanMap || '1d';
    window.lastMapUrl = getMapUrl(query, mapTimespan);
    window.lastMapGeoJsonUrl = getMapGeoJsonUrl(query, mapTimespan);
    const mapPh = document.getElementById('gdeltMapPlaceholder');
    const mapNoResults = document.getElementById('gdeltMapNoResults');
    if (mapPh) mapPh.style.display = 'none';
    if (mapNoResults) mapNoResults.style.display = 'none';
    const cacheKey = query + '|' + mapTimespan;
    const cachedArticles = (window._cachedArticlesKey === cacheKey) ? window._cachedArticles : null;
    if (window.updateLeafletMapPoints) window.updateLeafletMapPoints(query, mapTimespan, cachedArticles);
    if (window.updateQueryResultsWindow) window.updateQueryResultsWindow(query, mapTimespan);
  };

  // Fetch 30d of articles once; render as native HTML list; cache data for map reuse.
  window.triggerHeadlinesLoad = function () {
    const query = buildQuery();
    if (!query || !query.trim()) return;
    const FETCH_TIMESPAN = '30d';
    const jsonUrl = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(query)}&mode=ArtList&maxrecords=250&timespan=${FETCH_TIMESPAN}&format=json`;
    // Store raw GDELT URL for the 🔗 button
    window.lastHeadlinesUrl = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(query)}&mode=ArtList&maxrecords=250&timespan=${FETCH_TIMESPAN}&trans=googtrans#googtrans(auto|en)`;
    const headlinesPh = document.getElementById('gdeltHeadlinesPlaceholder');
    const loader = document.getElementById('gdeltHeadlinesLoader');
    if (headlinesPh) headlinesPh.style.display = 'none';
    if (loader) { loader.style.display = 'flex'; loader.style.alignItems = 'center'; loader.style.justifyContent = 'center'; }
    fetch(jsonUrl)
      .then(r => r.json())
      .then(data => {
        const articles = data.articles || [];
        if (loader) loader.style.display = 'none';
        // Cache for map reuse
        window._allHeadlinesArticles = articles;
        window._cachedArticles = articles;
        window._cachedArticlesKey = query + '|' + FETCH_TIMESPAN;
        if (window.renderHeadlinesList) window.renderHeadlinesList(articles);
      })
      .catch(err => {
        if (loader) loader.style.display = 'none';
        const container = document.getElementById('gdeltHeadlinesList');
        if (container) container.innerHTML = '<div style="padding:2em;text-align:center;color:#c00;">Failed to load headlines. Please try again.</div>';
        console.error('[DEBUG] Headlines fetch error:', err);
      });
  };

  function loadFromURL() {
    const params = new URLSearchParams(window.location.search);
    
    const resource = params.get('resource');
    const region = params.get('region');
    const country = params.get('country');
    const custom = params.get('custom');
    const query = params.get('query'); // Direct query parameter
    const timespan = params.get('timespan');
    
    console.log('[URL Params]', { resource, region, country, custom, query, timespan });
    
    if (resource && resourceInput) {
      resourceInput.value = decodeURIComponent(resource);
    }
    if (region && regionInput) {
      regionInput.value = decodeURIComponent(region);
    }
    if (country && countryInput) {
      countryInput.value = decodeURIComponent(country);
    }
    if (custom && customInput) {
      customInput.value = decodeURIComponent(custom);
    }
    
    if (query && customInput && !custom && !resource && !region && !country) {
      customInput.value = decodeURIComponent(query);
    }
    
    if (timespan) {
      window._gdeltTimespanMap = timespan;
      window._gdeltTimespanHeadlines = timespan;
      document.querySelectorAll('.query-time-btn').forEach(btn => {
        btn.setAttribute('aria-pressed', 'false');
        btn.classList.remove('active');
      });
      const activeBtn = document.getElementById(`queryTime${timespan}`);
      if (activeBtn) {
        activeBtn.setAttribute('aria-pressed', 'true');
        activeBtn.classList.add('active');
      }
    }
    
    if (resource || region || country || custom || query) {
      setTimeout(() => {
        refreshQueryAndResetPlaceholders();
      }, 100);
    }
  }

  window.getShareableURL = function() {
    const params = new URLSearchParams();
    
    const query = buildQuery();
    
    if (resourceInput && resourceInput.value) params.set('resource', resourceInput.value);
    if (regionInput && regionInput.value) params.set('region', regionInput.value);
    if (countryInput && countryInput.value) params.set('country', countryInput.value);
    if (customInput && customInput.value) params.set('custom', customInput.value);
    
    if (query) params.set('query', query);
    if (window._gdeltTimespanMap) params.set('timespan', window._gdeltTimespanMap);
    
    const baseUrl = window.location.href.split('?')[0];
    const url = `${baseUrl}?${params.toString()}`;
    
    console.log('[Share URL] Generated:', url);
    return url;
  };

  window.copyShareableURL = function() {
    const url = window.getShareableURL();
    
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(() => {
        alert('Shareable link copied to clipboard!\n\n' + url);
      }).catch((err) => {
        console.error('Clipboard copy failed:', err);
        fallbackCopy(url);
      });
    } else {
      fallbackCopy(url);
    }
    
    function fallbackCopy(text) {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
        alert('Shareable link copied to clipboard!\n\n' + text);
      } catch (err) {
        alert('Could not copy. Please copy manually:\n\n' + text);
      }
      document.body.removeChild(textarea);
    }
  };

  loadFromURL();
}
