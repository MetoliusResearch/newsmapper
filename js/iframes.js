export function setupIframes() {
  window.setIframeWithLoader = function (iframeId, loaderId, url) {
    const iframe = document.getElementById(iframeId);
    const loader = document.getElementById(loaderId);
    if (!iframe) return;
    if (loader) {
      const parent = iframe.parentElement;
      if (parent && parent.style.position !== 'relative') {
        parent.style.position = 'relative';
      }
      loader.style.display = 'flex';
      loader.style.alignItems = 'center';
      loader.style.justifyContent = 'center';
    }
    iframe.style.visibility = 'hidden';
    iframe.src = url;
    
    const timeoutId = setTimeout(() => {
      if (loader) loader.style.display = 'none';
      iframe.style.visibility = 'visible';
    }, 2000);
    
    iframe.onload = function () {
      clearTimeout(timeoutId);
      if (loader) loader.style.display = 'none';
      iframe.style.visibility = 'visible';
    };
  };
  window.copyEmbedCode = function (section, event) {
    let url = '';
    if (section === 'gdeltMap') {
      url = window.lastMapUrl;
      const queryBox = document.getElementById('gdeltMapQuery');
      const query = queryBox ? queryBox.value : 'petroleum AND lng';
      const timespan = window._gdeltTimespanMap || '1d';
      const geojsonUrl = `https://api.gdeltproject.org/api/v2/geo/geo?query=${encodeURIComponent(query)}&mode=PointData&timespan=${timespan}&format=geojson`;
      document.querySelectorAll('.embed-popup').forEach((el) => el.remove());
      const popup = document.createElement('div');
      popup.className = 'embed-popup';
      popup.innerHTML = `
                <div style="font-size:0.95em;margin-bottom:0.5em;">Embed code for map (iframe):</div>
                <textarea readonly style="width:420px;height:90px;font-size:0.97em;">${`<iframe src=\"${url}\" scrolling=\"no\" width=\"100%\" frameborder=\"0\" height=\"500\"></iframe>`}</textarea>
                <div style="margin:0.7em 0 0.3em 0;font-size:0.97em;color:#0c1b50;">GeoJSON URL for this map query:</div>
                <input readonly style="width:420px;font-size:0.97em;" value="${geojsonUrl}">
                <div style="text-align:right;margin-top:0.5em;">
                    <button style="padding:0.2em 1em;font-size:1em;" onclick="this.parentNode.parentNode.remove()">Close</button>
                </div>
            `;
      const btn = event ? event.currentTarget : null;
      if (btn) {
        const rect = btn.getBoundingClientRect();
        popup.style.position = 'fixed';
        popup.style.left = rect.right + 12 + 'px';
        popup.style.top = rect.top - 8 + 'px';
        popup.style.zIndex = 9999;
        popup.style.background = '#fff';
        popup.style.border = '1px solid #bbb';
        popup.style.boxShadow = '0 2px 8px rgba(34,34,59,0.13)';
        popup.style.padding = '1em';
        popup.style.borderRadius = '8px';
        popup.style.minWidth = '340px';
        popup.style.maxWidth = '90vw';
      } else {
        popup.style.position = 'fixed';
        popup.style.left = '50vw';
        popup.style.top = '30vh';
        popup.style.transform = 'translate(-50%, 0)';
        popup.style.zIndex = 9999;
        popup.style.background = '#fff';
        popup.style.border = '1px solid #bbb';
        popup.style.boxShadow = '0 2px 8px rgba(34,34,59,0.13)';
        popup.style.padding = '1em';
        popup.style.borderRadius = '8px';
        popup.style.minWidth = '340px';
        popup.style.maxWidth = '90vw';
      }
      document.body.appendChild(popup);
      const embedCode = `<iframe src="${url}" scrolling="no" width="100%" frameborder="0" height="500"></iframe>`;
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(embedCode);
      } else {
        window.prompt('Copy the embed code below:', embedCode);
      }
      return;
    }
    if (section === 'gdeltHeadlines') url = window.lastHeadlinesUrl;
    else if (section === 'gdeltSentiment') url = window.lastSentimentUrl;
    const embedCode = `<iframe src="${url}" scrolling="no" width="100%" frameborder="0" height="500"></iframe>`;
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(embedCode);
    } else {
      window.prompt('Copy the embed code below:', embedCode);
    }
    document.querySelectorAll('.embed-popup').forEach((el) => el.remove());
    const popup = document.createElement('div');
    popup.className = 'embed-popup';
    popup.innerHTML = `
            <div style="font-size:0.95em;margin-bottom:0.5em;">Embed code copied:</div>
            <textarea readonly style="width:420px;height:90px;font-size:0.97em;">${embedCode}</textarea>
            <div style="text-align:right;margin-top:0.5em;">
                <button style="padding:0.2em 1em;font-size:1em;" onclick="this.parentNode.parentNode.remove()">Close</button>
            </div>
        `;
    const btn = event ? event.currentTarget : null;
    if (btn) {
      const rect = btn.getBoundingClientRect();
      popup.style.position = 'fixed';
      popup.style.left = rect.right + 12 + 'px';
      popup.style.top = rect.top - 8 + 'px';
      popup.style.zIndex = 9999;
      popup.style.background = '#fff';
      popup.style.border = '1px solid #bbb';
      popup.style.boxShadow = '0 2px 8px rgba(34,34,59,0.13)';
      popup.style.padding = '1em';
      popup.style.borderRadius = '8px';
      popup.style.minWidth = '340px';
      popup.style.maxWidth = '90vw';
    } else {
      popup.style.position = 'fixed';
      popup.style.left = '50vw';
      popup.style.top = '30vh';
      popup.style.transform = 'translate(-50%, 0)';
      popup.style.zIndex = 9999;
      popup.style.background = '#fff';
      popup.style.border = '1px solid #bbb';
      popup.style.boxShadow = '0 2px 8px rgba(34,34,59,0.13)';
      popup.style.padding = '1em';
      popup.style.borderRadius = '8px';
      popup.style.minWidth = '340px';
      popup.style.maxWidth = '90vw';
    }
    document.body.appendChild(popup);
  };
  
  window.downloadGeoJSON = function() {
    const url = window.lastMapGeoJsonUrl;
    if (!url) {
        alert('No map data available to download.');
        return;
    }
    
    const button = document.activeElement;
    const originalText = button ? button.innerHTML : '';
    if (button) button.innerHTML = '⏳';

    fetch(url)
        .then(resp => resp.blob())
        .then(blob => {
            const blobUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = blobUrl;
            a.download = 'gdelt_extractive_industries_map.geojson';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(blobUrl);
            if (button) button.innerHTML = originalText;
        })
        .catch(err => {
            console.error('Download failed', err);
            alert('Download failed. Opening raw data in new tab instead.');
            window.open(url, '_blank');
            if (button) button.innerHTML = originalText;
        });
  };

  window.copyAndConfirmLink = function (iframeId) {
    if (iframeId === 'gdeltMap') {
      if (window.lastMapUrl) {
        window.open(window.lastMapUrl, '_blank', 'noopener');
        return;
      }
      // Fallback if lastMapUrl not set yet
      const queryBox = document.getElementById('gdeltMapQuery');
      if (queryBox && queryBox.value) {
         const timespan = window._gdeltTimespanMap || '1d';
         const url = `https://api.gdeltproject.org/api/v2/geo/geo?query=${encodeURIComponent(queryBox.value)}&mode=PointData&timespan=${timespan}`;
         window.open(url, '_blank', 'noopener');
         return;
      }
    }
    const iframe = document.getElementById(iframeId);
    if (iframe && iframe.src) {
      window.open(iframe.src, '_blank', 'noopener');
    }
  };
}
