import { t } from './i18n.js';
import { clearHintSquares } from './board.js';

export function sleep(time) {
    return new Promise((resolve) => setTimeout(resolve, time));
}

function normalizeErrorMessage(error) {
    const fallback = 'Request failed. Please try again.';

    if (error == null) {
        return fallback;
    }

    const rawMessage = typeof error === 'string'
        ? error
        : (error.message || String(error));

    const normalized = rawMessage
        .replace(/^HubException:\s*/i, '')
        .trim();

    return normalized || fallback;
}

const connectionToneClasses = ['is-reconnecting', 'is-syncing', 'is-disconnected', 'is-offline'];

export function createRoomElement(player) {
    const div = document.createElement('div');
    const span = document.createElement('span');
    const button = document.createElement('button');

    span.innerText = t('roomSuffix', { name: player.name.toUpperCase() });
    span.classList.add('game-lobby-room-name');

    button.innerText = t('join');
    button.classList.add('game-lobby-room-join-btn', 'game-btn', 'btn');

    div.append(span, button);
    div.classList.add('game-lobby-room-item');
    div.dataset.roomId = player.id;

    return div;
}

function createNoRoomsElement() {
    const div = document.createElement('div');
    div.classList.add('game-lobby-room-empty');
    div.textContent = t('noRoomsAvailable');
    return div;
}

export function renderRooms(container, waitingPlayers, shouldDisableJoin = false) {
    container.innerHTML = '';

    const rooms = Array.isArray(waitingPlayers) ? waitingPlayers : [];
    const roomCount = document.querySelector('.game-lobby-room-count');
    if (roomCount) {
        roomCount.textContent = String(rooms.length);
    }

    if (rooms.length === 0) {
        container.appendChild(createNoRoomsElement());
        return;
    }

    rooms.forEach((player) => {
        const roomElement = createRoomElement(player);
        const joinButton = roomElement.querySelector('.game-lobby-room-join-btn');
        if (joinButton) {
            joinButton.disabled = !!shouldDisableJoin;
            joinButton.classList.toggle('is-disabled', !!shouldDisableJoin);
            joinButton.classList.toggle('is-loading', false);
        }

        container.appendChild(roomElement);
    });
}

export function updateStatus(elements, state, movingPlayerId, movingPlayerName) {
    if (state.hasGameEnded) {
        return;
    }

    if (movingPlayerId) {
        state.activeMovingPlayerId = movingPlayerId;
    }

    if (movingPlayerName) {
        state.activeMovingPlayerName = movingPlayerName;
    }

    if (state.activeMovingPlayerId) {
        state.isYourTurn = state.activeMovingPlayerId === state.playerId;
    } else {
        state.isYourTurn = state.activeMovingPlayerName === state.playerName;
    }

    const activeMovingPlayerName = state.activeMovingPlayerName;

    if (!activeMovingPlayerName) {
        elements.statusText.innerText = '';
        elements.statusText.style.color = 'inherit';
        return;
    }

    if (state.isYourTurn) {
        elements.statusText.innerText = t('yourTurn');
        elements.statusText.style.color = 'green';
    } else if (state.isBotGame && state.botPlayerName && activeMovingPlayerName === state.botPlayerName) {
        elements.statusText.innerText = t('botThinking');
        elements.statusText.style.color = '#b36b00';
    } else {
        elements.statusText.innerText = t('playerTurnFormat', { name: activeMovingPlayerName });
        elements.statusText.style.color = 'red';
    }
}

export function updateChat(elements, message, chat, isInternalMessage, isBlack) {
    const li = document.createElement('li');
    li.innerText = `${message}`;

    if (isInternalMessage) {
        li.classList.add('chat-internal-msg', 'chat-msg', 'flex-start');
    } else if (isBlack) {
        li.classList.add('black-chat-msg', 'chat-user-msg', 'chat-msg', 'flex-end');
    } else {
        li.classList.add('white-chat-msg', 'chat-user-msg', 'chat-msg', 'flex-start');
    }

    chat.appendChild(li);
    chat.scrollTop = chat.scrollHeight;
}

export function removeHighlight(color) {
    const highlightedSquares = document.querySelectorAll(`.highlight-${color}`);
    for (let i = 0; i < highlightedSquares.length; i++) {
        highlightedSquares[i].classList.remove(`highlight-${color}`);
    }
}

