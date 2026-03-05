import { reportClientError, showWaitingForOpponent } from './ui.js';

function setLobbyButtonsDisabled(elements, isDisabled) {
    elements.lobbyInputCreateBtn.disabled = isDisabled;
    if (elements.lobbyInputVsBotBtn) {
        elements.lobbyInputVsBotBtn.disabled = isDisabled;
    }

    $('.game-lobby-room-join-btn').prop('disabled', isDisabled);
}

function tryGetLobbyName(elements) {
    const name = (elements.lobbyInputName.value || '').trim();
    if (name === '') {
        elements.lobbyInputName.focus();
        return null;
    }

    return name;
}

function runLobbyAction(elements, state, action) {
    if (state.lobbyActionInFlight) {
        return;
    }

    state.lobbyActionInFlight = true;
    setLobbyButtonsDisabled(elements, true);

    action()
        .catch((err) => reportClientError(elements, err, elements.lobbyInputName))
        .finally(() => {
            state.lobbyActionInFlight = false;
            setLobbyButtonsDisabled(elements, false);
        });
}

export function bindLobbyHandlers(connection, elements, state) {
    window.addEventListener('beforeunload', function onBeforeUnload(e) {
        if (state.isGameStarted) {
            e.preventDefault();
            e.returnValue = '';
        }
    });

    $(document).on('click', '.game-lobby-room-join-btn', function onJoinRoomClick() {
        if (state.lobbyActionInFlight) {
            return;
        }

        const roomElement = $(this).closest('.game-lobby-room-item');
        const id = roomElement.data('room-id');
        const name = tryGetLobbyName(elements);

        if (!name || !id) {
            return;
        }

        runLobbyAction(elements, state, () => connection.invoke('JoinRoom', name, id)
            .then((player) => {
                state.playerId = player.id;
            }));
    });

    elements.lobbyInputCreateBtn.addEventListener('click', function onCreateRoomClick() {
        const name = tryGetLobbyName(elements);
        if (!name) {
            return;
        }

        runLobbyAction(elements, state, () => connection.invoke('CreateRoom', name)
            .then((player) => {
                showWaitingForOpponent(elements, state, player);
            }));
    });

    if (elements.lobbyInputVsBotBtn) {
        elements.lobbyInputVsBotBtn.addEventListener('click', function onStartVsBotClick() {
            const name = tryGetLobbyName(elements);
            if (!name) {
                return;
            }

            runLobbyAction(elements, state, () => connection.invoke('StartVsBot', name)
                .then((player) => {
                    state.playerId = player.id;
                }));
        });
    }
}
