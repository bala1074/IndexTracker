// /api/nse-proxy.js

/**
 * Vercel serverless function to proxy NSE (National Stock Exchange) of India API calls.
 * * This function is enhanced to reliably bypass NSE's bot detection by mimicking a
 * real browser's navigation flow to establish a valid session with the necessary cookies.
 * * Key Features:
 * - Handles both GET and POST requests for single or batch symbols.
 * - Supports multiple NSE API endpoints through a simple configuration object.
 * - Implements a realistic multi-step session "warm-up" with retry logic for reliability.
 * - Robust cookie parsing and management.
 * - throttles requests in concurrent chunks to avoid rate-limiting.
 * - Clear and structured JSON response with metadata, data, and errors.
 * - Proper HTTP status codes for success (200), partial success (207), and failure (502).
 */

// --- CONFIGURATION ---

const NSE_BASE_URL = 'https://www.nseindia.com';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

// Map friendly endpoint names to actual API paths and required query parameters
const ENDPOINT_CONFIG = {
  'quote': {
    path: '/api/quote-equity',
    param: 'symbol',
  },
  'option-chain': {
    path: '/api/option-chain-indices',
    param: 'symbol', // e.g., NIFTY, BANKNIFTY
  },
  'chart': {
    path: '/api/chart-databyindex',
    param: 'index', // e.g., NIFTY 50
  },
  // Add other endpoints here as needed
};

// --- HELPER FUNCTIONS ---

/**
 * Fetches a URL with a specified timeout.
 * @param {string} url The URL to fetch.
 * @param {object} options The fetch options.
 * @param {number} timeoutMs The timeout in milliseconds.
 * @returns {Promise<Response>} A promise that resolves with the fetch Response.
 */
function fetchWithTimeout(url, options, timeoutMs = 25000) { // Increased default timeout
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(timeout));
}

/**
 * Establishes a session with NSE, with retry logic for resilience.
 * @returns {Promise<string>} A promise that resolves with the semicolon-separated cookie string.
 */
async function getSessionCookies() {
  console.log('Establishing NSE session...');
  const MAX_ATTEMPTS = 3;
  let lastError;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      console.log(`Session attempt ${attempt}/${MAX_ATTEMPTS}...`);
      const headers = {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'User-Agent': USER_AGENT,
        'Sec-Ch-Ua': '"Not/A)Brand";v="8", "Chromium";v="126", "Google Chrome";v="126"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
        'Upgrade-Insecure-Requests': '1',
        'Cache-Control': 'max-age=0'
      };

      // Step 1: Visit the main page to get initial cookies.
      const mainPageRes = await fetchWithTimeout(NSE_BASE_URL, { headers });
      if (!mainPageRes.ok) throw new Error(`Main page fetch failed: ${mainPageRes.status}`);

      const mainCookies = mainPageRes.headers.get('set-cookie') || '';
      console.log('Step 1: Main page cookies received.');

      // Step 2: Visit a data-heavy page to get additional cookies.
      await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 500));
      const marketDataRes = await fetchWithTimeout(`${NSE_BASE_URL}/market-data/live-equity-market`, {
        headers: { ...headers, 'Referer': NSE_BASE_URL, 'Cookie': mainCookies }
      });
      if (!marketDataRes.ok) throw new Error(`Market data page fetch failed: ${marketDataRes.status}`);

      // Clean and de-duplicate all collected cookies
      const allCookiesRaw = [mainCookies, marketDataRes.headers.get('set-cookie') || ''].join(', ');
      const cookieMap = new Map();
      allCookiesRaw.split(',').forEach(cookie => {
        const parts = cookie.split(';')[0].trim();
        if (parts) {
          const [name, ...value] = parts.split('=');
          if (name && value.length > 0) {
            cookieMap.set(name, value.join('='));
          }
        }
      });

      const finalCookies = Array.from(cookieMap.entries()).map(([k, v]) => `${k}=${v}`).join('; ');
      console.log(`Session established successfully. Final cookie length: ${finalCookies.length}`);
      return finalCookies; // Success!

    } catch (error) {
      lastError = error;
      console.error(`Session attempt ${attempt} failed: ${error.message}`);
      if (attempt < MAX_ATTEMPTS) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait before retrying
      }
    }
  }
  
  // If all attempts fail, throw the last recorded error
  throw new Error(`Failed to establish NSE session after ${MAX_ATTEMPTS} attempts. Last error: ${lastError.message}`);
}

