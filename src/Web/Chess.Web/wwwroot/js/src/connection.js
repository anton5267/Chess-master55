import {
    clearHintSquares,
    safeResizeBoard,
    syncBoardState,
} from './board.js';
import { storageKeys, storeValue } from './state.js';
import {
    applyGameStats,
    clearGameResultBanner,
    createRoomElement,
    removeHighlight,
    renderRooms,
    resetGameUi,
    setGameResultBanner,
    setConnectionStatus,
    updateBotDifficultyBadge,
    setPlayAgainVsBotVisibility,
    sleep,
    updateChat,
    updateReplayControls,
    updateStatus,
} from './ui.js';
import { t } from './i18n.js';

export function createConnection() {
    return new signalR.HubConnectionBuilder().withUrl('/hub').withAutomaticReconnect().build();
}

function normalizeStartPayload(payload) {
    const game = payload && payload.game ? payload.game : payload;
    const botPlayerId = payload && payload.botPlayerId ? payload.botPlayerId : null;
    const botPlayerName = payload && payload.botPlayerName ? payload.botPlayerName : null;
    const isBotGame = payload && typeof payload.isBotGame === 'boolean'
        ? payload.isBotGame
        : !!botPlayerId;

    return {
        game,
        startFen: payload && payload.startFen ? payload.startFen : 'start',
        movingPlayerId: payload && payload.movingPlayerId
            ? payload.movingPlayerId
            : (game && game.movingPlayer ? game.movingPlayer.id : null),
        movingPlayerName: payload && payload.movingPlayerName
            ? payload.movingPlayerName
            : (game && game.movingPlayer ? game.movingPlayer.name : null),
        turnNumber: payload && payload.turnNumber ? payload.turnNumber : (game && game.turn ? game.turn : 1),
        selfPlayerId: payload && payload.selfPlayerId ? payload.selfPlayerId : null,
        selfPlayerName: payload && payload.selfPlayerName ? payload.selfPlayerName : null,
        isBotGame,
        gameMode: payload && payload.gameMode ? payload.gameMode : (isBotGame ? 'bot' : 'pvp'),
        botPlayerId,
        botPlayerName,
        botDifficulty: payload && payload.botDifficulty ? payload.botDifficulty : 'normal',
    };
}

function getLobbyStorageKey(elements) {
    const dataKey = elements.lobbyInputName
        ? (elements.lobbyInputName.dataset.storageKey || '').trim()
        : '';
    return dataKey || storageKeys.lobbyName;
}

function resolveSelfPlayer(game, state, normalizedPayload) {
    const fallbackPlayerOne = game.player1;
    const fallbackPlayerTwo = game.player2;

    let selfPlayerId = normalizedPayload.selfPlayerId || state.playerId;
    let selfPlayerName = normalizedPayload.selfPlayerName || state.playerName;
    let isPlayerOne = false;

    if (selfPlayerId) {
        if (selfPlayerId === game.player1.id) {
            isPlayerOne = true;
        } else if (selfPlayerId === game.player2.id) {
            isPlayerOne = false;
        } else if (selfPlayerName) {
            isPlayerOne = selfPlayerName === game.player1.name;
        } else {
            isPlayerOne = state.playerColor === game.player1.color;
        }
    } else if (selfPlayerName) {
        isPlayerOne = selfPlayerName === game.player1.name;
    } else {
        isPlayerOne = state.playerColor === game.player1.color;
    }

    if (!selfPlayerId) {
        selfPlayerId = isPlayerOne ? fallbackPlayerOne.id : fallbackPlayerTwo.id;
    }

    if (!selfPlayerName) {
        selfPlayerName = isPlayerOne ? fallbackPlayerOne.name : fallbackPlayerTwo.name;
    }

    return {
        isPlayerOne,
        selfPlayerId,
        selfPlayerName,
    };
}

function clearSyncWatchdog(state) {
    if (!state.pendingSyncTimeoutId) {
        return;
    }

    clearTimeout(state.pendingSyncTimeoutId);
    state.pendingSyncTimeoutId = null;
}

