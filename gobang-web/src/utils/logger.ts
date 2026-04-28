export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

const LOG_PREFIX = {
  [LogLevel.DEBUG]: '[DEBUG]',
  [LogLevel.INFO]: '[INFO]',
  [LogLevel.WARN]: '[WARN]',
  [LogLevel.ERROR]: '[ERROR]',
};

class Logger {
  private level: LogLevel = LogLevel.INFO;

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  debug(message: string, ...args: unknown[]): void {
    if (this.level <= LogLevel.DEBUG) {
      console.log(`${LOG_PREFIX[LogLevel.DEBUG]} ${message}`, ...args);
    }
  }

  info(message: string, ...args: unknown[]): void {
    if (this.level <= LogLevel.INFO) {
      console.log(`${LOG_PREFIX[LogLevel.INFO]} ${message}`, ...args);
    }
  }

  warn(message: string, ...args: unknown[]): void {
    if (this.level <= LogLevel.WARN) {
      console.warn(`${LOG_PREFIX[LogLevel.WARN]} ${message}`, ...args);
    }
  }

  error(message: string, ...args: unknown[]): void {
    if (this.level <= LogLevel.ERROR) {
      console.error(`${LOG_PREFIX[LogLevel.ERROR]} ${message}`, ...args);
    }
  }

  gameStart(): void {
    this.info('='.repeat(50));
    this.info('游戏开始 - Gobang Web');
    this.info('='.repeat(50));
  }

  move(player: 'black' | 'white', row: number, col: number): void {
    const symbol = player === 'black' ? '●' : '○';
    this.info(`${symbol} 落子: [${row}, ${col}]`);
  }

  gameEnd(winner: 'black' | 'white' | 'draw'): void {
    this.info('-'.repeat(50));
    if (winner === 'draw') {
      this.info('游戏结束: 平局');
    } else {
      const symbol = winner === 'black' ? '●' : '○';
      this.info(`游戏结束: ${symbol} 获胜`);
    }
    this.info('-'.repeat(50));
  }

  aiThink(depth: number): void {
    this.debug(`AI 开始思考 (深度: ${depth})`);
  }

  aiMove(row: number, col: number, score: number): void {
    this.debug(`AI 落子: [${row}, ${col}] (评分: ${score})`);
  }
}

export const logger = new Logger();
export default logger;