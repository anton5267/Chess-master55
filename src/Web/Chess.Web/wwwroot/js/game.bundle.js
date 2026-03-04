(() => {
  // wwwroot/js/src/board.js
  function applyBoardTheme(elements, boardThemes2, theme) {
    const themeClass = boardThemes2[theme] || boardThemes2.classic;
    Object.values(boardThemes2).forEach((className) => elements.board.classList.remove(className));
    elements.board.classList.add(themeClass);
  }
  function createOnDropHandler(state, connection) {
    return function onDrop(source, target, piece, newPos, oldPos) {
      if (state.playerColor === 0 && piece.search(/b/) !== -1 || state.playerColor === 1 && piece.search(/w/) !== -1) {
        return "snapback";
      }
      if (target.length === 2) {
        const sourceFen = Chessboard.objToFen(oldPos);
        const targetFen = Chessboard.objToFen(newPos);
        connection.invoke("MoveSelected", source, target, sourceFen, targetFen);
      }
      return void 0;
    };
  }
  function createOrRebuildBoard(state, pieceThemes2, onDrop) {
    let orientation = "white";
    let position = "start";
    if (state.board) {
      orientation = state.board.orientation();
      position = state.board.fen();
      state.board.destroy();
    }
    const config = {
      pieceTheme: pieceThemes2[state.selectedPieceTheme] || pieceThemes2.wikipedia,
      draggable: true,
      dropOffBoard: "snapback",
      showNotation: true,
      onDrop,
      moveSpeed: 50,
      position: "start"
    };
    state.board = ChessBoard("board", config);
    state.board.orientation(orientation);
    state.board.position(position, false);
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
    div.classList.add(`${player.id}`);
    return div;
  }
  function renderRooms(container, waitingPlayers) {
    container.innerHTML = "";
    waitingPlayers.forEach((player) => {
      container.appendChild(createRoomElement(player));
    });
  }
  function updateStatus(elements, state, movingPlayerName) {
    if (movingPlayerName === state.playerName) {
      elements.statusText.innerText = t("yourTurn");
      elements.statusText.style.color = "green";
    } else {
      elements.statusText.innerText = t("playerTurnFormat", { name: movingPlayerName });
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
      highlightedSquares[i].className = highlightedSquares[i].className.replace(/\bhighlight\b/g, "");
    }
  }
  function showWaitingForOpponent(elements, state, player) {
    state.playerId = player.id;
    elements.lobbyContainer.style.display = "none";
    elements.playground.style.display = "flex";
    elements.board.style.pointerEvents = "none";
    $(".game-btn").prop("disabled", true);
    elements.whiteName.textContent = player.name;
    elements.whiteRating.textContent = player.rating;
    elements.blackName.textContent = "?";
    elements.blackRating.textContent = t("notAvailable");
    elements.statusText.style.color = "red";
    elements.statusText.innerText = t("waitingForOpponent");
  }

  // wwwroot/js/src/chat.js
  function bindChatHandlers(connection, elements) {
    elements.lobbyChatSendBtn.addEventListener("click", function onLobbyChatSend() {
      const message = elements.lobbyChatInput.value;
      if (message !== "") {
        connection.invoke("LobbySendMessage", message).then(() => {
          elements.lobbyChatInput.value = "";
        }).catch((err) => alert(err));
      } else {
        elements.lobbyChatInput.focus();
      }
    });
    elements.gameChatSendBtn.addEventListener("click", function onGameChatSend() {
      const message = elements.gameChatInput.value;
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
  function bindGameOptionHandlers(connection, elements) {
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
  }

  // wwwroot/js/src/connection.js
  function createConnection() {
    return new signalR.HubConnectionBuilder().withUrl("/hub").build();
  }
  function registerConnectionHandlers(connection, elements, state) {
    connection.on("AddRoom", function onAddRoom(player) {
      elements.rooms.appendChild(createRoomElement(player));
    });
    connection.on("ListRooms", function onListRooms(waitingPlayers) {
      renderRooms(elements.rooms, waitingPlayers);
    });
    connection.on("Start", function onStart(game) {
      elements.lobbyContainer.style.display = "none";
      elements.playground.style.display = "flex";
      elements.board.style.pointerEvents = "auto";
      $(".game-btn").prop("disabled", false);
      $(".threefold-draw-btn").prop("disabled", true);
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
    connection.on("BoardMove", function onBoardMove(source, target) {
      state.board.move(`${source}-${target}`);
    });
    connection.on("BoardSnapback", function onBoardSnapback(fen) {
      state.board.position(fen);
    });
    connection.on("BoardSetPosition", function onBoardSetPosition(fen) {
      state.board.position(fen);
    });
    connection.on("EnPassantTake", function onEnPassantTake(pawnPosition, target) {
      state.board.move(`${target}-${pawnPosition}`, `${pawnPosition}-${target}`);
    });
    connection.on("GameOver", function onGameOver(player, gameOver) {
      elements.statusText.style.color = "purple";
      elements.board.style.pointerEvents = "none";
      switch (gameOver) {
        case 1:
          elements.statusText.innerText = t("checkmateWinFormat", { name: player.name.toUpperCase() });
          elements.statusCheck.style.display = "none";
          break;
        case 2:
          elements.statusText.innerText = t("stalemate");
          break;
        case 3:
          elements.statusText.innerText = t("draw");
          break;
        case 4:
          elements.statusText.innerText = t("threefoldDeclaredByFormat", { name: player.name.toUpperCase() });
          break;
        case 5:
          elements.statusText.innerText = t("fivefoldDraw");
          break;
        case 6:
          elements.statusText.innerText = t("resignedFormat", { name: player.name.toUpperCase() });
          break;
        case 7:
          elements.statusText.innerText = t("leftYouWinFormat", { name: player.name.toUpperCase() });
          break;
        case 8:
          elements.statusText.innerText = t("fiftyMoveDraw");
          break;
        default:
          break;
      }
      $(".option-btn").prop("disabled", true);
    });
    connection.on("ThreefoldAvailable", function onThreefoldAvailable(isAvailable) {
      $(".threefold-draw-btn").prop("disabled", !isAvailable);
    });
    connection.on("CheckStatus", function onCheckStatus(type) {
      if (type === 2) {
        elements.statusCheck.style.display = "inline";
        elements.statusCheck.innerText = t("check");
      } else {
        elements.statusCheck.style.display = "none";
      }
    });
    connection.on("InvalidMove", function onInvalidMove(type) {
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
        elements.statusText.innerText = t("yourTurn");
        elements.statusText.style.color = "green";
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
    connection.on("UpdateStatus", function onUpdateStatus(movingPlayerName) {
      updateStatus(elements, state, movingPlayerName);
    });
    connection.on("HighlightMove", function onHighlightMove(source, target, player) {
      const sourceSquare = document.getElementsByClassName(`square-${source}`);
      const targetSquare = document.getElementsByClassName(`square-${target}`);
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
      if (state.playerTwoName !== void 0 && state.playerTwoName !== null) {
        e.preventDefault();
        e.returnValue = "";
      }
    });
    $(document).on("click", ".game-lobby-room-join-btn", function onJoinRoomClick() {
      const id = $(this).parent().attr("class");
      const name = elements.lobbyInputName.value;
      if (name !== "") {
        connection.invoke("JoinRoom", name, id).then((player) => {
          state.playerId = player.id;
          state.board.orientation("black");
        }).catch((err) => alert(err));
      } else {
        elements.lobbyInputName.focus();
      }
    });
    elements.lobbyInputCreateBtn.addEventListener("click", function onCreateRoomClick() {
      const name = elements.lobbyInputName.value;
      if (name !== "") {
        connection.invoke("CreateRoom", name).then((player) => {
          showWaitingForOpponent(elements, state, player);
        }).catch((err) => alert(err));
      } else {
        elements.lobbyInputName.focus();
      }
    });
  }

  // wwwroot/js/src/state.js
  var storageKeys = {
    boardTheme: "chess.boardTheme",
    pieceTheme: "chess.pieceTheme"
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
      lobbyChatInput: document.querySelector(".game-lobby-chat-input"),
      lobbyChatSendBtn: document.querySelector(".game-lobby-chat-send-btn"),
      gameChatInput: document.querySelector(".game-chat-input"),
      gameChatSendBtn: document.querySelector(".game-chat-send-btn"),
      resignBtn: document.querySelector(".resign-btn"),
      offerDrawBtn: document.querySelector(".offer-draw-btn"),
      threefoldDrawBtn: document.querySelector(".threefold-draw-btn"),
      boardThemeSelect: document.querySelector("#board-theme-select"),
      pieceThemeSelect: document.querySelector("#piece-theme-select"),
      lobbyContainer: document.querySelector(".game-lobby")
    };
  }
  function createState() {
    return {
      playerId: null,
      playerName: null,
      playerColor: null,
      playerOneName: null,
      playerTwoName: null,
      board: null,
      selectedBoardTheme: getStoredValue(storageKeys.boardTheme, "classic", boardThemes),
      selectedPieceTheme: getStoredValue(storageKeys.pieceTheme, "wikipedia", pieceThemes)
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

  // wwwroot/js/src/game.js
  $(function bootstrapGameLobby() {
    const connection = createConnection();
    const elements = getElements();
    const state = createState();
    registerConnectionHandlers(connection, elements, state);
    const onDrop = createOnDropHandler(state, connection);
    elements.boardThemeSelect.value = state.selectedBoardTheme;
    elements.pieceThemeSelect.value = state.selectedPieceTheme;
    elements.boardThemeSelect.addEventListener("change", function onBoardThemeChange(e) {
      state.selectedBoardTheme = e.target.value;
      applyBoardTheme(elements, boardThemes, state.selectedBoardTheme);
      storeValue(storageKeys.boardTheme, state.selectedBoardTheme);
    });
    elements.pieceThemeSelect.addEventListener("change", function onPieceThemeChange(e) {
      state.selectedPieceTheme = e.target.value;
      storeValue(storageKeys.pieceTheme, state.selectedPieceTheme);
      createOrRebuildBoard(state, pieceThemes, onDrop);
    });
    applyBoardTheme(elements, boardThemes, state.selectedBoardTheme);
    createOrRebuildBoard(state, pieceThemes, onDrop);
    bindLobbyHandlers(connection, elements, state);
    bindChatHandlers(connection, elements);
    bindGameOptionHandlers(connection, elements);
    connection.start();
  });
})();
//# sourceMappingURL=game.bundle.js.map
