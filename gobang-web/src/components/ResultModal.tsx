import { Player, GameStatus } from '../types';

interface ResultModalProps {
  winner: Player | 'draw' | null;
  gameStatus: GameStatus;
  onRestart: () => void;
}

export const ResultModal: React.FC<ResultModalProps> = ({
  winner,
  gameStatus,
  onRestart,
}) => {
  if (gameStatus !== 'ended') return null;

  const getMessage = () => {
    if (winner === 'draw') return '平局！';
    return `${winner === 'black' ? '黑方' : '白方'} 获胜！`;
  };

  return (
    <div className="result-modal">
      <div className="result-modal-content">
        <div className="result-text">
          {getMessage()}
        </div>
        <button
          onClick={onRestart}
          className="control-btn control-btn-primary w-full"
        >
          再来一局
        </button>
      </div>
    </div>
  );
};