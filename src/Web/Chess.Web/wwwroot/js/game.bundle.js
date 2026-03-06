(() => {
  // wwwroot/js/src/board.js
  function getOrientation(state) {
    if (state.playerColor === 1) {
      return "black";
    }
    if (state.playerColor === 0) {
      return "white";
    }
    if (state.board) {
      return state.board.orientation();
    }
    return "white";
  }
  function normalizeLegalMove(move) {
    return {
      source: move.source || move.Source || "",
      target: move.target || move.Target || "",
      isCapture: typeof move.isCapture === "boolean" ? move.isCapture : !!move.IsCapture
    };
  }
  function applyBoardTheme(elements, boardThemes2, theme) {
    const themeClass = boardThemes2[theme] || boardThemes2.classic;
    Object.values(boardThemes2).forEach((className) => elements.board.classList.remove(className));
    elements.board.classList.add(themeClass);
  }
  function clearHintSquares() {
    const highlightedSquares = document.querySelectorAll(".hint-move, .hint-capture");
    highlightedSquares.forEach((square) => {
      square.classList.remove("hint-move");
      square.classList.remove("hint-capture");
    });
  }
  function highlightLegalMovesForSource(state, sourceSquare) {
    clearHintSquares();
    if (!state.legalHintsEnabled || !state.isYourTurn) {
      return;
    }
    const moves = (state.legalMoves || []).map(normalizeLegalMove).filter((move) => move.source === sourceSquare);
    moves.forEach((move) => {
      const square = document.querySelector(`.square-${move.target}`);
      if (!square) {
        return;
      }
      square.classList.add(move.isCapture ? "hint-capture" : "hint-move");
    });
  }
  function createOnDragStartHandler(state) {
    return function onDragStart(source, piece) {
      if (!state.isGameStarted || !state.isYourTurn) {
        return false;
      }
      if (state.playerColor === 0 && piece.search(/b/) !== -1 || state.playerColor === 1 && piece.search(/w/) !== -1) {
        return false;
      }
      highlightLegalMovesForSource(state, source);
      return true;
    };
  }
  function scheduleSyncWatchdog(connection, state) {
    if (state.pendingSyncTimeoutId) {
      clearTimeout(state.pendingSyncTimeoutId);
    }
    state.pendingSyncTimeoutId = setTimeout(() => {
      state.pendingSyncTimeoutId = null;
      if (!state.isGameStarted) {
        return;
      }
      if (connection.state !== signalR.HubConnectionState.Connected || state.syncRequestInFlight) {
        return;
      }
      state.syncRequestInFlight = true;
      connection.invoke("RequestSync").catch((err) => console.error(err)).finally(() => {
        state.syncRequestInFlight = false;
      });
    }, 900);
  }
  function createOnDropHandler(state, connection) {
    return function onDrop(source, target, piece, newPos, oldPos) {
      clearHintSquares();
      if (!state.isGameStarted || !state.isYourTurn) {
        return "snapback";
      }
      if (state.playerColor === 0 && piece.search(/b/) !== -1 || state.playerColor === 1 && piece.search(/w/) !== -1) {
        return "snapback";
      }
      if (target.length !== 2) {
        return "snapback";
      }
      const sourceFen = Chessboard.objToFen(oldPos);
      const targetFen = Chessboard.objToFen(newPos);
      const liveFen = state.liveFen || state.currentFen;
      if (liveFen && sourceFen !== liveFen) {
        if (state.board) {
          state.board.position(liveFen, false);
          state.displayFen = liveFen;
        }
        if (connection.state === signalR.HubConnectionState.Connected && !state.syncRequestInFlight) {
          state.syncRequestInFlight = true;
          connection.invoke("RequestSync").catch((err) => console.error(err)).finally(() => {
            state.syncRequestInFlight = false;
          });
        }
        return "snapback";
      }
      scheduleSyncWatchdog(connection, state);
      connection.invoke("MoveSelected", source, target, sourceFen, targetFen).catch((err) => {
        console.error(err);
        if (state.pendingSyncTimeoutId) {
          clearTimeout(state.pendingSyncTimeoutId);
          state.pendingSyncTimeoutId = null;
        }
        if (state.board) {
          state.board.position(sourceFen, false);
          state.currentFen = sourceFen;
          state.liveFen = sourceFen;
          state.displayFen = sourceFen;
        }
      });
      return void 0;
    };
  }
  function syncBoardState(state) {
    if (!state.board) {
      return;
    }
    const fenToDisplay = state.displayFen || state.liveFen || state.currentFen || "start";
    state.board.orientation(getOrientation(state));
    state.board.position(fenToDisplay, false);
    state.displayFen = state.board.fen();
    if (!state.liveFen) {
      state.liveFen = state.displayFen;
    }
    state.currentFen = state.liveFen;
  }
  function safeResizeBoard(state) {
    if (!state.board) {
      return;
    }
    requestAnimationFrame(() => {
      if (!state.board) {
        return;
      }
      state.board.resize();
      const fenToDisplay = state.displayFen || state.liveFen || state.currentFen || "start";
      state.board.position(fenToDisplay, false);
      state.displayFen = state.board.fen();
      if (!state.liveFen) {
        state.liveFen = state.displayFen;
      }
      state.currentFen = state.liveFen;
    });
  }
  function ensureBoardInitialized(state, pieceThemes2, onDrop, onDragStart) {
    if (state.boardInitialized && state.board) {
      return;
    }
    const config = {
      pieceTheme: pieceThemes2[state.selectedPieceTheme] || pieceThemes2.wikipedia,
      draggable: true,
      dropOffBoard: "snapback",
      showNotation: true,
      onDragStart,
      onDrop,
      onSnapEnd: clearHintSquares,
      moveSpeed: 50,
      position: state.currentFen || "start"
    };
    state.board = ChessBoard("board", config);
    state.boardInitialized = true;
    syncBoardState(state);
  }
  function rebuildBoard(state, pieceThemes2, onDrop, onDragStart) {
    const position = state.displayFen || state.liveFen || state.currentFen || (state.board ? state.board.fen() : "start");
    const orientation = getOrientation(state);
    if (state.board) {
      state.board.destroy();
    }
    state.board = null;
    state.boardInitialized = false;
    state.displayFen = position;
    if (!state.liveFen) {
      state.liveFen = position;
    }
    state.currentFen = state.liveFen;
    ensureBoardInitialized(state, pieceThemes2, onDrop, onDragStart);
    if (state.board) {
      state.board.orientation(orientation);
      state.board.position(position, false);
      state.displayFen = state.board.fen();
      if (!state.liveFen) {
        state.liveFen = state.displayFen;
      }
      state.currentFen = state.liveFen;
    }
  }

  // wwwroot/js/src/i18n.js
  function format(value, params = {}) {
    return value.replace(/\{(\w+)\}/g, (_, key) => {
      if (Object.prototype.hasOwnProperty.call(params, key)) {
        return params[key];
      }
      return `{${key}}`;
    });
  }
  function t(key, params = {}) {
    const dictionary = window.chessI18n || {};
    const value = dictionary[key] || key;
    return format(value, params);
  }

  // wwwroot/js/src/ui.js
  function sleep(time) {
    return new Promise((resolve) => setTimeout(resolve, time));
  }
  function normalizeErrorMessage(error) {
    const fallback = "Request failed. Please try again.";
    if (error == null) {
      return fallback;
    }
    const rawMessage = typeof error === "string" ? error : error.message || String(error);
    const normalized = rawMessage.replace(/^HubException:\s*/i, "").trim();
    return normalized || fallback;
  }
  var connectionToneClasses = ["is-reconnecting", "is-syncing", "is-disconnected", "is-offline"];
  var internalChatDedupWindowMs = 5e3;
  var maxChatItems = 250;
  var legacyReplaySelectors = [
    ".game-replay-toolbar",
    ".game-replay-hotkeys",
    ".game-replay-indicator",
    ".game-replay-controls",
    ".replay-toolbar",
    ".replay-controls",
    ".replay-hotkeys",
    ".pgn-export-controls"
  ];
  var legacyReplayTextTokens = [
    "\u043F\u043E\u0432\u0442\u043E\u0440",
    "\u043F\u043E\u0432\u0442\u043E\u0440:",
    "replay",
    "wiederholung",
    "powtor",
    "powt\xF3r",
    "repeticion",
    "repetici\xF3n",
    "export pgn",
    "\u0435\u043A\u0441\u043F\u043E\u0440\u0442 pgn",
    "\u044D\u043A\u0441\u043F\u043E\u0440\u0442 pgn",
    "eksport pgn",
    "exportar pgn",
    "pgn exportieren",
    "\u043F\u043E\u0432\u0435\u0440\u043D\u0443\u0442\u0438\u0441\u044F \u0443 live",
    "return to live",
    "zur\xFCck zu live",
    "powr\xF3t do live",
    "volver a live",
    "\u043F\u043E\u0442\u043E\u0447\u043D\u0430 \u043F\u043E\u0437\u0438\u0446\u0456\u044F",
    "current position"
  ];
  var legacyReplayLooseButtonLabels = /* @__PURE__ */ new Set(["home", "end", "p", "\u2190", "\u2192"]);
  var legacyReplayTextOnlySelectors = ["div", "span", "p", "small", "strong", "label", "h6"];
  var legacyReplayCleanupObserver = null;
  var legacyReplayCleanupScheduled = false;
  function scheduleLegacyReplayCleanup() {
    if (legacyReplayCleanupScheduled) {
      return;
    }
    legacyReplayCleanupScheduled = true;
    requestAnimationFrame(() => {
      legacyReplayCleanupScheduled = false;
      removeLegacyReplayDomArtifacts(false);
    });
  }
  function ensureLegacyReplayCleanupObserver(observeRoot) {
    if (legacyReplayCleanupObserver || !observeRoot || typeof MutationObserver === "undefined") {
      return;
    }
    legacyReplayCleanupObserver = new MutationObserver(() => {
      scheduleLegacyReplayCleanup();
    });
    legacyReplayCleanupObserver.observe(observeRoot, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true
    });
  }
  function removeLegacyReplayDomArtifacts(ensureObserver = true) {
    const gameShell = document.querySelector(".game-shell");
    if (!gameShell) {
      return;
    }
    const cleanupScope = gameShell;
    if (ensureObserver) {
      ensureLegacyReplayCleanupObserver(gameShell);
    }
    cleanupScope.querySelectorAll(legacyReplaySelectors.join(",")).forEach((node) => node.remove());
    cleanupScope.querySelectorAll("[aria-keyshortcuts]").forEach((node) => node.remove());
    cleanupScope.querySelectorAll('button, .btn, a.btn, [role="button"], a').forEach((node) => {
      const text = (node.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
      if (!text) {
        return;
      }
      const isLooseLegacyButtonLabel = legacyReplayLooseButtonLabels.has(text) && (node.tagName === "BUTTON" || node.classList.contains("btn"));
      const hasLegacyReplayToken = legacyReplayTextTokens.some((token) => text.includes(token));
      const hasReplayShortcut = typeof node.getAttribute === "function" && !!node.getAttribute("aria-keyshortcuts");
      if (isLooseLegacyButtonLabel || hasLegacyReplayToken || hasReplayShortcut) {
        const removableContainer = node.closest(".btn-group, .toolbar, .game-replay-toolbar, .game-replay-hotkeys, .game-replay-indicator, .game-replay-controls, .replay-toolbar, .replay-controls, .replay-hotkeys, .pgn-export-controls");
        if (removableContainer && cleanupScope.contains(removableContainer)) {
          removableContainer.remove();
          return;
        }
        if (cleanupScope.contains(node)) {
          node.remove();
        }
      }
    });
    cleanupScope.querySelectorAll(legacyReplayTextOnlySelectors.join(",")).forEach((node) => {
      const text = (node.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
      if (!text) {
        return;
      }
      const hasLegacyReplayToken = legacyReplayTextTokens.some((token) => text.includes(token));
      if (!hasLegacyReplayToken) {
        return;
      }
      const hasInteractiveChild = node.querySelector('button, a, [role="button"]');
      if (hasInteractiveChild) {
        return;
      }
      const removableContainer = node.closest(
        ".btn-group, .toolbar, .game-replay-toolbar, .game-replay-hotkeys, .game-replay-indicator, .game-replay-controls, .replay-toolbar, .replay-controls, .replay-hotkeys, .pgn-export-controls"
      );
      if (removableContainer && cleanupScope.contains(removableContainer)) {
        removableContainer.remove();
        return;
      }
      if (cleanupScope.contains(node)) {
        node.remove();
      }
    });
  }
  function purgeLegacyReplayUi() {
    removeLegacyReplayDomArtifacts(true);
  }
  function createRoomElement(player) {
    const div = document.createElement("div");
    const span = document.createElement("span");
    const button = document.createElement("button");
    span.innerText = t("roomSuffix", { name: player.name.toUpperCase() });
    span.classList.add("game-lobby-room-name");
    button.innerText = t("join");
    button.classList.add("game-lobby-room-join-btn", "game-btn", "btn");
    div.append(span, button);
    div.classList.add("game-lobby-room-item");
    div.dataset.roomId = player.id;
    return div;
  }
  function createNoRoomsElement() {
    const div = document.createElement("div");
    div.classList.add("game-lobby-room-empty");
    div.textContent = t("noRoomsAvailable");
    return div;
  }
  function renderRooms(container, waitingPlayers, shouldDisableJoin = false) {
    container.innerHTML = "";
    const rooms = Array.isArray(waitingPlayers) ? waitingPlayers : [];
    const roomCount = document.querySelector(".game-lobby-room-count");
    if (roomCount) {
      roomCount.textContent = String(rooms.length);
    }
    if (rooms.length === 0) {
      container.appendChild(createNoRoomsElement());
      return;
    }
    rooms.forEach((player) => {
      const roomElement = createRoomElement(player);
      const joinButton = roomElement.querySelector(".game-lobby-room-join-btn");
      if (joinButton) {
        joinButton.disabled = !!shouldDisableJoin;
        joinButton.classList.toggle("is-disabled", !!shouldDisableJoin);
        joinButton.classList.toggle("is-loading", false);
      }
      container.appendChild(roomElement);
    });
  }
  function updateStatus(elements, state, movingPlayerId, movingPlayerName) {
    if (state.hasGameEnded) {
      return;
    }
    if (movingPlayerId) {
      state.activeMovingPlayerId = movingPlayerId;
    }
    if (movingPlayerName) {
      state.activeMovingPlayerName = movingPlayerName;
    }
    if (state.activeMovingPlayerId) {
      state.isYourTurn = state.activeMovingPlayerId === state.playerId;
    } else {
      state.isYourTurn = state.activeMovingPlayerName === state.playerName;
    }
    const activeMovingPlayerName = state.activeMovingPlayerName;
    if (!activeMovingPlayerName) {
      elements.statusText.innerText = "";
      elements.statusText.style.color = "inherit";
      return;
    }
    if (state.isYourTurn) {
      elements.statusText.innerText = t("yourTurn");
      elements.statusText.style.color = "green";
    } else if (state.isBotGame && state.botPlayerName && activeMovingPlayerName === state.botPlayerName) {
      elements.statusText.innerText = t("botThinking");
      elements.statusText.style.color = "#b36b00";
    } else {
      elements.statusText.innerText = t("playerTurnFormat", { name: activeMovingPlayerName });
      elements.statusText.style.color = "red";
    }
  }
  function updateChat(elements, message, chat, isInternalMessage, isBlack) {
    const normalizedMessage = `${message || ""}`.trim();
    if (normalizedMessage.length === 0) {
      return;
    }
    if (isInternalMessage) {
      const lastEntry = chat.lastElementChild;
      if (lastEntry && lastEntry.classList.contains("chat-internal-msg")) {
        const lastMessage = (lastEntry.dataset.chatMessage || "").trim();
        const lastTimestamp = Number(lastEntry.dataset.chatTimestamp || 0);
        const now = Date.now();
        if (lastMessage === normalizedMessage && Number.isFinite(lastTimestamp) && now - lastTimestamp <= internalChatDedupWindowMs) {
          return;
        }
      }
    }
    const li = document.createElement("li");
    li.innerText = normalizedMessage;
    li.dataset.chatMessage = normalizedMessage;
    li.dataset.chatTimestamp = String(Date.now());
    if (isInternalMessage) {
      li.classList.add("chat-internal-msg", "chat-msg", "flex-start");
    } else if (isBlack) {
      li.classList.add("black-chat-msg", "chat-user-msg", "chat-msg", "flex-end");
    } else {
      li.classList.add("white-chat-msg", "chat-user-msg", "chat-msg", "flex-start");
    }
    chat.appendChild(li);
    while (chat.childElementCount > maxChatItems) {
      chat.removeChild(chat.firstElementChild);
    }
    chat.scrollTop = chat.scrollHeight;
  }
  function removeHighlight(color) {
    const highlightedSquares = document.querySelectorAll(`.highlight-${color}`);
    for (let i = 0; i < highlightedSquares.length; i++) {
      highlightedSquares[i].classList.remove(`highlight-${color}`);
    }
  }
  function setPlayAgainVsBotVisibility(elements, isVisible) {
    if (!elements.playAgainVsBotBtn) {
      return;
    }
    elements.playAgainVsBotBtn.style.display = isVisible ? "inline-flex" : "none";
  }
  function setConnectionStatus(elements, tone, message) {
    if (!elements.connectionPill) {
      return;
    }
    const normalizedTone = tone === "reconnecting" || tone === "syncing" || tone === "disconnected" || tone === "offline" ? tone : null;
    const text = (message || "").trim();
    elements.connectionPill.classList.remove(...connectionToneClasses);
    if (!normalizedTone || text === "") {
      elements.connectionPill.hidden = true;
      elements.connectionPill.textContent = "";
      return;
    }
    elements.connectionPill.hidden = false;
    elements.connectionPill.classList.add(`is-${normalizedTone}`);
    elements.connectionPill.textContent = text;
  }
  function resolveBotDifficultyLabel(elements, state) {
    if (!elements.botDifficultySelect) {
      return state.botDifficulty === "easy" ? "Easy" : "Normal";
    }
    const selectedOption = Array.from(elements.botDifficultySelect.options).find((option) => option.value === state.botDifficulty);
    if (selectedOption) {
      return selectedOption.textContent || selectedOption.innerText || selectedOption.value;
    }
    return state.botDifficulty === "easy" ? "Easy" : "Normal";
  }
  function updateBotDifficultyBadge(elements, state) {
    if (!elements.botDifficultyMeta || !elements.botDifficultyMetaValue) {
      return;
    }
    const shouldShow = !!state.isBotGame && (!!state.isGameStarted || !!state.hasGameEnded);
    elements.botDifficultyMeta.hidden = !shouldShow;
    if (!shouldShow) {
      return;
    }
    elements.botDifficultyMetaValue.textContent = resolveBotDifficultyLabel(elements, state);
  }
  function updateReplayControls(elements, state) {
    removeLegacyReplayDomArtifacts();
    const shouldLockInteractiveActions = !!state.hasGameEnded || !state.isGameStarted;
    const actionBusy = !!state.gameActionInFlight;
    const isBotMode = !!state.isBotGame;
    if (elements.offerDrawBtn) {
      elements.offerDrawBtn.hidden = isBotMode;
      elements.offerDrawBtn.style.display = isBotMode ? "none" : "";
    }
    if (elements.threefoldDrawBtn) {
      elements.threefoldDrawBtn.hidden = isBotMode;
      elements.threefoldDrawBtn.style.display = isBotMode ? "none" : "";
    }
    if (elements.offerDrawBtn) {
      elements.offerDrawBtn.disabled = isBotMode || shouldLockInteractiveActions || actionBusy;
    }
    if (elements.resignBtn) {
      elements.resignBtn.disabled = shouldLockInteractiveActions || actionBusy;
    }
    if (elements.threefoldDrawBtn && (shouldLockInteractiveActions || actionBusy)) {
      elements.threefoldDrawBtn.disabled = true;
    }
    if (elements.threefoldDrawBtn && isBotMode) {
      elements.threefoldDrawBtn.disabled = true;
    }
    if (elements.playAgainVsBotBtn) {
      const canReplayBotGame = state.isBotGame && state.hasGameEnded && !actionBusy;
      elements.playAgainVsBotBtn.disabled = !canReplayBotGame;
    }
  }
  var gameResultTones = /* @__PURE__ */ new Set(["win", "loss", "draw"]);
  var gameResultToneClasses = ["game-result-win", "game-result-loss", "game-result-draw"];
  function clearGameResultBanner(elements) {
    if (!elements.gameResultBanner) {
      return;
    }
    elements.gameResultBanner.textContent = "";
    elements.gameResultBanner.classList.add("game-result-hidden");
    elements.gameResultBanner.classList.remove("is-terminal");
    elements.gameResultBanner.classList.remove(...gameResultToneClasses);
  }
  function setGameResultBanner(elements, message, tone = "draw") {
    if (!elements.gameResultBanner) {
      return;
    }
    const normalizedTone = gameResultTones.has(tone) ? tone : "draw";
    elements.gameResultBanner.textContent = message || "";
    elements.gameResultBanner.classList.remove(...gameResultToneClasses);
    elements.gameResultBanner.classList.add(`game-result-${normalizedTone}`);
    elements.gameResultBanner.classList.add("is-terminal");
    elements.gameResultBanner.classList.remove("game-result-hidden");
  }
  function resetGameUi(elements, state) {
    removeLegacyReplayDomArtifacts();
    elements.statusCheck.style.display = "none";
    elements.statusCheck.textContent = "";
    clearGameResultBanner(elements);
    setConnectionStatus(elements, null, "");
    elements.whitePointsValue.innerText = "0";
    elements.blackPointsValue.innerText = "0";
    elements.blackPawnsTaken.innerText = "0";
    elements.blackKnightsTaken.innerText = "0";
    elements.blackBishopsTaken.innerText = "0";
    elements.blackRooksTaken.innerText = "0";
    elements.blackQueensTaken.innerText = "0";
    elements.whitePawnsTaken.innerText = "0";
    elements.whiteKnightsTaken.innerText = "0";
    elements.whiteBishopsTaken.innerText = "0";
    elements.whiteRooksTaken.innerText = "0";
    elements.whiteQueensTaken.innerText = "0";
    elements.whiteMoveHistory.innerHTML = "";
    elements.blackMoveHistory.innerHTML = "";
    elements.gameChatWindow.innerHTML = "";
    removeHighlight("white");
    removeHighlight("black");
    clearHintSquares();
    state.isGameStarted = false;
    state.hasGameEnded = false;
    state.gameOverCode = null;
    state.gameOverWinnerName = null;
    state.currentFen = "start";
    state.liveFen = "start";
    state.displayFen = "start";
    state.turnNumber = 1;
    state.activeMovingPlayerId = null;
    state.activeMovingPlayerName = null;
    state.isYourTurn = false;
    state.isInCheck = false;
    state.isBotGame = false;
    state.botPlayerId = null;
    state.botPlayerName = null;
    state.legalMoves = [];
    state.legalMovesRequestId += 1;
    state.syncRequestInFlight = false;
    state.syncRetryAttempt = 0;
    state.lobbyNameValid = false;
    state.lobbyActionInFlight = false;
    state.gameActionInFlight = false;
    state.mobilePanel = "board";
    if (state.pendingSyncTimeoutId) {
      clearTimeout(state.pendingSyncTimeoutId);
      state.pendingSyncTimeoutId = null;
    }
    if (state.pendingSyncRetryTimeoutId) {
      clearTimeout(state.pendingSyncRetryTimeoutId);
      state.pendingSyncRetryTimeoutId = null;
    }
    if (state.pendingBotRecoveryTimeoutId) {
      clearTimeout(state.pendingBotRecoveryTimeoutId);
      state.pendingBotRecoveryTimeoutId = null;
    }
    if (state.pendingHighlightTimeoutId) {
      clearTimeout(state.pendingHighlightTimeoutId);
      state.pendingHighlightTimeoutId = null;
    }
    if (state.board) {
      state.board.orientation("white");
      state.board.position("start", false);
    }
    setPlayAgainVsBotVisibility(elements, false);
    updateBotDifficultyBadge(elements, state);
    updateReplayControls(elements, state);
  }
  function getTakenValue(takenFigures, key) {
    if (!takenFigures || typeof takenFigures !== "object") {
      return "0";
    }
    if (Object.prototype.hasOwnProperty.call(takenFigures, key)) {
      return String(takenFigures[key] ?? 0);
    }
    return "0";
  }
  function applyGameStats(elements, game) {
    if (!game || !game.player1 || !game.player2) {
      return;
    }
    elements.whitePointsValue.innerText = String(game.player1.points ?? 0);
    elements.blackPointsValue.innerText = String(game.player2.points ?? 0);
    elements.blackPawnsTaken.innerText = getTakenValue(game.player1.takenFigures, "Pawn");
    elements.blackKnightsTaken.innerText = getTakenValue(game.player1.takenFigures, "Knight");
    elements.blackBishopsTaken.innerText = getTakenValue(game.player1.takenFigures, "Bishop");
    elements.blackRooksTaken.innerText = getTakenValue(game.player1.takenFigures, "Rook");
    elements.blackQueensTaken.innerText = getTakenValue(game.player1.takenFigures, "Queen");
    elements.whitePawnsTaken.innerText = getTakenValue(game.player2.takenFigures, "Pawn");
    elements.whiteKnightsTaken.innerText = getTakenValue(game.player2.takenFigures, "Knight");
    elements.whiteBishopsTaken.innerText = getTakenValue(game.player2.takenFigures, "Bishop");
    elements.whiteRooksTaken.innerText = getTakenValue(game.player2.takenFigures, "Rook");
    elements.whiteQueensTaken.innerText = getTakenValue(game.player2.takenFigures, "Queen");
  }
  function showWaitingForOpponent(elements, state, player) {
    resetGameUi(elements, state);
    state.playerId = player.id;
    state.playerColor = 0;
    state.playerName = player.name;
    state.playerOneName = player.name;
    state.playerTwoName = null;
    state.isBotGame = false;
    state.botPlayerId = null;
    state.botPlayerName = null;
    state.connectionState = "waiting";
    elements.lobbyContainer.style.display = "none";
    elements.playground.style.display = "grid";
    elements.board.style.pointerEvents = "none";
    $(".game-btn").prop("disabled", true);
    elements.whiteName.textContent = player.name;
    elements.whiteRating.textContent = player.rating;
    elements.blackName.textContent = "?";
    elements.blackRating.textContent = t("notAvailable");
    elements.statusText.style.color = "red";
    elements.statusText.innerText = t("waitingForOpponent");
    setPlayAgainVsBotVisibility(elements, false);
  }
  function reportClientError(elements, error, inputElement) {
    const message = normalizeErrorMessage(error);
    console.error(error);
    if (inputElement && typeof inputElement.setCustomValidity === "function" && typeof inputElement.reportValidity === "function") {
      inputElement.setCustomValidity(message);
      inputElement.reportValidity();
      setTimeout(() => inputElement.setCustomValidity(""), 2200);
    }
    if (elements.statusText && elements.playground && elements.playground.style.display !== "none") {
      elements.statusText.style.color = "#b42318";
      elements.statusText.innerText = message;
    }
  }

  // wwwroot/js/src/chat.js
  var maxChatMessageLength = 300;
  var nearLimitThreshold = 240;
  function normalizeChatMessage(message) {
    if (typeof message !== "string") {
      return "";
    }
    return message.trim();
  }
  function validateChatMessage(elements, message, inputElement) {
    if (message.length === 0) {
      reportClientError(elements, new Error(t("hubErrorMessageEmpty")), inputElement);
      inputElement.focus();
      return false;
    }
    if (message.length > maxChatMessageLength) {
      reportClientError(elements, new Error(t("hubErrorMessageTooLong")), inputElement);
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
    counterElement.classList.toggle("is-near-limit", safeLength >= nearLimitThreshold && safeLength <= maxChatMessageLength);
    counterElement.classList.toggle("is-over-limit", safeLength > maxChatMessageLength);
  }
  function syncSendButtonState(inputElement, sendButton, counterElement) {
    if (!inputElement || !sendButton) {
      return;
    }
    const rawValue = inputElement.value || "";
    const rawLength = rawValue.length;
    const message = normalizeChatMessage(rawValue);
    sendButton.disabled = message.length === 0 || message.length > maxChatMessageLength;
    syncChatCounter(counterElement, rawLength);
  }
  function bindChatHandlers(connection, elements) {
    elements.lobbyChatSendBtn.addEventListener("click", function onLobbyChatSend() {
      const message = normalizeChatMessage(elements.lobbyChatInput.value || "");
      if (!validateChatMessage(elements, message, elements.lobbyChatInput)) {
        return;
      }
      connection.invoke("LobbySendMessage", message).then(() => {
        elements.lobbyChatInput.value = "";
        syncSendButtonState(elements.lobbyChatInput, elements.lobbyChatSendBtn, elements.lobbyChatCounter);
      }).catch((err) => reportClientError(elements, err, elements.lobbyChatInput));
    });
    elements.gameChatSendBtn.addEventListener("click", function onGameChatSend() {
      const message = normalizeChatMessage(elements.gameChatInput.value || "");
      if (!validateChatMessage(elements, message, elements.gameChatInput)) {
        return;
      }
      connection.invoke("GameSendMessage", message).then(() => {
        elements.gameChatInput.value = "";
        syncSendButtonState(elements.gameChatInput, elements.gameChatSendBtn, elements.gameChatCounter);
      }).catch((err) => reportClientError(elements, err, elements.gameChatInput));
    });
    elements.lobbyChatInput.addEventListener("keydown", function onLobbyChatKeyDown(e) {
      if (e.key === "Enter") {
        e.preventDefault();
        elements.lobbyChatSendBtn.click();
      }
    });
    elements.gameChatInput.addEventListener("keydown", function onGameChatKeyDown(e) {
      if (e.key === "Enter") {
        e.preventDefault();
        elements.gameChatSendBtn.click();
      }
    });
    elements.lobbyChatInput.addEventListener("input", function onLobbyChatInput() {
      syncSendButtonState(elements.lobbyChatInput, elements.lobbyChatSendBtn, elements.lobbyChatCounter);
    });
    elements.gameChatInput.addEventListener("input", function onGameChatInput() {
      syncSendButtonState(elements.gameChatInput, elements.gameChatSendBtn, elements.gameChatCounter);
    });
    syncSendButtonState(elements.lobbyChatInput, elements.lobbyChatSendBtn, elements.lobbyChatCounter);
    syncSendButtonState(elements.gameChatInput, elements.gameChatSendBtn, elements.gameChatCounter);
  }
  function bindGameOptionHandlers(connection, elements, state) {
    function runGameAction(action) {
      if (state.gameActionInFlight) {
        return;
      }
      state.gameActionInFlight = true;
      updateReplayControls(elements, state);
      Promise.resolve().then(action).catch((err) => reportClientError(elements, err, elements.gameChatInput)).finally(() => {
        state.gameActionInFlight = false;
        updateReplayControls(elements, state);
      });
    }
    elements.threefoldDrawBtn.addEventListener("click", function onThreefoldClick() {
      runGameAction(() => connection.invoke("ThreefoldDraw"));
    });
    elements.offerDrawBtn.addEventListener("click", function onOfferDrawClick() {
      const oldText = elements.statusText.innerText;
      const oldColor = elements.statusText.style.color;
      const pendingText = t("drawRequestSent");
      elements.statusText.style.color = "black";
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
      runGameAction(() => connection.invoke("OfferDrawRequest"));
    });
    elements.resignBtn.addEventListener("click", function onResignClick() {
      runGameAction(() => connection.invoke("Resign"));
    });
    if (elements.playAgainVsBotBtn) {
      elements.playAgainVsBotBtn.addEventListener("click", function onPlayAgainVsBotClick() {
        if (!state.isBotGame || !state.hasGameEnded) {
          return;
        }
        const nameFromState = (state.playerName || "").trim();
        const fallbackName = (elements.lobbyInputName.value || "").trim();
        const playerName = nameFromState || fallbackName;
        if (playerName === "") {
          elements.lobbyInputName.focus();
          return;
        }
        const difficulty = state.botDifficulty === "easy" ? "easy" : "normal";
        runGameAction(() => connection.invoke("StartVsBotWithDifficulty", playerName, difficulty).then((player) => {
          state.playerId = player.id;
        }));
      });
    }
    updateReplayControls(elements, state);
  }

  // wwwroot/js/src/state.js
  var storageKeys = {
    boardTheme: "chess.boardTheme",
    pieceTheme: "chess.pieceTheme",
    checkHints: "chess.checkHints",
    legalMoveHints: "chess.legalMoveHints",
    botDifficulty: "chess.botDifficulty",
    lobbyName: "chess.lobbyName"
  };
  var boardThemes = {
    classic: "board-theme-classic",
    forest: "board-theme-forest",
    midnight: "board-theme-midnight"
  };
  var pieceThemes = {
    wikipedia: "img/chesspieces/wikipedia/{piece}.png",
    alpha: "img/chesspieces/alpha/320/{piece}.png",
    leipzig: "img/chesspieces/leipzig/320/{piece}.png"
  };
  var botDifficulties = {
    easy: "easy",
    normal: "normal"
  };
  function getElements() {
    return {
      playground: document.querySelector(".main-playground"),
      board: document.querySelector("#board"),
      mobileTabs: document.querySelector(".game-mobile-tabs"),
      mobileTabButtons: Array.from(document.querySelectorAll(".game-mobile-tab-btn")),
      botDifficultyMeta: document.querySelector(".game-live-bot-difficulty"),
      botDifficultyMetaValue: document.querySelector(".game-live-bot-difficulty-value"),
      connectionPill: document.querySelector(".game-connection-pill"),
      gameResultBanner: document.querySelector(".game-result-banner"),
      statusText: document.querySelector(".status-bar-text"),
      statusCheck: document.querySelector(".status-bar-check-notification"),
      whiteName: document.querySelector(".main-playground-white-name"),
      whitePointsValue: document.querySelector(".white-points-value"),
      whiteRating: document.querySelector(".main-playground-white-rating"),
      whiteMoveHistory: document.querySelector(".main-playground-white-move-history"),
      blackPawnsTaken: document.querySelector(".taken-pieces-black-pawn-value"),
      blackKnightsTaken: document.querySelector(".taken-pieces-black-knight-value"),
      blackBishopsTaken: document.querySelector(".taken-pieces-black-bishop-value"),
      blackRooksTaken: document.querySelector(".taken-pieces-black-rook-value"),
      blackQueensTaken: document.querySelector(".taken-pieces-black-queen-value"),
      blackName: document.querySelector(".main-playground-black-name"),
      blackRating: document.querySelector(".main-playground-black-rating"),
      blackPointsValue: document.querySelector(".black-points-value"),
      blackMoveHistory: document.querySelector(".main-playground-black-move-history"),
      whitePawnsTaken: document.querySelector(".taken-pieces-white-pawn-value"),
      whiteKnightsTaken: document.querySelector(".taken-pieces-white-knight-value"),
      whiteBishopsTaken: document.querySelector(".taken-pieces-white-bishop-value"),
      whiteRooksTaken: document.querySelector(".taken-pieces-white-rook-value"),
      whiteQueensTaken: document.querySelector(".taken-pieces-white-queen-value"),
      gameChatWindow: document.querySelector(".game-chat-window"),
      lobbyChatWindow: document.querySelector(".game-lobby-chat-window"),
      rooms: document.querySelector(".game-lobby-room-container"),
      lobbyRoomCount: document.querySelector(".game-lobby-room-count"),
      lobbyInputName: document.querySelector(".game-lobby-input-name"),
      lobbyInputCreateBtn: document.querySelector(".game-lobby-input-create-btn"),
      botDifficultySelect: document.querySelector("#bot-difficulty-select"),
      lobbyInputVsBotBtn: document.querySelector(".game-lobby-input-vs-bot-btn"),
      lobbyChatInput: document.querySelector(".game-lobby-chat-input"),
      lobbyChatSendBtn: document.querySelector(".game-lobby-chat-send-btn"),
      lobbyChatCounter: document.querySelector(".game-lobby-chat-counter"),
      gameChatInput: document.querySelector(".game-chat-input"),
      gameChatSendBtn: document.querySelector(".game-chat-send-btn"),
      gameChatCounter: document.querySelector(".game-chat-counter"),
      resignBtn: document.querySelector(".resign-btn"),
      offerDrawBtn: document.querySelector(".offer-draw-btn"),
      threefoldDrawBtn: document.querySelector(".threefold-draw-btn"),
      boardThemeSelect: document.querySelector("#board-theme-select"),
      pieceThemeSelect: document.querySelector("#piece-theme-select"),
      checkHintsToggle: document.querySelector("#check-hints-toggle"),
      legalMovesToggle: document.querySelector("#legal-moves-toggle"),
      lobbyContainer: document.querySelector(".game-lobby"),
      playAgainVsBotBtn: document.querySelector(".game-play-again-btn")
    };
  }
  function createState() {
    return {
      playerId: null,
      playerName: null,
      playerColor: null,
      playerOneName: null,
      playerTwoName: null,
      isBotGame: false,
      botPlayerId: null,
      botPlayerName: null,
      liveFen: "start",
      displayFen: "start",
      board: null,
      currentFen: "start",
      isGameStarted: false,
      hasGameEnded: false,
      gameOverCode: null,
      gameOverWinnerName: null,
      mobilePanel: "board",
      connectionState: "disconnected",
      turnNumber: 1,
      activeMovingPlayerId: null,
      activeMovingPlayerName: null,
      isYourTurn: false,
      isInCheck: false,
      legalMoves: [],
      legalMovesRequestId: 0,
      syncRequestInFlight: false,
      pendingSyncTimeoutId: null,
      pendingSyncRetryTimeoutId: null,
      syncRetryAttempt: 0,
      pendingBotRecoveryTimeoutId: null,
      pendingHighlightTimeoutId: null,
      boardInitialized: false,
      selectedBoardTheme: getStoredValue(storageKeys.boardTheme, "classic", boardThemes),
      selectedPieceTheme: getStoredValue(storageKeys.pieceTheme, "wikipedia", pieceThemes),
      hintsEnabled: getStoredBoolean(storageKeys.checkHints, true),
      legalHintsEnabled: getStoredBoolean(storageKeys.legalMoveHints, true),
      botDifficulty: getStoredValue(storageKeys.botDifficulty, "normal", botDifficulties),
      lobbyNameValid: false,
      lobbyActionInFlight: false,
      gameActionInFlight: false
    };
  }
  function getStoredValue(storageKey, fallbackValue, options) {
    try {
      const storedValue = localStorage.getItem(storageKey);
      if (storedValue !== null && Object.prototype.hasOwnProperty.call(options, storedValue)) {
        return storedValue;
      }
    } catch (error) {
    }
    return fallbackValue;
  }
  function storeValue(storageKey, value) {
    try {
      localStorage.setItem(storageKey, value);
    } catch (error) {
    }
  }
  function getStoredBoolean(storageKey, fallbackValue) {
    try {
      const storedValue = localStorage.getItem(storageKey);
      if (storedValue === null) {
        return fallbackValue;
      }
      return storedValue === "true";
    } catch (error) {
      return fallbackValue;
    }
  }
  function storeBoolean(storageKey, value) {
    try {
      localStorage.setItem(storageKey, value ? "true" : "false");
    } catch (error) {
    }
  }
  function getStoredText(storageKey, fallbackValue = "") {
    try {
      const storedValue = localStorage.getItem(storageKey);
      if (typeof storedValue === "string") {
        return storedValue;
      }
    } catch (error) {
    }
    return fallbackValue;
  }

  // wwwroot/js/src/connection.js
  function createConnection() {
    return new signalR.HubConnectionBuilder().withUrl("/hub").withAutomaticReconnect().build();
  }
  function normalizeStartPayload(payload) {
    const game = payload && payload.game ? payload.game : payload;
    const botPlayerId = payload && payload.botPlayerId ? payload.botPlayerId : null;
    const botPlayerName = payload && payload.botPlayerName ? payload.botPlayerName : null;
    const isBotGame = payload && typeof payload.isBotGame === "boolean" ? payload.isBotGame : !!botPlayerId;
    return {
      game,
      startFen: payload && payload.startFen ? payload.startFen : "start",
      movingPlayerId: payload && payload.movingPlayerId ? payload.movingPlayerId : game && game.movingPlayer ? game.movingPlayer.id : null,
      movingPlayerName: payload && payload.movingPlayerName ? payload.movingPlayerName : game && game.movingPlayer ? game.movingPlayer.name : null,
      turnNumber: payload && payload.turnNumber ? payload.turnNumber : game && game.turn ? game.turn : 1,
      selfPlayerId: payload && payload.selfPlayerId ? payload.selfPlayerId : null,
      selfPlayerName: payload && payload.selfPlayerName ? payload.selfPlayerName : null,
      isBotGame,
      gameMode: payload && payload.gameMode ? payload.gameMode : isBotGame ? "bot" : "pvp",
      botPlayerId,
      botPlayerName,
      botDifficulty: payload && payload.botDifficulty ? payload.botDifficulty : "normal"
    };
  }
  function getLobbyStorageKey(elements) {
    const dataKey = elements.lobbyInputName ? (elements.lobbyInputName.dataset.storageKey || "").trim() : "";
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
      selfPlayerName
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
    return state.isGameStarted && !state.hasGameEnded && state.connectionState !== "offline" && state.connectionState !== "disconnected";
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
    return connection.invoke("RequestSync").then(() => {
      state.syncRetryAttempt = 0;
      clearSyncRetryTimer(state);
      return true;
    }).catch((err) => {
      console.error(err);
      if (shouldAttemptSyncRecovery(state)) {
        state.syncRetryAttempt = Math.min((state.syncRetryAttempt || 0) + 1, 3);
        scheduleSyncRetry(connection, state);
      }
      return false;
    }).finally(() => {
      state.syncRequestInFlight = false;
    });
  }
  function applyOfflineState(elements, state) {
    state.connectionState = "offline";
    state.isYourTurn = false;
    clearSyncWatchdog(state);
    clearSyncRetryTimer(state);
    clearBotRecoveryWatchdog(state);
    elements.board.style.pointerEvents = "none";
    setConnectionStatus(elements, "offline", t("connectionOffline"));
    if (!state.hasGameEnded) {
      elements.statusText.style.color = "#b36b00";
      elements.statusText.innerText = t("connectionOffline");
    }
    updateReplayControls(elements, state);
  }
  function tryRecoverFromOffline(connection, elements, state) {
    if (state.connectionState !== "offline" || !navigator.onLine) {
      return;
    }
    if (connection.state === signalR.HubConnectionState.Connected) {
      state.connectionState = "connected";
      setConnectionStatus(elements, "syncing", t("connectionSyncing"));
      if (state.isGameStarted) {
        requestSyncSafely(connection, state);
      }
      return;
    }
    state.connectionState = "reconnecting";
    setConnectionStatus(elements, "reconnecting", t("connectionReconnecting"));
  }
  function scheduleSyncWatchdog2(connection, state) {
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
      if (state.connectionState === "reconnecting" || state.connectionState === "disconnected" || state.connectionState === "offline") {
        return;
      }
      if (state.isYourTurn || !isBotToMove(state)) {
        return;
      }
      requestSyncSafely(connection, state).finally(() => {
        if (!state.isGameStarted || state.hasGameEnded) {
          return;
        }
        if (state.connectionState === "reconnecting" || state.connectionState === "disconnected" || state.connectionState === "offline") {
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
      if (typeof onCompleted === "function") {
        onCompleted();
      }
      return;
    }
    const requestId = state.legalMovesRequestId + 1;
    state.legalMovesRequestId = requestId;
    connection.invoke("GetLegalMoves").then((moves) => {
      if (requestId !== state.legalMovesRequestId || !state.isGameStarted || !state.isYourTurn) {
        return;
      }
      state.legalMoves = Array.isArray(moves) ? moves : [];
      if (typeof onCompleted === "function") {
        onCompleted();
      }
    }).catch((err) => {
      console.error(err);
      if (typeof onCompleted === "function") {
        onCompleted();
      }
    });
  }
  function syncTurnDependentState(connection, elements, state, movingPlayerId, movingPlayerName) {
    clearHintSquares();
    removeHighlight("white");
    removeHighlight("black");
    clearHighlightTimer(state);
    if (state.hasGameEnded) {
      clearBotRecoveryWatchdog(state);
      state.isYourTurn = false;
      state.legalMoves = [];
      state.legalMovesRequestId += 1;
      elements.board.style.pointerEvents = "none";
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
    if (state.isGameStarted && state.connectionState !== "reconnecting" && state.connectionState !== "disconnected" && state.connectionState !== "offline" && state.isYourTurn) {
      elements.board.style.pointerEvents = "auto";
    } else {
      elements.board.style.pointerEvents = "none";
    }
    updateReplayControls(elements, state);
  }
  function scheduleHighlightCleanup(state) {
    clearHighlightTimer(state);
    state.pendingHighlightTimeoutId = setTimeout(() => {
      state.pendingHighlightTimeoutId = null;
      removeHighlight("white");
      removeHighlight("black");
    }, 1200);
  }
  function resolveGameResultTone(state, player, gameOver) {
    const isPlayerKnown = !!(player && player.name);
    const isCurrentPlayer = isPlayerKnown && player.name === state.playerName;
    switch (gameOver) {
      case 1:
        return isPlayerKnown ? isCurrentPlayer ? "win" : "loss" : "draw";
      case 2:
      case 3:
      case 4:
      case 5:
      case 8:
        return "draw";
      case 6:
      case 7:
        return isPlayerKnown ? isCurrentPlayer ? "loss" : "win" : "draw";
      default:
        return "draw";
    }
  }
  function registerConnectionHandlers(connection, elements, state) {
    window.addEventListener("offline", () => {
      applyOfflineState(elements, state);
    });
    window.addEventListener("online", () => {
      tryRecoverFromOffline(connection, elements, state);
    });
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible" && state.isGameStarted) {
        if (state.connectionState === "offline") {
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
      state.connectionState = "reconnecting";
      state.isYourTurn = false;
      clearSyncWatchdog(state);
      clearSyncRetryTimer(state);
      clearBotRecoveryWatchdog(state);
      clearHighlightTimer(state);
      elements.board.style.pointerEvents = "none";
      setConnectionStatus(elements, "reconnecting", t("connectionReconnecting"));
      if (!state.hasGameEnded) {
        elements.statusText.style.color = "#b36b00";
        elements.statusText.innerText = t("connectionReconnecting");
      }
    });
    connection.onreconnected(function onReconnected() {
      if (!navigator.onLine) {
        applyOfflineState(elements, state);
        return;
      }
      state.connectionState = "connected";
      setConnectionStatus(elements, "syncing", t("connectionSyncing"));
      if (state.isGameStarted) {
        requestSyncSafely(connection, state);
      }
    });
    connection.onclose(function onClosed() {
      if (!navigator.onLine) {
        applyOfflineState(elements, state);
        return;
      }
      state.connectionState = "disconnected";
      state.isYourTurn = false;
      clearSyncWatchdog(state);
      clearSyncRetryTimer(state);
      clearBotRecoveryWatchdog(state);
      clearHighlightTimer(state);
      elements.board.style.pointerEvents = "none";
      setConnectionStatus(elements, "disconnected", t("connectionDisconnected"));
      if (!state.hasGameEnded) {
        elements.statusText.style.color = "#b42318";
        elements.statusText.innerText = t("connectionDisconnected");
      }
    });
    connection.on("AddRoom", function onAddRoom(player) {
      if (!player || !player.id) {
        return;
      }
      const roomId = String(player.id);
      const existingRoom = elements.rooms.querySelector(`.game-lobby-room-item[data-room-id="${roomId}"]`);
      if (existingRoom) {
        return;
      }
      const emptyState = elements.rooms.querySelector(".game-lobby-room-empty");
      if (emptyState) {
        emptyState.remove();
      }
      elements.rooms.appendChild(createRoomElement(player));
      const appendedJoinButton = elements.rooms.querySelector(`.game-lobby-room-item[data-room-id="${roomId}"] .game-lobby-room-join-btn`);
      if (appendedJoinButton) {
        const disableJoin = !!state.lobbyActionInFlight || !state.lobbyNameValid;
        appendedJoinButton.disabled = disableJoin;
        appendedJoinButton.classList.toggle("is-disabled", disableJoin);
        appendedJoinButton.classList.toggle("is-loading", !!state.lobbyActionInFlight);
      }
      if (elements.lobbyRoomCount) {
        const totalRooms = elements.rooms.querySelectorAll(".game-lobby-room-item").length;
        elements.lobbyRoomCount.textContent = String(totalRooms);
      }
    });
    connection.on("ListRooms", function onListRooms(waitingPlayers) {
      const disableJoin = !!state.lobbyActionInFlight || !state.lobbyNameValid;
      renderRooms(elements.rooms, waitingPlayers, disableJoin);
    });
    connection.on("Start", function onStart(startPayload) {
      const normalizedPayload = normalizeStartPayload(startPayload);
      const game = normalizedPayload.game;
      if (!game) {
        return;
      }
      resetGameUi(elements, state);
      elements.lobbyContainer.style.display = "none";
      elements.playground.style.display = "grid";
      elements.board.style.pointerEvents = "auto";
      $(".game-btn").prop("disabled", false);
      $(".threefold-draw-btn").prop("disabled", true);
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
        state.botDifficulty = normalizedPayload.botDifficulty === "easy" ? "easy" : "normal";
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
      state.currentFen = normalizedPayload.startFen || "start";
      state.liveFen = state.currentFen;
      state.displayFen = state.currentFen;
      state.isGameStarted = true;
      state.connectionState = "in-game";
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
      setConnectionStatus(elements, null, "");
      setPlayAgainVsBotVisibility(elements, false);
      updateReplayControls(elements, state);
      state.mobilePanel = "board";
      if (elements.playground) {
        elements.playground.dataset.mobilePanel = "board";
      }
      if (Array.isArray(elements.mobileTabButtons)) {
        elements.mobileTabButtons.forEach((button) => {
          const isBoardTab = button.dataset.mobilePanel === "board";
          button.classList.toggle("is-active", isBoardTab);
          button.setAttribute("aria-selected", isBoardTab ? "true" : "false");
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
        normalizedPayload.movingPlayerName || game.movingPlayer.name
      );
      if (state.isBotGame && state.botPlayerName) {
        updateChat(
          elements,
          t("botJoinedGame", { name: state.botPlayerName }),
          elements.gameChatWindow,
          true,
          false
        );
      }
    });
    connection.on("BoardMove", function onBoardMove(source, target) {
      if (!state.board) {
        return;
      }
      clearHintSquares();
      state.board.move(`${source}-${target}`);
      state.displayFen = state.board.fen();
      scheduleSyncWatchdog2(connection, state);
    });
    connection.on("BoardSnapback", function onBoardSnapback(fen) {
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
    connection.on("BoardSetPosition", function onBoardSetPosition(fen) {
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
    connection.on("EnPassantTake", function onEnPassantTake(pawnPosition, target) {
      if (!state.board) {
        return;
      }
      clearHintSquares();
      state.board.move(`${target}-${pawnPosition}`, `${pawnPosition}-${target}`);
      state.displayFen = state.board.fen();
      scheduleSyncWatchdog2(connection, state);
    });
    connection.on("SyncPosition", function onSyncPosition(fen, movingPlayerName, turnNumber, movingPlayerId) {
      clearSyncWatchdog(state);
      removeHighlight("white");
      removeHighlight("black");
      state.turnNumber = turnNumber;
      applySyncPosition(state, elements, fen, movingPlayerId, movingPlayerName);
      if (!state.hasGameEnded) {
        syncTurnDependentState(connection, elements, state, movingPlayerId, movingPlayerName);
      }
      if (state.connectionState === "connected" || state.connectionState === "in-game") {
        setConnectionStatus(elements, null, "");
      }
      updateReplayControls(elements, state);
    });
    connection.on("GameOver", function onGameOver(player, gameOver) {
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
      removeHighlight("white");
      removeHighlight("black");
      elements.statusText.style.color = "purple";
      elements.board.style.pointerEvents = "none";
      switch (gameOver) {
        case 1:
          if (player && player.name) {
            elements.statusText.innerText = t("checkmateWinFormat", { name: player.name.toUpperCase() });
          } else {
            elements.statusText.innerText = t("checkmate");
          }
          elements.statusCheck.style.display = "none";
          break;
        case 2:
          elements.statusText.innerText = t("stalemate");
          break;
        case 3:
          elements.statusText.innerText = t("draw");
          break;
        case 4:
          if (player && player.name) {
            elements.statusText.innerText = t("threefoldDeclaredByFormat", { name: player.name.toUpperCase() });
          } else {
            elements.statusText.innerText = t("draw");
          }
          break;
        case 5:
          elements.statusText.innerText = t("fivefoldDraw");
          break;
        case 6:
          if (player && player.name) {
            elements.statusText.innerText = t("resignedFormat", { name: player.name.toUpperCase() });
          } else {
            elements.statusText.innerText = t("draw");
          }
          break;
        case 7:
          if (player && player.name) {
            elements.statusText.innerText = t("leftYouWinFormat", { name: player.name.toUpperCase() });
          } else {
            elements.statusText.innerText = t("draw");
          }
          break;
        case 8:
          elements.statusText.innerText = t("fiftyMoveDraw");
          break;
        default:
          break;
      }
      const resultTone = resolveGameResultTone(state, player, gameOver);
      let resultPrefix = t("gameResultDraw");
      if (resultTone === "win") {
        resultPrefix = t("gameResultWin");
      } else if (resultTone === "loss") {
        resultPrefix = t("gameResultLoss");
      }
      const resultMessage = elements.statusText.innerText ? `${resultPrefix} ${elements.statusText.innerText}`.trim() : resultPrefix;
      setGameResultBanner(elements, resultMessage, resultTone);
      $(".option-btn").prop("disabled", true);
      setPlayAgainVsBotVisibility(elements, state.isBotGame);
      updateReplayControls(elements, state);
    });
    connection.on("ThreefoldAvailable", function onThreefoldAvailable(isAvailable) {
      $(".threefold-draw-btn").prop("disabled", !isAvailable);
    });
    connection.on("CheckStatus", function onCheckStatus(type) {
      state.isInCheck = type === 2;
      if (state.isInCheck) {
        elements.statusCheck.style.display = "inline";
        if (state.hintsEnabled && state.isYourTurn) {
          elements.statusCheck.innerText = `${t("check")}: ${t("checkEscapeHint")}`;
          refreshLegalMoves(connection, state);
        } else {
          elements.statusCheck.innerText = t("check");
        }
        clearHintSquares();
      } else {
        elements.statusCheck.style.display = "none";
        elements.statusCheck.innerText = "";
        clearHintSquares();
      }
    });
    connection.on("InvalidMove", function onInvalidMove(type) {
      if (state.hasGameEnded) {
        return;
      }
      elements.statusText.style.color = "red";
      switch (type) {
        case 3:
          elements.statusText.innerText = t("kingInCheck");
          break;
        case 4:
          elements.statusText.innerText = t("willOpenCheck");
          break;
        default:
          elements.statusText.innerText = t("invalidMove");
          break;
      }
      sleep(1200).then(() => {
        if (state.hasGameEnded) {
          return;
        }
        requestSyncSafely(connection, state).finally(() => {
          if (state.hasGameEnded) {
            return;
          }
          syncTurnDependentState(
            connection,
            elements,
            state,
            state.activeMovingPlayerId,
            state.activeMovingPlayerName
          );
        });
      });
    });
    connection.on("DrawOffered", function onDrawOffered(player) {
      const oldText = elements.statusText.innerText;
      const oldColor = elements.statusText.style.color;
      const yesButton = document.createElement("button");
      yesButton.innerText = t("yes");
      yesButton.classList.add("draw-offer-yes-btn", "draw-offer-button", "btn", "btn-primary");
      const noButton = document.createElement("button");
      noButton.innerText = t("no");
      noButton.classList.add("draw-offer-no-btn", "draw-offer-button", "btn", "btn-primary");
      elements.statusText.style.color = "black";
      elements.statusText.innerText = t("drawRequestQuestionFormat", { name: player.name });
      const container = document.createElement("div");
      container.classList.add("draw-offer-container");
      container.append(yesButton, noButton);
      elements.statusText.appendChild(container);
      yesButton.addEventListener("click", function onAcceptDraw() {
        connection.invoke("OfferDrawAnswer", true);
        if (!state.hasGameEnded) {
          elements.statusText.innerText = oldText;
          elements.statusText.style.color = oldColor;
        }
      });
      noButton.addEventListener("click", function onRejectDraw() {
        connection.invoke("OfferDrawAnswer", false);
        if (!state.hasGameEnded) {
          elements.statusText.innerText = oldText;
          elements.statusText.style.color = oldColor;
        }
      });
    });
    connection.on("DrawOfferRejected", function onDrawOfferRejected(player) {
      const oldText = elements.statusText.innerText;
      const oldColor = elements.statusText.style.color;
      const rejectedText = t("drawOfferRejectedFormat", { name: player.name });
      elements.statusText.style.color = "black";
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
    connection.on("UpdateTakenFigures", function onUpdateTakenFigures(movingPlayer, pieceName, points) {
      if (movingPlayer.name === state.playerOneName) {
        elements.whitePointsValue.innerText = points;
        switch (pieceName) {
          case "Pawn":
            elements.blackPawnsTaken.innerText++;
            break;
          case "Knight":
            elements.blackKnightsTaken.innerText++;
            break;
          case "Bishop":
            elements.blackBishopsTaken.innerText++;
            break;
          case "Rook":
            elements.blackRooksTaken.innerText++;
            break;
          case "Queen":
            elements.blackQueensTaken.innerText++;
            break;
          default:
            break;
        }
      } else {
        elements.blackPointsValue.innerText = points;
        switch (pieceName) {
          case "Pawn":
            elements.whitePawnsTaken.innerText++;
            break;
          case "Knight":
            elements.whiteKnightsTaken.innerText++;
            break;
          case "Bishop":
            elements.whiteBishopsTaken.innerText++;
            break;
          case "Rook":
            elements.whiteRooksTaken.innerText++;
            break;
          case "Queen":
            elements.whiteQueensTaken.innerText++;
            break;
          default:
            break;
        }
      }
    });
    connection.on("UpdateMoveHistory", function onUpdateMoveHistory(movingPlayer, moveNotation) {
      const li = document.createElement("li");
      li.classList.add("list-group-item");
      li.innerText = moveNotation;
      if (movingPlayer.name === state.playerOneName) {
        elements.whiteMoveHistory.appendChild(li);
        if (elements.whiteMoveHistory.getElementsByTagName("li").length > 40) {
          elements.whiteMoveHistory.removeChild(elements.whiteMoveHistory.childNodes[0]);
        }
      } else {
        elements.blackMoveHistory.appendChild(li);
        if (elements.blackMoveHistory.getElementsByTagName("li").length > 40) {
          elements.blackMoveHistory.removeChild(elements.blackMoveHistory.childNodes[0]);
        }
      }
      updateReplayControls(elements, state);
    });
    connection.on("UpdateStatus", function onUpdateStatus(movingPlayerIdOrName, movingPlayerNameMaybe) {
      if (state.hasGameEnded) {
        return;
      }
      const movingPlayerId = movingPlayerNameMaybe ? movingPlayerIdOrName : null;
      const movingPlayerName = movingPlayerNameMaybe || movingPlayerIdOrName;
      syncTurnDependentState(connection, elements, state, movingPlayerId, movingPlayerName);
    });
    connection.on("HighlightMove", function onHighlightMove(source, target, player) {
      const sourceSquare = document.getElementsByClassName(`square-${source}`);
      const targetSquare = document.getElementsByClassName(`square-${target}`);
      if (!sourceSquare.length || !targetSquare.length) {
        return;
      }
      clearHighlightTimer(state);
      removeHighlight("white");
      removeHighlight("black");
      if (player.name === state.playerOneName) {
        sourceSquare[0].classList.add("highlight-white");
        targetSquare[0].classList.add("highlight-white");
      } else {
        sourceSquare[0].classList.add("highlight-black");
        targetSquare[0].classList.add("highlight-black");
      }
      scheduleHighlightCleanup(state);
    });
    connection.on("UpdateGameChat", function onUpdateGameChat(message, player) {
      const isBlack = player.name !== state.playerOneName;
      updateChat(elements, message, elements.gameChatWindow, false, isBlack);
    });
    connection.on("UpdateGameChatInternalMessage", function onUpdateGameChatInternalMessage(message) {
      updateChat(elements, message, elements.gameChatWindow, true, false);
    });
    connection.on("UpdateLobbyChat", function onUpdateLobbyChat(message) {
      updateChat(elements, message, elements.lobbyChatWindow, false, false);
    });
    connection.on("UpdateLobbyChatInternalMessage", function onUpdateLobbyChatInternalMessage(message) {
      updateChat(elements, message, elements.lobbyChatWindow, true, false);
    });
  }

  // wwwroot/js/src/lobby.js
  var playerNamePattern = /^[A-Za-z0-9_]{3,20}$/;
  function getLobbyStorageKey2(elements) {
    const dataKey = (elements.lobbyInputName.dataset.storageKey || "").trim();
    return dataKey || storageKeys.lobbyName;
  }
  function storeLobbyName(lobbyStorageKey, name) {
    if (!name || !playerNamePattern.test(name)) {
      return;
    }
    storeValue(lobbyStorageKey, name);
    if (lobbyStorageKey !== storageKeys.lobbyName) {
      storeValue(storageKeys.lobbyName, name);
    }
  }
  function setLobbyButtonsDisabled(elements, shouldDisable, isBusy) {
    elements.lobbyInputCreateBtn.disabled = shouldDisable;
    elements.lobbyInputCreateBtn.classList.toggle("is-disabled", shouldDisable);
    elements.lobbyInputCreateBtn.classList.toggle("is-loading", !!isBusy);
    if (elements.lobbyInputVsBotBtn) {
      elements.lobbyInputVsBotBtn.disabled = shouldDisable;
      elements.lobbyInputVsBotBtn.classList.toggle("is-disabled", shouldDisable);
      elements.lobbyInputVsBotBtn.classList.toggle("is-loading", !!isBusy);
    }
    $(".game-lobby-room-join-btn").prop("disabled", shouldDisable).toggleClass("is-disabled", shouldDisable).toggleClass("is-loading", !!isBusy);
  }
  function isLobbyNameValid(elements) {
    const name = (elements.lobbyInputName.value || "").trim();
    return playerNamePattern.test(name);
  }
  function syncLobbyNameValidity(elements, state) {
    const isValid = isLobbyNameValid(elements);
    state.lobbyNameValid = isValid;
    const shouldDisableActions = state.lobbyActionInFlight || !isValid;
    setLobbyButtonsDisabled(elements, shouldDisableActions, state.lobbyActionInFlight);
    if (typeof elements.lobbyInputName.setCustomValidity === "function") {
      if (isValid || elements.lobbyInputName.value.trim().length === 0) {
        elements.lobbyInputName.setCustomValidity("");
      } else {
        elements.lobbyInputName.setCustomValidity(t("hubErrorNameInvalid"));
      }
    }
    const lobbyStorageKey = getLobbyStorageKey2(elements);
    const name = (elements.lobbyInputName.value || "").trim();
    if (name.length > 0 && playerNamePattern.test(name)) {
      storeLobbyName(lobbyStorageKey, name);
    }
  }
  function tryGetLobbyName(elements) {
    const name = (elements.lobbyInputName.value || "").trim();
    if (name === "") {
      reportClientError(elements, new Error(t("hubErrorNameInvalid")), elements.lobbyInputName);
      elements.lobbyInputName.focus();
      return null;
    }
    if (!playerNamePattern.test(name)) {
      reportClientError(elements, new Error(t("hubErrorNameInvalid")), elements.lobbyInputName);
      elements.lobbyInputName.focus();
      return null;
    }
    storeLobbyName(getLobbyStorageKey2(elements), name);
    return name;
  }
  function runLobbyAction(elements, state, action) {
    if (state.lobbyActionInFlight) {
      return;
    }
    state.lobbyActionInFlight = true;
    elements.lobbyContainer.classList.add("is-loading");
    syncLobbyNameValidity(elements, state);
    action().catch((err) => reportClientError(elements, err, elements.lobbyInputName)).finally(() => {
      state.lobbyActionInFlight = false;
      elements.lobbyContainer.classList.remove("is-loading");
      syncLobbyNameValidity(elements, state);
    });
  }
  function normalizeDifficulty(value) {
    return value === "easy" ? "easy" : "normal";
  }
  function getSelectedBotDifficulty(elements, state) {
    const rawValue = elements.botDifficultySelect ? elements.botDifficultySelect.value : state.botDifficulty;
    const normalized = normalizeDifficulty(rawValue);
    state.botDifficulty = normalized;
    storeValue(storageKeys.botDifficulty, normalized);
    return normalized;
  }
  function resolvePersistedLobbyName(lobbyStorageKey, defaultLobbyName) {
    const rememberedScopedName = getStoredText(lobbyStorageKey, "").trim();
    if (playerNamePattern.test(rememberedScopedName)) {
      return rememberedScopedName;
    }
    const rememberedGlobalName = getStoredText(storageKeys.lobbyName, "").trim();
    if (playerNamePattern.test(rememberedGlobalName)) {
      return rememberedGlobalName;
    }
    if (playerNamePattern.test(defaultLobbyName)) {
      return defaultLobbyName;
    }
    return "";
  }
  function bindLobbyHandlers(connection, elements, state) {
    const lobbyStorageKey = getLobbyStorageKey2(elements);
    const defaultLobbyName = (elements.lobbyInputName.dataset.defaultName || "").trim();
    const persistedLobbyName = resolvePersistedLobbyName(lobbyStorageKey, defaultLobbyName);
    if (!elements.lobbyInputName.value.trim() && persistedLobbyName) {
      elements.lobbyInputName.value = persistedLobbyName;
    }
    const ensureLobbyNameIsSeeded = () => {
      const current = (elements.lobbyInputName.value || "").trim();
      if (playerNamePattern.test(current)) {
        return current;
      }
      const fallbackName = resolvePersistedLobbyName(lobbyStorageKey, defaultLobbyName);
      if (fallbackName) {
        elements.lobbyInputName.value = fallbackName;
        storeValue(lobbyStorageKey, fallbackName);
        return fallbackName;
      }
      return "";
    };
    elements.lobbyInputName.addEventListener("input", function onLobbyNameInput() {
      syncLobbyNameValidity(elements, state);
    });
    elements.lobbyInputName.addEventListener("blur", function onLobbyNameBlur() {
      ensureLobbyNameIsSeeded();
      syncLobbyNameValidity(elements, state);
    });
    elements.lobbyInputName.addEventListener("keydown", function onLobbyNameKeyDown(event) {
      if (event.key !== "Enter") {
        return;
      }
      event.preventDefault();
      if (!elements.lobbyInputCreateBtn.disabled) {
        elements.lobbyInputCreateBtn.click();
      }
    });
    window.addEventListener("beforeunload", function onBeforeUnload(e) {
      if (state.isGameStarted) {
        e.preventDefault();
        e.returnValue = "";
      }
    });
    $(document).on("click", ".game-lobby-room-join-btn", function onJoinRoomClick() {
      if (state.lobbyActionInFlight) {
        return;
      }
      const roomElement = $(this).closest(".game-lobby-room-item");
      const id = roomElement.data("room-id");
      ensureLobbyNameIsSeeded();
      const name = tryGetLobbyName(elements);
      if (!name || !id) {
        return;
      }
      runLobbyAction(elements, state, () => connection.invoke("JoinRoom", name, id).then((player) => {
        state.playerId = player.id;
      }));
    });
    elements.lobbyInputCreateBtn.addEventListener("click", function onCreateRoomClick() {
      ensureLobbyNameIsSeeded();
      const name = tryGetLobbyName(elements);
      if (!name) {
        return;
      }
      runLobbyAction(elements, state, () => connection.invoke("CreateRoom", name).then((player) => {
        showWaitingForOpponent(elements, state, player);
      }));
    });
    if (elements.lobbyInputVsBotBtn) {
      elements.lobbyInputVsBotBtn.addEventListener("click", function onStartVsBotClick() {
        ensureLobbyNameIsSeeded();
        const name = tryGetLobbyName(elements);
        if (!name) {
          return;
        }
        const difficulty = getSelectedBotDifficulty(elements, state);
        runLobbyAction(elements, state, () => connection.invoke("StartVsBotWithDifficulty", name, difficulty).then((player) => {
          state.playerId = player.id;
        }));
      });
    }
    ensureLobbyNameIsSeeded();
    syncLobbyNameValidity(elements, state);
  }

  // wwwroot/js/src/game.js
  function syncTakenPiecesTheme(state) {
    const themeTemplate = pieceThemes[state.selectedPieceTheme] || pieceThemes.wikipedia;
    const pieceImages = document.querySelectorAll(".taken-piece-image[data-piece-code]");
    pieceImages.forEach((image) => {
      const pieceCode = image.dataset.pieceCode;
      if (!pieceCode) {
        return;
      }
      image.src = themeTemplate.replace("{piece}", pieceCode);
    });
  }
  function bindMobileTabs(elements, state) {
    if (!elements.mobileTabs || !Array.isArray(elements.mobileTabButtons) || elements.mobileTabButtons.length === 0) {
      return;
    }
    const mobileQuery = window.matchMedia("(max-width: 992px)");
    const applyPanel = (panel) => {
      const normalizedPanel = panel === "history" || panel === "chat" ? panel : "board";
      state.mobilePanel = normalizedPanel;
      elements.playground.dataset.mobilePanel = normalizedPanel;
      elements.mobileTabButtons.forEach((button) => {
        const isActive = button.dataset.mobilePanel === normalizedPanel;
        button.classList.toggle("is-active", isActive);
        button.setAttribute("aria-selected", isActive ? "true" : "false");
        button.tabIndex = isActive ? 0 : -1;
      });
    };
    const applyResponsiveState = () => {
      if (mobileQuery.matches) {
        elements.mobileTabs.classList.add("is-visible");
        applyPanel(state.mobilePanel || "board");
        safeResizeBoard(state);
        return;
      }
      elements.mobileTabs.classList.remove("is-visible");
      elements.playground.removeAttribute("data-mobile-panel");
      elements.mobileTabButtons.forEach((button) => {
        button.classList.remove("is-active");
        button.setAttribute("aria-selected", "false");
        button.tabIndex = -1;
      });
      safeResizeBoard(state);
    };
    elements.mobileTabButtons.forEach((button) => {
      button.addEventListener("click", () => {
        applyPanel(button.dataset.mobilePanel);
      });
      button.addEventListener("keydown", (event) => {
        if (!mobileQuery.matches) {
          return;
        }
        const buttonIndex = elements.mobileTabButtons.indexOf(button);
        if (buttonIndex < 0) {
          return;
        }
        const maxIndex = elements.mobileTabButtons.length - 1;
        let nextIndex = buttonIndex;
        switch (event.key) {
          case "ArrowRight":
            nextIndex = buttonIndex >= maxIndex ? 0 : buttonIndex + 1;
            break;
          case "ArrowLeft":
            nextIndex = buttonIndex <= 0 ? maxIndex : buttonIndex - 1;
            break;
          case "Home":
            nextIndex = 0;
            break;
          case "End":
            nextIndex = maxIndex;
            break;
          default:
            return;
        }
        event.preventDefault();
        const nextButton = elements.mobileTabButtons[nextIndex];
        nextButton.focus();
        applyPanel(nextButton.dataset.mobilePanel);
      });
    });
    window.addEventListener("resize", applyResponsiveState);
    applyResponsiveState();
  }
  $(function bootstrapGameLobby() {
    const connection = createConnection();
    const elements = getElements();
    const state = createState();
    purgeLegacyReplayUi();
    registerConnectionHandlers(connection, elements, state);
    const onDrop = createOnDropHandler(state, connection);
    const onDragStart = createOnDragStartHandler(state);
    elements.boardThemeSelect.value = state.selectedBoardTheme;
    elements.pieceThemeSelect.value = state.selectedPieceTheme;
    if (elements.botDifficultySelect) {
      elements.botDifficultySelect.value = state.botDifficulty;
    }
    if (elements.checkHintsToggle) {
      elements.checkHintsToggle.checked = state.hintsEnabled;
    }
    if (elements.legalMovesToggle) {
      elements.legalMovesToggle.checked = state.legalHintsEnabled;
    }
    elements.boardThemeSelect.addEventListener("change", function onBoardThemeChange(e) {
      state.selectedBoardTheme = e.target.value;
      applyBoardTheme(elements, boardThemes, state.selectedBoardTheme);
      storeValue(storageKeys.boardTheme, state.selectedBoardTheme);
      safeResizeBoard(state);
    });
    elements.pieceThemeSelect.addEventListener("change", function onPieceThemeChange(e) {
      state.selectedPieceTheme = e.target.value;
      storeValue(storageKeys.pieceTheme, state.selectedPieceTheme);
      syncTakenPiecesTheme(state);
      rebuildBoard(state, pieceThemes, onDrop, onDragStart);
      safeResizeBoard(state);
    });
    if (elements.botDifficultySelect) {
      elements.botDifficultySelect.addEventListener("change", function onBotDifficultyChange(e) {
        const selectedDifficulty = e.target.value;
        if (!Object.prototype.hasOwnProperty.call(botDifficulties, selectedDifficulty)) {
          return;
        }
        state.botDifficulty = selectedDifficulty;
        storeValue(storageKeys.botDifficulty, state.botDifficulty);
        updateBotDifficultyBadge(elements, state);
      });
    }
    if (elements.checkHintsToggle) {
      elements.checkHintsToggle.addEventListener("change", function onCheckHintsChange(e) {
        state.hintsEnabled = !!e.target.checked;
        storeBoolean(storageKeys.checkHints, state.hintsEnabled);
      });
    }
    if (elements.legalMovesToggle) {
      elements.legalMovesToggle.addEventListener("change", function onLegalHintsChange(e) {
        state.legalHintsEnabled = !!e.target.checked;
        storeBoolean(storageKeys.legalMoveHints, state.legalHintsEnabled);
        if (!state.legalHintsEnabled) {
          clearHintSquares();
        }
      });
    }
    applyBoardTheme(elements, boardThemes, state.selectedBoardTheme);
    syncTakenPiecesTheme(state);
    ensureBoardInitialized(state, pieceThemes, onDrop, onDragStart);
    safeResizeBoard(state);
    updateBotDifficultyBadge(elements, state);
    updateReplayControls(elements, state);
    bindMobileTabs(elements, state);
    [150, 450, 1e3].forEach((delayMs) => {
      setTimeout(() => purgeLegacyReplayUi(), delayMs);
    });
    let replayWatchdogTicks = 0;
    const replayWatchdog = setInterval(() => {
      replayWatchdogTicks += 1;
      purgeLegacyReplayUi();
      if (replayWatchdogTicks >= 20) {
        clearInterval(replayWatchdog);
      }
    }, 1500);
    bindLobbyHandlers(connection, elements, state);
    bindChatHandlers(connection, elements);
    bindGameOptionHandlers(connection, elements, state);
    state.connectionState = "connecting";
    connection.start().then(() => {
      state.connectionState = "connected";
    }).catch((err) => {
      state.connectionState = "failed";
      console.error(err);
    });
    window.addEventListener("resize", () => safeResizeBoard(state));
  });
})();
//# sourceMappingURL=game.bundle.js.map
