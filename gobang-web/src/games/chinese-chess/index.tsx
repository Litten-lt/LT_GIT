import { BaseGameInfo } from '../../types/game';

export interface ChineseChessState {
  status: 'waiting' | 'playing' | 'ended';
}

export function createChineseChessGame(): BaseGameInfo {
  return {
    id: 'chinese-chess',
    name: 'Chinese Chess',
    nameCn: '中国象棋',
    icon: '♟',
    description: '楚河汉界，车马炮各展所长',
    status: 'coming-soon',
    playerCount: 2,
  };
}

export const ChineseChessPlaceholder: React.FC = () => (
  <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
    <div className="text-6xl mb-6">♟</div>
    <h1 className="text-3xl font-bold text-white mb-4">中国象棋</h1>
    <p className="text-slate-400 mb-8">敬请期待...</p>
    <p className="text-slate-500 text-sm">游戏开发中，敬请期待完整版发布</p>
  </div>
);