export function setPlayAgainVsBotVisibility(elements, isVisible) {
    if (!elements.playAgainVsBotBtn) {
        return;
    }

    elements.playAgainVsBotBtn.style.display = isVisible ? 'inline-flex' : 'none';
}

export function setConnectionStatus(elements, tone, message) {
    if (!elements.connectionPill) {
        return;
    }

    const normalizedTone = tone === 'reconnecting'
        || tone === 'syncing'
        || tone === 'disconnected'
        || tone === 'offline'
        ? tone
        : null;
    const text = (message || '').trim();

    elements.connectionPill.classList.remove(...connectionToneClasses);
    if (!normalizedTone || text === '') {
        elements.connectionPill.hidden = true;
        elements.connectionPill.textContent = '';
        return;
    }

    elements.connectionPill.hidden = false;
    elements.connectionPill.classList.add(`is-${normalizedTone}`);
    elements.connectionPill.textContent = text;
}

function resolveBotDifficultyLabel(elements, state) {
    if (!elements.botDifficultySelect) {
        return state.botDifficulty === 'easy' ? 'Easy' : 'Normal';
    }

    const selectedOption = Array.from(elements.botDifficultySelect.options)
        .find((option) => option.value === state.botDifficulty);
    if (selectedOption) {
        return selectedOption.textContent || selectedOption.innerText || selectedOption.value;
    }

    return state.botDifficulty === 'easy' ? 'Easy' : 'Normal';
}

export function updateBotDifficultyBadge(elements, state) {
    if (!elements.botDifficultyMeta || !elements.botDifficultyMetaValue) {
        return;
    }

    const shouldShow = !!state.isBotGame && (!!state.isGameStarted || !!state.hasGameEnded);
    elements.botDifficultyMeta.hidden = !shouldShow;
    if (!shouldShow) {
        return;
    }

    elements.botDifficultyMetaValue.textContent = resolveBotDifficultyLabel(elements, state);
}

export function updateReplayControls(elements, state) {
    const hasTimeline = Array.isArray(state.fenTimeline) && state.fenTimeline.length > 0;
    const maxIndex = hasTimeline ? state.fenTimeline.length - 1 : 0;
    const currentIndex = Math.max(0, Math.min(state.replayIndex || 0, maxIndex));
    const hasPastMoves = maxIndex > 0;
    const isReplayMode = !!state.isReplayMode;
    const activeIndex = isReplayMode ? currentIndex : maxIndex;
    const replayAllowed = !!state.isBotGame;

    if (!replayAllowed && state.isReplayMode) {
        state.isReplayMode = false;
        state.replayIndex = maxIndex;
    }

    if (elements.replayStartBtn) {
        elements.replayStartBtn.hidden = !replayAllowed;
        elements.replayStartBtn.disabled = !replayAllowed || !hasPastMoves;
    }

    if (elements.replayPrevBtn) {
        elements.replayPrevBtn.hidden = !replayAllowed;
        elements.replayPrevBtn.disabled = !replayAllowed || !hasPastMoves || activeIndex <= 0;
    }

    if (elements.replayNextBtn) {
        elements.replayNextBtn.hidden = !replayAllowed;
        elements.replayNextBtn.disabled = !replayAllowed || !hasPastMoves || activeIndex >= maxIndex;
    }

    if (elements.replayLiveBtn) {
        elements.replayLiveBtn.hidden = !replayAllowed;
        elements.replayLiveBtn.disabled = !replayAllowed || !isReplayMode;
    }

    if (elements.replayHotkeys) {
        elements.replayHotkeys.hidden = !replayAllowed;
    }

    if (elements.exportPgnBtn) {
        elements.exportPgnBtn.disabled = !state.whiteMoves?.length && !state.blackMoves?.length;
    }

    const shouldLockInteractiveActions = !!state.isReplayMode || !!state.hasGameEnded || !state.isGameStarted;
    const actionBusy = !!state.gameActionInFlight;

    if (elements.offerDrawBtn) {
        elements.offerDrawBtn.disabled = shouldLockInteractiveActions || actionBusy;
    }

    if (elements.resignBtn) {
        elements.resignBtn.disabled = shouldLockInteractiveActions || actionBusy;
    }

    if (elements.threefoldDrawBtn && (shouldLockInteractiveActions || actionBusy)) {
        // Threefold availability is server-driven. Keep it disabled when replay/terminal/busy.
        elements.threefoldDrawBtn.disabled = true;
    }

    if (elements.playAgainVsBotBtn) {
        const canReplayBotGame = state.isBotGame && state.hasGameEnded && !state.isReplayMode && !actionBusy;
        elements.playAgainVsBotBtn.disabled = !canReplayBotGame;
    }

    if (!elements.replayIndicator) {
        return;
    }

    elements.replayIndicator.hidden = !replayAllowed;
    if (!replayAllowed) {
        return;
    }

    if (!hasPastMoves) {
        elements.replayIndicator.textContent = t('replayLive');
        return;
    }

    if (isReplayMode) {
        elements.replayIndicator.textContent = t('replayModeFormat', {
            current: String(currentIndex),
            total: String(maxIndex),
        });
        return;
    }

    elements.replayIndicator.textContent = t('replayLive');
}