/**
 * Fetches data for a single symbol from a specified NSE endpoint.
 * @param {string} symbol The stock symbol or index name.
 * @param {string} endpoint The friendly endpoint name (e.g., 'quote').
 * @param {string} sessionCookies The session cookie string.
 * @returns {Promise<object>} A result object indicating success or failure.
 */
async function fetchNseData(symbol, endpoint, sessionCookies) {
  const config = ENDPOINT_CONFIG[endpoint];
  if (!config) {
    return { symbol, success: false, error: `Invalid endpoint: ${endpoint}` };
  }

  const targetUrl = `${NSE_BASE_URL}${config.path}?${config.param}=${encodeURIComponent(symbol)}`;
  console.log(`Fetching data for [${symbol}] from [${endpoint}] endpoint...`);

  try {
    const headers = {
      'Accept': 'application/json, text/plain, */*',
      'User-Agent': USER_AGENT,
      'Referer': `${NSE_BASE_URL}/get-quotes/equity`, 
      'Cookie': sessionCookies
    };

    const response = await fetchWithTimeout(targetUrl, { headers });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[${symbol}] Failed with status ${response.status}.`);
      return {
        symbol,
        success: false,
        error: `HTTP Error: ${response.status}`,
        details: errorText.substring(0, 200)
      };
    }

    const data = await response.json();
    console.log(`[${symbol}] Success.`);
    return { symbol, success: true, data };

  } catch (error) {
    console.error(`[${symbol}] Request failed: ${error.message}`);
    return { symbol, success: false, error: error.message };
  }
}

// --- MAIN HANDLER ---

export default async function handler(req, res) {
  // Set CORS and handle preflight OPTIONS request
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const startTime = Date.now();
  let symbols = [];
  let endpoint = 'quote';

  // Extract parameters from GET or POST request
  if (req.method === 'GET') {
    const { symbol, symbols: symbolsParam, endpoint: endpointParam } = req.query;
    if (symbolsParam) symbols = symbolsParam.split(',').map(s => s.trim()).filter(Boolean);
    else if (symbol) symbols = [symbol.trim()];
    if (endpointParam) endpoint = endpointParam;
  } else if (req.method === 'POST') {
    symbols = req.body.symbols || [];
    endpoint = req.body.endpoint || 'quote';
  } else {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  if (!symbols.length || !ENDPOINT_CONFIG[endpoint]) {
    return res.status(400).json({ 
        error: 'Missing or invalid parameters.',
        usage: {
            'GET (single)': `/api/nse-proxy?symbol=RELIANCE&endpoint=quote`,
            'GET (batch)': `/api/nse-proxy?symbols=RELIANCE,TCS&endpoint=quote`,
            'POST (batch)': `{"symbols": ["RELIANCE", "TCS"], "endpoint": "quote"}`,
            'Available Endpoints': Object.keys(ENDPOINT_CONFIG)
        }
    });
  }

  try {
    const sessionCookies = await getSessionCookies();
    
    // Process symbols in throttled, concurrent chunks
    const MAX_CONCURRENT = 4;
    const results = [];
    for (let i = 0; i < symbols.length; i += MAX_CONCURRENT) {
      const chunk = symbols.slice(i, i + MAX_CONCURRENT);
      console.log(`Processing chunk: ${chunk.join(', ')}`);
      
      const chunkPromises = chunk.map(symbol => fetchNseData(symbol, endpoint, sessionCookies));
      const chunkResults = await Promise.all(chunkPromises);
      results.push(...chunkResults);

      if (i + MAX_CONCURRENT < symbols.length) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // Delay between chunks
      }
    }
    
    // Compile the final response
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    const responsePayload = {
      meta: {
        source: 'NSE API via Vercel Proxy',
        symbolsRequested: symbols.length,
        successful: successful.length,
        failed: failed.length,
        duration: `${Date.now() - startTime}ms`,
        timestamp: new Date().toISOString(),
      },
      data: successful.reduce((acc, r) => {
        acc[r.symbol] = r.data;
        return acc;
      }, {}),
      errors: failed.reduce((acc, r) => {
        acc[r.symbol] = { error: r.error, details: r.details };
        return acc;
      }, {}),
    };

    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');

    if (failed.length === 0) {
      return res.status(200).json(responsePayload); // All successful
    } else if (successful.length > 0) {
      return res.status(207).json(responsePayload); // Partial success
    } else {
      return res.status(502).json(responsePayload); // All failed
    }

  } catch (error) {
    console.error('Critical Proxy Error:', error);
    return res.status(503).json({ 
        error: 'Service Unavailable', 
        message: error.message 
    });
  }
}
