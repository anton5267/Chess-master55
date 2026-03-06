(function () {
    const toggleBindings = [];
    let resizeBound = false;

    function getText(key, fallback) {
        if (document.body && document.body.dataset && document.body.dataset[key]) {
            return document.body.dataset[key];
        }

        return fallback;
    }

    function syncTogglePosition(binding) {
        if (!binding || !binding.input || !binding.button) {
            return;
        }

        const inputTop = Number.isFinite(binding.input.offsetTop) ? binding.input.offsetTop : 0;
        const inputHeight = Number.isFinite(binding.input.offsetHeight) ? binding.input.offsetHeight : 0;
        if (inputHeight <= 0) {
            return;
        }

        binding.button.style.top = `${inputTop + (inputHeight / 2)}px`;
    }

    function syncAllTogglePositions() {
        toggleBindings.forEach(syncTogglePosition);
    }

    function ensureResizeBinding() {
        if (resizeBound) {
            return;
        }

        resizeBound = true;
        window.addEventListener('resize', syncAllTogglePositions);
        window.addEventListener('orientationchange', syncAllTogglePositions);
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

            const binding = { input, button };
            toggleBindings.push(binding);
            syncTogglePosition(binding);
            requestAnimationFrame(() => syncTogglePosition(binding));
        });

        ensureResizeBinding();
        requestAnimationFrame(syncAllTogglePositions);

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
