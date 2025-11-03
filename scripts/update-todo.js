#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const args = require('minimist')(process.argv.slice(2));
const taskId = args.task;
if (!taskId) {
  console.error('Usage: node scripts/update-todo.js --task P1-06');
  process.exit(1);
}

// Validate and sanitize taskId to avoid regex injection and enforce expected pattern like "P1-06"
const TASK_ID_PATTERN = /^[A-Z]\d-\d{2}$/;
if (!TASK_ID_PATTERN.test(taskId)) {
  console.error('Invalid task id. Expected format like P1-06');
  process.exit(1);
}

const file = path.join(process.cwd(), 'TODO_TASKLIST.md');
if (!fs.existsSync(file)) {
  console.error('TODO file not found:', file);
  process.exit(1);
}

const now = new Date().toISOString();
let text = fs.readFileSync(file, 'utf8');
// Update lines deterministically without constructing regex from user input
const lines = text.split('\n');
const prefixPending = `- [ ] ${taskId}:`;
const prefixInProgress = `- [~] ${taskId}:`;
for (let i = 0; i < lines.length; i += 1) {
  const line = lines[i];
  if (line.startsWith(prefixInProgress)) {
    // Strip any (started: ...) metadata and mark completed
    const rest = line.slice(prefixInProgress.length).trim().replace(/\(started:[^)]*\)\s*/g, '').trim();
    lines[i] = `- [x] ${taskId}:${rest ? ' ' + rest : ''} (completed: ${now})`;
    continue;
  }
  if (line.startsWith(prefixPending)) {
    // Strip any (created: ...) metadata and mark completed
    const rest = line.slice(prefixPending.length).trim().replace(/\(created:[^)]*\)\s*/g, '').trim();
    lines[i] = `- [x] ${taskId}:${rest ? ' ' + rest : ''} (completed: ${now})`;
    continue;
  }
}
text = lines.join('\n');

// Update header timestamp
text = text.replace(
  /(Last Updated:\s*)(.*)/,
  (_m, pfx) => `${pfx}${now}`
);

fs.writeFileSync(file, text, 'utf8');
console.log('Updated TODO for', taskId);
