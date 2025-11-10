/* eslint-disable no-console */

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

const resolveConsoleMethod = (level: LogLevel): 'info' | 'warn' | 'error' | 'log' => {
  switch (level) {
    case 'warn':
      return 'warn';
    case 'error':
      return 'error';
    case 'debug':
      return 'log';
    default:
      return 'info';
  }
};

const log = (level: LogLevel, message: unknown, ...optionalParams: unknown[]): void => {
  if (process.env.NODE_ENV === 'test') {
    return;
  }
  const method = resolveConsoleMethod(level);
  console[method](message, ...optionalParams);
};

export const logger = {
  info: (message: unknown, ...optionalParams: unknown[]) => log('info', message, ...optionalParams),
  warn: (message: unknown, ...optionalParams: unknown[]) => log('warn', message, ...optionalParams),
  error: (message: unknown, ...optionalParams: unknown[]) => log('error', message, ...optionalParams),
  debug: (message: unknown, ...optionalParams: unknown[]) => log('debug', message, ...optionalParams),
};

