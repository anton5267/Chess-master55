function getOrientation(state) {
    if (state.playerColor === 1) {
        return 'black';
    }

    if (state.playerColor === 0) {
        return 'white';
    }

    if (state.board) {
        return state.board.orientation();
    }

    return 'white';
}

function normalizeLegalMove(move) {
    return {
        source: move.source || move.Source || '',
        target: move.target || move.Target || '',
        isCapture: typeof move.isCapture === 'boolean' ? move.isCapture : !!move.IsCapture,
    };
}

export function applyBoardTheme(elements, boardThemes, theme) {
    const themeClass = boardThemes[theme] || boardThemes.classic;
    Object.values(boardThemes).forEach((className) => elements.board.classList.remove(className));
    elements.board.classList.add(themeClass);
}

export function clearHintSquares() {
    const highlightedSquares = document.querySelectorAll('.hint-move, .hint-capture');
    highlightedSquares.forEach((square) => {
        square.classList.remove('hint-move');
        square.classList.remove('hint-capture');
    });
}

export function highlightLegalMovesForSource(state, sourceSquare) {
    clearHintSquares();

    if (!state.legalHintsEnabled || !state.isYourTurn) {
        return;
    }

    const moves = (state.legalMoves || [])
        .map(normalizeLegalMove)
        .filter((move) => move.source === sourceSquare);

    moves.forEach((move) => {
        const square = document.querySelector(`.square-${move.target}`);
        if (!square) {
            return;
        }

        square.classList.add(move.isCapture ? 'hint-capture' : 'hint-move');
    });
}

export function highlightAllLegalMoves(state) {
    clearHintSquares();

    if (!state.legalHintsEnabled || !state.isYourTurn) {
        return;
    }

    const moves = (state.legalMoves || []).map(normalizeLegalMove);
    moves.forEach((move) => {
        const square = document.querySelector(`.square-${move.target}`);
        if (!square) {
            return;
        }

        square.classList.add(move.isCapture ? 'hint-capture' : 'hint-move');
    });
}

export function createOnDragStartHandler(state) {
    return function onDragStart(source, piece) {
        if (!state.isGameStarted || !state.isYourTurn) {
            return false;
        }

        if ((state.playerColor === 0 && piece.search(/b/) !== -1) ||
            (state.playerColor === 1 && piece.search(/w/) !== -1)) {
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

        connection.invoke('RequestSync').catch((err) => console.error(err));
    }, 900);
}

export function createOnDropHandler(state, connection) {
    return function onDrop(source, target, piece, newPos, oldPos) {
        clearHintSquares();

        if (!state.isGameStarted || !state.isYourTurn) {
            return 'snapback';
        }

        if ((state.playerColor === 0 && piece.search(/b/) !== -1) ||
            (state.playerColor === 1 && piece.search(/w/) !== -1)) {
            return 'snapback';
        }

        if (target.length !== 2) {
            return 'snapback';
        }

        const sourceFen = Chessboard.objToFen(oldPos);
        const targetFen = Chessboard.objToFen(newPos);

        // Guard against stale local board state. If local fen diverges from the
        // latest authoritative server fen, rollback and resync before move submit.
        if (state.currentFen && sourceFen !== state.currentFen) {
            if (state.board) {
                state.board.position(state.currentFen, false);
            }

            connection.invoke('RequestSync').catch((err) => console.error(err));
            return 'snapback';
        }

        scheduleSyncWatchdog(connection, state);
        connection.invoke('MoveSelected', source, target, sourceFen, targetFen)
            .catch((err) => {
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

        return undefined;
    };
}

export function syncBoardState(state) {
    if (!state.board) {
        return;
    }

    state.board.orientation(getOrientation(state));
    state.board.position(state.currentFen || 'start', false);
    state.currentFen = state.board.fen();
}

export function safeResizeBoard(state) {
    if (!state.board) {
        return;
    }

    requestAnimationFrame(() => {
        if (!state.board) {
            return;
        }

        state.board.resize();
        state.board.position(state.currentFen || 'start', false);
        state.currentFen = state.board.fen();
    });
}

export function ensureBoardInitialized(state, pieceThemes, onDrop, onDragStart) {
    if (state.boardInitialized && state.board) {
        return;
    }

    const config = {
        pieceTheme: pieceThemes[state.selectedPieceTheme] || pieceThemes.wikipedia,
        draggable: true,
        dropOffBoard: 'snapback',
        showNotation: true,
        onDragStart,
        onDrop,
        onSnapEnd: clearHintSquares,
        moveSpeed: 50,
        position: state.currentFen || 'start',
    };

    state.board = ChessBoard('board', config);
    state.boardInitialized = true;
    syncBoardState(state);
}

export function rebuildBoard(state, pieceThemes, onDrop, onDragStart) {
    const position = state.currentFen || (state.board ? state.board.fen() : 'start');
    const orientation = getOrientation(state);

    if (state.board) {
        state.board.destroy();
    }

    state.board = null;
    state.boardInitialized = false;
    state.currentFen = position;

    ensureBoardInitialized(state, pieceThemes, onDrop, onDragStart);
    if (state.board) {
        state.board.orientation(orientation);
        state.board.position(position, false);
        state.currentFen = state.board.fen();
    }
}
