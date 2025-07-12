// Vercel serverless function to proxy NSE API calls
// Enhanced to work with NSE's bot detection

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
  
  // Allow both GET and POST requests
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    let symbols = [];
    let endpoint = 'quote';
    
    // Handle both GET and POST requests
    if (req.method === 'GET') {
      const { symbol, symbols: symbolsParam, endpoint: endpointParam = 'quote' } = req.query;
      endpoint = endpointParam;
      
      if (symbolsParam) {
        symbols = symbolsParam.split(',').map(s => s.trim()).filter(s => s);
      } else if (symbol) {
        symbols = [symbol];
      }
    } else if (req.method === 'POST') {
      const body = req.body;
      symbols = body.symbols || [];
      endpoint = body.endpoint || 'quote';
    }
    
    if (!symbols || symbols.length === 0) {
      return res.status(400).json({ 
        error: 'Symbols parameter is required',
        usage: {
          single: '/api/nse-proxy?symbol=RELIANCE&endpoint=quote',
          batch_get: '/api/nse-proxy?symbols=RELIANCE,TCS,HDFCBANK&endpoint=quote',
          batch_post: 'POST /api/nse-proxy with body: {"symbols": ["RELIANCE", "TCS"], "endpoint": "quote"}'
        }
      });
    }
    
    console.log(`Processing ${symbols.length} symbols: ${symbols.join(', ')}`);
    
    // Helper function to create requests with timeout
    function fetchWithTimeout(url, options, timeoutMs = 15000) {
      return Promise.race([
        fetch(url, options),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error(`Request timeout after ${timeoutMs}ms`)), timeoutMs)
        )
      ]);
    }
    
    // Enhanced session establishment - mimic exact NSE website behavior
    console.log('Establishing NSE session with realistic browser flow...');
    let sessionCookies = '';
    
    // Step 1: Get main page like a real browser
    try {
      console.log('Step 1: Loading NSE main page...');
      const mainPageResponse = await fetchWithTimeout('https://www.nseindia.com', {
        method: 'GET',
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
          'Sec-Ch-Ua-Mobile': '?0',
          'Sec-Ch-Ua-Platform': '"Windows"',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-User': '?1',
          'Upgrade-Insecure-Requests': '1',
          'Cache-Control': 'max-age=0'
        }
      }, 12000);
      
      console.log(`Main page response: ${mainPageResponse.status}`);
      
      if (mainPageResponse.status === 200) {
        const mainCookies = mainPageResponse.headers.get('set-cookie');
        if (mainCookies) {
          sessionCookies = mainCookies.split(',').map(c => c.trim().split(';')[0]).join('; ');
          console.log(`Main page cookies received: ${sessionCookies.substring(0, 100)}...`);
        }
        
        // Step 2: Simulate human behavior - wait and load market data page
        console.log('Step 2: Waiting 2 seconds (human behavior simulation)...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        console.log('Step 3: Loading market data page...');
        const marketDataResponse = await fetchWithTimeout('https://www.nseindia.com/market-data/live-equity-market', {
          method: 'GET',
          headers: {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
            'Sec-Ch-Ua-Mobile': '?0',
            'Sec-Ch-Ua-Platform': '"Windows"',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'same-origin',
            'Sec-Fetch-User': '?1',
            'Referer': 'https://www.nseindia.com',
            'Cookie': sessionCookies,
            'Upgrade-Insecure-Requests': '1'
          }
        }, 10000);
        
        console.log(`Market data page response: ${marketDataResponse.status}`);
        
        if (marketDataResponse.status === 200) {
          const additionalCookies = marketDataResponse.headers.get('set-cookie');
          if (additionalCookies) {
            const newCookies = additionalCookies.split(',').map(c => c.trim().split(';')[0]).join('; ');
            sessionCookies = sessionCookies + '; ' + newCookies;
            console.log(`Additional cookies received: ${newCookies.substring(0, 100)}...`);
          }
        }
        
        // Step 3: Load get quotes page (where the API is typically called from)
        console.log('Step 4: Loading get quotes page...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const quotesPageResponse = await fetchWithTimeout('https://www.nseindia.com/get-quotes/equity', {
          method: 'GET',
          headers: {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
            'Sec-Ch-Ua-Mobile': '?0',
            'Sec-Ch-Ua-Platform': '"Windows"',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'same-origin',
            'Sec-Fetch-User': '?1',
            'Referer': 'https://www.nseindia.com/market-data/live-equity-market',
            'Cookie': sessionCookies,
            'Upgrade-Insecure-Requests': '1'
          }
        }, 10000);
        
        console.log(`Get quotes page response: ${quotesPageResponse.status}`);
        
        if (quotesPageResponse.status === 200) {
          const finalCookies = quotesPageResponse.headers.get('set-cookie');
          if (finalCookies) {
            const newCookies = finalCookies.split(',').map(c => c.trim().split(';')[0]).join('; ');
            sessionCookies = sessionCookies + '; ' + newCookies;
          }
        }
        
      }
    } catch (error) {
      console.error('Session establishment failed:', error.message);
    }
    
    // Clean up cookies - remove duplicates and empty values
    if (sessionCookies) {
      const cookieMap = new Map();
      sessionCookies.split(';').forEach(cookie => {
        const [name, value] = cookie.trim().split('=');
        if (name && value) {
          cookieMap.set(name.trim(), value.trim());
        }
      });
      sessionCookies = Array.from(cookieMap.entries()).map(([name, value]) => `${name}=${value}`).join('; ');
      console.log(`Final session cookies: ${sessionCookies.length} characters`);
    }
    
    // Function to fetch data for a single symbol
    async function fetchSingleSymbol(symbol) {
      try {
        const targetUrl = `https://www.nseindia.com/api/quote-equity?symbol=${symbol}`;
        console.log(`Fetching ${symbol} from: ${targetUrl}`);
        
        // Wait a bit before making API call (simulate human behavior)
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const headers = {
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
          'Sec-Ch-Ua-Mobile': '?0',
          'Sec-Ch-Ua-Platform': '"Windows"',
          'Sec-Fetch-Dest': 'empty',
          'Sec-Fetch-Mode': 'cors',
          'Sec-Fetch-Site': 'same-origin',
          'Referer': 'https://www.nseindia.com/get-quotes/equity',
          'X-Requested-With': 'XMLHttpRequest',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        };
        
        // Add session cookies if available
        if (sessionCookies) {
          headers['Cookie'] = sessionCookies;
        }
        
        console.log(`${symbol}: Making API call with session cookies...`);
        
        const response = await fetchWithTimeout(targetUrl, {
          method: 'GET',
          headers: headers
        }, 15000);
        
        console.log(`${symbol}: Response ${response.status} ${response.statusText}`);
        
        if (!response.ok) {
          const errorText = await response.text();
          const contentType = response.headers.get('content-type') || '';
          
          console.error(`${symbol}: Error - ${response.status} ${response.statusText}`);
          console.error(`${symbol}: Content-Type: ${contentType}`);
          
          return {
            symbol: symbol,
            success: false,
            error: `HTTP ${response.status}: ${response.statusText}`,
            details: contentType.includes('text/html') ? 'NSE returned HTML error page' : errorText.substring(0, 200),
            timestamp: new Date().toISOString()
          };
        }
        
        const data = await response.json();
        console.log(`${symbol}: Success - Data received`);
        
        return {
          symbol: symbol,
          success: true,
          data: data,
          timestamp: new Date().toISOString()
        };
        
      } catch (error) {
        console.error(`${symbol}: Error - ${error.message}`);
        return {
          symbol: symbol,
          success: false,
          error: error.message,
          timestamp: new Date().toISOString()
        };
      }
    }
    
    // Process symbols with proper delays and chunking
    console.log('Starting API requests with realistic timing...');
    const startTime = Date.now();
    const MAX_CONCURRENT = 3; // Very conservative to avoid overwhelming NSE
    const MAX_PROCESSING_TIME = 50000; // 50 seconds max
    
    const results = [];
    
    // Process symbols in small chunks with delays
    for (let i = 0; i < symbols.length; i += MAX_CONCURRENT) {
      const chunk = symbols.slice(i, i + MAX_CONCURRENT);
      
      // Check timeout
      if (Date.now() - startTime > MAX_PROCESSING_TIME) {
        console.log(`Timeout approaching, stopping at ${i}/${symbols.length}`);
        for (let j = i; j < symbols.length; j++) {
          results.push({
            symbol: symbols[j],
            success: false,
            error: 'Processing timeout',
            timestamp: new Date().toISOString()
          });
        }
        break;
      }
      
      console.log(`Processing chunk ${Math.floor(i/MAX_CONCURRENT) + 1}: ${chunk.join(', ')}`);
      
      try {
        const chunkResults = await Promise.all(
          chunk.map(symbol => fetchSingleSymbol(symbol))
        );
        results.push(...chunkResults);
        
        // Longer delay between chunks to be respectful
        if (i + MAX_CONCURRENT < symbols.length) {
          console.log('Waiting 3 seconds before next chunk...');
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
        
      } catch (error) {
        console.error(`Chunk failed: ${error.message}`);
        chunk.forEach(symbol => {
          results.push({
            symbol: symbol,
            success: false,
            error: `Chunk failed: ${error.message}`,
            timestamp: new Date().toISOString()
          });
        });
      }
    }
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.log(`Completed ${results.length}/${symbols.length} requests in ${duration}ms`);
    
    // Process results
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    console.log(`Success: ${successful.length}, Failed: ${failed.length}`);
    
    // Build response
    const response = {
      meta: {
        totalSymbols: symbols.length,
        successful: successful.length,
        failed: failed.length,
        duration: `${duration}ms`,
        timestamp: new Date().toISOString(),
        source: 'NSE API via Enhanced Proxy',
        sessionEstablished: sessionCookies ? true : false
      },
      data: {},
      errors: {}
    };
    
    // Add successful data
    successful.forEach(result => {
      response.data[result.symbol] = result.data;
    });
    
    // Add error information
    failed.forEach(result => {
      response.errors[result.symbol] = {
        error: result.error,
        details: result.details,
        timestamp: result.timestamp
      };
    });
    
    // Cache briefly
    res.setHeader('Cache-Control', 'public, max-age=60');
    
    // Return response
    if (successful.length > 0) {
      return res.status(200).json(response);
    } else {
      return res.status(207).json(response);
    }
    
  } catch (error) {
    console.error('Proxy Error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
} 
