import { showWaitingForOpponent } from './ui.js';

export function bindLobbyHandlers(connection, elements, state) {
    window.addEventListener('beforeunload', function onBeforeUnload(e) {
        if (state.playerTwoName !== undefined && state.playerTwoName !== null) {
            e.preventDefault();
            e.returnValue = '';
        }
    });

    $(document).on('click', '.game-lobby-room-join-btn', function onJoinRoomClick() {
        const id = $(this).parent().attr('class');
        const name = elements.lobbyInputName.value;

        if (name !== '') {
            connection.invoke('JoinRoom', name, id)
                .then((player) => {
                    state.playerId = player.id;
                    state.board.orientation('black');
                })
                .catch((err) => alert(err));
        } else {
            elements.lobbyInputName.focus();
        }
    });

    elements.lobbyInputCreateBtn.addEventListener('click', function onCreateRoomClick() {
        const name = elements.lobbyInputName.value;

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
}
