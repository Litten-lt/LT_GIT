import { useState } from 'react';
import { ConnectionStatus } from '../hooks/useOnlineGame';

interface OnlineRoom {
  id: string;
  players: [string | null, string | null];
  state: 'waiting' | 'playing' | 'ended';
}

interface RoomUIProps {
  connectionStatus: ConnectionStatus;
  onCreateRoom: () => void;
  onJoinRoom: (roomId: string) => void;
  roomId?: string | null;
  playerIndex?: 0 | 1 | null;
  currentRoom?: OnlineRoom | null;
  onLeaveRoom?: () => void;
}

export const RoomUI: React.FC<RoomUIProps> = ({
  connectionStatus,
  onCreateRoom,
  onJoinRoom,
  roomId,
  playerIndex,
  currentRoom,
  onLeaveRoom,
}) => {
  const [inputRoomId, setInputRoomId] = useState('');

  const handleJoin = () => {
    if (inputRoomId.trim()) {
      onJoinRoom(inputRoomId.trim().toUpperCase());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleJoin();
    }
  };

  if (roomId && playerIndex !== null && playerIndex !== undefined) {
    const opponentJoined = playerIndex === 0
      ? currentRoom?.players[1] !== null
      : currentRoom?.players[0] !== null;

    return (
      <div className="flex flex-col items-center gap-4 p-6 bg-stone-800/80 rounded-xl border border-stone-600">
        <div className="text-center">
          <div className="text-amber-400 font-bold text-lg mb-1">房间号</div>
          <div className="text-3xl font-mono tracking-widest text-amber-200">{roomId}</div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div
              className={`w-6 h-6 rounded-full ${
                playerIndex === 0 ? 'bg-black border-2 border-gray-400' : 'bg-white border-2 border-gray-300'
              }`}
            />
            <span className="text-amber-100">{playerIndex === 0 ? '黑方 (你)' : '白方 (你)'}</span>
          </div>
          <span className="text-stone-400">vs</span>
          <div className="flex items-center gap-2">
            <div
              className={`w-6 h-6 rounded-full ${
                playerIndex === 0 ? 'bg-white border-2 border-gray-300' : 'bg-black border-2 border-gray-400'
              }`}
            />
            <span className="text-amber-100">{playerIndex === 0 ? '白方' : '黑方'}</span>
            {!opponentJoined && <span className="text-stone-400 text-sm">(等待加入...)</span>}
          </div>
        </div>

        {onLeaveRoom && (
          <button
            onClick={onLeaveRoom}
            className="px-4 py-2 text-sm bg-stone-700 hover:bg-stone-600 text-stone-200 rounded-lg transition-colors"
          >
            离开房间
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6 p-8 bg-stone-800/80 rounded-xl border border-stone-600">
      <h2 className="text-2xl font-bold text-amber-400">在线对战</h2>

      <div className="flex flex-col items-center gap-2">
        <div
          className={`w-3 h-3 rounded-full ${
            connectionStatus === 'connected'
              ? 'bg-green-500'
              : connectionStatus === 'connecting'
              ? 'bg-yellow-500 animate-pulse'
              : 'bg-red-500'
          }`}
        />
        <span className="text-sm text-stone-400">
          {connectionStatus === 'connected'
            ? '已连接'
            : connectionStatus === 'connecting'
            ? '连接中...'
            : '未连接'}
        </span>
      </div>

      <div className="flex flex-col gap-3 w-full max-w-xs">
        <button
          onClick={onCreateRoom}
          disabled={connectionStatus !== 'connected'}
          className="w-full py-3 px-4 bg-amber-700 hover:bg-amber-600 disabled:bg-stone-700 disabled:text-stone-500 text-white font-semibold rounded-lg transition-colors"
        >
          创建房间
        </button>

        <div className="flex items-center gap-2 my-2">
          <div className="flex-1 h-px bg-stone-600" />
          <span className="text-stone-500 text-sm">或</span>
          <div className="flex-1 h-px bg-stone-600" />
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={inputRoomId}
            onChange={(e) => setInputRoomId(e.target.value.toUpperCase())}
            onKeyDown={handleKeyDown}
            placeholder="输入房间码"
            maxLength={6}
            className="flex-1 py-2 px-3 bg-stone-700 border border-stone-600 rounded-lg text-center text-lg font-mono tracking-widest text-amber-200 placeholder-stone-500 focus:outline-none focus:border-amber-500"
          />
          <button
            onClick={handleJoin}
            disabled={connectionStatus !== 'connected' || inputRoomId.length < 6}
            className="px-4 py-2 bg-stone-600 hover:bg-stone-500 disabled:bg-stone-700 disabled:text-stone-500 text-white rounded-lg transition-colors"
          >
            加入
          </button>
        </div>
      </div>
    </div>
  );
};