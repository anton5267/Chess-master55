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
import { updateReplayControls } from './ui.js';

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
            button.classList.toggle('is-active', button.dataset.mobilePanel === normalizedPanel);
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
        elements.mobileTabButtons.forEach((button) => button.classList.remove('is-active'));
        safeResizeBoard(state);
    };

    elements.mobileTabButtons.forEach((button) => {
        button.addEventListener('click', () => {
            applyPanel(button.dataset.mobilePanel);
        });
    });

    window.addEventListener('resize', applyResponsiveState);
    applyResponsiveState();
}

$(function bootstrapGameLobby() {
    const connection = createConnection();
    const elements = getElements();
    const state = createState();

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
    updateReplayControls(elements, state);
    bindMobileTabs(elements, state);

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
