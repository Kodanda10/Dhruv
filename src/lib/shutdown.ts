/**
 * Graceful Shutdown Handler
 * 
 * Handles SIGINT and SIGTERM signals to gracefully close
 * database connections and other resources.
 */

import { closeDBPool } from '@/lib/db/pool';

let isShuttingDown = false;

/**
 * Graceful shutdown handler
 */
async function gracefulShutdown(signal: string): Promise<void> {
  if (isShuttingDown) {
    console.warn('Shutdown already in progress, forcing exit...');
    process.exit(1);
  }

  isShuttingDown = true;
  console.log(`\n${signal} received, starting graceful shutdown...`);

  try {
    // Close database pool
    console.log('Closing database connections...');
    await closeDBPool();
    console.log('Database connections closed.');

    // Add other cleanup tasks here (Redis, file handles, etc.)

    console.log('Graceful shutdown complete.');
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
}

// Register shutdown handlers
if (typeof process !== 'undefined') {
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    console.error('Uncaught exception:', error);
    gracefulShutdown('uncaughtException').catch(() => process.exit(1));
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled rejection at:', promise, 'reason:', reason);
    gracefulShutdown('unhandledRejection').catch(() => process.exit(1));
  });
}

// Export for manual invocation if needed
export { gracefulShutdown };

