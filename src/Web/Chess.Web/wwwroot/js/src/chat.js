import { sleep } from './ui.js';
import { t } from './i18n.js';

export function bindChatHandlers(connection, elements) {
    elements.lobbyChatSendBtn.addEventListener('click', function onLobbyChatSend() {
        const message = (elements.lobbyChatInput.value || '').trim();
        if (message !== '') {
            connection.invoke('LobbySendMessage', message)
                .then(() => {
                    elements.lobbyChatInput.value = '';
                })
                .catch((err) => alert(err));
        } else {
            elements.lobbyChatInput.focus();
        }
    });

    elements.gameChatSendBtn.addEventListener('click', function onGameChatSend() {
        const message = (elements.gameChatInput.value || '').trim();
        if (message !== '') {
            connection.invoke('GameSendMessage', message)
                .then(() => {
                    elements.gameChatInput.value = '';
                })
                .catch((err) => alert(err));
        } else {
            elements.gameChatInput.focus();
        }
    });

    elements.lobbyChatInput.addEventListener('keyup', function onLobbyChatKeyUp(e) {
        if (e.keyCode === 13) {
            elements.lobbyChatSendBtn.click();
        }
    });

    elements.gameChatInput.addEventListener('keyup', function onGameChatKeyUp(e) {
        if (e.keyCode === 13) {
            elements.gameChatSendBtn.click();
        }
    });
}

export function bindGameOptionHandlers(connection, elements, state) {
    elements.threefoldDrawBtn.addEventListener('click', function onThreefoldClick() {
        connection.invoke('ThreefoldDraw').catch((err) => alert(err));
    });

    elements.offerDrawBtn.addEventListener('click', function onOfferDrawClick() {
        const oldText = elements.statusText.innerText;
        const oldColor = elements.statusText.style.color;
        elements.statusText.style.color = 'black';
        elements.statusText.innerText = t('drawRequestSent');

        sleep(1500).then(() => {
            elements.statusText.style.color = oldColor;
            elements.statusText.innerText = oldText;
        });

        connection.invoke('OfferDrawRequest').catch((err) => alert(err));
    });

    elements.resignBtn.addEventListener('click', function onResignClick() {
        connection.invoke('Resign').catch((err) => alert(err));
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

            elements.playAgainVsBotBtn.disabled = true;
            connection.invoke('StartVsBot', playerName)
                .then((player) => {
                    state.playerId = player.id;
                })
                .catch((err) => alert(err))
                .finally(() => {
                    elements.playAgainVsBotBtn.disabled = false;
                });
        });
    }
}
