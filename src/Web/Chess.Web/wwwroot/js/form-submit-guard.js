(function initFormSubmitGuard() {
    if (window.__chessFormSubmitGuardInitialized) {
        return;
    }

    window.__chessFormSubmitGuardInitialized = true;

    function setBusyState(form, submitter) {
        if (!submitter) {
            return;
        }

        submitter.dataset.submitGuardOriginalHtml = submitter.innerHTML;
        submitter.classList.add("is-submitting");
        submitter.setAttribute("aria-busy", "true");
        submitter.disabled = true;
        if (!submitter.classList.contains("btn-link")) {
            submitter.innerHTML = "<span class=\"submit-guard-spinner\" aria-hidden=\"true\"></span><span class=\"submit-guard-text\">" + (submitter.textContent || "").trim() + "</span>";
        }
        form.dataset.submitGuardBusy = "true";
    }

    function releaseBusyState(form, submitter) {
        if (!submitter) {
            return;
        }

        const originalHtml = submitter.dataset.submitGuardOriginalHtml;
        if (originalHtml) {
            submitter.innerHTML = originalHtml;
        }

        delete submitter.dataset.submitGuardOriginalHtml;
        submitter.classList.remove("is-submitting");
        submitter.removeAttribute("aria-busy");
        submitter.disabled = false;
        delete form.dataset.submitGuardBusy;
    }

    const guardedForms = document.querySelectorAll("form[method='post']:not([data-no-submit-guard='true'])");
    guardedForms.forEach((form) => {
        form.addEventListener("submit", (event) => {
            if (form.dataset.submitGuardBusy === "true") {
                event.preventDefault();
                return;
            }

            const submitter = event.submitter || form.querySelector("button[type='submit'], input[type='submit']");
            if (!submitter) {
                return;
            }

            setBusyState(form, submitter);
        });

        const resetButtons = form.querySelectorAll("button[type='reset']");
        resetButtons.forEach((button) => {
            button.addEventListener("click", () => {
                const submitter = form.querySelector(".is-submitting");
                if (submitter) {
                    releaseBusyState(form, submitter);
                }
            });
        });
    });
}());
