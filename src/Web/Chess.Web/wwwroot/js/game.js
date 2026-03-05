(function legacyGameScriptBridge() {
    // Compatibility bridge for legacy references to /js/game.js.
    // The canonical client code lives in /js/game.bundle(.min).js (esbuild pipeline).
    if (window.__chessLegacyGameBridgeLoaded) {
        return;
    }

    window.__chessLegacyGameBridgeLoaded = true;

    const hasModernBundleReference = document.querySelector('script[src*="/js/game.bundle.js"], script[src*="/js/game.bundle.min.js"]');
    if (hasModernBundleReference) {
        return;
    }

    const script = document.createElement('script');
    script.src = '/js/game.bundle.js';
    script.defer = true;
    document.head.appendChild(script);
})();
