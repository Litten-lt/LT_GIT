import { GAME_LIST, BaseGameInfo } from '../types/game';

interface LobbyProps {
  onSelectGame: (gameId: string) => void;
}

export const Lobby: React.FC<LobbyProps> = ({ onSelectGame }) => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500 mb-12">
        游戏中心
      </h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 max-w-2xl w-full">
        {GAME_LIST.map((game) => (
          <GameCard key={game.id} game={game} onSelect={onSelectGame} />
        ))}
      </div>

      <div className="mt-12 text-slate-500 text-sm">
        更多信息请访问文档中心
      </div>
    </div>
  );
};

interface GameCardProps {
  game: BaseGameInfo;
  onSelect: (gameId: string) => void;
}

const GameCard: React.FC<GameCardProps> = ({ game, onSelect }) => {
  const isAvailable = game.status === 'available';

  return (
    <div
      className={`
        relative group rounded-2xl p-8 border transition-all duration-300 cursor-pointer
        ${isAvailable
          ? 'bg-gradient-to-br from-slate-800/80 to-slate-900/80 border-slate-700/50 hover:border-cyan-500/50 hover:shadow-lg hover:shadow-cyan-500/10'
          : 'bg-slate-800/40 border-slate-700/30 opacity-60'
        }
      `}
      onClick={() => isAvailable && onSelect(game.id)}
    >
      {isAvailable && (
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-cyan-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
      )}

      <div className="relative z-10 flex flex-col items-center text-center">
        <div
          className={`
            w-20 h-20 rounded-2xl flex items-center justify-center mb-6 text-4xl
            ${isAvailable
              ? 'bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30'
              : 'bg-slate-700/50 border border-slate-600/30'
            }
          `}
        >
          {game.icon}
        </div>

        <h2 className={`text-xl font-bold mb-2 ${isAvailable ? 'text-white' : 'text-slate-400'}`}>
          {game.nameCn}
        </h2>

        <p className={`text-sm mb-6 ${isAvailable ? 'text-slate-400' : 'text-slate-500'}`}>
          {game.description}
        </p>

        {isAvailable ? (
          <button className="px-6 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-semibold rounded-lg shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 transition-all">
            开始游戏
          </button>
        ) : (
          <span className="px-4 py-2 bg-slate-700/50 text-slate-400 font-medium rounded-lg">
            敬请期待
          </span>
        )}
      </div>

      {isAvailable && (
        <div className="absolute top-4 right-4 w-2 h-2 rounded-full bg-green-500 animate-pulse" />
      )}
    </div>
  );
};