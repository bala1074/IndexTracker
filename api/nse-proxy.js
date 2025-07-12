// Vercel serverless function to proxy NSE API calls
// Supports both single symbol and batch requests

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
        // Batch request via GET (comma-separated symbols)
        symbols = symbolsParam.split(',').map(s => s.trim()).filter(s => s);
      } else if (symbol) {
        // Single symbol request
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
    function fetchWithTimeout(url, options, timeoutMs = 10000) {
      return Promise.race([
        fetch(url, options),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error(`Request timeout after ${timeoutMs}ms`)), timeoutMs)
        )
      ]);
    }
    
    // Step 1: Establish session cookies once for all requests
    console.log('Establishing NSE session...');
    let sessionCookies = '';
    
    try {
      const sessionResponse = await fetchWithTimeout('https://www.nseindia.com/', {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Cache-Control': 'no-cache'
        }
      }, 8000); // 8 second timeout for session establishment
      
      sessionCookies = sessionResponse.headers.get('set-cookie') || '';
      console.log(`Session established: ${sessionCookies ? 'Cookies received' : 'No cookies'}`);
      
    } catch (error) {
      console.error('Failed to establish session:', error.message);
      // Continue without session cookies - some requests might still work
    }
    
    // Function to fetch data for a single symbol using shared session
    async function fetchSingleSymbol(symbol) {
      try {
        const targetUrl = `https://www.nseindia.com/api/quote-equity?symbol=${symbol}`;
        console.log(`Fetching ${symbol} from: ${targetUrl}`);
        
        // Step 2: Make the actual API request with shared session cookies and timeout
        const response = await fetchWithTimeout(targetUrl, {
          method: 'GET',
          headers: {
            'Accept': '*/*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Referer': 'https://www.nseindia.com/',
            'Origin': 'https://www.nseindia.com',
            'X-Requested-With': 'XMLHttpRequest',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Sec-Fetch-Dest': 'empty',
            'Sec-Fetch-Mode': 'cors',
            'Sec-Fetch-Site': 'same-origin',
            'Cookie': sessionCookies
          }
        }, 12000); // 12 second timeout for individual API calls
        
        console.log(`${symbol}: Response ${response.status}`);
        
        if (!response.ok) {
          const errorText = await response.text();
          return {
            symbol: symbol,
            success: false,
            error: `HTTP ${response.status}: ${response.statusText}`,
            details: errorText.substring(0, 200),
            timestamp: new Date().toISOString()
          };
        }
        
        const data = await response.json();
        
        return {
          symbol: symbol,
          success: true,
          data: data,
          timestamp: new Date().toISOString()
        };
        
      } catch (error) {
        console.error(`Error fetching ${symbol}:`, error.message);
        return {
          symbol: symbol,
          success: false,
          error: error.message,
          timestamp: new Date().toISOString()
        };
      }
    }
    
    // Make parallel requests for all symbols with chunking to prevent timeout
    console.log('Starting batch requests...');
    const startTime = Date.now();
    const MAX_CONCURRENT = 8; // Limit concurrent requests to prevent overwhelming NSE
    const MAX_PROCESSING_TIME = 45000; // 45 second max processing time
    
    const results = [];
    
    // Process symbols in chunks to avoid timeout
    for (let i = 0; i < symbols.length; i += MAX_CONCURRENT) {
      const chunk = symbols.slice(i, i + MAX_CONCURRENT);
      const chunkStartTime = Date.now();
      
      // Check if we're approaching timeout
      if (Date.now() - startTime > MAX_PROCESSING_TIME) {
        console.log(`Timeout approaching, stopping at ${i}/${symbols.length} symbols`);
        // Add timeout errors for remaining symbols
        for (let j = i; j < symbols.length; j++) {
          results.push({
            symbol: symbols[j],
            success: false,
            error: 'Processing timeout - request cancelled to avoid Vercel timeout',
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
        
        const chunkDuration = Date.now() - chunkStartTime;
        console.log(`Chunk completed in ${chunkDuration}ms`);
        
      } catch (error) {
        console.error(`Chunk failed:`, error.message);
        // Add error results for this chunk
        chunk.forEach(symbol => {
          results.push({
            symbol: symbol,
            success: false,
            error: `Chunk processing failed: ${error.message}`,
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
        source: 'NSE API via Vercel Proxy (Batch)'
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
    
    // Cache the response for 30 seconds
    res.setHeader('Cache-Control', 'public, max-age=30');
    
    // Return appropriate status code
    if (successful.length > 0) {
      // Return 200 if at least some symbols succeeded
      return res.status(200).json(response);
    } else {
      // Return 207 (Multi-Status) if all failed but request was valid
      return res.status(207).json(response);
    }
    
  } catch (error) {
    console.error('Batch Proxy Error:', error);
    
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
} 
