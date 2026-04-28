import { GameMode, Difficulty } from '../types';

interface ControlPanelProps {
  gameMode: GameMode;
  difficulty: Difficulty;
  canUndo: boolean;
  onRestart: () => void;
  onUndo: () => void;
  onModeChange: (mode: GameMode) => void;
  onDifficultyChange: (difficulty: Difficulty) => void;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
  gameMode,
  difficulty,
  canUndo,
  onRestart,
  onUndo,
  onModeChange,
  onDifficultyChange,
}) => {
  return (
    <div className="flex flex-col gap-4 items-center mt-4">
      <div className="flex gap-3">
        <button
          onClick={onRestart}
          className="control-btn control-btn-primary"
        >
          重新开始
        </button>
        <button
          onClick={onUndo}
          disabled={!canUndo}
          className="control-btn control-btn-secondary"
        >
          悔棋
        </button>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex rounded-lg overflow-hidden shadow">
          <button
            onClick={() => onModeChange('pvp')}
            className={`
              mode-btn
              ${gameMode === 'pvp' ? 'mode-btn-active' : 'mode-btn-inactive'}
            `}
          >
            双人
          </button>
          <button
            onClick={() => onModeChange('ai')}
            className={`
              mode-btn
              ${gameMode === 'ai' ? 'mode-btn-active' : 'mode-btn-inactive'}
            `}
          >
            AI
          </button>
        </div>

        {gameMode === 'ai' && (
          <div className="flex rounded-lg overflow-hidden shadow">
            {(['easy', 'medium', 'hard'] as Difficulty[]).map((d) => (
              <button
                key={d}
                onClick={() => onDifficultyChange(d)}
                className={`
                  mode-btn
                  ${difficulty === d ? 'mode-btn-active' : 'mode-btn-inactive'}
                `}
              >
                {d === 'easy' ? '简单' : d === 'medium' ? '中等' : '困难'}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};