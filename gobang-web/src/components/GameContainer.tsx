import React from 'react';

interface GameContainerProps {
  title: string;
  icon: React.ReactNode;
  onBack: () => void;
  appMode?: 'local' | 'online';
  onAppModeChange?: (mode: 'local' | 'online') => void;
  children: React.ReactNode;
}

export const GameContainer: React.FC<GameContainerProps> = ({
  title,
  icon,
  onBack,
  appMode,
  onAppModeChange,
  children,
}) => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="absolute top-4 left-4">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 rounded-lg border border-slate-700/50 transition-colors"
        >
          <span>←</span>
          <span>返回</span>
        </button>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <span className="text-2xl">{icon}</span>
        <h1 className="text-2xl font-bold text-white">{title}</h1>
      </div>

      {onAppModeChange && appMode && (
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => onAppModeChange('local')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              appMode === 'local'
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/50'
                : 'bg-slate-800/80 text-slate-400 border border-slate-700/50 hover:bg-slate-700/80'
            }`}
          >
            本地对战
          </button>
          <button
            onClick={() => onAppModeChange('online')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              appMode === 'online'
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/50'
                : 'bg-slate-800/80 text-slate-400 border border-slate-700/50 hover:bg-slate-700/80'
            }`}
          >
            在线对战
          </button>
        </div>
      )}

      {children}
    </div>
  );
};