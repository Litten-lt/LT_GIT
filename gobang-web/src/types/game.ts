export interface BaseGameInfo {
  id: string;
  name: string;
  nameCn: string;
  icon: string;
  description: string;
  status: 'available' | 'coming-soon';
  playerCount: 2 | 4;
}

export type GameId = 'gobang' | 'chinese-chess' | 'honga';

export const GAME_LIST: BaseGameInfo[] = [
  {
    id: 'gobang',
    name: 'Gobang',
    nameCn: '五子棋',
    icon: '⬤',
    description: '经典五子棋，双人对战或与AI切磋',
    status: 'available',
    playerCount: 2,
  },
  {
    id: 'chinese-chess',
    name: 'Chinese Chess',
    nameCn: '中国象棋',
    icon: '♟',
    description: '楚河汉界，车马炮各展所长',
    status: 'coming-soon',
    playerCount: 2,
  },
  {
    id: 'honga',
    name: 'HongA',
    nameCn: '红A',
    icon: '♥',
    description: '四人扑克牌游戏，红A是你的队友',
    status: 'coming-soon',
    playerCount: 4,
  },
];

export function getGameById(id: string): BaseGameInfo | undefined {
  return GAME_LIST.find(game => game.id === id);
}

export function isGameAvailable(id: string): boolean {
  const game = getGameById(id);
  return game?.status === 'available';
}

export function isMultiplayerGame(id: string): boolean {
  const game = getGameById(id);
  return game?.playerCount === 4;
}