const gameResultTones = new Set(['win', 'loss', 'draw']);
const gameResultToneClasses = ['game-result-win', 'game-result-loss', 'game-result-draw'];

export function clearGameResultBanner(elements) {
    if (!elements.gameResultBanner) {
        return;
    }

    elements.gameResultBanner.textContent = '';
    elements.gameResultBanner.classList.add('game-result-hidden');
    elements.gameResultBanner.classList.remove('is-terminal');
    elements.gameResultBanner.classList.remove(...gameResultToneClasses);
}

export function setGameResultBanner(elements, message, tone = 'draw') {
    if (!elements.gameResultBanner) {
        return;
    }

    const normalizedTone = gameResultTones.has(tone) ? tone : 'draw';

    elements.gameResultBanner.textContent = message || '';
    elements.gameResultBanner.classList.remove(...gameResultToneClasses);
    elements.gameResultBanner.classList.add(`game-result-${normalizedTone}`);
    elements.gameResultBanner.classList.add('is-terminal');
    elements.gameResultBanner.classList.remove('game-result-hidden');
}

export function resetGameUi(elements, state) {
    elements.statusCheck.style.display = 'none';
    elements.statusCheck.textContent = '';
    clearGameResultBanner(elements);
    setConnectionStatus(elements, null, '');

    elements.whitePointsValue.innerText = '0';
    elements.blackPointsValue.innerText = '0';

    elements.blackPawnsTaken.innerText = '0';
    elements.blackKnightsTaken.innerText = '0';
    elements.blackBishopsTaken.innerText = '0';
    elements.blackRooksTaken.innerText = '0';
    elements.blackQueensTaken.innerText = '0';

    elements.whitePawnsTaken.innerText = '0';
    elements.whiteKnightsTaken.innerText = '0';
    elements.whiteBishopsTaken.innerText = '0';
    elements.whiteRooksTaken.innerText = '0';
    elements.whiteQueensTaken.innerText = '0';

    elements.whiteMoveHistory.innerHTML = '';
    elements.blackMoveHistory.innerHTML = '';
    elements.gameChatWindow.innerHTML = '';

    removeHighlight('white');
    removeHighlight('black');
    clearHintSquares();

    state.isGameStarted = false;
    state.hasGameEnded = false;
    state.gameOverCode = null;
    state.gameOverWinnerName = null;
    state.currentFen = 'start';
    state.liveFen = 'start';
    state.displayFen = 'start';
    state.turnNumber = 1;
    state.activeMovingPlayerId = null;
    state.activeMovingPlayerName = null;
    state.isYourTurn = false;
    state.isInCheck = false;
    state.isBotGame = false;
    state.botPlayerId = null;
    state.botPlayerName = null;
    state.legalMoves = [];
    state.legalMovesRequestId += 1;
    state.syncRequestInFlight = false;
    state.syncRetryAttempt = 0;
    state.lobbyNameValid = false;
    state.lobbyActionInFlight = false;
    state.gameActionInFlight = false;
    state.isReplayMode = false;
    state.replayIndex = 0;
    state.fenTimeline = ['start'];
    state.whiteMoves = [];
    state.blackMoves = [];
    state.mobilePanel = 'board';

    if (state.pendingSyncTimeoutId) {
        clearTimeout(state.pendingSyncTimeoutId);
        state.pendingSyncTimeoutId = null;
    }
    if (state.pendingSyncRetryTimeoutId) {
        clearTimeout(state.pendingSyncRetryTimeoutId);
        state.pendingSyncRetryTimeoutId = null;
    }
    if (state.pendingBotRecoveryTimeoutId) {
        clearTimeout(state.pendingBotRecoveryTimeoutId);
        state.pendingBotRecoveryTimeoutId = null;
    }
    if (state.pendingHighlightTimeoutId) {
        clearTimeout(state.pendingHighlightTimeoutId);
        state.pendingHighlightTimeoutId = null;
    }

    if (state.board) {
        state.board.orientation('white');
        state.board.position('start', false);
    }

    setPlayAgainVsBotVisibility(elements, false);
    updateBotDifficultyBadge(elements, state);
    updateReplayControls(elements, state);
}

