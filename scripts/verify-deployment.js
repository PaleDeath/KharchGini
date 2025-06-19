#!/usr/bin/env node

const https = require('https');
const http = require('http');
const { URL } = require('url');

const DOMAIN = process.env.VERCEL_URL || 'kharchgini-beta.vercel.app';
const BASE_URL = `https://${DOMAIN}`;

console.log('🔍 KharchGini Deployment Verification');
console.log('=====================================');
console.log(`Testing: ${BASE_URL}\n`);

const tests = [
  {
    name: 'Manifest.json Availability',
    url: `${BASE_URL}/manifest.json`,
    expectedStatus: 200,
    expectedContentType: 'application/manifest+json'
  },
  {
    name: 'Service Worker Availability',
    url: `${BASE_URL}/sw.js`,
    expectedStatus: 200,
    expectedContentType: 'application/javascript'
  },
  {
    name: 'Status API Endpoint',
    url: `${BASE_URL}/api/status`,
    expectedStatus: 200,
    expectedContentType: 'application/json'
  },
  {
    name: 'Speech-to-Text API Endpoint (Options)',
    url: `${BASE_URL}/api/speech-to-text`,
    method: 'OPTIONS',
    expectedStatus: 200,
    expectedContentType: 'text/plain'
  },
  {
    name: 'Speech-to-Text API Test (Invalid Request)',
    url: `${BASE_URL}/api/speech-to-text`,
    method: 'POST',
    body: JSON.stringify({ test: 'invalid' }),
    expectedStatus: 400,
    expectedContentType: 'application/json'
  },
  {
    name: 'Main App Page',
    url: `${BASE_URL}/dashboard`,
    expectedStatus: 200,
    expectedContentType: 'text/html'
  }
];

async function makeRequest(url, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const https = require('https');
    
    const parsedUrl = new URL(url);
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname + parsedUrl.search,
      method: method,
      headers: {
        'User-Agent': 'KharchGini-Deployment-Verifier/1.0'
      }
    };

    if (body && method !== 'GET') {
      options.headers['Content-Type'] = 'application/json';
      options.headers['Content-Length'] = Buffer.byteLength(body);
    }

    const request = https.request(options, (response) => {
      let data = '';
      
      response.on('data', (chunk) => {
        data += chunk;
      });
      
      response.on('end', () => {
        resolve({
          status: response.statusCode,
          headers: response.headers,
          data: data,
          contentType: response.headers['content-type']
        });
      });
    });
    
    request.on('error', (error) => {
      reject(error);
    });
    
    request.setTimeout(10000, () => {
      request.destroy();
      reject(new Error('Request timeout'));
    });

    if (body && method !== 'GET') {
      request.write(body);
    }
    
    request.end();
  });
}

async function runTest(test) {
  try {
    console.log(`🧪 Testing: ${test.name}`);
    const result = await makeRequest(test.url, test.method || 'GET', test.body || null);
    
    const statusMatch = result.status === test.expectedStatus;
    const contentTypeMatch = !test.expectedContentType || 
      (result.contentType && result.contentType.includes(test.expectedContentType));
    
    if (statusMatch && contentTypeMatch) {
      console.log(`✅ PASS: ${test.name}`);
      if (test.name === 'Status API Endpoint') {
        try {
          const status = JSON.parse(result.data);
          console.log(`   📊 Status: ${status.status}`);
          console.log(`   🌐 Environment: ${status.environment}`);
        } catch (e) {
          console.log(`   ⚠️  Could not parse status JSON`);
        }
      }
      if (test.name.includes('Speech-to-Text')) {
        console.log(`   🔊 Response: ${result.data.substring(0, 100)}${result.data.length > 100 ? '...' : ''}`);
      }
    } else {
      console.log(`❌ FAIL: ${test.name}`);
      console.log(`   Expected Status: ${test.expectedStatus}, Got: ${result.status}`);
      if (test.expectedContentType) {
        console.log(`   Expected Content-Type: ${test.expectedContentType}, Got: ${result.contentType}`);
      }
      if (test.name.includes('Speech-to-Text')) {
        console.log(`   Response: ${result.data.substring(0, 200)}`);
      }
    }
    
    return statusMatch && contentTypeMatch;
  } catch (error) {
    console.log(`❌ ERROR: ${test.name} - ${error.message}`);
    return false;
  }
}

async function main() {
  let passed = 0;
  let total = tests.length;
  
  for (const test of tests) {
    const success = await runTest(test);
    if (success) passed++;
    console.log(''); // Empty line for readability
  }
  
  console.log('📋 DEPLOYMENT VERIFICATION SUMMARY');
  console.log('==================================');
  console.log(`✅ Passed: ${passed}/${total} tests`);
  
  if (passed === total) {
    console.log('🎉 ALL TESTS PASSED! Deployment looks good.');
    process.exit(0);
  } else {
    console.log('⚠️  Some tests failed. Check the issues above.');
    console.log('\n🔧 Common fixes:');
    console.log('   • Clear browser cache and hard refresh');
    console.log('   • Verify environment variables in Vercel dashboard');
    console.log('   • Check if domain is added to Firebase authorized domains');
    process.exit(1);
  }
}

main().catch(console.error); 