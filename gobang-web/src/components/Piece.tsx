import { Player } from '../types';

interface PieceProps {
  player: Player;
  isLastMove?: boolean;
}

export const Piece: React.FC<PieceProps> = ({ player, isLastMove }) => {
  const isBlack = player === 'black';

  return (
    <div
      style={{
        position: 'absolute',
        width: '80%',
        height: '80%',
        borderRadius: '50%',
        background: isBlack
          ? 'radial-gradient(circle at 35% 35%, #555 0%, #222 40%, #000 100%)'
          : 'radial-gradient(circle at 35% 35%, #fff 0%, #e0e0e0 40%, #bbb 100%)',
        boxShadow: isBlack
          ? '2px 3px 6px rgba(0,0,0,0.6), inset -2px -2px 4px rgba(0,0,0,0.4), inset 2px 2px 4px rgba(255,255,255,0.15)'
          : '2px 3px 6px rgba(0,0,0,0.35), inset -1px -1px 3px rgba(0,0,0,0.1), inset 2px 2px 4px rgba(255,255,255,0.9)',
      }}
    >
      {isLastMove && (
        <div
          style={{
            position: 'absolute',
            top: '25%',
            left: '25%',
            width: '50%',
            height: '50%',
            borderRadius: '50%',
            backgroundColor: 'rgba(220, 38, 38, 0.9)',
          }}
        />
      )}
    </div>
  );
};