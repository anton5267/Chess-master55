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
      connection.invoke("RequestSync").catch((err) => console.error(err));
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
      if (state.currentFen && sourceFen !== state.currentFen) {
        if (state.board) {
          state.board.position(state.currentFen, false);
        }
        connection.invoke("RequestSync").catch((err) => console.error(err));
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
        }
      });
      return void 0;
    };
  }
  function syncBoardState(state) {
    if (!state.board) {
      return;
    }
    state.board.orientation(getOrientation(state));
    state.board.position(state.currentFen || "start", false);
    state.currentFen = state.board.fen();
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
      state.board.position(state.currentFen || "start", false);
      state.currentFen = state.board.fen();
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
    const position = state.currentFen || (state.board ? state.board.fen() : "start");
    const orientation = getOrientation(state);
    if (state.board) {
      state.board.destroy();
    }
    state.board = null;
    state.boardInitialized = false;
    state.currentFen = position;
    ensureBoardInitialized(state, pieceThemes2, onDrop, onDragStart);
    if (state.board) {
      state.board.orientation(orientation);
      state.board.position(position, false);
      state.currentFen = state.board.fen();
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
  function renderRooms(container, waitingPlayers) {
    container.innerHTML = "";
    waitingPlayers.forEach((player) => {
      container.appendChild(createRoomElement(player));
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
    const li = document.createElement("li");
    li.innerText = `${message}`;
    if (isInternalMessage) {
      li.classList.add("chat-internal-msg", "chat-msg", "flex-start");
    } else if (isBlack) {
      li.classList.add("black-chat-msg", "chat-user-msg", "chat-msg", "flex-end");
    } else {
      li.classList.add("white-chat-msg", "chat-user-msg", "chat-msg", "flex-start");
    }
    chat.appendChild(li);
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
  function resetGameUi(elements, state) {
    elements.statusCheck.style.display = "none";
    elements.statusCheck.textContent = "";
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
    if (state.pendingSyncTimeoutId) {
      clearTimeout(state.pendingSyncTimeoutId);
      state.pendingSyncTimeoutId = null;
    }
    if (state.board) {
      state.board.orientation("white");
      state.board.position("start", false);
    }
    setPlayAgainVsBotVisibility(elements, false);
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

  // wwwroot/js/src/chat.js
  function bindChatHandlers(connection, elements) {
    elements.lobbyChatSendBtn.addEventListener("click", function onLobbyChatSend() {
      const message = (elements.lobbyChatInput.value || "").trim();
      if (message !== "") {
        connection.invoke("LobbySendMessage", message).then(() => {
          elements.lobbyChatInput.value = "";
        }).catch((err) => alert(err));
      } else {
        elements.lobbyChatInput.focus();
      }
    });
    elements.gameChatSendBtn.addEventListener("click", function onGameChatSend() {
      const message = (elements.gameChatInput.value || "").trim();
      if (message !== "") {
        connection.invoke("GameSendMessage", message).then(() => {
          elements.gameChatInput.value = "";
        }).catch((err) => alert(err));
      } else {
        elements.gameChatInput.focus();
      }
    });
    elements.lobbyChatInput.addEventListener("keyup", function onLobbyChatKeyUp(e) {
      if (e.keyCode === 13) {
        elements.lobbyChatSendBtn.click();
      }
    });
    elements.gameChatInput.addEventListener("keyup", function onGameChatKeyUp(e) {
      if (e.keyCode === 13) {
        elements.gameChatSendBtn.click();
      }
    });
  }
  function bindGameOptionHandlers(connection, elements, state) {
    elements.threefoldDrawBtn.addEventListener("click", function onThreefoldClick() {
      connection.invoke("ThreefoldDraw").catch((err) => alert(err));
    });
    elements.offerDrawBtn.addEventListener("click", function onOfferDrawClick() {
      const oldText = elements.statusText.innerText;
      const oldColor = elements.statusText.style.color;
      elements.statusText.style.color = "black";
      elements.statusText.innerText = t("drawRequestSent");
      sleep(1500).then(() => {
        elements.statusText.style.color = oldColor;
        elements.statusText.innerText = oldText;
      });
      connection.invoke("OfferDrawRequest").catch((err) => alert(err));
    });
    elements.resignBtn.addEventListener("click", function onResignClick() {
      connection.invoke("Resign").catch((err) => alert(err));
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
        elements.playAgainVsBotBtn.disabled = true;
        connection.invoke("StartVsBot", playerName).then((player) => {
          state.playerId = player.id;
        }).catch((err) => alert(err)).finally(() => {
          elements.playAgainVsBotBtn.disabled = false;
        });
      });
    }
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
      botPlayerName
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
  function scheduleSyncWatchdog2(connection, state) {
    clearSyncWatchdog(state);
    state.pendingSyncTimeoutId = setTimeout(() => {
      if (!state.isGameStarted || state.hasGameEnded) {
        return;
      }
      connection.invoke("RequestSync").catch((err) => console.error(err));
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
    if (state.hasGameEnded) {
      state.isYourTurn = false;
      state.legalMoves = [];
      state.legalMovesRequestId += 1;
      elements.board.style.pointerEvents = "none";
      return;
    }
    updateStatus(elements, state, movingPlayerId, movingPlayerName);
    refreshLegalMoves(connection, state);
    if (state.isGameStarted && state.connectionState !== "reconnecting") {
      elements.board.style.pointerEvents = "auto";
    } else if (!state.isGameStarted || state.connectionState === "reconnecting" || state.connectionState === "disconnected") {
      elements.board.style.pointerEvents = "none";
    }
  }
  function registerConnectionHandlers(connection, elements, state) {
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible" && state.isGameStarted) {
        connection.invoke("RequestSync").catch((err) => console.error(err));
      }
    });
    connection.onreconnecting(function onReconnecting() {
      state.connectionState = "reconnecting";
      state.isYourTurn = false;
      elements.board.style.pointerEvents = "none";
    });
    connection.onreconnected(function onReconnected() {
      state.connectionState = "connected";
      if (state.isGameStarted) {
        connection.invoke("RequestSync").catch((err) => console.error(err));
      }
    });
    connection.onclose(function onClosed() {
      state.connectionState = "disconnected";
      state.isYourTurn = false;
      clearSyncWatchdog(state);
      elements.board.style.pointerEvents = "none";
    });
    connection.on("AddRoom", function onAddRoom(player) {
      elements.rooms.appendChild(createRoomElement(player));
    });
    connection.on("ListRooms", function onListRooms(waitingPlayers) {
      renderRooms(elements.rooms, waitingPlayers);
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
      state.currentFen = normalizedPayload.startFen || "start";
      state.isGameStarted = true;
      state.connectionState = "in-game";
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
      state.currentFen = state.board.fen();
      scheduleSyncWatchdog2(connection, state);
    });
    connection.on("BoardSnapback", function onBoardSnapback(fen) {
      if (!state.board) {
        return;
      }
      clearHintSquares();
      state.board.position(fen, false);
      state.currentFen = state.board.fen();
    });
    connection.on("BoardSetPosition", function onBoardSetPosition(fen) {
      if (!state.board) {
        return;
      }
      clearHintSquares();
      state.board.position(fen, false);
      state.currentFen = state.board.fen();
    });
    connection.on("EnPassantTake", function onEnPassantTake(pawnPosition, target) {
      if (!state.board) {
        return;
      }
      clearHintSquares();
      state.board.move(`${target}-${pawnPosition}`, `${pawnPosition}-${target}`);
      state.currentFen = state.board.fen();
      scheduleSyncWatchdog2(connection, state);
    });
    connection.on("SyncPosition", function onSyncPosition(fen, movingPlayerName, turnNumber, movingPlayerId) {
      clearSyncWatchdog(state);
      state.turnNumber = turnNumber;
      applySyncPosition(state, elements, fen, movingPlayerId, movingPlayerName);
      if (!state.hasGameEnded) {
        syncTurnDependentState(connection, elements, state, movingPlayerId, movingPlayerName);
      }
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
      clearHintSquares();
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
      $(".option-btn").prop("disabled", true);
      setPlayAgainVsBotVisibility(elements, state.isBotGame);
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
        connection.invoke("RequestSync").catch((err) => console.error(err)).finally(() => {
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
        elements.statusText.innerText = oldText;
        elements.statusText.style.color = oldColor;
      });
      noButton.addEventListener("click", function onRejectDraw() {
        connection.invoke("OfferDrawAnswer", false);
        elements.statusText.innerText = oldText;
        elements.statusText.style.color = oldColor;
      });
    });
    connection.on("DrawOfferRejected", function onDrawOfferRejected(player) {
      const oldText = elements.statusText.innerText;
      const oldColor = elements.statusText.style.color;
      elements.statusText.style.color = "black";
      elements.statusText.innerText = t("drawOfferRejectedFormat", { name: player.name });
      sleep(1500).then(() => {
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
      if (player.name === state.playerOneName) {
        removeHighlight("black");
        sourceSquare[0].className += " highlight-white";
        targetSquare[0].className += " highlight-white";
      } else {
        removeHighlight("white");
        sourceSquare[0].className += " highlight-black";
        targetSquare[0].className += " highlight-black";
      }
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
  function bindLobbyHandlers(connection, elements, state) {
    window.addEventListener("beforeunload", function onBeforeUnload(e) {
      if (state.isGameStarted) {
        e.preventDefault();
        e.returnValue = "";
      }
    });
    $(document).on("click", ".game-lobby-room-join-btn", function onJoinRoomClick() {
      const roomElement = $(this).closest(".game-lobby-room-item");
      const id = roomElement.data("room-id");
      const name = (elements.lobbyInputName.value || "").trim();
      if (name !== "" && id) {
        connection.invoke("JoinRoom", name, id).then((player) => {
          state.playerId = player.id;
        }).catch((err) => alert(err));
      } else {
        elements.lobbyInputName.focus();
      }
    });
    elements.lobbyInputCreateBtn.addEventListener("click", function onCreateRoomClick() {
      const name = (elements.lobbyInputName.value || "").trim();
      if (name !== "") {
        connection.invoke("CreateRoom", name).then((player) => {
          showWaitingForOpponent(elements, state, player);
        }).catch((err) => alert(err));
      } else {
        elements.lobbyInputName.focus();
      }
    });
    if (elements.lobbyInputVsBotBtn) {
      elements.lobbyInputVsBotBtn.addEventListener("click", function onStartVsBotClick() {
        const name = (elements.lobbyInputName.value || "").trim();
        if (name !== "") {
          connection.invoke("StartVsBot", name).then((player) => {
            state.playerId = player.id;
          }).catch((err) => alert(err));
        } else {
          elements.lobbyInputName.focus();
        }
      });
    }
  }

  // wwwroot/js/src/state.js
  var storageKeys = {
    boardTheme: "chess.boardTheme",
    pieceTheme: "chess.pieceTheme",
    checkHints: "chess.checkHints",
    legalMoveHints: "chess.legalMoveHints"
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
  function getElements() {
    return {
      playground: document.querySelector(".main-playground"),
      board: document.querySelector("#board"),
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
      lobbyInputName: document.querySelector(".game-lobby-input-name"),
      lobbyInputCreateBtn: document.querySelector(".game-lobby-input-create-btn"),
      lobbyInputVsBotBtn: document.querySelector(".game-lobby-input-vs-bot-btn"),
      lobbyChatInput: document.querySelector(".game-lobby-chat-input"),
      lobbyChatSendBtn: document.querySelector(".game-lobby-chat-send-btn"),
      gameChatInput: document.querySelector(".game-chat-input"),
      gameChatSendBtn: document.querySelector(".game-chat-send-btn"),
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
      board: null,
      currentFen: "start",
      isGameStarted: false,
      hasGameEnded: false,
      gameOverCode: null,
      gameOverWinnerName: null,
      connectionState: "disconnected",
      turnNumber: 1,
      activeMovingPlayerId: null,
      activeMovingPlayerName: null,
      isYourTurn: false,
      isInCheck: false,
      legalMoves: [],
      legalMovesRequestId: 0,
      pendingSyncTimeoutId: null,
      boardInitialized: false,
      selectedBoardTheme: getStoredValue(storageKeys.boardTheme, "classic", boardThemes),
      selectedPieceTheme: getStoredValue(storageKeys.pieceTheme, "wikipedia", pieceThemes),
      hintsEnabled: getStoredBoolean(storageKeys.checkHints, true),
      legalHintsEnabled: getStoredBoolean(storageKeys.legalMoveHints, true)
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
  $(function bootstrapGameLobby() {
    const connection = createConnection();
    const elements = getElements();
    const state = createState();
    registerConnectionHandlers(connection, elements, state);
    const onDrop = createOnDropHandler(state, connection);
    const onDragStart = createOnDragStartHandler(state);
    elements.boardThemeSelect.value = state.selectedBoardTheme;
    elements.pieceThemeSelect.value = state.selectedPieceTheme;
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
