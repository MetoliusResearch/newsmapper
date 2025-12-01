// GDELT Query logic module for NewsMapper
// Handles query building, updating, and iframe URL construction

export function setupGdeltQuery() {
  // Query building and update logic from gdelt.js
  const resourceInput = document.getElementById('resourceInput');
  const regionInput = document.getElementById('regionInput');
  const countryInput = document.getElementById('countryInput');
  const customInput = document.getElementById('customInput');
  const queryBox = document.getElementById('gdeltMapQuery');

  // Add openQuery function for opening the result link in a new tab (like original gdelt.js)
  window.openQuery = function (inputId) {
    const input = document.getElementById(inputId);
    if (input && input.value) {
      window.open(input.value, '_blank');
    }
  };

  // Support for time frame buttons (map, headlines, sentiment)
  function buildQuery() {
    let resource = resourceInput ? resourceInput.value : '';
    let region = regionInput ? regionInput.value : '';
    let country = countryInput ? countryInput.value.trim() : '';
    let custom = customInput ? customInput.value.trim() : '';
    const resourceMap = {
      // Use simpler Oil & Gas query: petroleum AND lng
      'Fossil Fuels': '(oil OR gas OR petroleum OR lng OR coal)',
      'Oil & Gas': 'petroleum AND lng',
      Petroleum: 'petroleum',
      LNG: 'lng',
      Coal: 'coal',
      Mining: 'mining',
      'Any Mining': 'mining',
      ETMs: '(lithium OR cobalt OR nickel OR copper OR graphite OR manganese OR "rare earths" OR platinum OR palladium OR antimony)',
      'Aluminum/Bauxite': '(aluminum OR bauxite)',
      Agroindustry: '(palm oil OR soy OR cattle OR beef)',
      'Cattle/Beef': '(cattle OR beef)',
      Logging: '(logging OR timber AND forest)',
      'Any Logging': '(logging OR timber AND forest)',
      Timber: 'timber',
      Biofuels: 'biofuels'
    };
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
    if (queryBox) queryBox.value = finalQuery;
    return finalQuery;
  }
  function getMapUrl(query, timespan) {
    return `https://api.gdeltproject.org/api/v2/geo/geo?query=${encodeURIComponent(query)}&mode=PointData&timespan=${timespan}`;
  }
  function getHeadlinesUrl(query, timespan) {
    // Include Google Translate by default
    return `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(query)}&mode=ArtList&maxrecords=100&timespan=${timespan}&trans=googtrans`;
  }
  function getSentimentUrl(query, timespan) {
    return `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(query)}&mode=TimelineTone&timelinesmooth=0&timespan=${timespan}&timezoom=yes&FORMAT=html`;
  }
  // Helper to create a human-readable query string for section titles
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
  // Helper to update section titles based on query and timespan
  function updateSectionTitles(query, mapTimespan, headlinesTimespan, sentimentTimespan) {
    // Get readable query for titles
    const resource = resourceInput ? resourceInput.value : '';
    const region = regionInput ? regionInput.value : '';
    const country = countryInput ? countryInput.value.trim() : '';
    const custom = customInput ? customInput.value.trim() : '';
    const readable = getHumanReadableQuery(resource, region, country, custom);
    // Map
    const mapTitle = document.getElementById('mapTitle');
    if (mapTitle) {
      mapTitle.textContent = `News Map: ${readable} ${getTimespanLabel(mapTimespan)}`;
    }
    // Headlines
    const headlinesTitle = document.getElementById('headlinesTitle');
    if (headlinesTitle) {
      headlinesTitle.textContent = `Headlines: ${readable} ${getTimespanLabel(headlinesTimespan)}`;
    }
    // Sentiment
    const sentimentTitle = document.getElementById('sentimentTitle');
    if (sentimentTitle) {
      sentimentTitle.textContent = `Sentiment: ${readable} (${sentimentTimespan})`;
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
    // Always update the iframes, even if the query is empty
    const query = buildQuery();
    updateSectionTitles(
      query,
      timespan,
      window._gdeltTimespanHeadlines || '1d',
      window._gdeltTimespanSentiment || '1y'
    );
    const mapUrl = getMapUrl(query, timespan);
    window.lastMapUrl = mapUrl;
    if (window.setIframeWithLoader) {
      window.setIframeWithLoader('gdeltMap', 'gdeltMapLoader', mapUrl);
    }
    // Also check for no results message
    checkMapNoResults(query, timespan);
  };
  window.setHeadlinesTime = function (timespan) {
    window._gdeltTimespanHeadlines = timespan;
    // Always update the iframes, even if the query is empty
    const query = buildQuery();
    updateSectionTitles(
      query,
      window._gdeltTimespanMap || '1d',
      timespan,
      window._gdeltTimespanSentiment || '1y'
    );
    const headlinesUrl = getHeadlinesUrl(query, timespan);
    window.lastHeadlinesUrl = headlinesUrl;
    if (window.setIframeWithLoader) {
      window.setIframeWithLoader('gdeltHeadlines', 'gdeltHeadlinesLoader', headlinesUrl);
    }
    // Also check for no results message
    checkHeadlinesNoResults(query, timespan);
  };
  window.setSentimentTime = function (timespan) {
    window._gdeltTimespanSentiment = timespan;
    const query = buildQuery();
    updateSectionTitles(
      query,
      window._gdeltTimespanMap || '1d',
      window._gdeltTimespanHeadlines || '1d',
      timespan
    );
    const sentimentUrl = getSentimentUrl(query, timespan);
    window.lastSentimentUrl = sentimentUrl;
    if (window.setIframeWithLoader) {
      window.setIframeWithLoader('gdeltSentiment', 'gdeltSentimentLoader', sentimentUrl);
    }
  };

  // Helper to clear custom input if resource/region/country changes
  function clearCustomIfNeeded() {
    if (customInput && customInput.value.trim() !== '') {
      customInput.value = '';
    }
  }

  // Always update all iframes, including headlines, on any change
  if (resourceInput)
    resourceInput.addEventListener('change', function () {
      clearCustomIfNeeded();
      updateGdeltIframes();
    });
  if (regionInput)
    regionInput.addEventListener('change', function () {
      if (regionInput.value && regionInput.value !== 'Global') {
        if (countryInput) countryInput.value = '';
      }
      clearCustomIfNeeded();
      updateGdeltIframes();
    });
  if (countryInput) {
    countryInput.addEventListener('input', function () {
      if (countryInput.value && countryInput.value.trim() !== '') {
        if (regionInput) regionInput.value = 'Global';
      }
      clearCustomIfNeeded();
      updateGdeltIframes();
    });
    countryInput.addEventListener('change', function () {
      if (countryInput.value && countryInput.value.trim() !== '') {
        if (regionInput) regionInput.value = 'Global';
      }
      clearCustomIfNeeded();
      updateGdeltIframes();
    });
  }
  if (customInput)
    customInput.addEventListener('input', function () {
      if (customInput.value.trim() !== '') {
        if (resourceInput) resourceInput.value = '';
        if (regionInput) regionInput.value = '';
        if (countryInput) countryInput.value = '';
      }
      updateGdeltIframes();
    });
  const resetBtn = document.getElementById('resetCountry');
  if (resetBtn) {
    resetBtn.addEventListener('click', function () {
      if (resourceInput) resourceInput.value = 'Oil & Gas';
      if (regionInput) regionInput.value = 'Global';
      if (countryInput) countryInput.value = '';
      if (customInput) customInput.value = '';
      // Reset timespans to default
      window._gdeltTimespanMap = '1d';
      window._gdeltTimespanHeadlines = '1d';
      window._gdeltTimespanSentiment = '1y';
      updateGdeltIframes();
    });
  }

  // Helper to show/hide no results message for headlines
  function checkHeadlinesNoResults(query, timespan) {
    const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(query)}&mode=ArtList&maxrecords=1&format=json&timespan=${timespan}`;
    const noResultsDiv = document.getElementById('gdeltHeadlinesEmptyQuery');
    const headlinesIframe = document.getElementById('gdeltHeadlines');
    if (!noResultsDiv || !headlinesIframe) return;
    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        // Probe the number of articles returned
        if (!data.articles || data.articles.length === 0) {
          noResultsDiv.textContent =
            'No results found, try increasing the time period or change the query';
          noResultsDiv.style.display = 'flex';
          headlinesIframe.style.visibility = 'hidden';
        } else {
          noResultsDiv.style.display = 'none';
          headlinesIframe.style.visibility = 'visible';
        }
      })
      .catch(() => {
        noResultsDiv.textContent =
          'No results found, try increasing the time period or change the query';
        noResultsDiv.style.display = 'flex';
        headlinesIframe.style.visibility = 'hidden';
      });
  }
  // Helper to show/hide no results message for map
  function checkMapNoResults(query, timespan) {
    const url = `https://api.gdeltproject.org/api/v2/geo/geo?query=${encodeURIComponent(query)}&mode=PointData&format=json&timespan=${timespan}`;
    const noResultsDiv = document.getElementById('gdeltMapNoResults');
    if (!noResultsDiv) return;
    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        if (!data.features || data.features.length === 0) {
          noResultsDiv.style.display = 'block';
        } else {
          noResultsDiv.style.display = 'none';
        }
      })
      .catch(() => {
        noResultsDiv.style.display = 'none';
      });
  }
  // Helper to show/hide no results message for sentiment
  function checkSentimentNoResults(query, timespan) {
    const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(query)}&mode=TimelineTone&format=json&timespan=${timespan}`;
    const noResultsDiv = document.getElementById('gdeltSentimentNoResults');
    if (!noResultsDiv) return;
    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        if (!data.timeline || !data.timeline.length) {
          noResultsDiv.style.display = 'block';
        } else {
          noResultsDiv.style.display = 'none';
        }
      })
      .catch(() => {
        noResultsDiv.style.display = 'none';
      });
  }

  // Update updateGdeltIframes to use the selected timespans
  function updateGdeltIframes() {
    const query = buildQuery();
    const mapTimespan = window._gdeltTimespanMap || '1d';
    const headlinesTimespan = window._gdeltTimespanHeadlines || '1d';
    const sentimentTimespan = window._gdeltTimespanSentiment || '1y';
    const mapUrl = getMapUrl(query, mapTimespan);
    const headlinesUrl = getHeadlinesUrl(query, headlinesTimespan);
    const sentimentUrl = getSentimentUrl(query, sentimentTimespan);
    window.lastMapUrl = mapUrl;
    window.lastHeadlinesUrl = headlinesUrl;
    window.lastSentimentUrl = sentimentUrl;
    updateSectionTitles(query, mapTimespan, headlinesTimespan, sentimentTimespan);
    // Headlines no results logic
    const noResultsDiv = document.getElementById('gdeltHeadlinesEmptyQuery');
    const headlinesIframe = document.getElementById('gdeltHeadlines');
    if (noResultsDiv && headlinesIframe) {
      noResultsDiv.style.display = 'none'; // Hide by default
      headlinesIframe.style.visibility = 'visible';
    }
    if (window.setIframeWithLoader) {
      window.setIframeWithLoader('gdeltMap', 'gdeltMapLoader', mapUrl);
      window.setIframeWithLoader('gdeltHeadlines', 'gdeltHeadlinesLoader', headlinesUrl);
      window.setIframeWithLoader('gdeltSentiment', 'gdeltSentimentLoader', sentimentUrl);
    }
    checkMapNoResults(query, mapTimespan);
    checkHeadlinesNoResults(query, headlinesTimespan);
    checkSentimentNoResults(query, sentimentTimespan);
    // --- Always update Leaflet map points with current query/timespan ---
    if (window.updateLeafletMapPoints) {
      window.updateLeafletMapPoints(query, mapTimespan);
    }
  }

  // Load query parameters from URL on page load
  function loadFromURL() {
    const params = new URLSearchParams(window.location.search);
    
    // Get parameters
    const resource = params.get('resource');
    const region = params.get('region');
    const country = params.get('country');
    const custom = params.get('custom');
    const query = params.get('query'); // Direct query parameter
    const timespan = params.get('timespan');
    
    console.log('[URL Params]', { resource, region, country, custom, query, timespan });
    
    // Set input values if parameters exist
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
    
    // If direct query is provided, put it in custom input (only if nothing else is set)
    if (query && customInput && !custom && !resource && !region && !country) {
      customInput.value = decodeURIComponent(query);
    }
    
    if (timespan) {
      window._gdeltTimespanMap = timespan;
      window._gdeltTimespanHeadlines = timespan;
      // Update button states
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
    
    // If any parameters were provided, trigger an update after a short delay
    // to ensure DOM is fully ready
    if (resource || region || country || custom || query) {
      setTimeout(() => {
        console.log('[URL Params] Triggering updateGdeltIframes()');
        updateGdeltIframes();
      }, 100);
    }
  }

  // Generate shareable URL with current query state
  window.getShareableURL = function() {
    const params = new URLSearchParams();
    
    // Get the actual built query
    const query = buildQuery();
    
    // If we have individual components, use them
    if (resourceInput && resourceInput.value) params.set('resource', resourceInput.value);
    if (regionInput && regionInput.value) params.set('region', regionInput.value);
    if (countryInput && countryInput.value) params.set('country', countryInput.value);
    if (customInput && customInput.value) params.set('custom', customInput.value);
    
    // Also include the built query for direct use
    if (query) params.set('query', query);
    if (window._gdeltTimespanMap) params.set('timespan', window._gdeltTimespanMap);
    
    // Build the URL properly
    const baseUrl = window.location.href.split('?')[0]; // Get URL without existing params
    const url = `${baseUrl}?${params.toString()}`;
    
    console.log('[Share URL] Generated:', url);
    return url;
  };

  // Copy shareable URL to clipboard
  window.copyShareableURL = function() {
    const url = window.getShareableURL();
    
    // Try modern clipboard API first
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(() => {
        alert('Shareable link copied to clipboard!\n\n' + url);
      }).catch((err) => {
        console.error('Clipboard copy failed:', err);
        // Fallback
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

  // Load URL parameters on page load
  loadFromURL();
}
