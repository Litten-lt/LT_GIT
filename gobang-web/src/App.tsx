import { useState, useEffect } from 'react';
import { isGameAvailable, GameId } from './types/game';
import { Lobby } from './components/Lobby';
import { GobangGame } from './games/gobang/components/GobangGame';
import { HongAGame } from './games/honga/components/HongAGame';

type Page = 'lobby' | 'game';

const GAME_PARAM = 'game';
const MODE_PARAM = 'mode';
const ROOM_PARAM = 'room';

function getUrlParams(): URLSearchParams {
  return new URLSearchParams(window.location.search);
}

function updateUrl(params: Record<string, string | null>): void {
  const url = new URL(window.location.href);

  Object.entries(params).forEach(([key, value]) => {
    if (value === null || value === '') {
      url.searchParams.delete(key);
    } else {
      url.searchParams.set(key, value);
    }
  });

  window.history.pushState({}, '', url.toString());
}

const GamePlaceholders: Record<string, React.FC> = {
  'chinese-chess': () => (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="text-6xl mb-6">♟</div>
      <h1 className="text-3xl font-bold text-white mb-4">中国象棋</h1>
      <p className="text-slate-400 mb-8">敬请期待...</p>
    </div>
  ),
};

function App() {
  const [page, setPage] = useState<Page>('lobby');
  const [currentGameId, setCurrentGameId] = useState<GameId | null>(null);
  const [initialOnlineRoom, setInitialOnlineRoom] = useState<string | null>(null);

  useEffect(() => {
    const params = getUrlParams();
    const gameParam = params.get(GAME_PARAM) as GameId | null;

    if (gameParam && isGameAvailable(gameParam)) {
      const mode = params.get(MODE_PARAM);
      const room = params.get(ROOM_PARAM);

      setCurrentGameId(gameParam);
      setPage('game');

      if (mode === 'online' && room) {
        setInitialOnlineRoom(room);
      }
    }
  }, []);

  const handleSelectGame = (gameId: string) => {
    if (isGameAvailable(gameId)) {
      setCurrentGameId(gameId as GameId);
      setPage('game');
      setInitialOnlineRoom(null);
      updateUrl({ [GAME_PARAM]: gameId, [MODE_PARAM]: null, [ROOM_PARAM]: null });
    }
  };

  const handleBackToLobby = () => {
    setCurrentGameId(null);
    setPage('lobby');
    setInitialOnlineRoom(null);
    updateUrl({ [GAME_PARAM]: null, [MODE_PARAM]: null, [ROOM_PARAM]: null });
  };

  const handleNavigateToOnline = (roomId: string) => {
    updateUrl({ [GAME_PARAM]: currentGameId, [MODE_PARAM]: 'online', [ROOM_PARAM]: roomId });
  };

  const handleClearOnlineState = () => {
    updateUrl({ [MODE_PARAM]: null, [ROOM_PARAM]: null });
  };

  const renderGame = () => {
    if (!currentGameId) return null;

    if (currentGameId === 'gobang') {
      return (
        <GobangGame
          onBack={handleBackToLobby}
          initialOnlineRoom={initialOnlineRoom}
          onNavigateToOnline={handleNavigateToOnline}
          onClearOnlineState={handleClearOnlineState}
        />
      );
    }

    if (currentGameId === 'honga') {
      return (
        <HongAGame
          onBack={handleBackToLobby}
          initialOnlineRoom={initialOnlineRoom}
          onNavigateToOnline={handleNavigateToOnline}
          onClearOnlineState={handleClearOnlineState}
        />
      );
    }

    const Placeholder = GamePlaceholders[currentGameId];
    if (Placeholder) {
      return <Placeholder />;
    }

    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <h1 className="text-3xl font-bold text-white mb-4">游戏加载失败</h1>
        <button
          onClick={handleBackToLobby}
          className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
        >
          返回
        </button>
      </div>
    );
  };

  return (
    <>
      {page === 'lobby' && (
        <Lobby onSelectGame={handleSelectGame} />
      )}

      {page === 'game' && renderGame()}
    </>
  );
}

export default App;