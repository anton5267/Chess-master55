import { showWaitingForOpponent } from './ui.js';

export function bindLobbyHandlers(connection, elements, state) {
    window.addEventListener('beforeunload', function onBeforeUnload(e) {
        if (state.isGameStarted) {
            e.preventDefault();
            e.returnValue = '';
        }
    });

    $(document).on('click', '.game-lobby-room-join-btn', function onJoinRoomClick() {
        const roomElement = $(this).closest('.game-lobby-room-item');
        const id = roomElement.data('room-id');
        const name = (elements.lobbyInputName.value || '').trim();

        if (name !== '' && id) {
            connection.invoke('JoinRoom', name, id)
                .then((player) => {
                    state.playerId = player.id;
                })
                .catch((err) => alert(err));
        } else {
            elements.lobbyInputName.focus();
        }
    });

    elements.lobbyInputCreateBtn.addEventListener('click', function onCreateRoomClick() {
        const name = (elements.lobbyInputName.value || '').trim();

        if (name !== '') {
            connection.invoke('CreateRoom', name)
                .then((player) => {
                    showWaitingForOpponent(elements, state, player);
                })
                .catch((err) => alert(err));
        } else {
            elements.lobbyInputName.focus();
        }
    });

    if (elements.lobbyInputVsBotBtn) {
        elements.lobbyInputVsBotBtn.addEventListener('click', function onStartVsBotClick() {
            const name = (elements.lobbyInputName.value || '').trim();

            if (name !== '') {
                connection.invoke('StartVsBot', name)
                    .then((player) => {
                        state.playerId = player.id;
                    })
                    .catch((err) => alert(err));
            } else {
                elements.lobbyInputName.focus();
            }
        });
    }
}
