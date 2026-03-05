export const storageKeys = {
    boardTheme: "chess.boardTheme",
    pieceTheme: "chess.pieceTheme",
    checkHints: "chess.checkHints",
    legalMoveHints: "chess.legalMoveHints",
};

export const boardThemes = {
    classic: "board-theme-classic",
    forest: "board-theme-forest",
    midnight: "board-theme-midnight",
};

export const pieceThemes = {
    wikipedia: "img/chesspieces/wikipedia/{piece}.png",
    alpha: "img/chesspieces/alpha/320/{piece}.png",
    leipzig: "img/chesspieces/leipzig/320/{piece}.png",
};

export function getElements() {
    return {
        playground: document.querySelector('.main-playground'),
        board: document.querySelector('#board'),
        statusText: document.querySelector('.status-bar-text'),
        statusCheck: document.querySelector('.status-bar-check-notification'),
        whiteName: document.querySelector('.main-playground-white-name'),
        whitePointsValue: document.querySelector('.white-points-value'),
        whiteRating: document.querySelector('.main-playground-white-rating'),
        whiteMoveHistory: document.querySelector('.main-playground-white-move-history'),
        blackPawnsTaken: document.querySelector('.taken-pieces-black-pawn-value'),
        blackKnightsTaken: document.querySelector('.taken-pieces-black-knight-value'),
        blackBishopsTaken: document.querySelector('.taken-pieces-black-bishop-value'),
        blackRooksTaken: document.querySelector('.taken-pieces-black-rook-value'),
        blackQueensTaken: document.querySelector('.taken-pieces-black-queen-value'),
        blackName: document.querySelector('.main-playground-black-name'),
        blackRating: document.querySelector('.main-playground-black-rating'),
        blackPointsValue: document.querySelector('.black-points-value'),
        blackMoveHistory: document.querySelector('.main-playground-black-move-history'),
        whitePawnsTaken: document.querySelector('.taken-pieces-white-pawn-value'),
        whiteKnightsTaken: document.querySelector('.taken-pieces-white-knight-value'),
        whiteBishopsTaken: document.querySelector('.taken-pieces-white-bishop-value'),
        whiteRooksTaken: document.querySelector('.taken-pieces-white-rook-value'),
        whiteQueensTaken: document.querySelector('.taken-pieces-white-queen-value'),
        gameChatWindow: document.querySelector('.game-chat-window'),
        lobbyChatWindow: document.querySelector('.game-lobby-chat-window'),
        rooms: document.querySelector('.game-lobby-room-container'),
        lobbyInputName: document.querySelector('.game-lobby-input-name'),
        lobbyInputCreateBtn: document.querySelector('.game-lobby-input-create-btn'),
        lobbyInputVsBotBtn: document.querySelector('.game-lobby-input-vs-bot-btn'),
        lobbyChatInput: document.querySelector('.game-lobby-chat-input'),
        lobbyChatSendBtn: document.querySelector('.game-lobby-chat-send-btn'),
        gameChatInput: document.querySelector('.game-chat-input'),
        gameChatSendBtn: document.querySelector('.game-chat-send-btn'),
        resignBtn: document.querySelector('.resign-btn'),
        offerDrawBtn: document.querySelector('.offer-draw-btn'),
        threefoldDrawBtn: document.querySelector('.threefold-draw-btn'),
        boardThemeSelect: document.querySelector('#board-theme-select'),
        pieceThemeSelect: document.querySelector('#piece-theme-select'),
        checkHintsToggle: document.querySelector('#check-hints-toggle'),
        legalMovesToggle: document.querySelector('#legal-moves-toggle'),
        lobbyContainer: document.querySelector('.game-lobby'),
        playAgainVsBotBtn: document.querySelector('.game-play-again-btn'),
    };
}

export function createState() {
    return {
        playerId: null,
        playerName: null,
        playerColor: null,
        playerOneName: null,
        playerTwoName: null,
        isBotGame: false,
        botPlayerId: null,
        botPlayerName: null,
        board: null,
        currentFen: 'start',
        isGameStarted: false,
        hasGameEnded: false,
        gameOverCode: null,
        gameOverWinnerName: null,
        connectionState: 'disconnected',
        turnNumber: 1,
        activeMovingPlayerId: null,
        activeMovingPlayerName: null,
        isYourTurn: false,
        isInCheck: false,
        legalMoves: [],
        legalMovesRequestId: 0,
        pendingSyncTimeoutId: null,
        boardInitialized: false,
        selectedBoardTheme: getStoredValue(storageKeys.boardTheme, "classic", boardThemes),
        selectedPieceTheme: getStoredValue(storageKeys.pieceTheme, "wikipedia", pieceThemes),
        hintsEnabled: getStoredBoolean(storageKeys.checkHints, true),
        legalHintsEnabled: getStoredBoolean(storageKeys.legalMoveHints, true),
    };
}

export function getStoredValue(storageKey, fallbackValue, options) {
    try {
        const storedValue = localStorage.getItem(storageKey);
        if (storedValue !== null && Object.prototype.hasOwnProperty.call(options, storedValue)) {
            return storedValue;
        }
    } catch (error) {
        // Ignore storage errors and keep defaults.
    }

    return fallbackValue;
}

export function storeValue(storageKey, value) {
    try {
        localStorage.setItem(storageKey, value);
    } catch (error) {
        // Ignore storage errors and keep in-memory value only.
    }
}

export function getStoredBoolean(storageKey, fallbackValue) {
    try {
        const storedValue = localStorage.getItem(storageKey);
        if (storedValue === null) {
            return fallbackValue;
        }

        return storedValue === "true";
    } catch (error) {
        return fallbackValue;
    }
}

export function storeBoolean(storageKey, value) {
    try {
        localStorage.setItem(storageKey, value ? "true" : "false");
    } catch (error) {
        // Ignore storage errors and keep in-memory value only.
    }
}