function getTakenValue(takenFigures, key) {
    if (!takenFigures || typeof takenFigures !== 'object') {
        return '0';
    }

    if (Object.prototype.hasOwnProperty.call(takenFigures, key)) {
        return String(takenFigures[key] ?? 0);
    }

    return '0';
}

export function applyGameStats(elements, game) {
    if (!game || !game.player1 || !game.player2) {
        return;
    }

    elements.whitePointsValue.innerText = String(game.player1.points ?? 0);
    elements.blackPointsValue.innerText = String(game.player2.points ?? 0);

    elements.blackPawnsTaken.innerText = getTakenValue(game.player1.takenFigures, 'Pawn');
    elements.blackKnightsTaken.innerText = getTakenValue(game.player1.takenFigures, 'Knight');
    elements.blackBishopsTaken.innerText = getTakenValue(game.player1.takenFigures, 'Bishop');
    elements.blackRooksTaken.innerText = getTakenValue(game.player1.takenFigures, 'Rook');
    elements.blackQueensTaken.innerText = getTakenValue(game.player1.takenFigures, 'Queen');

    elements.whitePawnsTaken.innerText = getTakenValue(game.player2.takenFigures, 'Pawn');
    elements.whiteKnightsTaken.innerText = getTakenValue(game.player2.takenFigures, 'Knight');
    elements.whiteBishopsTaken.innerText = getTakenValue(game.player2.takenFigures, 'Bishop');
    elements.whiteRooksTaken.innerText = getTakenValue(game.player2.takenFigures, 'Rook');
    elements.whiteQueensTaken.innerText = getTakenValue(game.player2.takenFigures, 'Queen');
}

export function showWaitingForOpponent(elements, state, player) {
    resetGameUi(elements, state);

    state.playerId = player.id;
    state.playerColor = 0;
    state.playerName = player.name;
    state.playerOneName = player.name;
    state.playerTwoName = null;
    state.isBotGame = false;
    state.botPlayerId = null;
    state.botPlayerName = null;
    state.connectionState = 'waiting';

    elements.lobbyContainer.style.display = 'none';
    elements.playground.style.display = 'grid';
    elements.board.style.pointerEvents = 'none';
    $('.game-btn').prop('disabled', true);

    elements.whiteName.textContent = player.name;
    elements.whiteRating.textContent = player.rating;
    elements.blackName.textContent = '?';
    elements.blackRating.textContent = t('notAvailable');
    elements.statusText.style.color = 'red';
    elements.statusText.innerText = t('waitingForOpponent');
    setPlayAgainVsBotVisibility(elements, false);
}

export function reportClientError(elements, error, inputElement) {
    const message = normalizeErrorMessage(error);
    console.error(error);

    if (inputElement && typeof inputElement.setCustomValidity === 'function' && typeof inputElement.reportValidity === 'function') {
        inputElement.setCustomValidity(message);
        inputElement.reportValidity();
        setTimeout(() => inputElement.setCustomValidity(''), 2200);
    }

    if (elements.statusText && elements.playground && elements.playground.style.display !== 'none') {
        elements.statusText.style.color = '#b42318';
        elements.statusText.innerText = message;
    }
}
