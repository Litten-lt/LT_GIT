import { useState } from 'react';
import { Board as BoardType } from '../types';
import { Piece } from './Piece';
import { BOARD_SIZE } from '../types';

const STAR_POINTS = [
  [3, 3], [3, 11], [7, 7], [11, 3], [11, 11]
];

interface BoardProps {
  board: BoardType;
  lastMove: [number, number] | null;
  winningLine: [number, number][] | null;
  onCellClick: (row: number, col: number) => void;
  disabled?: boolean;
}

export const Board: React.FC<BoardProps> = ({
  board,
  lastMove,
  winningLine,
  onCellClick,
  disabled,
}) => {
  const [hoverCell, setHoverCell] = useState<[number, number] | null>(null);

  const isWinningCell = (row: number, col: number): boolean => {
    if (!winningLine) return false;
    return winningLine.some(([r, c]) => r === row && c === col);
  };

  const isStarPoint = (row: number, col: number): boolean => {
    return STAR_POINTS.some(([r, c]) => r === row && c === col);
  };

  return (
    <div
      className="gobang-board"
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${BOARD_SIZE}, 1fr)`,
        gridTemplateRows: `repeat(${BOARD_SIZE}, 1fr)`,
        width: 'min(85vw, 85vh)',
        height: 'min(85vw, 85vh)',
        padding: '8px',
        gap: '0',
      }}
    >
      {Array.from({ length: BOARD_SIZE * BOARD_SIZE }, (_, index) => {
        const row = Math.floor(index / BOARD_SIZE);
        const col = index % BOARD_SIZE;
        const cell = board[row][col];
        const isLast = lastMove && lastMove[0] === row && lastMove[1] === col;
        const isWinning = isWinningCell(row, col);
        const isHovered = hoverCell && hoverCell[0] === row && hoverCell[1] === col;
        const showPreview = isHovered && cell === null && !disabled;
        const hasPiece = cell !== null;

        const isTop = row === 0;
        const isBottom = row === BOARD_SIZE - 1;
        const isLeft = col === 0;
        const isRight = col === BOARD_SIZE - 1;

        return (
          <div
            key={`${row}-${col}`}
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderTop: isTop ? '2px solid #3d2814' : '1px solid rgba(80,50,20,0.4)',
              borderBottom: isBottom ? '2px solid #3d2814' : '1px solid rgba(80,50,20,0.4)',
              borderLeft: isLeft ? '2px solid #3d2814' : '1px solid rgba(80,50,20,0.4)',
              borderRight: isRight ? '2px solid #3d2814' : '1px solid rgba(80,50,20,0.4)',
              backgroundColor: isWinning ? 'rgba(250,204,21,0.4)' : 'transparent',
              cursor: disabled ? 'default' : 'pointer',
            }}
            onClick={() => !disabled && onCellClick(row, col)}
            onMouseEnter={() => setHoverCell([row, col])}
            onMouseLeave={() => setHoverCell(null)}
          >
            {hasPiece && (
              <Piece player={cell} isLastMove={isLast ?? false} />
            )}

            {showPreview && (
              <div
                style={{
                  position: 'absolute',
                  width: '60%',
                  height: '60%',
                  borderRadius: '50%',
                  background: lastMove && board[lastMove[0]][lastMove[1]] === 'black'
                    ? 'radial-gradient(circle at 30% 30%, #4a4a4a 0%, #1a1a1a 100%)'
                    : 'radial-gradient(circle at 30% 30%, #ffffff 0%, #d0d0d0 100%)',
                  opacity: 0.4,
                }}
              />
            )}

            {isStarPoint(row, col) && !hasPiece && (
              <div
                style={{
                  position: 'absolute',
                  width: '8px',
                  height: '8px',
                  backgroundColor: 'rgba(60,40,15,0.8)',
                  borderRadius: '50%',
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
};