import { useState, useCallback, useEffect, useMemo } from 'react';
import { useHongAOnline } from '../../../hooks/useHongAOnline';
import { Card, RANK_DISPLAY } from '../types';
import { RoomUI } from '../../gobang/components/RoomUI';

interface HongAGameProps {
  onBack: () => void;
  initialOnlineRoom: string | null;
  onNavigateToOnline: (roomId: string) => void;
  onClearOnlineState: () => void;
}

type AppMode = 'local' | 'online';

function sortHand(hand: Card[]): Card[] {
  const cardKey = (c: Card) => `${c.suit}-${c.rank}`;

  const result: Card[] = [];
  const remaining: Card[] = [];

  const heartA = hand.find(c => c.suit === 'heart' && c.rank === 14);
  const diamondA = hand.find(c => c.suit === 'diamond' && c.rank === 14);
  if (heartA && diamondA) {
    result.push(heartA, diamondA);
  }

  const suits = ['spade', 'heart', 'club', 'diamond'] as const;
  for (const suit of suits) {
    const sameSuitCards = hand.filter(c => c.suit === suit);
    const card5 = sameSuitCards.find(c => c.rank === 5);
    const card10 = sameSuitCards.find(c => c.rank === 10);
    const cardK = sameSuitCards.find(c => c.rank === 13);
    if (card5 && card10 && cardK) {
      result.push(card5, card10, cardK);
    }
  }

  const rankCounts: Record<number, Card[]> = {};
  for (const card of hand) {
    if (!result.some(c => cardKey(c) === cardKey(card))) {
      if (!rankCounts[card.rank]) rankCounts[card.rank] = [];
      rankCounts[card.rank].push(card);
    }
  }

  for (const [, cards] of Object.entries(rankCounts)) {
    if (cards.length === 4) {
      result.push(...cards);
    }
  }

  for (const card of hand) {
    if (!result.some(c => cardKey(c) === cardKey(card))) {
      remaining.push(card);
    }
  }

  remaining.sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank;
    const suitOrder: Record<string, number> = { spade: 4, heart: 3, club: 2, diamond: 1 };
    return suitOrder[a.suit] - suitOrder[b.suit];
  });

  result.push(...remaining);
  return result;
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`;
}

export const HongAGame: React.FC<HongAGameProps> = ({
  onBack,
  initialOnlineRoom,
  onNavigateToOnline,
  onClearOnlineState,
}) => {
  const [appMode, setAppMode] = useState<AppMode>('online');
  const [selectedCards, setSelectedCards] = useState<Card[]>([]);

  const {
    status: onlineStatus,
    currentRoom,
    playerIndex,
    mySocketId,
    isMyTurn,
    createRoom,
    joinRoom,
    leaveRoom,
    playCards,
    pass,
    startGame,
    restartGame,
    reconnectToRoom,
    connectionError,
    gameLog,
  } = useHongAOnline();

  useEffect(() => {
    if (initialOnlineRoom && appMode === 'online') {
      reconnectToRoom(initialOnlineRoom);
    }
  }, [initialOnlineRoom, appMode]);

  const myHand: Card[] = useMemo(() => {
    if (!mySocketId || !currentRoom) return [];
    const hand = currentRoom.hands[mySocketId] || [];
    return sortHand(hand);
  }, [mySocketId, currentRoom]);

  const allPlayerScores = useMemo(() => {
    if (!currentRoom) return [];
    return currentRoom.players.map((socketId, index) => ({
      index,
      socketId: socketId || '',
      score: socketId ? (currentRoom.playerScores?.[socketId] || 0) : 0,
    }));
  }, [currentRoom]);

  const handleCardSelect = useCallback((card: Card) => {
    setSelectedCards(prev => {
      const exists = prev.some(c => c.suit === card.suit && c.rank === card.rank);
      if (exists) {
        return prev.filter(c => !(c.suit === card.suit && c.rank === card.rank));
      }
      return [...prev, card];
    });
  }, []);

  const handlePlayCards = useCallback(() => {
    if (selectedCards.length > 0) {
      playCards(selectedCards);
      setSelectedCards([]);
    }
  }, [selectedCards, playCards]);

  const handlePass = useCallback(() => {
    pass();
    setSelectedCards([]);
  }, [pass]);

  const handleOnlineLeave = useCallback(() => {
    leaveRoom();
    onClearOnlineState();
  }, [leaveRoom, onClearOnlineState]);

  const handleCreateRoom = useCallback(() => {
    createRoom();
  }, [createRoom]);

  const handleJoinRoom = useCallback((roomId: string) => {
    joinRoom(roomId);
  }, [joinRoom]);

  const handleOnlineRestart = useCallback(() => {
    restartGame();
  }, [restartGame]);

  const handleStartGame = useCallback(() => {
    startGame();
  }, [startGame]);

  const isOnlineGame = currentRoom !== null;
  const isPlaying = currentRoom?.state === 'playing';
  const isEnded = currentRoom?.state === 'ended' || currentRoom?.state === 'finished';
  const isHost = currentRoom?.hostSocketId === mySocketId;

  const isRoomExpired = connectionError === 'room-not-found';

  useEffect(() => {
    if (isOnlineGame && currentRoom) {
      onNavigateToOnline(currentRoom.id);
    }
  }, [isOnlineGame, currentRoom, onNavigateToOnline]);

  const handleAppModeChange = (mode: AppMode) => {
    setAppMode(mode);
    if (mode === 'local') {
      onClearOnlineState();
    }
  };

  const getCardDisplay = (card: Card): string => {
    const rankDisplay = RANK_DISPLAY[card.rank];
    const suitChinese: Record<string, string> = {
      spade: '黑桃', heart: '红桃', club: '梅花', diamond: '方片'
    };
    return `${suitChinese[card.suit]}${rankDisplay}`;
  };

  const getCardTypeName = (cardType: string): string => {
    const names: Record<string, string> = {
      'single': '单张',
      'pair': '对子',
      'triple': '三张',
      'straight': '顺子',
      'triple-one': '三带一',
      'triple-pair': '三带一对',
      'bomb-4': '地炸',
      'bomb-5-10-k': '5+10+K',
      'bomb-4-pair': '连对炸弹',
      'sky-bomb': '天炸',
    };
    return names[cardType] || cardType;
  };

  const getCardImage = (card: Card): string => {
    const suitMap: Record<string, string> = {
      spade: 'spade',
      heart: 'heart',
      club: 'club',
      diamond: 'diamond',
    };
    let rankStr: string;
    if (card.rank === 14) {
      rankStr = '1';
    } else if (card.rank === 15) {
      rankStr = '2';
    } else if (card.rank === 11) {
      rankStr = 'jack';
    } else if (card.rank === 12) {
      rankStr = 'queen';
    } else if (card.rank === 13) {
      rankStr = 'king';
    } else {
      rankStr = String(card.rank);
    }
    return `/cards/${suitMap[card.suit]}_${rankStr}.png`;
  };

  const renderCard = (card: Card, isSelected: boolean, isPlayable: boolean) => {
    const isRed = card.suit === 'heart' || card.suit === 'diamond';
    const isPointCard = card.rank === 5 || card.rank === 10 || card.rank === 13;
    return (
      <button
        key={`${card.suit}-${card.rank}`}
        onClick={() => isPlayable && handleCardSelect(card)}
        className={`
          w-12 h-16 sm:w-14 sm:h-20 rounded-lg border-2 flex flex-col items-center justify-center font-bold transition-all relative overflow-hidden
          ${isSelected
            ? 'bg-cyan-500/30 border-cyan-400 transform -translate-y-2'
            : 'bg-white border-gray-300 hover:bg-gray-100'}
          ${!isPlayable && 'opacity-60 cursor-not-allowed'}
        `}
        disabled={!isPlayable}
      >
        <img
          src={getCardImage(card)}
          alt={getCardDisplay(card)}
          className="w-full h-full object-contain"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.style.display = 'none';
            target.parentElement!.innerHTML = `<span class="${isRed ? 'text-red-600' : 'text-gray-900'} text-lg font-bold">${getCardDisplay(card)}</span>`;
          }}
        />
        {isPointCard && (
          <span className="absolute bottom-0.5 text-xs text-yellow-500">分</span>
        )}
      </button>
    );
  };

  const renderCurrentRound = () => {
    if (!currentRoom?.roundHistory || currentRoom.roundHistory.length === 0) {
      return (
        <div className="flex flex-col items-center py-4">
          <div className="text-slate-400 text-sm">等待出牌...</div>
        </div>
      );
    }
    return (
      <div className="flex flex-col items-center py-4">
        <div className="text-slate-400 text-xs mb-2">本轮出牌</div>
        {currentRoom.roundHistory.map((play, playIndex) => (
          <div key={playIndex} className="mb-2">
            <div className="text-xs text-slate-500 mb-1">
              玩家 {play.playerIndex + 1} [{getCardTypeName(play.cardType)}]
            </div>
            <div className="flex gap-1 flex-wrap justify-center">
              {play.cards.map((card, cardIndex) => {
                const isPointCard = card.rank === 5 || card.rank === 10 || card.rank === 13;
                return (
                  <div key={cardIndex}>
                    <img
                      src={getCardImage(card)}
                      alt={getCardDisplay(card)}
                      className={`w-8 h-12 rounded border-2 object-contain
                        ${isPointCard ? 'border-yellow-400 bg-yellow-100' : 'border-gray-300 bg-white'}`}
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        target.parentElement!.innerHTML = `<span class="text-xs font-bold ${isPointCard ? 'text-yellow-600' : 'text-gray-900'}">${getCardDisplay(card)}</span>`;
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderLogSidebar = () => (
    <div className="fixed right-0 top-0 h-full w-64 bg-slate-900/95 border-l border-slate-700/50 overflow-hidden flex flex-col">
      <div className="p-3 border-b border-slate-700/50">
        <div className="text-cyan-400 font-bold text-sm">游戏日志</div>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {gameLog.map((entry) => {
          const typeColors = {
            info: 'text-slate-400',
            play: 'text-blue-400',
            pass: 'text-yellow-400',
            error: 'text-red-400',
            system: 'text-green-400',
          };
          return (
            <div key={entry.id} className={`text-xs ${typeColors[entry.type]} py-1`}>
              <span className="text-slate-500">{formatTime(entry.timestamp)}</span>
              <span className="ml-1">{entry.message}</span>
            </div>
          );
        })}
      </div>
      {currentRoom && (
        <div className="p-3 border-t border-slate-700/50">
          <div className="text-xs text-slate-500">房间号</div>
          <div className="text-sm text-white font-mono">{currentRoom.id}</div>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="flex-1 flex flex-col items-center justify-center p-4">
        <div className="absolute top-4 left-4 flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 rounded-lg border border-slate-700/50 transition-colors"
          >
            <span>←</span>
            <span>返回</span>
          </button>
          <div className="flex items-center gap-2">
            <span className="text-2xl text-red-500">♥</span>
            <h1 className="text-2xl font-bold text-white">红A</h1>
          </div>
        </div>

        <div className="flex gap-2 mb-4">
          <button
            onClick={() => handleAppModeChange('local')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              appMode === 'local'
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/50'
                : 'bg-slate-800/80 text-slate-400 border border-slate-700/50 hover:bg-slate-700/80'
            }`}
          >
            本地游戏
          </button>
          <button
            onClick={() => handleAppModeChange('online')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              appMode === 'online'
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/50'
                : 'bg-slate-800/80 text-slate-400 border border-slate-700/50 hover:bg-slate-700/80'
            }`}
          >
            在线对战
          </button>
        </div>

        {appMode === 'online' && isRoomExpired && (
          <div className="flex flex-col items-center justify-center p-8 bg-slate-800/50 rounded-xl border border-red-500/50">
            <div className="text-4xl mb-4">⏰</div>
            <h2 className="text-xl font-bold text-red-400 mb-2">房间已失效</h2>
            <p className="text-slate-400 text-center max-w-xs mb-6">
              该房间已过期或不存在，请创建新房间
            </p>
            <RoomUI
              connectionStatus={onlineStatus}
              onCreateRoom={handleCreateRoom}
              onJoinRoom={handleJoinRoom}
            />
          </div>
        )}

        {appMode === 'online' && !isRoomExpired && !isOnlineGame && (
          <div className="mb-4">
            <RoomUI
              connectionStatus={onlineStatus}
              onCreateRoom={handleCreateRoom}
              onJoinRoom={handleJoinRoom}
            />
          </div>
        )}

        {appMode === 'online' && !isRoomExpired && isOnlineGame && !isPlaying && (
          <>
            <div className="mb-4 flex items-center gap-4">
              <RoomUI
                connectionStatus={onlineStatus}
                onCreateRoom={handleCreateRoom}
                onJoinRoom={handleJoinRoom}
                roomId={currentRoom.id}
                playerIndex={playerIndex ?? null}
                currentRoom={currentRoom as any}
                onLeaveRoom={handleOnlineLeave}
              />
            </div>

            {isHost && (
              <button
                onClick={handleStartGame}
                className="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 text-white font-semibold rounded-lg shadow-lg shadow-green-500/25 transition-all"
              >
                开始游戏
              </button>
            )}

            {!isHost && (
              <div className="text-slate-400 text-center">
                <p>等待房主开始游戏...</p>
                <p className="text-sm mt-1">({currentRoom.players.filter(p => p !== null).length}/4 玩家已加入)</p>
              </div>
            )}
          </>
        )}

        {appMode === 'online' && !isRoomExpired && isPlaying && (
          <>
            <div className="mb-4 flex items-center gap-4 text-sm">
              <div className="text-slate-400">
                回合: <span className="text-white font-bold">{currentRoom.currentPlayerIndex}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-400">分数:</span>
                {allPlayerScores.map((ps, i) => {
                  const isMe = ps.socketId === mySocketId;
                  const label = isMe ? '你' : `玩家${['一','二','三','四'][i]}`;
                  return (
                    <span key={i} className={`text-xs ${isMe ? 'text-cyan-400' : 'text-slate-400'}`}>
                      {label}：{ps.score}
                    </span>
                  );
                })}
              </div>
              {isMyTurn && (
                <div className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm">
                  你的回合
                </div>
              )}
            </div>

            {renderCurrentRound()}

            <div className="mb-4 flex items-center gap-2">
              <span className="text-slate-400 text-sm">选择:</span>
              <span className="text-cyan-400">{selectedCards.length}张</span>
            </div>

            <div className="flex gap-3 mb-6">
              <button
                onClick={handlePlayCards}
                disabled={selectedCards.length === 0 || !isMyTurn}
                className={`px-6 py-3 rounded-lg font-semibold transition-all ${
                  selectedCards.length > 0 && isMyTurn
                    ? 'bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white shadow-lg shadow-cyan-500/25'
                    : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                }`}
              >
                出牌
              </button>
              <button
                onClick={handlePass}
                disabled={!isMyTurn}
                className={`px-6 py-3 rounded-lg font-semibold transition-all ${
                  isMyTurn
                    ? 'bg-slate-700 hover:bg-slate-600 text-white'
                    : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                }`}
              >
                过
              </button>
            </div>

            <div className="mb-4">
              <div className="text-slate-400 text-sm mb-2">你的手牌 ({myHand.length}张)</div>
              <div className="flex flex-wrap gap-2 justify-center max-w-md">
                {myHand.map(card => renderCard(
                  card,
                  selectedCards.some(c => c.suit === card.suit && c.rank === card.rank),
                  isMyTurn
                ))}
              </div>
            </div>

            {isEnded && (
              <div className="flex flex-col items-center gap-3 mt-4">
                <div className="text-xl font-bold text-cyan-400">
                  游戏结束
                </div>
                <button
                  onClick={handleOnlineRestart}
                  className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white font-semibold rounded-lg shadow-lg shadow-cyan-500/25 transition-all"
                >
                  重新开始
                </button>
              </div>
            )}
          </>
        )}

        {appMode === 'local' && (
          <div className="flex flex-col items-center justify-center p-8">
            <div className="text-4xl mb-4 text-slate-400">开发中</div>
            <p className="text-slate-500">本地模式暂不支持</p>
            <p className="text-slate-600 text-sm mt-2">请选择在线对战模式</p>
          </div>
        )}
      </div>

      {renderLogSidebar()}
    </div>
  );
};