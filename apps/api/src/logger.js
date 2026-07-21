import pino from 'pino'

export function createLogger({ nodeEnv, logLevel }) {
  return pino({
    level: logLevel,
    transport: nodeEnv !== 'production'
      ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' } }
      : undefined,
  })
}