function clearSyncRetryTimer(state) {
    if (!state.pendingSyncRetryTimeoutId) {
        return;
    }

    clearTimeout(state.pendingSyncRetryTimeoutId);
    state.pendingSyncRetryTimeoutId = null;
}

function clearHighlightTimer(state) {
    if (!state.pendingHighlightTimeoutId) {
        return;
    }

    clearTimeout(state.pendingHighlightTimeoutId);
    state.pendingHighlightTimeoutId = null;
}

function clearBotRecoveryWatchdog(state) {
    if (!state.pendingBotRecoveryTimeoutId) {
        return;
    }

    clearTimeout(state.pendingBotRecoveryTimeoutId);
    state.pendingBotRecoveryTimeoutId = null;
}

function isBotToMove(state) {
    if (!state.isBotGame) {
        return false;
    }

    if (state.botPlayerId && state.activeMovingPlayerId) {
        return state.botPlayerId === state.activeMovingPlayerId;
    }

    if (state.botPlayerName && state.activeMovingPlayerName) {
        return state.botPlayerName === state.activeMovingPlayerName;
    }

    return false;
}

function shouldAttemptSyncRecovery(state) {
    return state.isGameStarted
        && !state.hasGameEnded
        && state.connectionState !== 'offline'
        && state.connectionState !== 'disconnected';
}

function scheduleSyncRetry(connection, state) {
    if (!shouldAttemptSyncRecovery(state)) {
        clearSyncRetryTimer(state);
        state.syncRetryAttempt = 0;
        return;
    }

    if (state.pendingSyncRetryTimeoutId) {
        return;
    }

    const delays = [450, 900, 1500];
    const attempt = Math.min(state.syncRetryAttempt, delays.length - 1);
    const delayMs = delays[attempt];

    state.pendingSyncRetryTimeoutId = setTimeout(() => {
        state.pendingSyncRetryTimeoutId = null;
        requestSyncSafely(connection, state);
    }, delayMs);
}

function requestSyncSafely(connection, state) {
    if (connection.state !== signalR.HubConnectionState.Connected) {
        return Promise.resolve(false);
    }

    if (state.syncRequestInFlight) {
        return Promise.resolve(false);
    }

    state.syncRequestInFlight = true;
    return connection.invoke('RequestSync')
        .then(() => {
            state.syncRetryAttempt = 0;
            clearSyncRetryTimer(state);
            return true;
        })
        .catch((err) => {
            console.error(err);
            if (shouldAttemptSyncRecovery(state)) {
                state.syncRetryAttempt = Math.min((state.syncRetryAttempt || 0) + 1, 3);
                scheduleSyncRetry(connection, state);
            }
            return false;
        })
        .finally(() => {
            state.syncRequestInFlight = false;
        });
}

function applyOfflineState(elements, state) {
    state.connectionState = 'offline';
    state.isYourTurn = false;
    clearSyncWatchdog(state);
    clearSyncRetryTimer(state);
    clearBotRecoveryWatchdog(state);
    elements.board.style.pointerEvents = 'none';
    setConnectionStatus(elements, 'offline', t('connectionOffline'));

    if (!state.hasGameEnded) {
        elements.statusText.style.color = '#b36b00';
        elements.statusText.innerText = t('connectionOffline');
    }

    updateReplayControls(elements, state);
}

function tryRecoverFromOffline(connection, elements, state) {
    if (state.connectionState !== 'offline' || !navigator.onLine) {
        return;
    }

    if (connection.state === signalR.HubConnectionState.Connected) {
        state.connectionState = 'connected';
        setConnectionStatus(elements, 'syncing', t('connectionSyncing'));
        if (state.isGameStarted) {
            requestSyncSafely(connection, state);
        }

        return;
    }

    state.connectionState = 'reconnecting';
    setConnectionStatus(elements, 'reconnecting', t('connectionReconnecting'));
}

function scheduleSyncWatchdog(connection, state) {
    clearSyncWatchdog(state);

    state.pendingSyncTimeoutId = setTimeout(() => {
        if (!state.isGameStarted || state.hasGameEnded) {
            return;
        }

        requestSyncSafely(connection, state);
    }, 900);
}

