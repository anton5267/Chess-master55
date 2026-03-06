import {
    ensureBoardInitialized,
    rebuildBoard,
    createOnDragStartHandler,
    createOnDropHandler,
    applyBoardTheme,
    clearHintSquares,
    safeResizeBoard,
} from './board.js';
import { bindChatHandlers, bindGameOptionHandlers } from './chat.js';
import { createConnection, registerConnectionHandlers } from './connection.js';
import { bindLobbyHandlers } from './lobby.js';
import {
    botDifficulties,
    boardThemes,
    createState,
    getElements,
    pieceThemes,
    storageKeys,
    storeBoolean,
    storeValue,
} from './state.js';
import {
    purgeLegacyReplayUi,
    updateBotDifficultyBadge,
    updateReplayControls,
} from './ui.js';

function syncTakenPiecesTheme(state) {
    const themeTemplate = pieceThemes[state.selectedPieceTheme] || pieceThemes.wikipedia;
    const pieceImages = document.querySelectorAll('.taken-piece-image[data-piece-code]');

    pieceImages.forEach((image) => {
        const pieceCode = image.dataset.pieceCode;
        if (!pieceCode) {
            return;
        }

        image.src = themeTemplate.replace('{piece}', pieceCode);
    });
}

function bindMobileTabs(elements, state) {
    if (!elements.mobileTabs || !Array.isArray(elements.mobileTabButtons) || elements.mobileTabButtons.length === 0) {
        return;
    }

    const mobileQuery = window.matchMedia('(max-width: 992px)');
    const applyPanel = (panel) => {
        const normalizedPanel = panel === 'history' || panel === 'chat'
            ? panel
            : 'board';
        state.mobilePanel = normalizedPanel;
        elements.playground.dataset.mobilePanel = normalizedPanel;
        elements.mobileTabButtons.forEach((button) => {
            const isActive = button.dataset.mobilePanel === normalizedPanel;
            button.classList.toggle('is-active', isActive);
            button.setAttribute('aria-selected', isActive ? 'true' : 'false');
            button.tabIndex = isActive ? 0 : -1;
        });
    };

    const applyResponsiveState = () => {
        if (mobileQuery.matches) {
            elements.mobileTabs.classList.add('is-visible');
            applyPanel(state.mobilePanel || 'board');
            safeResizeBoard(state);
            return;
        }

        elements.mobileTabs.classList.remove('is-visible');
        elements.playground.removeAttribute('data-mobile-panel');
        elements.mobileTabButtons.forEach((button) => {
            button.classList.remove('is-active');
            button.setAttribute('aria-selected', 'false');
            button.tabIndex = -1;
        });
        safeResizeBoard(state);
    };

    elements.mobileTabButtons.forEach((button) => {
        button.addEventListener('click', () => {
            applyPanel(button.dataset.mobilePanel);
        });

        button.addEventListener('keydown', (event) => {
            if (!mobileQuery.matches) {
                return;
            }

            const buttonIndex = elements.mobileTabButtons.indexOf(button);
            if (buttonIndex < 0) {
                return;
            }

            const maxIndex = elements.mobileTabButtons.length - 1;
            let nextIndex = buttonIndex;
            switch (event.key) {
                case 'ArrowRight':
                    nextIndex = buttonIndex >= maxIndex ? 0 : buttonIndex + 1;
                    break;
                case 'ArrowLeft':
                    nextIndex = buttonIndex <= 0 ? maxIndex : buttonIndex - 1;
                    break;
                case 'Home':
                    nextIndex = 0;
                    break;
                case 'End':
                    nextIndex = maxIndex;
                    break;
                default:
                    return;
            }

            event.preventDefault();
            const nextButton = elements.mobileTabButtons[nextIndex];
            nextButton.focus();
            applyPanel(nextButton.dataset.mobilePanel);
        });
    });

    window.addEventListener('resize', applyResponsiveState);
    applyResponsiveState();
}

