#!/usr/bin/env node

/**
 * Health Check Script
 *
 * Performs basic health checks on the application and its dependencies.
 * Used by CI/CD pipelines and deployment verification.
 */

const https = require('https');
const http = require('http');

const API_BASE = process.env.API_BASE || 'http://localhost:3000';
const TIMEOUT = 30000; // 30 seconds

async function main() {
  console.log('🏥 Starting application health check...');
  console.log(`🌐 API Base: ${API_BASE}`);
  console.log('');

  const checks = [
    { name: 'Health Endpoint', url: '/api/health', required: true },
    { name: 'Database Connection', url: '/api/health/db', required: false },
    { name: 'Parsing Pipeline', url: '/api/health/parsing', required: false },
  ];

  let allPassed = true;
  const results = [];

  for (const check of checks) {
    try {
      console.log(`🔍 Checking ${check.name}...`);
      const result = await checkEndpoint(check.url);

      if (result.success) {
        console.log(`✅ ${check.name}: PASSED (${result.responseTime}ms)`);
        results.push({ ...check, status: 'PASSED', responseTime: result.responseTime });
      } else {
        console.log(`❌ ${check.name}: FAILED (${result.error})`);
        results.push({ ...check, status: 'FAILED', error: result.error });

        if (check.required) {
          allPassed = false;
        }
      }
    } catch (error) {
      console.log(`❌ ${check.name}: ERROR (${error.message})`);
      results.push({ ...check, status: 'ERROR', error: error.message });

      if (check.required) {
        allPassed = false;
      }
    }
  }

  console.log('');
  console.log('📊 Health Check Summary:');
  console.log('='.repeat(50));

  results.forEach(result => {
    const status = result.status === 'PASSED' ? '✅' : '❌';
    const time = result.responseTime ? ` (${result.responseTime}ms)` : '';
    const error = result.error ? ` - ${result.error}` : '';
    console.log(`${status} ${result.name}: ${result.status}${time}${error}`);
  });

  console.log('');
  if (allPassed) {
    console.log('🎉 All required health checks passed!');
    process.exit(0);
  } else {
    console.log('💥 Some required health checks failed!');
    process.exit(1);
  }
}

async function checkEndpoint(path) {
  return new Promise((resolve) => {
    const url = new URL(path, API_BASE);
    const client = url.protocol === 'https:' ? https : http;

    const startTime = Date.now();
    const req = client.request({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: 'GET',
      timeout: TIMEOUT,
      headers: {
        'User-Agent': 'Health-Check-Script/1.0',
        'Accept': 'application/json',
      }
    }, (res) => {
      const responseTime = Date.now() - startTime;
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            const jsonData = JSON.parse(data);
            resolve({
              success: true,
              responseTime,
              data: jsonData
            });
          } else {
            resolve({
              success: false,
              responseTime,
              error: `HTTP ${res.statusCode}: ${data}`
            });
          }
        } catch (error) {
          resolve({
            success: false,
            responseTime,
            error: `Invalid JSON response: ${error.message}`
          });
        }
      });
    });

    req.on('error', (error) => {
      const responseTime = Date.now() - startTime;
      resolve({
        success: false,
        responseTime,
        error: error.message
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({
        success: false,
        responseTime: TIMEOUT,
        error: 'Request timeout'
      });
    });

    req.end();
  });
}

// Handle script execution
if (require.main === module) {
  main().catch((error) => {
    console.error('💥 Health check script failed:', error);
    process.exit(1);
  });
}

module.exports = { checkEndpoint };