import fetch from 'node-fetch';

async function testConnection() {
  const url = 'http://localhost:3000/api/health';
  console.log(`Attempting to connect to: ${url}`);
  try {
    const response = await fetch(url);
    console.log(`Status: ${response.status}`);
    const body = await response.json();
    console.log('Response:', body);
  } catch (error) {
    console.error('Fetch failed:', error);
  }
}

testConnection();
