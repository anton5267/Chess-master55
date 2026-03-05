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
    boardThemes,
    createState,
    getElements,
    pieceThemes,
    storageKeys,
    storeBoolean,
    storeValue,
} from './state.js';

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

$(function bootstrapGameLobby() {
    const connection = createConnection();
    const elements = getElements();
    const state = createState();

    registerConnectionHandlers(connection, elements, state);

    const onDrop = createOnDropHandler(state, connection);
    const onDragStart = createOnDragStartHandler(state);

    elements.boardThemeSelect.value = state.selectedBoardTheme;
    elements.pieceThemeSelect.value = state.selectedPieceTheme;
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

    bindLobbyHandlers(connection, elements, state);
    bindChatHandlers(connection, elements);
    bindGameOptionHandlers(connection, elements);

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
