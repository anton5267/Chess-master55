import { reportClientError, sleep, updateReplayControls } from './ui.js';
import { t } from './i18n.js';

const maxChatMessageLength = 300;
const nearLimitThreshold = 240;

function normalizeChatMessage(message) {
    if (typeof message !== 'string') {
        return '';
    }

    return message.trim();
}

function validateChatMessage(elements, message, inputElement) {
    if (message.length === 0) {
        reportClientError(elements, new Error(t('hubErrorMessageEmpty')), inputElement);
        inputElement.focus();
        return false;
    }

    if (message.length > maxChatMessageLength) {
        reportClientError(elements, new Error(t('hubErrorMessageTooLong')), inputElement);
        inputElement.focus();
        return false;
    }

    return true;
}

function syncChatCounter(counterElement, rawLength) {
    if (!counterElement) {
        return;
    }

    const safeLength = Number.isFinite(rawLength) ? rawLength : 0;
    counterElement.textContent = `${safeLength}/${maxChatMessageLength}`;
    counterElement.classList.toggle('is-near-limit', safeLength >= nearLimitThreshold && safeLength <= maxChatMessageLength);
    counterElement.classList.toggle('is-over-limit', safeLength > maxChatMessageLength);
}

function syncSendButtonState(inputElement, sendButton, counterElement) {
    if (!inputElement || !sendButton) {
        return;
    }

    const rawValue = inputElement.value || '';
    const rawLength = rawValue.length;
    const message = normalizeChatMessage(rawValue);
    sendButton.disabled = message.length === 0 || message.length > maxChatMessageLength;
    syncChatCounter(counterElement, rawLength);
}

export function bindChatHandlers(connection, elements) {
    elements.lobbyChatSendBtn.addEventListener('click', function onLobbyChatSend() {
        const message = normalizeChatMessage(elements.lobbyChatInput.value || '');
        if (!validateChatMessage(elements, message, elements.lobbyChatInput)) {
            return;
        }

        connection.invoke('LobbySendMessage', message)
            .then(() => {
                elements.lobbyChatInput.value = '';
                syncSendButtonState(elements.lobbyChatInput, elements.lobbyChatSendBtn, elements.lobbyChatCounter);
            })
            .catch((err) => reportClientError(elements, err, elements.lobbyChatInput));
    });

    elements.gameChatSendBtn.addEventListener('click', function onGameChatSend() {
        const message = normalizeChatMessage(elements.gameChatInput.value || '');
        if (!validateChatMessage(elements, message, elements.gameChatInput)) {
            return;
        }

        connection.invoke('GameSendMessage', message)
            .then(() => {
                elements.gameChatInput.value = '';
                syncSendButtonState(elements.gameChatInput, elements.gameChatSendBtn, elements.gameChatCounter);
            })
            .catch((err) => reportClientError(elements, err, elements.gameChatInput));
    });

    elements.lobbyChatInput.addEventListener('keydown', function onLobbyChatKeyDown(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            elements.lobbyChatSendBtn.click();
        }
    });

    elements.gameChatInput.addEventListener('keydown', function onGameChatKeyDown(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            elements.gameChatSendBtn.click();
        }
    });

    elements.lobbyChatInput.addEventListener('input', function onLobbyChatInput() {
        syncSendButtonState(elements.lobbyChatInput, elements.lobbyChatSendBtn, elements.lobbyChatCounter);
    });

    elements.gameChatInput.addEventListener('input', function onGameChatInput() {
        syncSendButtonState(elements.gameChatInput, elements.gameChatSendBtn, elements.gameChatCounter);
    });

    syncSendButtonState(elements.lobbyChatInput, elements.lobbyChatSendBtn, elements.lobbyChatCounter);
    syncSendButtonState(elements.gameChatInput, elements.gameChatSendBtn, elements.gameChatCounter);
}

export function bindGameOptionHandlers(connection, elements, state) {
    function runGameAction(action) {
        if (state.gameActionInFlight) {
            return;
        }

        state.gameActionInFlight = true;
        updateReplayControls(elements, state);

        Promise.resolve()
            .then(action)
            .catch((err) => reportClientError(elements, err, elements.gameChatInput))
            .finally(() => {
                state.gameActionInFlight = false;
                updateReplayControls(elements, state);
            });
    }

    elements.threefoldDrawBtn.addEventListener('click', function onThreefoldClick() {
        runGameAction(() => connection.invoke('ThreefoldDraw'));
    });

    elements.offerDrawBtn.addEventListener('click', function onOfferDrawClick() {
        const oldText = elements.statusText.innerText;
        const oldColor = elements.statusText.style.color;
        const pendingText = t('drawRequestSent');
        elements.statusText.style.color = 'black';
        elements.statusText.innerText = pendingText;

        sleep(1500).then(() => {
            if (state.hasGameEnded) {
                return;
            }

            if (elements.statusText.innerText !== pendingText) {
                return;
            }

            elements.statusText.style.color = oldColor;
            elements.statusText.innerText = oldText;
        });

        runGameAction(() => connection.invoke('OfferDrawRequest'));
    });

    elements.resignBtn.addEventListener('click', function onResignClick() {
        runGameAction(() => connection.invoke('Resign'));
    });

    if (elements.playAgainVsBotBtn) {
        elements.playAgainVsBotBtn.addEventListener('click', function onPlayAgainVsBotClick() {
            if (!state.isBotGame || !state.hasGameEnded) {
                return;
            }

            const nameFromState = (state.playerName || '').trim();
            const fallbackName = (elements.lobbyInputName.value || '').trim();
            const playerName = nameFromState || fallbackName;
            if (playerName === '') {
                elements.lobbyInputName.focus();
                return;
            }

            const difficulty = state.botDifficulty === 'easy'
                ? 'easy'
                : 'normal';

            runGameAction(() => connection.invoke('StartVsBotWithDifficulty', playerName, difficulty)
                .then((player) => {
                    state.playerId = player.id;
                }));
        });
    }

    updateReplayControls(elements, state);
}
