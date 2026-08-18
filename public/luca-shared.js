  /* BACKEND URL - a real hoisted function declaration (not an assignment
     buried inside the settings IIFE) so it's callable from anywhere in this
     script regardless of source order. Reads straight from localStorage
     instead of depending on the settings module having run first. */
  function getBackendUrl() {
    try {
      var raw = localStorage.getItem('luca-settings');
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && parsed.backendUrl) {
          return String(parsed.backendUrl).replace(/\/+$/, '');
        }
      }
    } catch (e) {}
    return 'http://localhost:3000';
  }

  /* ICON RENDER GUARD - wraps lucide.createIcons so a slow CDN does not abort the rest of this script. */
  function safeCreateIcons() {
    try {
      if (typeof lucide !== 'undefined') {
        lucide.createIcons();
        return;
      }
    } catch (e) {
      console.warn('Icon render failed:', e);
    }
    window.addEventListener('load', function retry() {
      try { if (typeof lucide !== 'undefined') lucide.createIcons(); } catch (e) {}
    }, { once: true });
  }
