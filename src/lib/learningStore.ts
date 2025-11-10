// In-memory store for the learning flag
let isLearningEnabled = true;

export function getLearningFlag() {
  return isLearningEnabled;
}

export function setLearningFlag(status: boolean) {
  isLearningEnabled = status;
}
