import {
    clearHintSquares,
    safeResizeBoard,
    syncBoardState,
} from './board.js';
import {
    applyGameStats,
    createRoomElement,
    removeHighlight,
    renderRooms,
    resetGameUi,
    setPlayAgainVsBotVisibility,
    sleep,
    updateChat,
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
    };
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

function scheduleSyncWatchdog(connection, state) {
    clearSyncWatchdog(state);

    state.pendingSyncTimeoutId = setTimeout(() => {
        if (!state.isGameStarted || state.hasGameEnded) {
            return;
        }

        connection.invoke('RequestSync').catch((err) => console.error(err));
    }, 900);
}

function applySyncPosition(state, elements, fen, movingPlayerId, movingPlayerName) {
    if (!state.board || !fen) {
        return;
    }

    if (state.board.fen() !== fen) {
        state.board.position(fen, false);
    }

    state.currentFen = fen;

    if (!state.hasGameEnded && (movingPlayerId || movingPlayerName)) {
        updateStatus(elements, state, movingPlayerId, movingPlayerName);
    }
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

    if (state.hasGameEnded) {
        state.isYourTurn = false;
        state.legalMoves = [];
        state.legalMovesRequestId += 1;
        elements.board.style.pointerEvents = 'none';
        return;
    }

    updateStatus(elements, state, movingPlayerId, movingPlayerName);
    refreshLegalMoves(connection, state);

    if (state.isGameStarted && state.connectionState !== 'reconnecting') {
        elements.board.style.pointerEvents = 'auto';
    } else if (!state.isGameStarted || state.connectionState === 'reconnecting' || state.connectionState === 'disconnected') {
        elements.board.style.pointerEvents = 'none';
    }
}

export function registerConnectionHandlers(connection, elements, state) {
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && state.isGameStarted) {
            connection.invoke('RequestSync').catch((err) => console.error(err));
        }
    });

    connection.onreconnecting(function onReconnecting() {
        state.connectionState = 'reconnecting';
        state.isYourTurn = false;
        elements.board.style.pointerEvents = 'none';
    });

    connection.onreconnected(function onReconnected() {
        state.connectionState = 'connected';
        if (state.isGameStarted) {
            connection.invoke('RequestSync').catch((err) => console.error(err));
        }
    });

    connection.onclose(function onClosed() {
        state.connectionState = 'disconnected';
        state.isYourTurn = false;
        clearSyncWatchdog(state);
        elements.board.style.pointerEvents = 'none';
    });

    connection.on('AddRoom', function onAddRoom(player) {
        elements.rooms.appendChild(createRoomElement(player));
    });

    connection.on('ListRooms', function onListRooms(waitingPlayers) {
        renderRooms(elements.rooms, waitingPlayers);
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
        state.currentFen = normalizedPayload.startFen || 'start';
        state.isGameStarted = true;
        state.connectionState = 'in-game';
        state.turnNumber = normalizedPayload.turnNumber;
        state.isInCheck = false;
        state.hasGameEnded = false;
        state.gameOverCode = null;
        state.gameOverWinnerName = null;
        setPlayAgainVsBotVisibility(elements, false);

        elements.whiteName.textContent = state.playerOneName;
        elements.blackName.textContent = state.playerTwoName;
        elements.whiteRating.textContent = game.player1.rating;
        elements.blackRating.textContent = game.player2.rating;
        applyGameStats(elements, game);

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
        state.currentFen = state.board.fen();
        scheduleSyncWatchdog(connection, state);
    });

    connection.on('BoardSnapback', function onBoardSnapback(fen) {
        if (!state.board) {
            return;
        }

        clearHintSquares();
        state.board.position(fen, false);
        state.currentFen = state.board.fen();
    });

    connection.on('BoardSetPosition', function onBoardSetPosition(fen) {
        if (!state.board) {
            return;
        }

        clearHintSquares();
        state.board.position(fen, false);
        state.currentFen = state.board.fen();
    });

    connection.on('EnPassantTake', function onEnPassantTake(pawnPosition, target) {
        if (!state.board) {
            return;
        }

        clearHintSquares();
        state.board.move(`${target}-${pawnPosition}`, `${pawnPosition}-${target}`);
        state.currentFen = state.board.fen();
        scheduleSyncWatchdog(connection, state);
    });

    connection.on('SyncPosition', function onSyncPosition(fen, movingPlayerName, turnNumber, movingPlayerId) {
        clearSyncWatchdog(state);
        state.turnNumber = turnNumber;
        applySyncPosition(state, elements, fen, movingPlayerId, movingPlayerName);

        if (!state.hasGameEnded) {
            syncTurnDependentState(connection, elements, state, movingPlayerId, movingPlayerName);
        }
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
        clearHintSquares();
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

        $('.option-btn').prop('disabled', true);
        setPlayAgainVsBotVisibility(elements, state.isBotGame);
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

            connection.invoke('RequestSync')
                .catch((err) => console.error(err))
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
            elements.statusText.innerText = oldText;
            elements.statusText.style.color = oldColor;
        });

        noButton.addEventListener('click', function onRejectDraw() {
            connection.invoke('OfferDrawAnswer', false);
            elements.statusText.innerText = oldText;
            elements.statusText.style.color = oldColor;
        });
    });

    connection.on('DrawOfferRejected', function onDrawOfferRejected(player) {
        const oldText = elements.statusText.innerText;
        const oldColor = elements.statusText.style.color;

        elements.statusText.style.color = 'black';
        elements.statusText.innerText = t('drawOfferRejectedFormat', { name: player.name });

        sleep(1500).then(() => {
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

        if (player.name === state.playerOneName) {
            removeHighlight('black');
            sourceSquare[0].className += ' highlight-white';
            targetSquare[0].className += ' highlight-white';
        } else {
            removeHighlight('white');
            sourceSquare[0].className += ' highlight-black';
            targetSquare[0].className += ' highlight-black';
        }
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
