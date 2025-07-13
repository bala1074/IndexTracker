// Vercel Serverless Function to Proxy Screener.in Requests
// This avoids CORS issues by fetching data server-side

export default async function handler(req, res) {
  // Set CORS headers to allow requests from your frontend
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  // Only allow GET requests
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  
  try {
    const { symbol } = req.query;
    
    if (!symbol) {
      res.status(400).json({ error: 'Symbol parameter is required' });
      return;
    }
    
    console.log(`🔍 Fetching data for ${symbol} from Screener.in`);
    
    // Fetch data from Screener.in
    const screenerUrl = `https://www.screener.in/company/${symbol}/`;
    const response = await fetch(screenerUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const html = await response.text();
    
    // Parse the HTML to extract company data
    const companyData = parseScreenerData(html, symbol);
    
    console.log(`✅ Successfully fetched ${symbol} from Screener.in`);
    
    // Return the parsed data
    res.status(200).json({
      success: true,
      symbol: symbol,
      data: companyData,
      source: 'Screener.in via Vercel Proxy',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error(`❌ Error fetching ${req.query.symbol}:`, error);
    res.status(500).json({ 
      error: 'Failed to fetch data from Screener.in',
      details: error.message,
      symbol: req.query.symbol
    });
  }
}

// Parse Screener.in HTML to extract company data
function parseScreenerData(html, symbol) {
  try {
    // Helper function to extract text content from HTML
    const extractValue = (regex, defaultValue = 'N/A') => {
      const match = html.match(regex);
      return match ? match[1].trim() : defaultValue;
    };
    
    // Helper function to extract numeric value
    const extractNumber = (regex, defaultValue = 0) => {
      const match = html.match(regex);
      if (!match) return defaultValue;
      const value = match[1].replace(/[^\d.-]/g, '');
      return value ? parseFloat(value) : defaultValue;
    };
    
    // Extract company name
    let companyName = extractValue(/<h1[^>]*>([^<]+)<\/h1>/);
    if (companyName === 'N/A') {
      companyName = extractValue(/<title>([^|]+)\|/);
    }
    if (companyName === 'N/A') {
      companyName = symbol;
    }
    
    // Extract current price
    const currentPrice = extractNumber(/Current Price[^₹]*₹([^<]+)/i) || 
                        extractNumber(/Price[^₹]*₹([^<]+)/i) ||
                        extractNumber(/₹([^<]+)/);
    
    // Extract 52-week high and low
    const week52High = extractNumber(/52W High[^₹]*₹([^<]+)/i) ||
                      extractNumber(/52 Week High[^₹]*₹([^<]+)/i);
    
    const week52Low = extractNumber(/52W Low[^₹]*₹([^<]+)/i) ||
                     extractNumber(/52 Week Low[^₹]*₹([^<]+)/i);
    
    // Extract PE ratios
    const currentPE = extractNumber(/PE[^>]*>([^<]+)</i) ||
                     extractNumber(/P\/E[^>]*>([^<]+)</i);
    
    // Extract sector
    let sector = extractValue(/Sector[^>]*>([^<]+)</i);
    if (sector === 'N/A') {
      sector = extractValue(/Industry[^>]*>([^<]+)</i);
    }
    
    // Extract market cap
    const marketCap = extractValue(/Market Cap[^>]*>([^<]+)</i) ||
                     extractValue(/Mkt Cap[^>]*>([^<]+)</i);
    
    // Try to extract from table structure if main extraction fails
    if (currentPrice === 0) {
      const tableMatches = html.match(/<table[^>]*>[\s\S]*?<\/table>/gi);
      if (tableMatches) {
        for (const table of tableMatches) {
          const priceMatch = table.match(/₹([^<]+)/);
          if (priceMatch) {
            const price = parseFloat(priceMatch[1].replace(/[^\d.-]/g, ''));
            if (price > 0) {
              return {
                companyName: companyName,
                lastPrice: price,
                week52High: week52High || price * 1.2,
                week52Low: week52Low || price * 0.8,
                currentPE: currentPE || 15,
                peAtHigh: currentPE * 1.2 || 18,
                peAtLow: currentPE * 0.8 || 12,
                sector: sector,
                marketCap: marketCap
              };
            }
          }
        }
      }
    }
    
    // Calculate PE at high and low if not available
    const peAtHigh = currentPE > 0 ? currentPE * 1.2 : 18;
    const peAtLow = currentPE > 0 ? currentPE * 0.8 : 12;
    
    return {
      companyName: companyName,
      lastPrice: currentPrice,
      week52High: week52High || currentPrice * 1.2,
      week52Low: week52Low || currentPrice * 0.8,
      currentPE: currentPE,
      peAtHigh: peAtHigh,
      peAtLow: peAtLow,
      sector: sector,
      marketCap: marketCap
    };
    
  } catch (error) {
    console.error('Error parsing Screener.in data:', error);
    return {
      companyName: symbol,
      lastPrice: 0,
      week52High: 0,
      week52Low: 0,
      currentPE: 0,
      peAtHigh: 0,
      peAtLow: 0,
      sector: 'N/A',
      marketCap: 'N/A'
    };
  }
} 
