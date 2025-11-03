#!/usr/bin/env node
const { execSync } = require('child_process');

// Get all closed issues with Task label
const closedIssues = JSON.parse(execSync('gh issue list --state closed --label "Task" --json number,title,closedAt', { encoding: 'utf8' }));

console.log('📋 Closed Task Issues Ready for Deployed Column:');
console.log('='.repeat(60));

closedIssues.forEach(issue => {
  const closedDate = new Date(issue.closedAt);
  const daysSinceClosed = Math.floor((new Date() - closedDate) / (1000 * 60 * 60 * 24));

  console.log(`✅ Issue #${issue.number}: ${issue.title}`);
  console.log(`   Closed: ${closedDate.toISOString().split('T')[0]} (${daysSinceClosed} days ago)`);
  console.log(`   Status: Ready for Deployed column`);
  console.log('');
});

console.log(`🎯 Total closed tasks: ${closedIssues.length}`);
console.log('');
console.log('💡 To move these to Deployed column:');
console.log('   1. Go to https://github.com/users/Pinak-Setu/projects/4');
console.log('   2. Drag each closed issue to the "Deployed" column');
console.log('   3. Or use GitHub CLI: gh issue edit <number> --add-project "Project Board" --column "Deployed"');
