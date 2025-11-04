/**
 * Health Metrics for AI Assistant
 * Tracks performance and health indicators
 */

export interface HealthMetrics {
  uptime: number;
  totalRequests: number;
  successfulRequests: number;
  averageResponseTime: number;
  errorRate: number;
  memoryUsage: number;
  lastHealthCheck: Date;
}

export class HealthMonitor {
  private startTime: Date = new Date();
  private metrics: HealthMetrics = {
    uptime: 0,
    totalRequests: 0,
    successfulRequests: 0,
    averageResponseTime: 0,
    errorRate: 0,
    memoryUsage: 0,
    lastHealthCheck: new Date()
  };

  recordRequest(success: boolean, responseTime: number): void {
    this.metrics.totalRequests++;
    if (success) {
      this.metrics.successfulRequests++;
    }
    this.updateAverageResponseTime(responseTime);
    this.updateErrorRate();
  }

  private updateAverageResponseTime(responseTime: number): void {
    const total = this.metrics.averageResponseTime * (this.metrics.totalRequests - 1);
    this.metrics.averageResponseTime = (total + responseTime) / this.metrics.totalRequests;
  }

  private updateErrorRate(): void {
    this.metrics.errorRate = 1 - (this.metrics.successfulRequests / this.metrics.totalRequests);
  }

  updateMemoryUsage(): void {
    this.metrics.memoryUsage = process.memoryUsage().heapUsed;
  }

  getMetrics(): HealthMetrics {
    this.metrics.uptime = Date.now() - this.startTime.getTime();
    this.metrics.lastHealthCheck = new Date();
    this.updateMemoryUsage();
    return { ...this.metrics };
  }

  getHealthStatus(): 'healthy' | 'warning' | 'critical' {
    const metrics = this.getMetrics();

    if (metrics.errorRate > 0.1 || metrics.averageResponseTime > 5000) {
      return 'critical';
    }

    if (metrics.errorRate > 0.05 || metrics.averageResponseTime > 2000) {
      return 'warning';
    }

    return 'healthy';
  }
}

export const healthMonitor = new HealthMonitor();

// Additional health metrics functions
export function updateValidationQueue(queueSize: number): void {
  healthMonitor.metrics.totalRequests += queueSize;
}