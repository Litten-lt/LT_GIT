import { BaseGameInfo } from '../../types/game';

export interface HongAState {
  status: 'waiting' | 'playing' | 'ended';
}

export function createHongAGame(): BaseGameInfo {
  return {
    id: 'honga',
    name: 'HongA',
    nameCn: '红A',
    icon: '♥',
    description: '四人扑克牌游戏，红A是你的队友',
    status: 'coming-soon',
    playerCount: 4,
  };
}

export const HongAPlaceholder: React.FC = () => (
  <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
    <div className="text-6xl mb-6">♥</div>
    <h1 className="text-3xl font-bold text-white mb-4">红A</h1>
    <p className="text-slate-400 mb-8">四人扑克牌游戏</p>
    <p className="text-slate-500 text-sm">游戏开发中，敬请期待完整版发布</p>
    <a
      href="/docs/HONGA_RULES.md"
      target="_blank"
      rel="noopener noreferrer"
      className="mt-4 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors text-sm"
    >
      查看规则文档
    </a>
  </div>
);