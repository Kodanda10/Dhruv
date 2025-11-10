/**
 * Graceful Shutdown Handler
 * 
 * Handles SIGINT and SIGTERM signals to gracefully close
 * database connections and other resources.
 */

import { closeDBPool } from '@/lib/db/pool';
import { logger } from '@/lib/utils/logger';

let isShuttingDown = false;

/**
 * Graceful shutdown handler
 */
async function gracefulShutdown(signal: string): Promise<void> {
  if (isShuttingDown) {
    logger.warn('Shutdown already in progress, forcing exit...');
    process.exit(1);
  }

  isShuttingDown = true;
  logger.info(`\n${signal} received, starting graceful shutdown...`);

  try {
    // Close database pool
    logger.info('Closing database connections...');
    await closeDBPool();
    logger.info('Database connections closed.');

    // Add other cleanup tasks here (Redis, file handles, etc.)

    logger.info('Graceful shutdown complete.');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown:', error as Error);
    process.exit(1);
  }
}

// Register shutdown handlers
if (typeof process !== 'undefined') {
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception:', error as Error);
    gracefulShutdown('uncaughtException').catch(() => process.exit(1));
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled rejection at:', promise, 'reason:', reason);
    gracefulShutdown('unhandledRejection').catch(() => process.exit(1));
  });
}

// Export for manual invocation if needed
export { gracefulShutdown };
