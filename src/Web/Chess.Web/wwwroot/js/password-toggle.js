(function () {
    const togglePositionCallbacks = new Set();
    let globalPositionListenerBound = false;

    function bindGlobalPositionListener() {
        if (globalPositionListenerBound) {
            return;
        }

        globalPositionListenerBound = true;

        const refreshAllToggles = () => {
            togglePositionCallbacks.forEach((callback) => callback());
        };

        window.addEventListener('resize', refreshAllToggles);
        window.addEventListener('orientationchange', refreshAllToggles);
    }

    function getText(key, fallback) {
        if (document.body && document.body.dataset && document.body.dataset[key]) {
            return document.body.dataset[key];
        }

        return fallback;
    }

    function bindTogglePositionSync(input, button, wrapper) {
        if (!input || !button || !wrapper) {
            return;
        }

        const syncPosition = () => {
            const inputTop = input.offsetTop || 0;
            const inputHeight = input.offsetHeight || 0;
            button.style.top = `${inputTop + (inputHeight / 2)}px`;
        };

        togglePositionCallbacks.add(syncPosition);
        bindGlobalPositionListener();

        syncPosition();
        requestAnimationFrame(syncPosition);
        setTimeout(syncPosition, 0);
        setTimeout(syncPosition, 150);

        input.addEventListener('focus', syncPosition);
        input.addEventListener('input', syncPosition);
        input.addEventListener('blur', syncPosition);
    }

    function initializePasswordToggles() {
        const showText = getText('showPasswordText', 'Show password');
        const hideText = getText('hidePasswordText', 'Hide password');

        const passwordInputs = Array.from(document.querySelectorAll('input[type="password"]'));
        passwordInputs.forEach((input) => {
            if (input.dataset.passwordToggleBound === 'true') {
                return;
            }

            input.dataset.passwordToggleBound = 'true';
            input.classList.add('password-toggle-input');

            const wrapper = input.closest('.form-floating') || input.parentElement;
            if (!wrapper) {
                return;
            }

            wrapper.classList.add('password-toggle-wrapper');

            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'password-toggle-btn';
            button.setAttribute('aria-label', showText);
            button.setAttribute('aria-pressed', 'false');
            button.setAttribute('title', showText);

            const icon = document.createElement('span');
            icon.className = 'fas fa-eye';
            icon.setAttribute('aria-hidden', 'true');
            button.appendChild(icon);

            button.addEventListener('click', () => {
                const shouldShow = input.type === 'password';
                input.type = shouldShow ? 'text' : 'password';
                icon.className = shouldShow ? 'fas fa-eye-slash' : 'fas fa-eye';
                button.setAttribute('aria-label', shouldShow ? hideText : showText);
                button.setAttribute('title', shouldShow ? hideText : showText);
                button.setAttribute('aria-pressed', shouldShow ? 'true' : 'false');
            });

            wrapper.appendChild(button);
            bindTogglePositionSync(input, button, wrapper);
        });

        const forms = Array.from(document.querySelectorAll('form'));
        forms.forEach((form) => {
            form.addEventListener('submit', () => {
                const visibleInputs = form.querySelectorAll('input[data-password-toggle-bound="true"][type="text"]');
                visibleInputs.forEach((input) => {
                    input.type = 'password';
                });
            });
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializePasswordToggles);
    } else {
        initializePasswordToggles();
    }
})();
