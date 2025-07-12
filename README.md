# 🚀 NIFTY Indices Dashboard - Vercel Deployment

> **Real-time Indian stock market indices with risk-reward analysis - No CORS issues!**

This version uses Vercel serverless functions to proxy NSE API calls, completely eliminating CORS issues that plague browser-based financial applications.

## 🌟 Features

- **🚀 Vercel Serverless Proxy** - Eliminates CORS issues completely
- **📈 Real-time NSE Data** - Live stock market data via server-side proxy
- **💡 Risk-Reward Analysis** - Distance to high/low calculations
- **📊 Multiple Data Sources** - Vercel proxy → External proxies → Demo data fallback
- **🔄 Auto-refresh** - Configurable refresh intervals
- **📱 Responsive Design** - Works on desktop and mobile
- **🧪 Debug Tools** - Comprehensive testing and diagnostics

## 🚀 Quick Deploy to Vercel

### Method 1: One-Click Deploy (Recommended)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/yourusername/nifty-indices-dashboard)

### Method 2: Manual Deployment

1. **Install Vercel CLI**
   ```bash
   npm install -g vercel
   ```

2. **Clone/Download the project**
   ```bash
   git clone https://github.com/yourusername/nifty-indices-dashboard.git
   cd nifty-indices-dashboard
   ```

3. **Deploy to Vercel**
   ```bash
   vercel --prod
   ```

4. **Follow the prompts**
   - Choose your Vercel account
   - Set project name (e.g., `nifty-indices-dashboard`)
   - Vercel will automatically detect the configuration

### Method 3: GitHub Integration

1. **Push code to GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/yourusername/nifty-indices-dashboard.git
   git push -u origin main
   ```

2. **Connect to Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Click "New Project"
   - Import your GitHub repository
   - Deploy automatically

## 🛠️ Local Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Open http://localhost:3000
```

## 📁 Project Structure

```
nifty-indices-dashboard/
├── index.html              # Main dashboard page
├── api/
│   └── nse-proxy.js        # Vercel serverless function for NSE API proxy
├── vercel.json             # Vercel configuration
├── package.json            # Dependencies and scripts
└── README.md               # This file
```

## 🔧 Configuration

### Environment Variables (Optional)

You can set these in Vercel dashboard under Project Settings → Environment Variables:

- `NSE_API_BASE_URL` - NSE API base URL (default: https://www.nseindia.com/api)
- `CACHE_DURATION` - API response cache duration in seconds (default: 30)

### Company Configuration

Edit the companies list in the "Companies" tab:
- Click "Companies" tab
- Modify the JSON array in the textarea
- Click "Save Config"

## 🔍 API Endpoints

### Vercel Proxy Endpoint

```
GET /api/nse-proxy?symbol=RELIANCE&endpoint=quote
```

**Parameters:**
- `symbol` (required) - Stock symbol (e.g., RELIANCE, TCS, INFY)
- `endpoint` (optional) - API endpoint type:
  - `quote` - Individual stock quote (default)
  - `indices` - All indices data
  - `preopen` - Pre-open market data
  - `marketstatus` - Market status

**Example Response:**
```json
{
  "info": {
    "symbol": "RELIANCE",
    "companyName": "Reliance Industries Limited",
    "marketCap": 1900000000000
  },
  "priceInfo": {
    "lastPrice": 2850.50,
    "change": 25.30,
    "pChange": 0.90,
    "weekHigh52": 3100.00,
    "weekLow52": 2200.00
  },
  "_meta": {
    "timestamp": "2024-01-15T10:30:00.000Z",
    "source": "NSE API via Vercel Proxy",
    "status": "success"
  }
}
```

## 🧪 Testing & Debugging

### Built-in Debug Tools

1. **🧪 Test Vercel API** - Test proxy with RELIANCE stock
2. **🔍 Full Diagnostics** - Comprehensive system check
3. **🔧 Test CORS Solutions** - Test fallback proxy services
4. **⚡ Quick CORS Check** - Fast connectivity test

### Debug Console

Open browser console (F12) to see detailed logs:
- API requests and responses
- Error messages and stack traces
- Performance metrics

## 📊 Data Sources & Fallbacks

The system tries multiple data sources in order:

1. **🚀 Vercel Proxy** - Primary source (server-side NSE API calls)
2. **🌐 External Proxies** - Fallback proxy services
3. **📊 Demo Data** - Static fallback data for testing

## 🚨 Troubleshooting

### Common Issues

**1. "Internal Server Error" (500)**
```
Check Vercel function logs:
vercel logs --project=your-project-name
```

**2. "NSE API Error" (401)**
```
NSE API requires session cookies even for server-side requests.
This is expected - system will fall back to external proxies.
```

**3. "No Live Data Available"**
```
- Check if market is open (9:15 AM - 3:30 PM IST)
- Verify internet connectivity
- Check Vercel function logs
- Try "🔍 Full Diagnostics" button
```

### Vercel-Specific Issues

**Function Timeout**
```
Increase timeout in vercel.json:
"functions": {
  "api/nse-proxy.js": {
    "maxDuration": 30
  }
}
```

**Build Errors**
```
Check build logs in Vercel dashboard
Ensure all files are properly committed
```

## 🔒 Security & Privacy

- **No API Keys Required** - Uses public NSE APIs
- **Server-side Requests** - Your IP is protected
- **No Data Storage** - Data is fetched in real-time
- **HTTPS Only** - All communications encrypted

## 🌐 Production URLs

After deployment, your dashboard will be available at:
- `https://your-project-name.vercel.app`
- `https://your-project-name-your-username.vercel.app`

## 📈 Performance

- **⚡ Fast Loading** - Optimized static files
- **🔄 Efficient Caching** - 30-second API cache
- **🌍 Global CDN** - Vercel's edge network
- **📱 Mobile Optimized** - Responsive design

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

MIT License - feel free to use for personal or commercial projects.

## 🆘 Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/nifty-indices-dashboard/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/nifty-indices-dashboard/discussions)
- **Email**: your.email@example.com

---

**Built with ❤️ using Vercel serverless functions**

*Eliminating CORS issues for financial applications since 2024* 🚀 