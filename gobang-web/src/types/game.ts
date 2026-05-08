export interface GameInfo {
  id: string;
  name: string;
  nameCn: string;
  icon: string;
  description: string;
  status: 'available' | 'coming-soon';
  component?: React.ComponentType;
}

export type GameId = 'gobang' | 'chinese-chess';

export const GAME_LIST: GameInfo[] = [
  {
    id: 'gobang',
    name: 'Gobang',
    nameCn: '五子棋',
    icon: '⬤',
    description: '经典五子棋，双人对战或与AI切磋',
    status: 'available',
  },
  {
    id: 'chinese-chess',
    name: 'Chinese Chess',
    nameCn: '中国象棋',
    icon: '♟',
    description: '楚河汉界，车马炮各展所长',
    status: 'coming-soon',
  },
];

export function getGameById(id: string): GameInfo | undefined {
  return GAME_LIST.find(game => game.id === id);
}

export function isGameAvailable(id: string): boolean {
  const game = getGameById(id);
  return game?.status === 'available';
}