import { reportClientError, showWaitingForOpponent } from './ui.js';
import { getStoredText, storageKeys, storeValue } from './state.js';
import { t } from './i18n.js';

const playerNamePattern = /^[A-Za-z0-9_]{3,20}$/;

function setLobbyButtonsDisabled(elements, shouldDisable, isBusy) {
    elements.lobbyInputCreateBtn.disabled = shouldDisable;
    elements.lobbyInputCreateBtn.classList.toggle('is-disabled', shouldDisable);
    elements.lobbyInputCreateBtn.classList.toggle('is-loading', !!isBusy);

    if (elements.lobbyInputVsBotBtn) {
        elements.lobbyInputVsBotBtn.disabled = shouldDisable;
        elements.lobbyInputVsBotBtn.classList.toggle('is-disabled', shouldDisable);
        elements.lobbyInputVsBotBtn.classList.toggle('is-loading', !!isBusy);
    }

    $('.game-lobby-room-join-btn')
        .prop('disabled', shouldDisable)
        .toggleClass('is-disabled', shouldDisable)
        .toggleClass('is-loading', !!isBusy);
}

function isLobbyNameValid(elements) {
    const name = (elements.lobbyInputName.value || '').trim();
    return playerNamePattern.test(name);
}

function syncLobbyNameValidity(elements, state) {
    const isValid = isLobbyNameValid(elements);
    state.lobbyNameValid = isValid;

    const shouldDisableActions = state.lobbyActionInFlight || !isValid;
    setLobbyButtonsDisabled(elements, shouldDisableActions, state.lobbyActionInFlight);

    if (typeof elements.lobbyInputName.setCustomValidity === 'function') {
        if (isValid || elements.lobbyInputName.value.trim().length === 0) {
            elements.lobbyInputName.setCustomValidity('');
        } else {
            elements.lobbyInputName.setCustomValidity(t('hubErrorNameInvalid'));
        }
    }

    const name = (elements.lobbyInputName.value || '').trim();
    if (name.length === 0) {
        storeValue(storageKeys.lobbyName, '');
    } else if (playerNamePattern.test(name)) {
        storeValue(storageKeys.lobbyName, name);
    }
}

function tryGetLobbyName(elements) {
    const name = (elements.lobbyInputName.value || '').trim();
    if (name === '') {
        reportClientError(elements, new Error(t('hubErrorNameInvalid')), elements.lobbyInputName);
        elements.lobbyInputName.focus();
        return null;
    }

    if (!playerNamePattern.test(name)) {
        reportClientError(elements, new Error(t('hubErrorNameInvalid')), elements.lobbyInputName);
        elements.lobbyInputName.focus();
        return null;
    }

    storeValue(storageKeys.lobbyName, name);
    return name;
}

function runLobbyAction(elements, state, action) {
    if (state.lobbyActionInFlight) {
        return;
    }

    state.lobbyActionInFlight = true;
    elements.lobbyContainer.classList.add('is-loading');
    syncLobbyNameValidity(elements, state);

    action()
        .catch((err) => reportClientError(elements, err, elements.lobbyInputName))
        .finally(() => {
            state.lobbyActionInFlight = false;
            elements.lobbyContainer.classList.remove('is-loading');
            syncLobbyNameValidity(elements, state);
        });
}

function normalizeDifficulty(value) {
    return value === 'easy' ? 'easy' : 'normal';
}

function getSelectedBotDifficulty(elements, state) {
    const rawValue = elements.botDifficultySelect
        ? elements.botDifficultySelect.value
        : state.botDifficulty;

    const normalized = normalizeDifficulty(rawValue);
    state.botDifficulty = normalized;
    storeValue(storageKeys.botDifficulty, normalized);
    return normalized;
}

export function bindLobbyHandlers(connection, elements, state) {
    const storedLobbyName = getStoredText(storageKeys.lobbyName, '').trim();
    if (playerNamePattern.test(storedLobbyName) && !elements.lobbyInputName.value.trim()) {
        elements.lobbyInputName.value = storedLobbyName;
    }

    elements.lobbyInputName.addEventListener('input', function onLobbyNameInput() {
        syncLobbyNameValidity(elements, state);
    });
    elements.lobbyInputName.addEventListener('keydown', function onLobbyNameKeyDown(event) {
        if (event.key !== 'Enter') {
            return;
        }

        event.preventDefault();
        if (!elements.lobbyInputCreateBtn.disabled) {
            elements.lobbyInputCreateBtn.click();
        }
    });

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

            const difficulty = getSelectedBotDifficulty(elements, state);

            runLobbyAction(elements, state, () => connection.invoke('StartVsBotWithDifficulty', name, difficulty)
                .then((player) => {
                    state.playerId = player.id;
                }));
        });
    }

    syncLobbyNameValidity(elements, state);
}
