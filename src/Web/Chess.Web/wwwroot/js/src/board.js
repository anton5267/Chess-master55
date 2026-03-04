export function applyBoardTheme(elements, boardThemes, theme) {
    const themeClass = boardThemes[theme] || boardThemes.classic;
    Object.values(boardThemes).forEach((className) => elements.board.classList.remove(className));
    elements.board.classList.add(themeClass);
}

export function createOnDropHandler(state, connection) {
    return function onDrop(source, target, piece, newPos, oldPos) {
        if ((state.playerColor === 0 && piece.search(/b/) !== -1) ||
            (state.playerColor === 1 && piece.search(/w/) !== -1)) {
            return 'snapback';
        }

        if (target.length === 2) {
            const sourceFen = Chessboard.objToFen(oldPos);
            const targetFen = Chessboard.objToFen(newPos);
            connection.invoke('MoveSelected', source, target, sourceFen, targetFen);
        }

        return undefined;
    };
}

export function createOrRebuildBoard(state, pieceThemes, onDrop) {
    let orientation = 'white';
    let position = 'start';

    if (state.board) {
        orientation = state.board.orientation();
        position = state.board.fen();
        state.board.destroy();
    }

    const config = {
        pieceTheme: pieceThemes[state.selectedPieceTheme] || pieceThemes.wikipedia,
        draggable: true,
        dropOffBoard: 'snapback',
        showNotation: true,
        onDrop,
        moveSpeed: 50,
        position: 'start',
    };

    state.board = ChessBoard('board', config);
    state.board.orientation(orientation);
    state.board.position(position, false);
}
