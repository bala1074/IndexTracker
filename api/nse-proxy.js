export default async function handler(req, res) {
  const symbolsParam = req.query.symbols;
  if (!symbolsParam) {
    return res.status(400).json({ error: "Missing ?symbols=TCS,RELIANCE" });
  }

  const symbols = symbolsParam.split(",");

  const headers = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/117 Safari/537.36",
    "Accept": "application/json",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://www.nseindia.com",
    "Connection": "keep-alive",
  };

  try {
    // Step 1: Warm up request to get cookies
    const homeRes = await fetch("https://www.nseindia.com", { headers });
    const cookies = homeRes.headers.get("set-cookie");

    if (!cookies) {
      return res.status(403).json({ error: "Could not get session cookie from NSE" });
    }

    // Step 2: Make all NSE API requests in parallel
    const results = await Promise.all(
      symbols.map(async (symbol) => {
        try {
          const response = await fetch(
            `https://www.nseindia.com/api/quote-equity?symbol=${symbol.trim()}`,
            {
              headers: {
                ...headers,
                Cookie: cookies,
              },
            }
          );

          if (!response.ok) {
            return { symbol, error: `Status ${response.status}` };
          }

          const data = await response.json();
          return {
            symbol,
            price: data.priceInfo?.lastPrice,
            high52: data.priceInfo?.weekHigh52,
            low52: data.priceInfo?.weekLow52,
          };
        } catch (err) {
          return { symbol, error: "NSE API failed" };
        }
      })
    );

    res.status(200).json(results);
  } catch (err) {
    res.status(500).json({ error: "NSE connection failed", details: err.message });
  }
}
