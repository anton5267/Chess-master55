import { createOrRebuildBoard, createOnDropHandler, applyBoardTheme } from './board.js';
import { bindChatHandlers, bindGameOptionHandlers } from './chat.js';
import { createConnection, registerConnectionHandlers } from './connection.js';
import { bindLobbyHandlers } from './lobby.js';
import { boardThemes, createState, getElements, pieceThemes, storageKeys, storeValue } from './state.js';

$(function bootstrapGameLobby() {
    const connection = createConnection();
    const elements = getElements();
    const state = createState();

    registerConnectionHandlers(connection, elements, state);

    const onDrop = createOnDropHandler(state, connection);

    elements.boardThemeSelect.value = state.selectedBoardTheme;
    elements.pieceThemeSelect.value = state.selectedPieceTheme;

    elements.boardThemeSelect.addEventListener('change', function onBoardThemeChange(e) {
        state.selectedBoardTheme = e.target.value;
        applyBoardTheme(elements, boardThemes, state.selectedBoardTheme);
        storeValue(storageKeys.boardTheme, state.selectedBoardTheme);
    });

    elements.pieceThemeSelect.addEventListener('change', function onPieceThemeChange(e) {
        state.selectedPieceTheme = e.target.value;
        storeValue(storageKeys.pieceTheme, state.selectedPieceTheme);
        createOrRebuildBoard(state, pieceThemes, onDrop);
    });

    applyBoardTheme(elements, boardThemes, state.selectedBoardTheme);
    createOrRebuildBoard(state, pieceThemes, onDrop);

    bindLobbyHandlers(connection, elements, state);
    bindChatHandlers(connection, elements);
    bindGameOptionHandlers(connection, elements);

    connection.start();
});
