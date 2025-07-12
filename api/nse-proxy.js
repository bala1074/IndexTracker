// Vercel serverless function to proxy NSE API calls
// This solves CORS issues by making server-side requests

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
    
    console.log(`Fetching data from NSE API: ${targetUrl}`);
    
    // Make request to NSE API with proper headers
    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://www.nseindia.com/',
        'Origin': 'https://www.nseindia.com',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }
    });
    
    console.log(`NSE API Response: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('NSE API Error:', errorText);
      
      // Return structured error response
      return res.status(response.status).json({
        error: `NSE API Error: ${response.status} ${response.statusText}`,
        details: response.status === 401 ? 
          'NSE API requires session cookies. Server-side requests may need additional authentication.' :
          errorText.substring(0, 200),
        symbol: symbol,
        endpoint: endpoint,
        timestamp: new Date().toISOString()
      });
    }
    
    const data = await response.json();
    console.log('NSE API Success:', Object.keys(data));
    
    // Add metadata to response
    const enrichedData = {
      ...data,
      _meta: {
        symbol: symbol,
        endpoint: endpoint,
        timestamp: new Date().toISOString(),
        source: 'NSE API via Vercel Proxy',
        status: 'success'
      }
    };
    
    // Cache the response for 30 seconds
    res.setHeader('Cache-Control', 'public, max-age=30');
    
    return res.status(200).json(enrichedData);
    
  } catch (error) {
    console.error('Proxy Error:', error);
    
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
} 