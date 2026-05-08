import { useState } from 'react';
import { Lobby } from './components/Lobby';
import { GobangGame } from './components/GobangGame';
import { GameId, isGameAvailable } from './types/game';

type Page = 'lobby' | 'game';

function App() {
  const [page, setPage] = useState<Page>('lobby');
  const [currentGameId, setCurrentGameId] = useState<GameId | null>(null);

  const handleSelectGame = (gameId: string) => {
    if (isGameAvailable(gameId)) {
      setCurrentGameId(gameId as GameId);
      setPage('game');
    }
  };

  const handleBackToLobby = () => {
    setCurrentGameId(null);
    setPage('lobby');
  };

  return (
    <>
      {page === 'lobby' && (
        <Lobby onSelectGame={handleSelectGame} />
      )}

      {page === 'game' && currentGameId === 'gobang' && (
        <GobangGame onBack={handleBackToLobby} />
      )}

      {page === 'game' && currentGameId === 'chinese-chess' && (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
          <h1 className="text-3xl font-bold text-white mb-4">中国象棋</h1>
          <p className="text-slate-400 mb-8">敬请期待...</p>
          <button
            onClick={handleBackToLobby}
            className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
          >
            返回
          </button>
        </div>
      )}
    </>
  );
}

export default App;