// Vercel serverless function to proxy NSE API calls
// This solves CORS issues by making server-side requests with dynamic session management

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type, Accept, Authorization, Origin');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    const { symbol, endpoint = 'quote' } = req.query;
    
    if (!symbol) {
      return res.status(400).json({ 
        error: 'Symbol parameter is required',
        usage: '/api/nse-proxy?symbol=RELIANCE&endpoint=quote'
      });
    }
    
    // Define NSE API endpoints
    const nseEndpoints = {
      quote: `https://www.nseindia.com/api/quote-equity?symbol=${symbol}`,
      indices: 'https://www.nseindia.com/api/allIndices',
      preopen: 'https://www.nseindia.com/api/market-data-pre-open?key=ALL',
      marketstatus: 'https://www.nseindia.com/api/marketStatus'
    };
    
    const targetUrl = nseEndpoints[endpoint];
    
    if (!targetUrl) {
      return res.status(400).json({ 
        error: 'Invalid endpoint',
        availableEndpoints: Object.keys(nseEndpoints)
      });
    }
    
    console.log(`🔄 Starting dynamic session for ${symbol}...`);
    
    // Step 1: Get fresh session cookies from NSE homepage
    const sessionData = await getSessionFromNSE();
    
    if (!sessionData.success) {
      console.error('❌ Failed to get session data:', sessionData.error);
      return res.status(500).json({
        error: 'Failed to establish NSE session',
        details: sessionData.error,
        timestamp: new Date().toISOString()
      });
    }
    
    console.log(`✅ Session established, making API call to: ${targetUrl}`);
    
    // Step 2: Make API call with fresh session cookies
    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'accept-language': 'en-GB,en-US;q=0.9,en;q=0.8',
        'cache-control': 'no-cache',
        'pragma': 'no-cache',
        'priority': 'u=0, i',
        'sec-ch-ua': '"Not)A;Brand";v="8", "Chromium";v="138", "Google Chrome";v="138"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"macOS"',
        'sec-fetch-dest': 'document',
        'sec-fetch-mode': 'navigate',
        'sec-fetch-site': 'none',
        'sec-fetch-user': '?1',
        'upgrade-insecure-requests': '1',
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
        'referer': 'https://www.nseindia.com/',
        'origin': 'https://www.nseindia.com',
        'cookie': sessionData.cookies
      }
    });
    
    console.log(`📡 NSE API Response: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ NSE API Error:', errorText);
      
      // Return structured error response
      return res.status(response.status).json({
        error: `NSE API Error: ${response.status} ${response.statusText}`,
        details: response.status === 401 ? 
          'NSE API requires session cookies. Session establishment may have failed.' :
          errorText.substring(0, 200),
        symbol: symbol,
        endpoint: endpoint,
        sessionInfo: {
          cookiesUsed: sessionData.cookies ? 'Yes' : 'No',
          sessionAge: sessionData.timestamp
        },
        timestamp: new Date().toISOString()
      });
    }
    
    const data = await response.json();
    console.log('🎯 NSE API Success for:', symbol);
    
    // Add metadata to response
    const enrichedData = {
      ...data,
      _meta: {
        symbol: symbol,
        endpoint: endpoint,
        timestamp: new Date().toISOString(),
        source: 'NSE API via Dynamic Session Proxy',
        sessionInfo: {
          freshCookies: true,
          sessionEstablished: sessionData.timestamp
        },
        status: 'success'
      }
    };
    
    // Cache the response for 30 seconds
    res.setHeader('Cache-Control', 'public, max-age=30');
    
    return res.status(200).json(enrichedData);
    
  } catch (error) {
    console.error('💥 Proxy Error:', error);
    
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

// Function to get fresh session cookies from NSE homepage
async function getSessionFromNSE() {
  try {
    console.log('🔄 Fetching fresh session from NSE homepage...');
    
    // Step 1: Visit NSE homepage to get initial cookies
    const homepageResponse = await fetch('https://www.nseindia.com', {
      method: 'GET',
      headers: {
        'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'accept-language': 'en-GB,en-US;q=0.9,en;q=0.8',
        'cache-control': 'no-cache',
        'pragma': 'no-cache',
        'sec-ch-ua': '"Not)A;Brand";v="8", "Chromium";v="138", "Google Chrome";v="138"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"macOS"',
        'sec-fetch-dest': 'document',
        'sec-fetch-mode': 'navigate',
        'sec-fetch-site': 'none',
        'sec-fetch-user': '?1',
        'upgrade-insecure-requests': '1',
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
      }
    });
    
    if (!homepageResponse.ok) {
      throw new Error(`Homepage request failed: ${homepageResponse.status}`);
    }
    
    // Extract cookies from response headers
    const setCookieHeaders = homepageResponse.headers.raw()['set-cookie'] || [];
    console.log('🍪 Received cookies:', setCookieHeaders.length);
    
    // Parse and format cookies for subsequent requests
    const cookies = extractCookies(setCookieHeaders);
    console.log('📦 Parsed cookies:', Object.keys(cookies).length);
    
    // Step 2: Get the homepage content to extract any additional tokens
    const homepageContent = await homepageResponse.text();
    
    // Extract nseappid or other tokens from the page if present
    const additionalTokens = extractTokensFromContent(homepageContent);
    
    // Combine all cookies
    const allCookies = { ...cookies, ...additionalTokens };
    
    // Format cookies for header
    const cookieHeader = Object.entries(allCookies)
      .map(([key, value]) => `${key}=${value}`)
      .join('; ');
    
    console.log('✅ Session established with', Object.keys(allCookies).length, 'cookies');
    
    return {
      success: true,
      cookies: cookieHeader,
      cookieCount: Object.keys(allCookies).length,
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('❌ Session establishment failed:', error);
    return {
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

// Helper function to extract cookies from Set-Cookie headers
function extractCookies(setCookieHeaders) {
  const cookies = {};
  
  setCookieHeaders.forEach(header => {
    if (typeof header === 'string') {
      const cookieParts = header.split(';')[0].split('=');
      if (cookieParts.length >= 2) {
        const name = cookieParts[0].trim();
        const value = cookieParts.slice(1).join('=').trim();
        cookies[name] = value;
      }
    }
  });
  
  return cookies;
}

// Helper function to extract tokens from page content
function extractTokensFromContent(content) {
  const tokens = {};
  
  try {
    // Extract nseappid token if present
    const nseappidMatch = content.match(/nseappid['"]\s*:\s*['"]([^'"]+)['"]/i);
    if (nseappidMatch) {
      tokens.nseappid = nseappidMatch[1];
      console.log('🔑 Found nseappid token');
    }
    
    // Extract other potential tokens
    const tokenPatterns = [
      /token['"]\s*:\s*['"]([^'"]+)['"]/i,
      /sessionId['"]\s*:\s*['"]([^'"]+)['"]/i,
      /apiKey['"]\s*:\s*['"]([^'"]+)['"]/i
    ];
    
    tokenPatterns.forEach((pattern, index) => {
      const match = content.match(pattern);
      if (match) {
        tokens[`token_${index}`] = match[1];
        console.log(`🔑 Found token_${index}`);
      }
    });
    
  } catch (error) {
    console.warn('⚠️ Token extraction failed:', error.message);
  }
  
  return tokens;
} 
