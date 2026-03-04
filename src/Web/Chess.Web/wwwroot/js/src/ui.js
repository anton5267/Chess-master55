import { t } from './i18n.js';

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
    div.classList.add(`${player.id}`);

    return div;
}

export function renderRooms(container, waitingPlayers) {
    container.innerHTML = '';
    waitingPlayers.forEach((player) => {
        container.appendChild(createRoomElement(player));
    });
}

export function updateStatus(elements, state, movingPlayerName) {
    if (movingPlayerName === state.playerName) {
        elements.statusText.innerText = t('yourTurn');
        elements.statusText.style.color = 'green';
    } else {
        elements.statusText.innerText = t('playerTurnFormat', { name: movingPlayerName });
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
        highlightedSquares[i].className = highlightedSquares[i].className.replace(/\bhighlight\b/g, '');
    }
}

export function showWaitingForOpponent(elements, state, player) {
    state.playerId = player.id;
    elements.lobbyContainer.style.display = 'none';
    elements.playground.style.display = 'flex';
    elements.board.style.pointerEvents = 'none';
    $('.game-btn').prop('disabled', true);

    elements.whiteName.textContent = player.name;
    elements.whiteRating.textContent = player.rating;
    elements.blackName.textContent = '?';
    elements.blackRating.textContent = t('notAvailable');
    elements.statusText.style.color = 'red';
    elements.statusText.innerText = t('waitingForOpponent');
}
