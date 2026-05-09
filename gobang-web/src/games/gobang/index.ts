export { GobangGame } from './components/GobangGame';
export { GobangGame as default } from './components/GobangGame';
export type { GobangState } from './types';
export { BOARD_SIZE, WIN_COUNT } from './types';
export { createGobangReducer } from './hooks/useGobangReducer';
export { findBestMove, AI_DEPTHS } from './ai';
export { INITIAL_GOBANG_STATE } from './types';