import { createRoomElement, removeHighlight, renderRooms, sleep, updateChat, updateStatus } from './ui.js';
import { t } from './i18n.js';

export function createConnection() {
    return new signalR.HubConnectionBuilder().withUrl('/hub').build();
}

export function registerConnectionHandlers(connection, elements, state) {
    connection.on('AddRoom', function onAddRoom(player) {
        elements.rooms.appendChild(createRoomElement(player));
    });

    connection.on('ListRooms', function onListRooms(waitingPlayers) {
        renderRooms(elements.rooms, waitingPlayers);
    });

    connection.on('Start', function onStart(game) {
        elements.lobbyContainer.style.display = 'none';
        elements.playground.style.display = 'flex';
        elements.board.style.pointerEvents = 'auto';
        $('.game-btn').prop('disabled', false);
        $('.threefold-draw-btn').prop('disabled', true);

        state.playerColor = state.playerId === game.player1.id ? game.player1.color : game.player2.color;
        state.playerName = state.playerId === game.player1.id ? game.player1.name : game.player2.name;
        state.playerOneName = game.player1.name;
        state.playerTwoName = game.player2.name;

        elements.whiteName.textContent = state.playerOneName;
        elements.blackName.textContent = state.playerTwoName;
        elements.whiteRating.textContent = game.player1.rating;
        elements.blackRating.textContent = game.player2.rating;

        updateStatus(elements, state, game.movingPlayer.name);
    });

    connection.on('BoardMove', function onBoardMove(source, target) {
        state.board.move(`${source}-${target}`);
    });

    connection.on('BoardSnapback', function onBoardSnapback(fen) {
        state.board.position(fen);
    });

    connection.on('BoardSetPosition', function onBoardSetPosition(fen) {
        state.board.position(fen);
    });

    connection.on('EnPassantTake', function onEnPassantTake(pawnPosition, target) {
        state.board.move(`${target}-${pawnPosition}`, `${pawnPosition}-${target}`);
    });

    connection.on('GameOver', function onGameOver(player, gameOver) {
        elements.statusText.style.color = 'purple';
        elements.board.style.pointerEvents = 'none';

        switch (gameOver) {
            case 1:
                elements.statusText.innerText = t('checkmateWinFormat', { name: player.name.toUpperCase() });
                elements.statusCheck.style.display = 'none';
                break;
            case 2:
                elements.statusText.innerText = t('stalemate');
                break;
            case 3:
                elements.statusText.innerText = t('draw');
                break;
            case 4:
                elements.statusText.innerText = t('threefoldDeclaredByFormat', { name: player.name.toUpperCase() });
                break;
            case 5:
                elements.statusText.innerText = t('fivefoldDraw');
                break;
            case 6:
                elements.statusText.innerText = t('resignedFormat', { name: player.name.toUpperCase() });
                break;
            case 7:
                elements.statusText.innerText = t('leftYouWinFormat', { name: player.name.toUpperCase() });
                break;
            case 8:
                elements.statusText.innerText = t('fiftyMoveDraw');
                break;
            default:
                break;
        }

        $('.option-btn').prop('disabled', true);
    });

    connection.on('ThreefoldAvailable', function onThreefoldAvailable(isAvailable) {
        $('.threefold-draw-btn').prop('disabled', !isAvailable);
    });

    connection.on('CheckStatus', function onCheckStatus(type) {
        if (type === 2) {
            elements.statusCheck.style.display = 'inline';
            elements.statusCheck.innerText = t('check');
        } else {
            elements.statusCheck.style.display = 'none';
        }
    });

    connection.on('InvalidMove', function onInvalidMove(type) {
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
            elements.statusText.innerText = t('yourTurn');
            elements.statusText.style.color = 'green';
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

    connection.on('UpdateStatus', function onUpdateStatus(movingPlayerName) {
        updateStatus(elements, state, movingPlayerName);
    });

    connection.on('HighlightMove', function onHighlightMove(source, target, player) {
        const sourceSquare = document.getElementsByClassName(`square-${source}`);
        const targetSquare = document.getElementsByClassName(`square-${target}`);

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
