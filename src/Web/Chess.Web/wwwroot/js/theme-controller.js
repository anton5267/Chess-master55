(function () {
    var root = document.documentElement;
    var themeSelect = document.getElementById("site-theme-select");
    var motionSelect = document.getElementById("site-motion-select");

    if (!root) {
        return;
    }

    var storage = {
        mode: "chess.siteThemeMode",
        variant: "chess.siteThemeVariant",
        motion: "chess.siteMotion",
    };

    var supportedVariants = ["light", "dark", "warm-dark", "contrast-light", "contrast-dark"];
    var darkModeQuery = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
    var contrastQuery = window.matchMedia ? window.matchMedia("(prefers-contrast: more)") : null;
    var reducedMotionQuery = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;

    function safeReadStorage(key) {
        try {
            return window.localStorage.getItem(key);
        } catch (error) {
            return null;
        }
    }

    function safeWriteStorage(key, value) {
        try {
            window.localStorage.setItem(key, value);
        } catch (error) {
            // Ignore browser storage access issues.
        }
    }

    function isValidVariant(value) {
        return supportedVariants.indexOf(value) !== -1;
    }

    function normalizeMode(value) {
        return value === "manual" ? "manual" : "auto";
    }

    function normalizeMotion(value) {
        return value === "off" ? "off" : "on";
    }

    function getSystemThemeVariant() {
        var hasSystemSignal = darkModeQuery !== null || contrastQuery !== null;
        if (!hasSystemSignal) {
            return "dark";
        }

        var prefersDark = darkModeQuery ? darkModeQuery.matches : false;
        var prefersContrast = contrastQuery ? contrastQuery.matches : false;

        if (prefersContrast) {
            return prefersDark ? "contrast-dark" : "contrast-light";
        }

        return prefersDark ? "dark" : "light";
    }

    function getStoredState() {
        var mode = normalizeMode(safeReadStorage(storage.mode) || root.getAttribute("data-theme-mode"));
        var variantCandidate = safeReadStorage(storage.variant) || root.getAttribute("data-theme-variant");
        var variant = isValidVariant(variantCandidate) ? variantCandidate : "dark";
        var motion = normalizeMotion(safeReadStorage(storage.motion) || root.getAttribute("data-motion"));

        return {
            mode: mode,
            variant: variant,
            motion: motion,
        };
    }

    function applyReducedMotionState() {
        var prefersReduced = reducedMotionQuery ? reducedMotionQuery.matches : false;
        root.setAttribute("data-reduced-motion", prefersReduced ? "true" : "false");
    }

    function applyTheme(mode, variant, persist) {
        var normalizedMode = normalizeMode(mode);
        var normalizedVariant = isValidVariant(variant) ? variant : "dark";
        var resolvedTheme = normalizedMode === "manual" ? normalizedVariant : getSystemThemeVariant();
        if (!isValidVariant(resolvedTheme)) {
            resolvedTheme = "dark";
        }

        root.setAttribute("data-theme-mode", normalizedMode);
        root.setAttribute("data-theme-variant", normalizedVariant);
        root.setAttribute("data-theme", resolvedTheme);

        if (persist) {
            safeWriteStorage(storage.mode, normalizedMode);
            safeWriteStorage(storage.variant, normalizedVariant);
        }

        if (themeSelect) {
            themeSelect.value = normalizedMode === "auto" ? "auto" : normalizedVariant;
        }
    }

    function applyMotion(value, persist) {
        var normalizedMotion = normalizeMotion(value);
        root.setAttribute("data-motion", normalizedMotion);

        if (persist) {
            safeWriteStorage(storage.motion, normalizedMotion);
        }

        if (motionSelect) {
            motionSelect.value = normalizedMotion;
        }
    }

    function onThemeSelectionChange() {
        if (!themeSelect) {
            return;
        }

        var selectedValue = themeSelect.value;
        if (selectedValue === "auto") {
            var fallbackVariant = root.getAttribute("data-theme-variant");
            applyTheme("auto", isValidVariant(fallbackVariant) ? fallbackVariant : "dark", true);
            return;
        }

        applyTheme("manual", selectedValue, true);
    }

    function onSystemThemeSignalChanged() {
        if (normalizeMode(root.getAttribute("data-theme-mode")) !== "auto") {
            return;
        }

        var currentVariant = root.getAttribute("data-theme-variant");
        applyTheme("auto", isValidVariant(currentVariant) ? currentVariant : "dark", false);
    }

    function bindSystemListeners() {
        if (darkModeQuery) {
            darkModeQuery.addEventListener("change", onSystemThemeSignalChanged);
        }

        if (contrastQuery) {
            contrastQuery.addEventListener("change", onSystemThemeSignalChanged);
        }

        if (reducedMotionQuery) {
            reducedMotionQuery.addEventListener("change", applyReducedMotionState);
        }
    }

    var initialState = getStoredState();
    applyTheme(initialState.mode, initialState.variant, true);
    applyMotion(initialState.motion, true);
    applyReducedMotionState();
    bindSystemListeners();

    if (themeSelect) {
        themeSelect.addEventListener("change", onThemeSelectionChange);
    }

    if (motionSelect) {
        motionSelect.addEventListener("change", function () {
            applyMotion(motionSelect.value, true);
        });
    }

    window.chessThemeController = {
        setThemeAuto: function () {
            var currentVariant = root.getAttribute("data-theme-variant");
            applyTheme("auto", currentVariant, true);
        },
        setThemeVariant: function (variant) {
            applyTheme("manual", variant, true);
        },
        setMotion: function (value) {
            applyMotion(value, true);
        },
        getState: function () {
            return {
                mode: root.getAttribute("data-theme-mode"),
                variant: root.getAttribute("data-theme-variant"),
                resolvedTheme: root.getAttribute("data-theme"),
                motion: root.getAttribute("data-motion"),
                reducedMotion: root.getAttribute("data-reduced-motion") === "true",
            };
        },
    };
})();