function scheduleBotRecoveryWatchdog(connection, state) {
    clearBotRecoveryWatchdog(state);

    state.pendingBotRecoveryTimeoutId = setTimeout(() => {
        if (!state.isGameStarted || state.hasGameEnded) {
            return;
        }

        if (state.connectionState === 'reconnecting'
            || state.connectionState === 'disconnected'
            || state.connectionState === 'offline') {
            return;
        }

        if (state.isYourTurn || !isBotToMove(state)) {
            return;
        }

        requestSyncSafely(connection, state)
            .finally(() => {
                if (!state.isGameStarted || state.hasGameEnded) {
                    return;
                }

                if (state.connectionState === 'reconnecting'
                    || state.connectionState === 'disconnected'
                    || state.connectionState === 'offline') {
                    return;
                }

                if (state.isYourTurn || !isBotToMove(state)) {
                    return;
                }

                scheduleBotRecoveryWatchdog(connection, state);
            });
    }, 1400);
}

function applySyncPosition(state, elements, fen, movingPlayerId, movingPlayerName) {
    if (!fen) {
        return;
    }

    state.liveFen = fen;
    state.currentFen = fen;

    if (state.board && state.board.fen() !== fen) {
        state.board.position(fen, false);
    }

    state.displayFen = fen;

    updateReplayControls(elements, state);
}

function refreshLegalMoves(connection, state, onCompleted) {
    if (!state.isGameStarted || !state.isYourTurn) {
        state.legalMoves = [];
        state.legalMovesRequestId += 1;
        clearHintSquares();
        if (typeof onCompleted === 'function') {
            onCompleted();
        }

        return;
    }

    const requestId = state.legalMovesRequestId + 1;
    state.legalMovesRequestId = requestId;

    connection.invoke('GetLegalMoves')
        .then((moves) => {
            if (requestId !== state.legalMovesRequestId || !state.isGameStarted || !state.isYourTurn) {
                return;
            }

            state.legalMoves = Array.isArray(moves) ? moves : [];
            if (typeof onCompleted === 'function') {
                onCompleted();
            }
        })
        .catch((err) => {
            console.error(err);
            if (typeof onCompleted === 'function') {
                onCompleted();
            }
        });
}

function syncTurnDependentState(connection, elements, state, movingPlayerId, movingPlayerName) {
    // Never keep stale hint overlays between turns.
    clearHintSquares();
    removeHighlight('white');
    removeHighlight('black');
    clearHighlightTimer(state);

    if (state.hasGameEnded) {
        clearBotRecoveryWatchdog(state);
        state.isYourTurn = false;
        state.legalMoves = [];
        state.legalMovesRequestId += 1;
        elements.board.style.pointerEvents = 'none';
        updateReplayControls(elements, state);
        return;
    }

    updateStatus(elements, state, movingPlayerId, movingPlayerName);
    refreshLegalMoves(connection, state);
    if (!state.isYourTurn && isBotToMove(state)) {
        scheduleBotRecoveryWatchdog(connection, state);
    } else {
        clearBotRecoveryWatchdog(state);
    }

    if (state.isGameStarted
        && state.connectionState !== 'reconnecting'
        && state.connectionState !== 'disconnected'
        && state.connectionState !== 'offline'
        && state.isYourTurn) {
        elements.board.style.pointerEvents = 'auto';
    } else {
        elements.board.style.pointerEvents = 'none';
    }

    updateReplayControls(elements, state);
}

function scheduleHighlightCleanup(state) {
    clearHighlightTimer(state);
    state.pendingHighlightTimeoutId = setTimeout(() => {
        state.pendingHighlightTimeoutId = null;
        removeHighlight('white');
        removeHighlight('black');
    }, 1200);
}

