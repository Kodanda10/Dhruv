/**
 * Dynamic Learning System
 * Handles adaptive learning and model improvement
 */

export interface LearningData {
  input: string;
  output: string;
  feedback?: 'positive' | 'negative' | 'neutral';
  timestamp: Date;
  sessionId: string;
}

export class DynamicLearning {
  private learningData: LearningData[] = [];

  recordInteraction(data: LearningData): void {
    this.learningData.push(data);
    // Limit stored data to prevent memory issues
    if (this.learningData.length > 1000) {
      this.learningData = this.learningData.slice(-500);
    }
  }

  getLearningData(): LearningData[] {
    return [...this.learningData];
  }

  analyzePatterns(): any {
    // Placeholder for pattern analysis
    const totalInteractions = this.learningData.length;
    const positiveFeedback = this.learningData.filter(d => d.feedback === 'positive').length;

    return {
      totalInteractions,
      positiveFeedback,
      successRate: totalInteractions > 0 ? positiveFeedback / totalInteractions : 0
    };
  }
}

export const dynamicLearning = new DynamicLearning();