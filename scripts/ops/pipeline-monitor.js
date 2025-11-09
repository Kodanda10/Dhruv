#!/usr/bin/env node

/**
 * Pipeline Monitor
 * Checks pipeline health and sends email notifications
 * Runs every 2 hours via GitHub Actions
 */

const { getPipelineStats } = require('./db-helpers');
const { sendPipelineStatusEmail } = require('./send-email-notification');

async function monitorPipeline() {
  try {
    console.log('🔍 Checking pipeline health...');
    
    const stats = await getPipelineStats();
    
    // Check for issues
    const issues = [];
    
    if (parseInt(stats.raw.pending || '0', 10) > 500) {
      issues.push(`High pending queue: ${stats.raw.pending} tweets`);
    }
    
    if (parseInt(stats.raw.failed || '0', 10) > 100) {
      issues.push(`High failure count: ${stats.raw.failed} failed tweets`);
    }
    
    if (parseInt(stats.review.needs_review || '0', 10) > 50) {
      issues.push(`Review queue backlog: ${stats.review.needs_review} events`);
    }
    
    // Generate report
    const report = {
      timestamp: new Date().toISOString(),
      status: issues.length > 0 ? 'needs_attention' : 'healthy',
      issues,
      stats,
    };
    
    console.log('\n📊 Pipeline Status:');
    console.log('Raw Tweets:');
    console.log(`  Total: ${stats.raw.total || 0}`);
    console.log(`  Pending: ${stats.raw.pending || 0}`);
    console.log(`  Parsed: ${stats.raw.parsed || 0}`);
    console.log(`  Failed: ${stats.raw.failed || 0}`);
    console.log('\nParsed Events:', stats.parsed.total || 0);
    console.log('\nReview Status:');
    console.log(`  Needs Review: ${stats.review.needs_review || 0}`);
    console.log(`  Approved: ${stats.review.approved || 0}`);
    console.log(`  Rejected: ${stats.review.rejected || 0}`);
    
    if (issues.length > 0) {
      console.log('\n⚠️  Issues detected:');
      issues.forEach(issue => console.log(`  - ${issue}`));
    } else {
      console.log('\n✅ Pipeline healthy');
    }
    
    // Send email notification
    console.log('\n📧 Sending email notification...');
    const emailResult = await sendPipelineStatusEmail(stats);
    
    if (emailResult.success) {
      console.log('✅ Email sent successfully');
    } else {
      console.log('⚠️  Email not sent:', emailResult.reason || emailResult.error);
    }
    
    // Output JSON for GitHub Actions
    console.log('\n--- JSON Output ---');
    console.log(JSON.stringify(report, null, 2));
    
    // Exit with non-zero if issues found
    if (issues.length > 0) {
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Monitor error:', error);
    process.exit(2);
  }
}

if (require.main === module) {
  monitorPipeline()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { monitorPipeline };


