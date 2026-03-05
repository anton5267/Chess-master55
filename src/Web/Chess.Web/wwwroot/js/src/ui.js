import { t } from './i18n.js';
import { clearHintSquares } from './board.js';

export function sleep(time) {
    return new Promise((resolve) => setTimeout(resolve, time));
}

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

export function renderRooms(container, waitingPlayers) {
    container.innerHTML = '';
    waitingPlayers.forEach((player) => {
        container.appendChild(createRoomElement(player));
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

export function resetGameUi(elements, state) {
    elements.statusCheck.style.display = 'none';
    elements.statusCheck.textContent = '';

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

    if (state.pendingSyncTimeoutId) {
        clearTimeout(state.pendingSyncTimeoutId);
        state.pendingSyncTimeoutId = null;
    }

    if (state.board) {
        state.board.orientation('white');
        state.board.position('start', false);
    }

    setPlayAgainVsBotVisibility(elements, false);
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
