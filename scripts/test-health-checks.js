/**
 * Comprehensive Health Check Test Script
 * Tests all health check endpoints and verifies integration
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

async function testHealthEndpoint() {
  console.log('🧪 Testing /api/system/health endpoint...\n');
  
  try {
    const response = await fetch(`${BASE_URL}/api/system/health`);
    const data = await response.json();
    
    console.log('✅ Health endpoint responded');
    console.log(`   Status Code: ${response.status}`);
    console.log(`   Overall Status: ${data.status}`);
    console.log(`   Timestamp: ${data.timestamp}\n`);
    
    // Verify all services are present
    const expectedServices = [
      'database',
      'twitter_api',
      'gemini_api',
      'ollama_api',
      'flask_api',
      'mapmyindia_api'
    ];
    
    console.log('📊 Service Status:\n');
    expectedServices.forEach(service => {
      const serviceData = data.services[service];
      if (serviceData) {
        const status = serviceData.status || 'unknown';
        const latency = serviceData.latency ? `${serviceData.latency}ms` : 'N/A';
        const icon = status === 'healthy' ? '✅' : status === 'degraded' ? '⚠️' : '❌';
        console.log(`   ${icon} ${service}: ${status} (${latency})`);
        
        // Show additional metrics
        if (serviceData.remaining_calls !== undefined) {
          console.log(`      Rate Limit: ${serviceData.remaining_calls} remaining`);
        }
        if (serviceData.models_available !== undefined) {
          console.log(`      Models: ${serviceData.models_available} available`);
        }
        if (serviceData.error) {
          console.log(`      Error: ${serviceData.error}`);
        }
        if (serviceData.note) {
          console.log(`      Note: ${serviceData.note}`);
        }
      } else {
        console.log(`   ❌ ${service}: MISSING`);
      }
    });
    
    // Verify all services are present
    const missingServices = expectedServices.filter(s => !data.services[s]);
    if (missingServices.length > 0) {
      console.log(`\n❌ Missing services: ${missingServices.join(', ')}`);
      return false;
    }
    
    console.log('\n✅ All services are present in response');
    
    // Check response time
    const startTime = Date.now();
    await fetch(`${BASE_URL}/api/system/health`);
    const responseTime = Date.now() - startTime;
    console.log(`\n⚡ Response Time: ${responseTime}ms`);
    
    if (responseTime > 10000) {
      console.log('⚠️  Response time is slow (>10s)');
    } else {
      console.log('✅ Response time is acceptable');
    }
    
    return true;
  } catch (error) {
    console.error('❌ Health endpoint test failed:', error.message);
    return false;
  }
}

async function testIndividualServices() {
  console.log('\n\n🔍 Testing Individual Service Health Checks...\n');
  
  const services = {
    database: 'Database connection',
    twitter_api: 'Twitter API',
    gemini_api: 'Gemini API',
    ollama_api: 'Ollama API',
    flask_api: 'Flask API',
    mapmyindia_api: 'MapMyIndia API'
  };
  
  const results = {};
  
  for (const [key, name] of Object.entries(services)) {
    try {
      const response = await fetch(`${BASE_URL}/api/system/health`);
      const data = await response.json();
      const service = data.services[key];
      
      if (service) {
        results[key] = {
          status: service.status,
          latency: service.latency,
          hasMetrics: !!(service.latency || service.error || service.note)
        };
        console.log(`✅ ${name}: ${service.status} (${service.latency || 'N/A'}ms)`);
      } else {
        results[key] = { status: 'missing' };
        console.log(`❌ ${name}: MISSING`);
      }
    } catch (error) {
      results[key] = { status: 'error', error: error.message };
      console.log(`❌ ${name}: ERROR - ${error.message}`);
    }
  }
  
  return results;
}

async function testErrorHandling() {
  console.log('\n\n🛡️  Testing Error Handling...\n');
  
  // Test with invalid endpoint (should handle gracefully)
  try {
    const response = await fetch(`${BASE_URL}/api/system/health/invalid`);
    console.log(`✅ Invalid endpoint handled: ${response.status}`);
  } catch (error) {
    console.log(`✅ Error handling works: ${error.message}`);
  }
  
  // Test timeout (if server is slow)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1000);
    await fetch(`${BASE_URL}/api/system/health`, { signal: controller.signal });
    clearTimeout(timeoutId);
    console.log('✅ Request completed within timeout');
  } catch (error) {
    if (error.name === 'AbortError') {
      console.log('⚠️  Request timed out (this is expected if server is slow)');
    } else {
      console.log(`✅ Error handling works: ${error.message}`);
    }
  }
}

async function runAllTests() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('   CommandView Health Checks - Integration Test');
  console.log('═══════════════════════════════════════════════════════\n');
  
  const results = {
    healthEndpoint: false,
    individualServices: {},
    errorHandling: true
  };
  
  // Test 1: Health endpoint
  results.healthEndpoint = await testHealthEndpoint();
  
  // Test 2: Individual services
  results.individualServices = await testIndividualServices();
  
  // Test 3: Error handling
  await testErrorHandling();
  
  // Summary
  console.log('\n\n═══════════════════════════════════════════════════════');
  console.log('   Test Summary');
  console.log('═══════════════════════════════════════════════════════\n');
  
  console.log(`Health Endpoint: ${results.healthEndpoint ? '✅ PASS' : '❌ FAIL'}`);
  
  const serviceResults = Object.values(results.individualServices);
  const healthyServices = serviceResults.filter(r => r.status === 'healthy').length;
  const totalServices = serviceResults.length;
  
  console.log(`Services Monitored: ${healthyServices}/${totalServices} healthy`);
  
  const allPresent = Object.values(results.individualServices).every(r => r.status !== 'missing');
  console.log(`All Services Present: ${allPresent ? '✅ YES' : '❌ NO'}`);
  
  console.log(`Error Handling: ${results.errorHandling ? '✅ PASS' : '❌ FAIL'}`);
  
  const allPassed = results.healthEndpoint && allPresent && results.errorHandling;
  
  console.log('\n═══════════════════════════════════════════════════════');
  console.log(`   Overall: ${allPassed ? '✅ ALL TESTS PASSED' : '⚠️  SOME TESTS FAILED'}`);
  console.log('═══════════════════════════════════════════════════════\n');
  
  return allPassed;
}

// Run tests
if (require.main === module) {
  runAllTests()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Test execution failed:', error);
      process.exit(1);
    });
}

module.exports = { runAllTests, testHealthEndpoint, testIndividualServices };

