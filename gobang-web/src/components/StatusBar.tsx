import { Player, GameMode, GameStatus } from '../types';

interface StatusBarProps {
  currentPlayer: Player;
  gameMode: GameMode;
  gameStatus: GameStatus;
  winner: Player | 'draw' | null;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  currentPlayer,
  gameMode,
  gameStatus,
  winner,
}) => {
  const getStatusText = () => {
    if (gameStatus === 'ended') {
      if (winner === 'draw') return '平局！';
      return `${winner === 'black' ? '黑方' : '白方'} 获胜！`;
    }
    const player = currentPlayer === 'black' ? '黑方' : '白方';
    const modeText = gameMode === 'ai' ? ' (AI)' : '';
    return `${player}回合${modeText}`;
  };

  return (
    <div className="flex items-center justify-center gap-3 py-4">
      <div
        className={`
          w-8 h-8 rounded-full shadow-lg
          ${currentPlayer === 'black'
            ? 'gobang-piece-black'
            : 'gobang-piece-white'
          }
          ${gameStatus === 'ended' ? 'opacity-50' : ''}
        `}
      />
      <span className="status-text">
        {getStatusText()}
      </span>
    </div>
  );
};