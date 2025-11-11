const API_BASE = 'http://localhost:3000';

async function testAPI() {
  try {
    console.log('Testing unparsed tweets API...');
    const url = `${API_BASE}/api/tweets/unparsed?limit=2`;
    console.log('URL:', url);
    
    const response = await fetch(url);
    console.log('Status:', response.status);
    
    if (response.ok) {
      const data = await response.json();
      console.log('Success! Got', data.length, 'tweets');
      if (data.length > 0) {
        console.log('First tweet:', {
          id: data[0].tweet_id,
          text: data[0].text.substring(0, 100) + '...',
          author: data[0].author_handle
        });
      }
      return true;
    } else {
      const error = await response.text();
      console.log('API Error:', error);
      return false;
    }
  } catch (error) {
    console.error('Fetch error:', error.message);
    return false;
  }
}

testAPI().then(success => {
  if (success) {
    console.log('API test passed! Running parser...');
    // Run the parser
    const { spawn } = require('child_process');
    const parser = spawn('node', ['scripts/parse_tweets.js', '--start', '0', '--batch', '2', '--dry', 'true'], {
      stdio: 'inherit',
      env: { ...process.env, API_BASE: 'http://localhost:3000' }
    });
    
    parser.on('close', (code) => {
      console.log('Parser exited with code:', code);
    });
  } else {
    console.log('API test failed');
    process.exit(1);
  }
});
