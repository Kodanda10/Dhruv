/**
 * FAISS Verification Script
 */

import { search, getIndexStats } from './search';

async function main() {
  try {
    console.log('🔍 FAISS Verification\n');

    // Get index stats
    console.log('📊 Index Statistics:');
    const stats = await getIndexStats();
    console.log(`  Locations: ${stats.locationCount.toLocaleString()}`);
    console.log(`  Dimension: ${stats.dimension}`);
    console.log(`  Index Path: ${stats.indexPath}\n`);

    // Test search
    console.log('🔎 Testing search with query: "खरसिया"');
    const startTime = Date.now();
    const results = await search('खरसिया', 5);
    const latency = Date.now() - startTime;

    console.log(`\n✅ Search completed in ${latency}ms`);
    console.log(`\n📋 Top 5 Results:\n`);
    results.forEach((result, index) => {
      console.log(`  ${index + 1}. ${result.name}`);
      console.log(`     Score: ${(result.score || result.similarity_score || 0).toFixed(4)}`);
      console.log(`     Type: ${result.match_type}\n`);
    });

    if (results.length === 0) {
      console.warn('⚠️  No results found - check index and query');
      process.exit(1);
    }

    console.log('✅ FAISS verification passed');
  } catch (error: any) {
    console.error('❌ FAISS verification failed:', error.message);
    process.exit(1);
  }
}

main();

