(function () {
  "use strict";

  const translations = {
    en: {
      source: "Source",
      mode: "Mode",
      modeBot: "Bot",
      modeLocal: "Local",
      difficulty: "Difficulty",
      normal: "Normal",
      easy: "Easy",
      boardTheme: "Board",
      classic: "Classic",
      forest: "Forest",
      midnight: "Midnight",
      pieceTheme: "Pieces",
      promotion: "Promotion",
      queen: "Queen",
      rook: "Rook",
      bishop: "Bishop",
      knight: "Knight",
      newGame: "New game",
      undo: "Undo",
      flip: "Flip",
      draw: "Draw",
      resign: "Resign",
      black: "Black",
      white: "White",
      points: "Points",
      moveHistory: "Move history",
      localStats: "Local stats",
      reset: "Reset",
      games: "Games",
      whiteWins: "White wins",
      blackWins: "Black wins",
      draws: "Draws",
      footer: "Static GitHub Pages edition",
      ready: "Ready",
      you: "You",
      bot: "Bot",
      whiteTurn: "White to move",
      blackTurn: "Black to move",
      check: "Check",
      checkmate: "Checkmate",
      stalemate: "Stalemate",
      drawResult: "Draw",
      whiteWon: "White won",
      blackWon: "Black won",
      botThinking: "Bot thinking",
      loadError: "The chess libraries did not load. Refresh the page or check the internet connection.",
    },
    uk: {
      source: "Код",
      mode: "Режим",
      modeBot: "Бот",
      modeLocal: "Локально",
      difficulty: "Складність",
      normal: "Нормальна",
      easy: "Легка",
      boardTheme: "Дошка",
      classic: "Класика",
      forest: "Ліс",
      midnight: "Ніч",
      pieceTheme: "Фігури",
      promotion: "Перетворення",
      queen: "Ферзь",
      rook: "Тура",
      bishop: "Слон",
      knight: "Кінь",
      newGame: "Нова гра",
      undo: "Назад",
      flip: "Повернути",
      draw: "Нічия",
      resign: "Здатися",
      black: "Чорні",
      white: "Білі",
      points: "Очки",
      moveHistory: "Історія ходів",
      localStats: "Локальна статистика",
      reset: "Скинути",
      games: "Ігри",
      whiteWins: "Перемоги білих",
      blackWins: "Перемоги чорних",
      draws: "Нічиї",
      footer: "Статична версія для GitHub Pages",
      ready: "Готово",
      you: "Ти",
      bot: "Бот",
      whiteTurn: "Хід білих",
      blackTurn: "Хід чорних",
      check: "Шах",
      checkmate: "Мат",
      stalemate: "Пат",
      drawResult: "Нічия",
      whiteWon: "Білі перемогли",
      blackWon: "Чорні перемогли",
      botThinking: "Бот думає",
      loadError: "Шахові бібліотеки не завантажились. Онови сторінку або перевір інтернет.",
    },
    de: {
      source: "Quellcode",
      mode: "Modus",
      modeBot: "Bot",
      modeLocal: "Lokal",
      difficulty: "Stufe",
      normal: "Normal",
      easy: "Einfach",
      boardTheme: "Brett",
      classic: "Klassisch",
      forest: "Wald",
      midnight: "Nacht",
      pieceTheme: "Figuren",
      promotion: "Umwandlung",
      queen: "Dame",
      rook: "Turm",
      bishop: "Laufer",
      knight: "Springer",
      newGame: "Neues Spiel",
      undo: "Zuruck",
      flip: "Drehen",
      draw: "Remis",
      resign: "Aufgeben",
      black: "Schwarz",
      white: "Weiss",
      points: "Punkte",
      moveHistory: "Zugliste",
      localStats: "Lokale Statistik",
      reset: "Reset",
      games: "Spiele",
      whiteWins: "Weiss gewinnt",
      blackWins: "Schwarz gewinnt",
      draws: "Remis",
      footer: "Statische GitHub Pages Version",
      ready: "Bereit",
      you: "Du",
      bot: "Bot",
      whiteTurn: "Weiss am Zug",
      blackTurn: "Schwarz am Zug",
      check: "Schach",
      checkmate: "Schachmatt",
      stalemate: "Patt",
      drawResult: "Remis",
      whiteWon: "Weiss gewinnt",
      blackWon: "Schwarz gewinnt",
      botThinking: "Bot denkt",
      loadError: "Die Schachbibliotheken wurden nicht geladen. Seite neu laden oder Verbindung prufen.",
    },
    pl: {
      source: "Kod",
      mode: "Tryb",
      modeBot: "Bot",
      modeLocal: "Lokalnie",
      difficulty: "Poziom",
      normal: "Normalny",
      easy: "Latwy",
      boardTheme: "Szachownica",
      classic: "Klasyczna",
      forest: "Las",
      midnight: "Noc",
      pieceTheme: "Figury",
      promotion: "Promocja",
      queen: "Hetman",
      rook: "Wieza",
      bishop: "Goniec",
      knight: "Skoczek",
      newGame: "Nowa gra",
      undo: "Cofnij",
      flip: "Obroc",
      draw: "Remis",
      resign: "Poddaj",
      black: "Czarne",
      white: "Biale",
      points: "Punkty",
      moveHistory: "Historia ruchow",
      localStats: "Statystyki lokalne",
      reset: "Reset",
      games: "Gry",
      whiteWins: "Wygrane bialych",
      blackWins: "Wygrane czarnych",
      draws: "Remisy",
      footer: "Statyczna wersja GitHub Pages",
      ready: "Gotowe",
      you: "Ty",
      bot: "Bot",
      whiteTurn: "Ruch bialych",
      blackTurn: "Ruch czarnych",
      check: "Szach",
      checkmate: "Mat",
      stalemate: "Pat",
      drawResult: "Remis",
      whiteWon: "Biale wygraly",
      blackWon: "Czarne wygraly",
      botThinking: "Bot mysli",
      loadError: "Biblioteki szachowe sie nie zaladowaly. Odswiez strone albo sprawdz internet.",
    },
    es: {
      source: "Codigo",
      mode: "Modo",
      modeBot: "Bot",
      modeLocal: "Local",
      difficulty: "Nivel",
      normal: "Normal",
      easy: "Facil",
      boardTheme: "Tablero",
      classic: "Clasico",
      forest: "Bosque",
      midnight: "Noche",
      pieceTheme: "Piezas",
      promotion: "Promocion",
      queen: "Dama",
      rook: "Torre",
      bishop: "Alfil",
      knight: "Caballo",
      newGame: "Nueva partida",
      undo: "Deshacer",
      flip: "Girar",
      draw: "Tablas",
      resign: "Rendirse",
      black: "Negras",
      white: "Blancas",
      points: "Puntos",
      moveHistory: "Historial",
      localStats: "Estadisticas locales",
      reset: "Reiniciar",
      games: "Partidas",
      whiteWins: "Ganan blancas",
      blackWins: "Ganan negras",
      draws: "Tablas",
      footer: "Version estatica para GitHub Pages",
      ready: "Listo",
      you: "Tu",
      bot: "Bot",
      whiteTurn: "Mueven blancas",
      blackTurn: "Mueven negras",
      check: "Jaque",
      checkmate: "Jaque mate",
      stalemate: "Ahogado",
      drawResult: "Tablas",
      whiteWon: "Ganan blancas",
      blackWon: "Ganan negras",
      botThinking: "Bot pensando",
      loadError: "No se cargaron las bibliotecas de ajedrez. Recarga la pagina o revisa internet.",
    },
  };

  const pieceThemes = {
    wikipedia: "img/chesspieces/wikipedia/{piece}.png",
    alpha: "img/chesspieces/alpha/320/{piece}.png",
    leipzig: "img/chesspieces/leipzig/320/{piece}.png",
  };

  const pieceValues = {
    p: 1,
    n: 3,
    b: 3,
    r: 5,
    q: 9,
    k: 0,
  };

  const pieceOrder = ["p", "n", "b", "r", "q"];
  const statsKey = "chess-master55.pages.stats";
  const settingsKey = "chess-master55.pages.settings";

  const elements = {};
  const settings = readSettings();
  let lang = resolveLanguage();
  let chess = null;
  let board = null;
  let selectedSquare = null;
  let lastMoveSquares = [];
  let manualResult = null;
  let resultRecorded = false;
  let botTimer = null;

  function $(id) {
    return document.getElementById(id);
  }

  function t(key) {
    return (translations[lang] && translations[lang][key]) || translations.en[key] || key;
  }

  function readSettings() {
    try {
      return JSON.parse(localStorage.getItem(settingsKey)) || {};
    } catch (error) {
      return {};
    }
  }

  function storeSettings() {
    const next = {
      mode: elements.modeSelect.value,
      difficulty: elements.difficultySelect.value,
      boardTheme: elements.boardThemeSelect.value,
      pieceTheme: elements.pieceThemeSelect.value,
      promotion: elements.promotionSelect.value,
      lang,
    };

    try {
      localStorage.setItem(settingsKey, JSON.stringify(next));
    } catch (error) {
      // Keep the current in-memory settings if storage is unavailable.
    }
  }

  function readStats() {
    try {
      return JSON.parse(localStorage.getItem(statsKey)) || defaultStats();
    } catch (error) {
      return defaultStats();
    }
  }

  function defaultStats() {
    return {
      games: 0,
      whiteWins: 0,
      blackWins: 0,
      draws: 0,
    };
  }

  function storeStats(stats) {
    try {
      localStorage.setItem(statsKey, JSON.stringify(stats));
    } catch (error) {
      // Ignore storage failures.
    }
  }

  function resolveLanguage() {
    const queryLang = new URLSearchParams(window.location.search).get("lang");
    const storedLang = settings.lang;
    const browserLang = (navigator.language || "en").slice(0, 2);
    const candidate = queryLang || storedLang || browserLang;
    return Object.prototype.hasOwnProperty.call(translations, candidate) ? candidate : "en";
  }

  function collectElements() {
    [
      "languageSelect",
      "modeSelect",
      "difficultySelect",
      "difficultyField",
      "boardThemeSelect",
      "pieceThemeSelect",
      "promotionSelect",
      "newGameBtn",
      "undoBtn",
      "flipBtn",
      "drawBtn",
      "resignBtn",
      "statusText",
      "turnBadge",
      "loadError",
      "whiteName",
      "blackName",
      "whiteScore",
      "blackScore",
      "whiteCaptured",
      "blackCaptured",
      "moveHistory",
      "moveCount",
      "statGames",
      "statWhiteWins",
      "statBlackWins",
      "statDraws",
      "resetStatsBtn",
    ].forEach((id) => {
      elements[id] = $(id);
    });
  }

  function applySavedSettings() {
    elements.languageSelect.value = lang;
    elements.modeSelect.value = settings.mode === "local" ? "local" : "bot";
    elements.difficultySelect.value = settings.difficulty === "easy" ? "easy" : "normal";
    elements.boardThemeSelect.value = ["classic", "forest", "midnight"].includes(settings.boardTheme)
      ? settings.boardTheme
      : "classic";
    elements.pieceThemeSelect.value = Object.prototype.hasOwnProperty.call(pieceThemes, settings.pieceTheme)
      ? settings.pieceTheme
      : "wikipedia";
    elements.promotionSelect.value = ["q", "r", "b", "n"].includes(settings.promotion)
      ? settings.promotion
      : "q";
  }

  function applyTranslations() {
    document.documentElement.lang = lang;
    document.title = "Chess Master55";
    document.querySelectorAll("[data-i18n]").forEach((node) => {
      const key = node.getAttribute("data-i18n");
      node.textContent = t(key);
    });
    elements.languageSelect.value = lang;
    elements.loadError.textContent = t("loadError");
  }

  function bindEvents() {
    elements.languageSelect.addEventListener("change", () => {
      lang = elements.languageSelect.value;
      const params = new URLSearchParams(window.location.search);
      params.set("lang", lang);
      window.history.replaceState({}, "", `${window.location.pathname}?${params.toString()}${window.location.hash}`);
      applyTranslations();
      updateNames();
      updateUi();
      storeSettings();
    });

    [
      elements.modeSelect,
      elements.difficultySelect,
      elements.boardThemeSelect,
      elements.pieceThemeSelect,
      elements.promotionSelect,
    ].forEach((control) => {
      control.addEventListener("change", () => {
        storeSettings();
        if (control === elements.modeSelect) {
          newGame();
          return;
        }

        if (control === elements.pieceThemeSelect) {
          rebuildBoard();
        }

        applyBoardTheme();
        updateUi();
      });
    });

    elements.newGameBtn.addEventListener("click", newGame);
    elements.undoBtn.addEventListener("click", undoMove);
    elements.flipBtn.addEventListener("click", () => {
      if (board) {
        board.flip();
      }
    });
    elements.drawBtn.addEventListener("click", () => endManually("draw"));
    elements.resignBtn.addEventListener("click", resign);
    elements.resetStatsBtn.addEventListener("click", () => {
      storeStats(defaultStats());
      renderStats();
    });

    window.addEventListener("resize", () => {
      if (board) {
        window.requestAnimationFrame(() => board.resize());
      }
    });

    $("board").addEventListener("click", handleBoardClick);
  }

  function applyBoardTheme() {
    const boardElement = $("board");
    boardElement.classList.remove("board-theme-classic", "board-theme-forest", "board-theme-midnight");
    boardElement.classList.add(`board-theme-${elements.boardThemeSelect.value}`);
  }

  function updateNames() {
    elements.whiteName.textContent = elements.modeSelect.value === "bot" ? t("you") : t("white");
    elements.blackName.textContent = elements.modeSelect.value === "bot" ? t("bot") : t("black");
  }

  function boardFactory() {
    return window.Chessboard || window.ChessBoard;
  }

  function shouldAnimateBoard() {
    return !window.matchMedia || !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function positionBoard(position, animate) {
    if (!board) {
      return;
    }

    board.position(position, !!animate && shouldAnimateBoard());
  }

  function pulseStatus() {
    const strip = elements.statusText && elements.statusText.closest(".status-strip");
    if (!strip) {
      return;
    }

    strip.classList.remove("is-status-updating");
    void strip.offsetWidth;
    strip.classList.add("is-status-updating");
    window.setTimeout(() => strip.classList.remove("is-status-updating"), 320);
  }

  function createBoardConfig() {
    return {
      draggable: true,
      position: "start",
      pieceTheme: pieceThemes[elements.pieceThemeSelect.value],
      appearSpeed: shouldAnimateBoard() ? 150 : 0,
      moveSpeed: shouldAnimateBoard() ? 210 : 0,
      snapbackSpeed: shouldAnimateBoard() ? 150 : 0,
      snapSpeed: shouldAnimateBoard() ? 120 : 0,
      trashSpeed: shouldAnimateBoard() ? 120 : 0,
      onDragStart,
      onDrop,
      onSnapEnd,
      onMouseoverSquare: showMovesForSquare,
      onMouseoutSquare: clearMoveHighlights,
    };
  }

  function initializeBoard() {
    const factory = boardFactory();
    if (!window.Chess || !factory) {
      elements.loadError.hidden = false;
      return false;
    }

    chess = new window.Chess();
    board = factory("board", createBoardConfig());
    applyBoardTheme();
    return true;
  }

  function rebuildBoard() {
    if (!board) {
      return;
    }

    const orientation = board.orientation();
    board.destroy();
    board = boardFactory()("board", Object.assign(createBoardConfig(), {
      position: chess.fen(),
      orientation,
    }));
    applyBoardTheme();
  }

  function newGame() {
    clearTimeout(botTimer);
    chess = new window.Chess();
    selectedSquare = null;
    lastMoveSquares = [];
    manualResult = null;
    resultRecorded = false;
    updateNames();
    if (board) {
      board.start(false);
      if (elements.modeSelect.value === "bot") {
        board.orientation("white");
      }
    }
    updateUi();
  }

  function isBotMode() {
    return elements.modeSelect.value === "bot";
  }

  function isGameFinished() {
    return !!manualResult || chess.game_over();
  }

  function isHumanTurn() {
    return !isBotMode() || chess.turn() === "w";
  }

  function onDragStart(source, piece) {
    if (isGameFinished() || !isHumanTurn()) {
      return false;
    }

    if ((chess.turn() === "w" && piece.search(/^b/) !== -1) ||
        (chess.turn() === "b" && piece.search(/^w/) !== -1)) {
      return false;
    }

    selectSquare(source);
    return true;
  }

  function onDrop(source, target) {
    clearMoveHighlights();
    const move = makeMove(source, target);
    return move ? undefined : "snapback";
  }

  function onSnapEnd() {
    if (board) {
      positionBoard(chess.fen(), false);
    }
  }

  function makeMove(source, target) {
    if (isGameFinished() || !isHumanTurn()) {
      return null;
    }

    const move = chess.move({
      from: source,
      to: target,
      promotion: elements.promotionSelect.value,
    });

    if (!move) {
      return null;
    }

    selectedSquare = null;
    lastMoveSquares = [move.from, move.to];
    positionBoard(chess.fen(), true);
    updateUi();

    if (!isGameFinished() && isBotMode()) {
      scheduleBotMove();
    }

    return move;
  }

  function scheduleBotMove() {
    clearTimeout(botTimer);
    elements.statusText.textContent = t("botThinking");
    elements.undoBtn.disabled = true;
    botTimer = setTimeout(() => {
      const move = chooseBotMove();
      if (move) {
        chess.move(move);
        lastMoveSquares = [move.from, move.to];
        positionBoard(chess.fen(), true);
      }
      updateUi();
    }, elements.difficultySelect.value === "easy" ? 360 : 520);
  }

  function chooseBotMove() {
    const moves = chess.moves({ verbose: true });
    if (moves.length === 0) {
      return null;
    }

    if (elements.difficultySelect.value === "easy") {
      return moves[Math.floor(Math.random() * moves.length)];
    }

    return moves
      .map((move) => ({
        move,
        score: scoreMove(move) + Math.random() * 0.25,
      }))
      .sort((a, b) => b.score - a.score)[0].move;
  }

  function scoreMove(move) {
    let score = 0;
    if (move.captured) {
      score += (pieceValues[move.captured] || 0) * 10;
    }
    if (move.san.includes("#")) {
      score += 1000;
    } else if (move.san.includes("+")) {
      score += 4;
    }
    if (move.promotion) {
      score += pieceValues[move.promotion] || 0;
    }
    if (["d4", "e4", "d5", "e5"].includes(move.to)) {
      score += 0.5;
    }
    return score;
  }

  function undoMove() {
    if (resultRecorded || !chess.history().length) {
      return;
    }

    clearTimeout(botTimer);
    chess.undo();
    if (isBotMode() && chess.history().length && chess.turn() === "b") {
      chess.undo();
    }

    manualResult = null;
    selectedSquare = null;
    lastMoveSquares = [];
    positionBoard(chess.fen(), true);
    updateUi();
  }

  function resign() {
    if (isGameFinished()) {
      return;
    }

    const winner = isBotMode() ? "black" : (chess.turn() === "w" ? "black" : "white");
    endManually(winner);
  }

  function endManually(result) {
    if (isGameFinished()) {
      return;
    }

    manualResult = result;
    selectedSquare = null;
    clearMoveHighlights();
    updateUi();
  }

  function handleBoardClick(event) {
    const square = getSquareFromTarget(event.target);
    if (!square || isGameFinished() || !isHumanTurn()) {
      return;
    }

    if (!selectedSquare) {
      const piece = chess.get(square);
      if (!piece || piece.color !== chess.turn()) {
        return;
      }

      selectSquare(square);
      return;
    }

    if (selectedSquare === square) {
      selectedSquare = null;
      clearMoveHighlights();
      return;
    }

    const move = makeMove(selectedSquare, square);
    if (!move) {
      const piece = chess.get(square);
      if (piece && piece.color === chess.turn()) {
        selectSquare(square);
      } else {
        selectedSquare = null;
        clearMoveHighlights();
      }
    }
  }

  function getSquareFromTarget(target) {
    const squareElement = target.closest("[class*='square-']");
    if (!squareElement) {
      return null;
    }

    const squareClass = Array.from(squareElement.classList).find((className) => /^square-[a-h][1-8]$/.test(className));
    return squareClass ? squareClass.replace("square-", "") : null;
  }

  function selectSquare(square) {
    selectedSquare = square;
    showMovesForSquare(square);
  }

  function showMovesForSquare(square) {
    clearMoveHighlights();
    if (isGameFinished() || !isHumanTurn()) {
      return;
    }

    const piece = chess.get(square);
    if (!piece || piece.color !== chess.turn()) {
      return;
    }

    const source = document.querySelector(`.square-${square}`);
    if (source) {
      source.classList.add("highlight-source");
    }

    chess.moves({ square, verbose: true }).forEach((move) => {
      const target = document.querySelector(`.square-${move.to}`);
      if (!target) {
        return;
      }
      target.classList.add(move.captured ? "highlight-capture" : "highlight-move");
    });
  }

  function clearMoveHighlights() {
    document
      .querySelectorAll(".highlight-source, .highlight-move, .highlight-capture")
      .forEach((node) => {
        node.classList.remove("highlight-source", "highlight-move", "highlight-capture");
      });
    highlightLastMove();
  }

  function highlightLastMove() {
    document.querySelectorAll(".last-move").forEach((node) => node.classList.remove("last-move"));
    lastMoveSquares.forEach((square) => {
      const squareElement = document.querySelector(`.square-${square}`);
      if (squareElement) {
        squareElement.classList.add("last-move");
      }
    });
  }

  function updateUi() {
    const actionLocked = isBotMode() && chess.turn() === "b" && !isGameFinished();
    elements.difficultyField.hidden = !isBotMode();
    elements.drawBtn.disabled = isGameFinished() || actionLocked;
    elements.resignBtn.disabled = isGameFinished() || actionLocked;
    elements.undoBtn.disabled = resultRecorded || chess.history().length === 0 || actionLocked;

    updateStatus();
    renderMoveHistory();
    renderCapturedPieces();
    renderStats();
    highlightLastMove();

    if (isGameFinished() && !resultRecorded) {
      recordResult();
      renderStats();
    }
  }

  function updateStatus() {
    let status = chess.turn() === "w" ? t("whiteTurn") : t("blackTurn");
    let badge = chess.turn() === "w" ? t("white") : t("black");

    if (manualResult) {
      if (manualResult === "draw") {
        status = t("drawResult");
        badge = t("draw");
      } else if (manualResult === "white") {
        status = t("whiteWon");
        badge = t("white");
      } else {
        status = t("blackWon");
        badge = t("black");
      }
    } else if (chess.in_checkmate()) {
      status = chess.turn() === "w" ? `${t("checkmate")} · ${t("blackWon")}` : `${t("checkmate")} · ${t("whiteWon")}`;
      badge = t("checkmate");
    } else if (chess.in_stalemate()) {
      status = t("stalemate");
      badge = t("draw");
    } else if (chess.in_draw()) {
      status = t("drawResult");
      badge = t("draw");
    } else if (chess.in_check()) {
      status = `${status} · ${t("check")}`;
    }

    const previousStatus = elements.statusText.textContent;
    elements.statusText.textContent = status;
    elements.turnBadge.textContent = badge;
    if (previousStatus !== status) {
      pulseStatus();
    }
  }

  function renderMoveHistory() {
    const history = chess.history({ verbose: true });
    elements.moveHistory.innerHTML = "";
    for (let i = 0; i < history.length; i += 2) {
      const item = document.createElement("li");
      const index = document.createElement("span");
      const moves = document.createElement("span");
      index.className = "move-index";
      index.textContent = `${Math.floor(i / 2) + 1}.`;
      moves.textContent = history[i + 1] ? `${history[i].san} ${history[i + 1].san}` : history[i].san;
      if (i >= history.length - 2) {
        item.classList.add("is-new-move");
      }
      item.append(index, moves);
      elements.moveHistory.appendChild(item);
    }
    elements.moveCount.textContent = String(history.length);
  }

  function renderCapturedPieces() {
    const capturedByWhite = {};
    const capturedByBlack = {};
    let whiteScore = 0;
    let blackScore = 0;

    chess.history({ verbose: true }).forEach((move) => {
      if (!move.captured) {
        return;
      }

      if (move.color === "w") {
        capturedByWhite[move.captured] = (capturedByWhite[move.captured] || 0) + 1;
        whiteScore += pieceValues[move.captured] || 0;
      } else {
        capturedByBlack[move.captured] = (capturedByBlack[move.captured] || 0) + 1;
        blackScore += pieceValues[move.captured] || 0;
      }
    });

    elements.whiteScore.textContent = String(whiteScore);
    elements.blackScore.textContent = String(blackScore);
    renderCapturedRow(elements.whiteCaptured, "b", capturedByWhite);
    renderCapturedRow(elements.blackCaptured, "w", capturedByBlack);
  }

  function renderCapturedRow(container, colorPrefix, counts) {
    container.innerHTML = "";
    pieceOrder.forEach((piece) => {
      const count = counts[piece] || 0;
      if (!count) {
        return;
      }

      const item = document.createElement("span");
      const image = document.createElement("img");
      const value = document.createElement("span");
      item.className = "captured-piece";
      image.src = pieceThemes[elements.pieceThemeSelect.value].replace("{piece}", `${colorPrefix}${piece.toUpperCase()}`);
      image.alt = "";
      value.textContent = `x${count}`;
      item.append(image, value);
      container.appendChild(item);
    });
  }

  function renderStats() {
    const stats = readStats();
    elements.statGames.textContent = String(stats.games || 0);
    elements.statWhiteWins.textContent = String(stats.whiteWins || 0);
    elements.statBlackWins.textContent = String(stats.blackWins || 0);
    elements.statDraws.textContent = String(stats.draws || 0);
  }

  function recordResult() {
    const stats = readStats();
    stats.games += 1;

    if (manualResult === "draw" || (!manualResult && chess.in_draw())) {
      stats.draws += 1;
    } else if (manualResult === "white" || (!manualResult && chess.in_checkmate() && chess.turn() === "b")) {
      stats.whiteWins += 1;
    } else if (manualResult === "black" || (!manualResult && chess.in_checkmate() && chess.turn() === "w")) {
      stats.blackWins += 1;
    } else {
      stats.draws += 1;
    }

    resultRecorded = true;
    storeStats(stats);
  }

  document.addEventListener("DOMContentLoaded", () => {
    collectElements();
    applySavedSettings();
    applyTranslations();
    bindEvents();
    renderStats();

    if (initializeBoard()) {
      newGame();
    }
  });
})();
