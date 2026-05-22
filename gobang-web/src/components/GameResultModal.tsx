import React from 'react';
import { Player } from '../types';

interface GameResultModalProps {
  winner: Player | 'draw' | null;
  gameStatus: 'playing' | 'ended';
  onRestart: () => void;
  winnerLabel?: {
    black: string;
    white: string;
    draw: string;
  };
}

export const GameResultModal: React.FC<GameResultModalProps> = ({
  winner,
  gameStatus,
  onRestart,
  winnerLabel = {
    black: '黑方',
    white: '白方',
    draw: '平局',
  },
}) => {
  if (gameStatus !== 'ended' || !winner) {
    return null;
  }

  const getResultText = () => {
    if (winner === 'draw') return winnerLabel.draw;
    return `${winner === 'black' ? winnerLabel.black : winnerLabel.white} 获胜！`;
  };

  const getResultColor = () => {
    if (winner === 'draw') return 'text-yellow-400';
    return winner === 'black' ? 'text-gray-800' : 'text-gray-100';
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-8 rounded-2xl border border-slate-700 shadow-2xl text-center">
        <div className={`text-4xl font-bold mb-4 ${getResultColor()}`}>
          {getResultText()}
        </div>
        <button
          onClick={onRestart}
          className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white font-semibold rounded-lg shadow-lg shadow-cyan-500/25 transition-all"
        >
          重新开始
        </button>
      </div>
    </div>
  );
};