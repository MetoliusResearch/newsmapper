export function setupPopups() {
  function setupInfoPopup(btnId, popupId, overlayId, closeId) {
    const btn = document.getElementById(btnId);
    const popup = document.getElementById(popupId);
    const overlay = document.getElementById(overlayId);
    const close = document.getElementById(closeId);
    if (btn && popup && overlay && close) {
      btn.addEventListener('click', function () {
        overlay.style.display = 'block';
        popup.style.display = 'block';
      });
      close.addEventListener('click', function () {
        overlay.style.display = 'none';
        popup.style.display = 'none';
      });
      overlay.addEventListener('click', function () {
        overlay.style.display = 'none';
        popup.style.display = 'none';
      });
    }
  }
  setupInfoPopup('headerInfoBtn', 'headerInfoPopup', 'headerInfoOverlay', 'headerInfoClose');
  setupInfoPopup('queryInfoBtn', 'queryInfoPopup', 'queryInfoOverlay', 'queryInfoClose');
  setupInfoPopup('mapInfoBtn', 'mapInfoPopup', 'mapInfoOverlay', 'mapInfoClose');
  setupInfoPopup(
    'headlinesInfoBtn',
    'headlinesInfoPopup',
    'headlinesInfoOverlay',
    'headlinesInfoClose'
  );
  setupInfoPopup(
    'sentimentInfoBtn',
    'sentimentInfoPopup',
    'sentimentInfoOverlay',
    'sentimentInfoClose'
  );
}