$(function bootstrapGameLobby() {
    const connection = createConnection();
    const elements = getElements();
    const state = createState();

    purgeLegacyReplayUi();

    registerConnectionHandlers(connection, elements, state);

    const onDrop = createOnDropHandler(state, connection);
    const onDragStart = createOnDragStartHandler(state);

    elements.boardThemeSelect.value = state.selectedBoardTheme;
    elements.pieceThemeSelect.value = state.selectedPieceTheme;
    if (elements.botDifficultySelect) {
        elements.botDifficultySelect.value = state.botDifficulty;
    }

    if (elements.checkHintsToggle) {
        elements.checkHintsToggle.checked = state.hintsEnabled;
    }

    if (elements.legalMovesToggle) {
        elements.legalMovesToggle.checked = state.legalHintsEnabled;
    }

    elements.boardThemeSelect.addEventListener('change', function onBoardThemeChange(e) {
        state.selectedBoardTheme = e.target.value;
        applyBoardTheme(elements, boardThemes, state.selectedBoardTheme);
        storeValue(storageKeys.boardTheme, state.selectedBoardTheme);
        safeResizeBoard(state);
    });

    elements.pieceThemeSelect.addEventListener('change', function onPieceThemeChange(e) {
        state.selectedPieceTheme = e.target.value;
        storeValue(storageKeys.pieceTheme, state.selectedPieceTheme);
        syncTakenPiecesTheme(state);
        rebuildBoard(state, pieceThemes, onDrop, onDragStart);
        safeResizeBoard(state);
    });

    if (elements.botDifficultySelect) {
        elements.botDifficultySelect.addEventListener('change', function onBotDifficultyChange(e) {
            const selectedDifficulty = e.target.value;
            if (!Object.prototype.hasOwnProperty.call(botDifficulties, selectedDifficulty)) {
                return;
            }

            state.botDifficulty = selectedDifficulty;
            storeValue(storageKeys.botDifficulty, state.botDifficulty);
            updateBotDifficultyBadge(elements, state);
        });
    }

    if (elements.checkHintsToggle) {
        elements.checkHintsToggle.addEventListener('change', function onCheckHintsChange(e) {
            state.hintsEnabled = !!e.target.checked;
            storeBoolean(storageKeys.checkHints, state.hintsEnabled);
        });
    }

    if (elements.legalMovesToggle) {
        elements.legalMovesToggle.addEventListener('change', function onLegalHintsChange(e) {
            state.legalHintsEnabled = !!e.target.checked;
            storeBoolean(storageKeys.legalMoveHints, state.legalHintsEnabled);
            if (!state.legalHintsEnabled) {
                clearHintSquares();
            }
        });
    }

    applyBoardTheme(elements, boardThemes, state.selectedBoardTheme);
    syncTakenPiecesTheme(state);
    ensureBoardInitialized(state, pieceThemes, onDrop, onDragStart);
    safeResizeBoard(state);
    updateBotDifficultyBadge(elements, state);
    updateReplayControls(elements, state);
    bindMobileTabs(elements, state);

    // Defensively clean up legacy replay controls that may be injected late by cached scripts.
    [150, 450, 1000].forEach((delayMs) => {
        setTimeout(() => purgeLegacyReplayUi(), delayMs);
    });
    let replayWatchdogTicks = 0;
    const replayWatchdog = setInterval(() => {
        replayWatchdogTicks += 1;
        purgeLegacyReplayUi();

        if (replayWatchdogTicks >= 20) {
            clearInterval(replayWatchdog);
        }
    }, 1500);

    bindLobbyHandlers(connection, elements, state);
    bindChatHandlers(connection, elements);
    bindGameOptionHandlers(connection, elements, state);

    state.connectionState = 'connecting';
    connection.start()
        .then(() => {
            state.connectionState = 'connected';
        })
        .catch((err) => {
            state.connectionState = 'failed';
            console.error(err);
        });

    window.addEventListener('resize', () => safeResizeBoard(state));
});
