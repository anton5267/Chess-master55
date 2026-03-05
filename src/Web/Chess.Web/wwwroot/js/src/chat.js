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

    function getReplayMaxIndex() {
        return Math.max((state.fenTimeline?.length || 1) - 1, 0);
    }

    function getReplayActiveIndex() {
        const maxIndex = getReplayMaxIndex();
        if (!state.isReplayMode) {
            return maxIndex;
        }

        return Math.min(Math.max(state.replayIndex || 0, 0), maxIndex);
    }

    function applyReplayPosition(index) {
        if (!state.board || !Array.isArray(state.fenTimeline) || state.fenTimeline.length === 0) {
            return;
        }

        const maxIndex = getReplayMaxIndex();
        const nextIndex = Math.min(Math.max(index, 0), maxIndex);
        const targetFen = state.fenTimeline[nextIndex] || state.liveFen || 'start';
        state.replayIndex = nextIndex;
        state.displayFen = targetFen;
        state.board.position(targetFen, false);
        elements.board.style.pointerEvents = 'none';
        updateReplayControls(elements, state);
    }

    function enterReplayMode(index) {
        if (!state.isBotGame) {
            return;
        }

        if (!state.board || !Array.isArray(state.fenTimeline) || state.fenTimeline.length <= 1) {
            return;
        }

        state.isReplayMode = true;
        applyReplayPosition(index);
    }

    function exitReplayMode() {
        if (!state.isBotGame) {
            return;
        }

        state.isReplayMode = false;
        state.replayIndex = getReplayMaxIndex();
        const liveFen = state.liveFen || state.currentFen || 'start';
        state.displayFen = liveFen;

        if (state.board) {
            state.board.position(liveFen, false);
        }

        if (state.isGameStarted && !state.hasGameEnded && state.isYourTurn) {
            elements.board.style.pointerEvents = 'auto';
        } else {
            elements.board.style.pointerEvents = 'none';
        }

        updateReplayControls(elements, state);
        if (connection.state === signalR.HubConnectionState.Connected) {
            connection.invoke('RequestSync').catch((err) => console.error(err));
        }
    }

    function getPgnResultToken() {
        const white = state.playerOneName;
        const black = state.playerTwoName;

        switch (state.gameOverCode) {
            case 1:
                if (state.gameOverWinnerName === white) {
                    return '1-0';
                }

                if (state.gameOverWinnerName === black) {
                    return '0-1';
                }

                return '*';
            case 2:
            case 3:
            case 4:
            case 5:
            case 8:
                return '1/2-1/2';
            case 6:
            case 7:
                if (state.gameOverWinnerName === white) {
                    return '0-1';
                }

                if (state.gameOverWinnerName === black) {
                    return '1-0';
                }

                return '*';
            default:
                return '*';
        }
    }

    function formatPgnDate() {
        const now = new Date();
        const year = String(now.getFullYear());
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return `${year}.${month}.${day}`;
    }

    function buildPgnText() {
        const eventName = state.isBotGame ? 'Chess Web Bot Match' : 'Chess Web PvP Match';
        const site = window.location?.origin || 'Local';
        const date = formatPgnDate();
        const white = state.playerOneName || 'White';
        const black = state.playerTwoName || 'Black';
        const result = getPgnResultToken();

        const headers = [
            `[Event "${eventName}"]`,
            `[Site "${site}"]`,
            `[Date "${date}"]`,
            `[Round "-"]`,
            `[White "${white.replace(/"/g, "'")}"]`,
            `[Black "${black.replace(/"/g, "'")}"]`,
            `[Result "${result}"]`,
            `[Mode "${state.isBotGame ? 'bot' : 'pvp'}"]`,
        ];

        if (state.isBotGame) {
            headers.push(`[BotDifficulty "${(state.botDifficulty || 'normal').toLowerCase()}"]`);
        }

        const whiteMoves = state.whiteMoves || [];
        const blackMoves = state.blackMoves || [];
        const movePairs = [];
        const maxLen = Math.max(whiteMoves.length, blackMoves.length);
        for (let i = 0; i < maxLen; i += 1) {
            const moveNo = i + 1;
            const whiteMove = (whiteMoves[i] || '').trim();
            const blackMove = (blackMoves[i] || '').trim();
            if (!whiteMove && !blackMove) {
                continue;
            }

            const pair = [`${moveNo}.`];
            if (whiteMove) {
                pair.push(whiteMove);
            }

            if (blackMove) {
                pair.push(blackMove);
            }

            movePairs.push(pair.join(' '));
        }

        const movesSection = movePairs.join(' ');
        return `${headers.join('\n')}\n\n${movesSection}${movesSection ? ' ' : ''}${result}\n`;
    }

    function downloadPgn() {
        try {
            const pgnText = buildPgnText();
            const now = new Date();
            const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
            const fileName = `chess-match-${timestamp}.pgn`;
            const blob = new Blob([pgnText], { type: 'application/x-chess-pgn;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = fileName;
            document.body.appendChild(anchor);
            anchor.click();
            document.body.removeChild(anchor);
            URL.revokeObjectURL(url);
            if (elements.replayIndicator) {
                elements.replayIndicator.textContent = t('pgnDownloaded');
                setTimeout(() => updateReplayControls(elements, state), 1200);
            }
        } catch (error) {
            console.error(error);
            if (elements.replayIndicator) {
                elements.replayIndicator.textContent = t('pgnDownloadFailed');
                setTimeout(() => updateReplayControls(elements, state), 1600);
            }
        }
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
            if (state.hasGameEnded || state.isReplayMode) {
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

    if (elements.replayStartBtn) {
        elements.replayStartBtn.addEventListener('click', function onReplayStartClick() {
            enterReplayMode(0);
        });
    }

    if (elements.replayPrevBtn) {
        elements.replayPrevBtn.addEventListener('click', function onReplayPrevClick() {
            enterReplayMode(getReplayActiveIndex() - 1);
        });
    }

    if (elements.replayNextBtn) {
        elements.replayNextBtn.addEventListener('click', function onReplayNextClick() {
            enterReplayMode(getReplayActiveIndex() + 1);
        });
    }

    if (elements.replayLiveBtn) {
        elements.replayLiveBtn.addEventListener('click', function onReplayLiveClick() {
            exitReplayMode();
        });
    }

    if (elements.exportPgnBtn) {
        elements.exportPgnBtn.addEventListener('click', function onExportPgnClick() {
            downloadPgn();
        });
    }

    updateReplayControls(elements, state);
}
