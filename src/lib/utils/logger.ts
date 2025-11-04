/**
 * Simple logger utility for the application
 * Provides consistent logging across components
 */

export interface Logger {
  debug: (message: string, ...args: any[]) => void;
  info: (message: string, ...args: any[]) => void;
  warn: (message: string, ...args: any[]) => void;
  error: (message: string, ...args: any[]) => void;
}

class SimpleLogger implements Logger {
  private prefix: string;

  constructor(prefix: string = '') {
    this.prefix = prefix ? `[${prefix}] ` : '';
  }

  debug(message: string, ...args: any[]): void {
    console.debug(`${this.prefix}${message}`, ...args);
  }

  info(message: string, ...args: any[]): void {
    console.info(`${this.prefix}${message}`, ...args);
  }

  warn(message: string, ...args: any[]): void {
    console.warn(`${this.prefix}${message}`, ...args);
  }

  error(message: string, ...args: any[]): void {
    console.error(`${this.prefix}${message}`, ...args);
  }
}

// Create default logger instance
export const logger = new SimpleLogger('ProjectDhruv');

// Factory function for creating prefixed loggers
export const createLogger = (prefix: string): Logger => {
  return new SimpleLogger(prefix);
};