function resolveGameResultTone(state, player, gameOver) {
    const isPlayerKnown = !!(player && player.name);
    const isCurrentPlayer = isPlayerKnown && player.name === state.playerName;

    switch (gameOver) {
        case 1:
            return isPlayerKnown ? (isCurrentPlayer ? 'win' : 'loss') : 'draw';
        case 2:
        case 3:
        case 4:
        case 5:
        case 8:
            return 'draw';
        case 6:
        case 7:
            return isPlayerKnown ? (isCurrentPlayer ? 'loss' : 'win') : 'draw';
        default:
            return 'draw';
    }
}

export function registerConnectionHandlers(connection, elements, state) {
    window.addEventListener('offline', () => {
        applyOfflineState(elements, state);
    });

    window.addEventListener('online', () => {
        tryRecoverFromOffline(connection, elements, state);
    });

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && state.isGameStarted) {
            if (state.connectionState === 'offline') {
                tryRecoverFromOffline(connection, elements, state);
            }

            requestSyncSafely(connection, state);
        }
    });

    connection.onreconnecting(function onReconnecting() {
        if (!navigator.onLine) {
            applyOfflineState(elements, state);
            return;
        }

        state.connectionState = 'reconnecting';
        state.isYourTurn = false;
        clearSyncWatchdog(state);
        clearSyncRetryTimer(state);
        clearBotRecoveryWatchdog(state);
        clearHighlightTimer(state);
        elements.board.style.pointerEvents = 'none';
        setConnectionStatus(elements, 'reconnecting', t('connectionReconnecting'));

        if (!state.hasGameEnded) {
            elements.statusText.style.color = '#b36b00';
            elements.statusText.innerText = t('connectionReconnecting');
        }
    });

    connection.onreconnected(function onReconnected() {
        if (!navigator.onLine) {
            applyOfflineState(elements, state);
            return;
        }

        state.connectionState = 'connected';
        setConnectionStatus(elements, 'syncing', t('connectionSyncing'));
        if (state.isGameStarted) {
            requestSyncSafely(connection, state);
        }
    });

    connection.onclose(function onClosed() {
        if (!navigator.onLine) {
            applyOfflineState(elements, state);
            return;
        }

        state.connectionState = 'disconnected';
        state.isYourTurn = false;
        clearSyncWatchdog(state);
        clearSyncRetryTimer(state);
        clearBotRecoveryWatchdog(state);
        clearHighlightTimer(state);
        elements.board.style.pointerEvents = 'none';
        setConnectionStatus(elements, 'disconnected', t('connectionDisconnected'));
        if (!state.hasGameEnded) {
            elements.statusText.style.color = '#b42318';
            elements.statusText.innerText = t('connectionDisconnected');
        }
    });

    connection.on('AddRoom', function onAddRoom(player) {
        if (!player || !player.id) {
            return;
        }

        const roomId = String(player.id);
        const existingRoom = elements.rooms.querySelector(`.game-lobby-room-item[data-room-id="${roomId}"]`);
        if (existingRoom) {
            return;
        }

        const emptyState = elements.rooms.querySelector('.game-lobby-room-empty');
        if (emptyState) {
            emptyState.remove();
        }

        elements.rooms.appendChild(createRoomElement(player));

        const appendedJoinButton = elements.rooms.querySelector(`.game-lobby-room-item[data-room-id="${roomId}"] .game-lobby-room-join-btn`);
        if (appendedJoinButton) {
            const disableJoin = !!state.lobbyActionInFlight || !state.lobbyNameValid;
            appendedJoinButton.disabled = disableJoin;
            appendedJoinButton.classList.toggle('is-disabled', disableJoin);
            appendedJoinButton.classList.toggle('is-loading', !!state.lobbyActionInFlight);
        }

        if (elements.lobbyRoomCount) {
            const totalRooms = elements.rooms.querySelectorAll('.game-lobby-room-item').length;
            elements.lobbyRoomCount.textContent = String(totalRooms);
        }
    });

    connection.on('ListRooms', function onListRooms(waitingPlayers) {
        const disableJoin = !!state.lobbyActionInFlight || !state.lobbyNameValid;
        renderRooms(elements.rooms, waitingPlayers, disableJoin);
    });

    connection.on('Start', function onStart(startPayload) {
        const normalizedPayload = normalizeStartPayload(startPayload);
        const game = normalizedPayload.game;
        if (!game) {
            return;
        }

        resetGameUi(elements, state);

        elements.lobbyContainer.style.display = 'none';
        elements.playground.style.display = 'grid';
        elements.board.style.pointerEvents = 'auto';
        $('.game-btn').prop('disabled', false);
        $('.threefold-draw-btn').prop('disabled', true);

        const selfPlayer = resolveSelfPlayer(game, state, normalizedPayload);
        state.playerId = selfPlayer.selfPlayerId;
        state.playerName = selfPlayer.selfPlayerName;
        state.playerColor = selfPlayer.isPlayerOne ? game.player1.color : game.player2.color;
        state.playerOneName = game.player1.name;
        state.playerTwoName = game.player2.name;
        state.isBotGame = normalizedPayload.isBotGame;
        state.botPlayerId = normalizedPayload.botPlayerId;
        state.botPlayerName = normalizedPayload.botPlayerName;
        if (state.isBotGame) {
            state.botDifficulty = normalizedPayload.botDifficulty === 'easy'
                ? 'easy'
                : 'normal';
        }

        if (elements.botDifficultySelect) {
            elements.botDifficultySelect.value = state.botDifficulty;
        }

        if (elements.lobbyInputName && state.playerName) {
            elements.lobbyInputName.value = state.playerName;
            const lobbyStorageKey = getLobbyStorageKey(elements);
            storeValue(lobbyStorageKey, state.playerName);
            if (lobbyStorageKey !== storageKeys.lobbyName) {
                storeValue(storageKeys.lobbyName, state.playerName);
            }
        }

        state.currentFen = normalizedPayload.startFen || 'start';
        state.liveFen = state.currentFen;
        state.displayFen = state.currentFen;
        state.isGameStarted = true;
        state.connectionState = 'in-game';
        state.turnNumber = normalizedPayload.turnNumber;
        state.isInCheck = false;
        state.hasGameEnded = false;
        state.gameOverCode = null;
        state.gameOverWinnerName = null;
        state.syncRetryAttempt = 0;
        clearSyncRetryTimer(state);
        clearHighlightTimer(state);
        clearGameResultBanner(elements);
        updateBotDifficultyBadge(elements, state);
        setConnectionStatus(elements, null, '');
        setPlayAgainVsBotVisibility(elements, false);
        updateReplayControls(elements, state);
        state.mobilePanel = 'board';
        if (elements.playground) {
            elements.playground.dataset.mobilePanel = 'board';
        }

        if (Array.isArray(elements.mobileTabButtons)) {
            elements.mobileTabButtons.forEach((button) => {
                const isBoardTab = button.dataset.mobilePanel === 'board';
                button.classList.toggle('is-active', isBoardTab);
                button.setAttribute('aria-selected', isBoardTab ? 'true' : 'false');
                button.tabIndex = isBoardTab ? 0 : -1;
            });
        }

        elements.whiteName.textContent = state.playerOneName;
        elements.blackName.textContent = state.playerTwoName;
        elements.whiteRating.textContent = game.player1.rating;
        elements.blackRating.textContent = game.player2.rating;
        applyGameStats(elements, game);
        if (elements.gameChatInput) {
            setTimeout(() => elements.gameChatInput.focus(), 0);
        }

        syncBoardState(state);
        safeResizeBoard(state);
        syncTurnDependentState(
            connection,
            elements,
            state,
            normalizedPayload.movingPlayerId || game.movingPlayer.id,
            normalizedPayload.movingPlayerName || game.movingPlayer.name);

        if (state.isBotGame && state.botPlayerName) {
            updateChat(
                elements,
                t('botJoinedGame', { name: state.botPlayerName }),
                elements.gameChatWindow,
                true,
                false);
        }
    });

    connection.on('BoardMove', function onBoardMove(source, target) {
        if (!state.board) {
            return;
        }

        clearHintSquares();
        state.board.move(`${source}-${target}`);
        state.displayFen = state.board.fen();
        scheduleSyncWatchdog(connection, state);
    });

    connection.on('BoardSnapback', function onBoardSnapback(fen) {
        if (!state.board) {
            return;
        }

        clearHintSquares();
        state.board.position(fen, false);
        state.displayFen = state.board.fen();
        state.liveFen = state.displayFen;
        state.currentFen = state.liveFen;
        updateReplayControls(elements, state);
    });

    connection.on('BoardSetPosition', function onBoardSetPosition(fen) {
        if (!state.board) {
            return;
        }

        clearHintSquares();
        state.board.position(fen, false);
        state.displayFen = state.board.fen();
        state.liveFen = state.displayFen;
        state.currentFen = state.liveFen;
        updateReplayControls(elements, state);
    });

    connection.on('EnPassantTake', function onEnPassantTake(pawnPosition, target) {
        if (!state.board) {
            return;
        }

        clearHintSquares();
        state.board.move(`${target}-${pawnPosition}`, `${pawnPosition}-${target}`);
        state.displayFen = state.board.fen();
        scheduleSyncWatchdog(connection, state);
    });

    connection.on('SyncPosition', function onSyncPosition(fen, movingPlayerName, turnNumber, movingPlayerId) {
        clearSyncWatchdog(state);
        removeHighlight('white');
        removeHighlight('black');
        state.turnNumber = turnNumber;
        applySyncPosition(state, elements, fen, movingPlayerId, movingPlayerName);

        if (!state.hasGameEnded) {
            syncTurnDependentState(connection, elements, state, movingPlayerId, movingPlayerName);
        }

        if (state.connectionState === 'connected' || state.connectionState === 'in-game') {
            setConnectionStatus(elements, null, '');
        }

        updateReplayControls(elements, state);
    });

    connection.on('GameOver', function onGameOver(player, gameOver) {
        state.isGameStarted = false;
        state.hasGameEnded = true;
        state.gameOverCode = gameOver;
        state.gameOverWinnerName = player && player.name ? player.name : null;
        state.isYourTurn = false;
        state.legalMoves = [];
        state.legalMovesRequestId += 1;
        clearSyncWatchdog(state);
        clearSyncRetryTimer(state);
        clearBotRecoveryWatchdog(state);
        clearHighlightTimer(state);
        clearHintSquares();
        removeHighlight('white');
        removeHighlight('black');
        elements.statusText.style.color = 'purple';
        elements.board.style.pointerEvents = 'none';

        switch (gameOver) {
            case 1:
                if (player && player.name) {
                    elements.statusText.innerText = t('checkmateWinFormat', { name: player.name.toUpperCase() });
                } else {
                    elements.statusText.innerText = t('checkmate');
                }

                elements.statusCheck.style.display = 'none';
                break;
            case 2:
                elements.statusText.innerText = t('stalemate');
                break;
            case 3:
                elements.statusText.innerText = t('draw');
                break;
            case 4:
                if (player && player.name) {
                    elements.statusText.innerText = t('threefoldDeclaredByFormat', { name: player.name.toUpperCase() });
                } else {
                    elements.statusText.innerText = t('draw');
                }
                break;
            case 5:
                elements.statusText.innerText = t('fivefoldDraw');
                break;
            case 6:
                if (player && player.name) {
                    elements.statusText.innerText = t('resignedFormat', { name: player.name.toUpperCase() });
                } else {
                    elements.statusText.innerText = t('draw');
                }
                break;
            case 7:
                if (player && player.name) {
                    elements.statusText.innerText = t('leftYouWinFormat', { name: player.name.toUpperCase() });
                } else {
                    elements.statusText.innerText = t('draw');
                }
                break;
            case 8:
                elements.statusText.innerText = t('fiftyMoveDraw');
                break;
            default:
                break;
        }

        const resultTone = resolveGameResultTone(state, player, gameOver);
        let resultPrefix = t('gameResultDraw');
        if (resultTone === 'win') {
            resultPrefix = t('gameResultWin');
        } else if (resultTone === 'loss') {
            resultPrefix = t('gameResultLoss');
        }

        const resultMessage = elements.statusText.innerText
            ? `${resultPrefix} ${elements.statusText.innerText}`.trim()
            : resultPrefix;

        setGameResultBanner(elements, resultMessage, resultTone);

        $('.option-btn').prop('disabled', true);
        setPlayAgainVsBotVisibility(elements, state.isBotGame);
        updateReplayControls(elements, state);
    });

    connection.on('ThreefoldAvailable', function onThreefoldAvailable(isAvailable) {
        $('.threefold-draw-btn').prop('disabled', !isAvailable);
    });

    connection.on('CheckStatus', function onCheckStatus(type) {
        state.isInCheck = type === 2;

        if (state.isInCheck) {
            elements.statusCheck.style.display = 'inline';
            if (state.hintsEnabled && state.isYourTurn) {
                elements.statusCheck.innerText = `${t('check')}: ${t('checkEscapeHint')}`;
                refreshLegalMoves(connection, state);
            } else {
                elements.statusCheck.innerText = t('check');
            }

            clearHintSquares();
        } else {
            elements.statusCheck.style.display = 'none';
            elements.statusCheck.innerText = '';
            clearHintSquares();
        }
    });

    connection.on('InvalidMove', function onInvalidMove(type) {
        if (state.hasGameEnded) {
            return;
        }

        elements.statusText.style.color = 'red';

        switch (type) {
            case 3:
                elements.statusText.innerText = t('kingInCheck');
                break;
            case 4:
                elements.statusText.innerText = t('willOpenCheck');
                break;
            default:
                elements.statusText.innerText = t('invalidMove');
                break;
        }

        sleep(1200).then(() => {
            if (state.hasGameEnded) {
                return;
            }

            requestSyncSafely(connection, state)
                .finally(() => {
                    if (state.hasGameEnded) {
                        return;
                    }

                    syncTurnDependentState(
                        connection,
                        elements,
                        state,
                        state.activeMovingPlayerId,
                        state.activeMovingPlayerName);
                });
        });
    });

    connection.on('DrawOffered', function onDrawOffered(player) {
        const oldText = elements.statusText.innerText;
        const oldColor = elements.statusText.style.color;

        const yesButton = document.createElement('button');
        yesButton.innerText = t('yes');
        yesButton.classList.add('draw-offer-yes-btn', 'draw-offer-button', 'btn', 'btn-primary');

        const noButton = document.createElement('button');
        noButton.innerText = t('no');
        noButton.classList.add('draw-offer-no-btn', 'draw-offer-button', 'btn', 'btn-primary');

        elements.statusText.style.color = 'black';
        elements.statusText.innerText = t('drawRequestQuestionFormat', { name: player.name });

        const container = document.createElement('div');
        container.classList.add('draw-offer-container');
        container.append(yesButton, noButton);
        elements.statusText.appendChild(container);

        yesButton.addEventListener('click', function onAcceptDraw() {
            connection.invoke('OfferDrawAnswer', true);
            if (!state.hasGameEnded) {
                elements.statusText.innerText = oldText;
                elements.statusText.style.color = oldColor;
            }
        });

        noButton.addEventListener('click', function onRejectDraw() {
            connection.invoke('OfferDrawAnswer', false);
            if (!state.hasGameEnded) {
                elements.statusText.innerText = oldText;
                elements.statusText.style.color = oldColor;
            }
        });
    });

    connection.on('DrawOfferRejected', function onDrawOfferRejected(player) {
        const oldText = elements.statusText.innerText;
        const oldColor = elements.statusText.style.color;
        const rejectedText = t('drawOfferRejectedFormat', { name: player.name });

        elements.statusText.style.color = 'black';
        elements.statusText.innerText = rejectedText;

        sleep(1500).then(() => {
            if (state.hasGameEnded) {
                return;
            }

            if (elements.statusText.innerText !== rejectedText) {
                return;
            }

            elements.statusText.style.color = oldColor;
            elements.statusText.innerText = oldText;
        });
    });

    connection.on('UpdateTakenFigures', function onUpdateTakenFigures(movingPlayer, pieceName, points) {
        if (movingPlayer.name === state.playerOneName) {
            elements.whitePointsValue.innerText = points;
            switch (pieceName) {
                case 'Pawn':
                    elements.blackPawnsTaken.innerText++;
                    break;
                case 'Knight':
                    elements.blackKnightsTaken.innerText++;
                    break;
                case 'Bishop':
                    elements.blackBishopsTaken.innerText++;
                    break;
                case 'Rook':
                    elements.blackRooksTaken.innerText++;
                    break;
                case 'Queen':
                    elements.blackQueensTaken.innerText++;
                    break;
                default:
                    break;
            }
        } else {
            elements.blackPointsValue.innerText = points;
            switch (pieceName) {
                case 'Pawn':
                    elements.whitePawnsTaken.innerText++;
                    break;
                case 'Knight':
                    elements.whiteKnightsTaken.innerText++;
                    break;
                case 'Bishop':
                    elements.whiteBishopsTaken.innerText++;
                    break;
                case 'Rook':
                    elements.whiteRooksTaken.innerText++;
                    break;
                case 'Queen':
                    elements.whiteQueensTaken.innerText++;
                    break;
                default:
                    break;
            }
        }
    });

    connection.on('UpdateMoveHistory', function onUpdateMoveHistory(movingPlayer, moveNotation) {
        const li = document.createElement('li');
        li.classList.add('list-group-item');
        li.innerText = moveNotation;

        if (movingPlayer.name === state.playerOneName) {
            elements.whiteMoveHistory.appendChild(li);
            if (elements.whiteMoveHistory.getElementsByTagName('li').length > 40) {
                elements.whiteMoveHistory.removeChild(elements.whiteMoveHistory.childNodes[0]);
            }
        } else {
            elements.blackMoveHistory.appendChild(li);
            if (elements.blackMoveHistory.getElementsByTagName('li').length > 40) {
                elements.blackMoveHistory.removeChild(elements.blackMoveHistory.childNodes[0]);
            }
        }

        updateReplayControls(elements, state);
    });

    connection.on('UpdateStatus', function onUpdateStatus(movingPlayerIdOrName, movingPlayerNameMaybe) {
        if (state.hasGameEnded) {
            return;
        }

        const movingPlayerId = movingPlayerNameMaybe ? movingPlayerIdOrName : null;
        const movingPlayerName = movingPlayerNameMaybe || movingPlayerIdOrName;
        syncTurnDependentState(connection, elements, state, movingPlayerId, movingPlayerName);
    });

    connection.on('HighlightMove', function onHighlightMove(source, target, player) {
        const sourceSquare = document.getElementsByClassName(`square-${source}`);
        const targetSquare = document.getElementsByClassName(`square-${target}`);
        if (!sourceSquare.length || !targetSquare.length) {
            return;
        }

        clearHighlightTimer(state);
        removeHighlight('white');
        removeHighlight('black');

        if (player.name === state.playerOneName) {
            sourceSquare[0].classList.add('highlight-white');
            targetSquare[0].classList.add('highlight-white');
        } else {
            sourceSquare[0].classList.add('highlight-black');
            targetSquare[0].classList.add('highlight-black');
        }

        scheduleHighlightCleanup(state);
    });

    connection.on('UpdateGameChat', function onUpdateGameChat(message, player) {
        const isBlack = player.name !== state.playerOneName;
        updateChat(elements, message, elements.gameChatWindow, false, isBlack);
    });

    connection.on('UpdateGameChatInternalMessage', function onUpdateGameChatInternalMessage(message) {
        updateChat(elements, message, elements.gameChatWindow, true, false);
    });

    connection.on('UpdateLobbyChat', function onUpdateLobbyChat(message) {
        updateChat(elements, message, elements.lobbyChatWindow, false, false);
    });

    connection.on('UpdateLobbyChatInternalMessage', function onUpdateLobbyChatInternalMessage(message) {
        updateChat(elements, message, elements.lobbyChatWindow, true, false);
    });
}
