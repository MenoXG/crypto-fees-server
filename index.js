import express from "express";
import fetch from "node-fetch";
import crypto from "crypto";

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// قائمة الشبكات المسموح بها
const ALLOWED_NETWORKS = [
  "ETH", "BSC", "MATIC", "ARBITRUM",
  "TON", "BTC", "APT", "SOL", "XRP", "TRX",
  "LTC", "OPTIMISM", "AVAXC", "SONIC", "CELO", "BASE"
];

// خريطة لتغيير أسماء الشبكات للعرض
const NETWORK_NAME_MAP = {
  "ETH": "✅ Ethereum (ERC20)",
  "BSC": "✅ BNB Smart Chain (BEP20)",
  "MATIC": "✅ Polygon",
  "ARBITRUM": "✅ Arbitrum",
  "TON": "✅ TON",
  "BTC": "✅ Bitcoin (BTC)",
  "APT": "✅ Aptos (APT)",
  "SOL": "✅ Solana (SOL)",
  "XRP": "✅ Ripple (XRP)",
  "TRX": "✅ TRC20 (Tron)",
  "LTC": "✅ Litecoin (LTC)",
  "OPTIMISM": "✅ Optimism (OP)",
  "AVAXC": "✅ AVAX C-Chain",
  "SONIC": "✅ Sonic Network",
  "CELO": "✅ CELO",
  "BASE": "✅ Base"
};

// تحذير إذا لم يتم ضبط API Key أو Secret
if (!process.env.BINANCE_API_KEY || !process.env.BINANCE_API_SECRET) {
  console.warn("⚠️ BINANCE_API_KEY or BINANCE_API_SECRET is not set! API requests will fail.");
}

// الكاش المحسن مع إضافة keep-alive
let warmCache = {
  data: null,
  timestamp: null,
  CACHE_DURATION: 2 * 60 * 1000, // 2 دقيقة
  isFetching: false // منع طلبات مكررة
};

// Keep-alive connections pool
const connectionPool = new Map();

// Helper لتوليد signature
function signQuery(queryString) {
  return crypto
    .createHmac("sha256", process.env.BINANCE_API_SECRET)
    .update(queryString)
    .digest("hex");
}

// دالة محسنة لجلب البيانات من Binance مع connection reuse
async function fetchBinanceData() {
  const timestamp = Date.now();
  const queryString = `timestamp=${timestamp}`;
  const signature = signQuery(queryString);

  const url = `https://api.binance.com/sapi/v1/capital/config/getall?${queryString}&signature=${signature}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 ثواني timeout

    const response = await fetch(url, {
      method: "GET",
      headers: { 
        "X-MBX-APIKEY": process.env.BINANCE_API_KEY,
        "Connection": "keep-alive",
        "Accept-Encoding": "gzip"
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Binance API error: ${response.status} - ${text}`);
    }

    return await response.json();
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('Request timeout');
    }
    throw error;
  }
}

// Health check سريع
app.get("/", (req, res) => {
  res.json({ 
    status: "🚀 Server is alive!", 
    timestamp: new Date().toISOString(),
    cacheStatus: warmCache.data ? "Warm" : "Cold",
    cacheAge: warmCache.timestamp ? Math.floor((Date.now() - warmCache.timestamp) / 1000) : null
  });
});

// ✅ Endpoint سريع للبيانات الأساسية
app.get("/health-data", async (req, res) => {
  try {
    const data = warmCache.data;
    if (!data) {
      return res.json({ status: "no_cache", message: "No cached data available" });
    }

    // إرجاع بيانات مختصرة وسريعة
    const quickResult = data.slice(0, 20).map((coinInfo) => ({
      coin: coinInfo.coin,
      networks: (coinInfo.networkList || [])
        .filter((n) => n.withdrawEnable && ALLOWED_NETWORKS.includes(n.network))
        .slice(0, 3) // فقط أول 3 شبكات
        .map((n) => ({
          network: NETWORK_NAME_MAP[n.network] || n.network,
          withdrawFee: n.withdrawFee,
        }))
    }));

    res.json({
      data: quickResult,
      timestamp: new Date().toISOString(),
      totalCoins: data.length,
      source: "cache"
    });

  } catch (err) {
    res.status(500).json({ error: "Health data error", details: err.message });
  }
});

// ✅ Endpoint لكل العملات (مع تحسينات الأداء)
app.get("/all-coins-fees", async (req, res) => {
  if (!process.env.BINANCE_API_KEY || !process.env.BINANCE_API_SECRET) {
    return res.json({ warning: "API Key/Secret not set", coins: [] });
  }

  try {
    const now = Date.now();
    let data;
    let source = "cache";
    
    // إذا كان الكاش قديم أو غير موجود، جلب بيانات جديدة
    if (!warmCache.data || !warmCache.timestamp || 
        (now - warmCache.timestamp) > warmCache.CACHE_DURATION) {
      
      if (warmCache.isFetching) {
        // إذا كان هناك fetch جاري، استخدم الكاش القديم مع تحذير
        if (warmCache.data) {
          console.log("⚠️ Using stale cache while fetching new data");
          data = warmCache.data;
          source = "stale_cache";
        } else {
          // لا توجد بيانات مطلقاً، انتظر قليلاً ثم حاول
          await new Promise(resolve => setTimeout(resolve, 500));
          data = await fetchBinanceData();
          warmCache.data = data;
          warmCache.timestamp = Date.now();
          source = "binance_fresh";
        }
      } else {
        warmCache.isFetching = true;
        try {
          data = await fetchBinanceData();
          warmCache.data = data;
          warmCache.timestamp = Date.now();
          source = "binance_fresh";
        } finally {
          warmCache.isFetching = false;
        }
      }
    } else {
      data = warmCache.data;
      console.log("✅ Using warm cache data");
    }

    const result = data.map((coinInfo) => ({
      coin: coinInfo.coin,
      name: coinInfo.name || "",
      networks: (coinInfo.networkList || [])
        .filter((n) => n.withdrawEnable && ALLOWED_NETWORKS.includes(n.network))
        .map((n) => ({
          network: NETWORK_NAME_MAP[n.network] || n.network,
          withdrawFee: n.withdrawFee,
          minWithdrawAmount: n.withdrawMin,
          depositEnable: n.depositEnable,
          withdrawEnable: n.withdrawEnable,
        }))
        .sort((a, b) => parseFloat(a.withdrawFee) - parseFloat(b.withdrawFee)),
    }));

    res.json({
      data: result,
      timestamp: new Date().toISOString(),
      source: source
    });

  } catch (err) {
    console.error("🔥 Unexpected error:", err);
    
    // استخدام الكاش القديم كحل أخير
    if (warmCache.data) {
      console.log("🔄 Using cached data as fallback");
      const result = warmCache.data.map((coinInfo) => ({
        coin: coinInfo.coin,
        name: coinInfo.name || "",
        networks: (coinInfo.networkList || [])
          .filter((n) => n.withdrawEnable && ALLOWED_NETWORKS.includes(n.network))
          .map((n) => ({
            network: NETWORK_NAME_MAP[n.network] || n.network,
            withdrawFee: n.withdrawFee,
            minWithdrawAmount: n.withdrawMin,
            depositEnable: n.depositEnable,
            withdrawEnable: n.withdrawEnable,
          }))
          .sort((a, b) => parseFloat(a.withdrawFee) - parseFloat(b.withdrawFee)),
      }));
      
      return res.json({
        data: result,
        timestamp: new Date().toISOString(),
        source: "cache_fallback",
        warning: "Using cached data due to API error"
      });
    }
    
    res.status(500).json({ 
      error: "Something went wrong", 
      details: err.message 
    });
  }
});

// ✅ Endpoint لعملة واحدة (محسن)
app.post("/get-withdraw-fees", async (req, res) => {
  const { coin } = req.body;
  if (!coin) return res.status(400).json({ error: "coin is required" });

  if (!process.env.BINANCE_API_KEY || !process.env.BINANCE_API_SECRET) {
    return res.json({ warning: "API Key/Secret not set", coin, networks: [] });
  }

  try {
    // استخدام الكاش أولاً، إذا لم يكن موجوداً جلب بيانات جديدة
    let data = warmCache.data;
    let source = "cache";
    
    if (!data) {
      data = await fetchBinanceData();
      warmCache.data = data;
      warmCache.timestamp = Date.now();
      source = "binance";
    }

    const coinInfo = data.find((c) => c.coin === coin.toUpperCase());

    if (!coinInfo) return res.status(404).json({ error: "Coin not found" });

    const networks = (coinInfo.networkList || [])
      .filter((n) => n.withdrawEnable && ALLOWED_NETWORKS.includes(n.network))
      .map((n) => ({
        network: NETWORK_NAME_MAP[n.network] || n.network,
        withdrawFee: n.withdrawFee,
        minWithdrawAmount: n.withdrawMin,
        depositEnable: n.depositEnable,
        withdrawEnable: n.withdrawEnable,
      }))
      .sort((a, b) => parseFloat(a.withdrawFee) - parseFloat(b.withdrawFee));

    if (networks.length === 0) {
      return res.json({ 
        coin: coinInfo.coin, 
        name: coinInfo.name || "", 
        networks: [], 
        warning: "No allowed networks available" 
      });
    }

    res.json({ 
      coin: coinInfo.coin, 
      name: coinInfo.name || "", 
      networks,
      timestamp: new Date().toISOString(),
      source: source
    });

  } catch (err) {
    console.error("🔥 Unexpected error:", err);
    
    if (warmCache.data) {
      const coinInfo = warmCache.data.find((c) => c.coin === coin.toUpperCase());
      if (coinInfo) {
        const networks = (coinInfo.networkList || [])
          .filter((n) => n.withdrawEnable && ALLOWED_NETWORKS.includes(n.network))
          .map((n) => ({
            network: NETWORK_NAME_MAP[n.network] || n.network,
            withdrawFee: n.withdrawFee,
            minWithdrawAmount: n.withdrawMin,
            depositEnable: n.depositEnable,
            withdrawEnable: n.withdrawEnable,
          }))
          .sort((a, b) => parseFloat(a.withdrawFee) - parseFloat(b.withdrawFee));
          
        return res.json({
          coin: coinInfo.coin,
          name: coinInfo.name || "",
          networks,
          timestamp: new Date().toISOString(),
          source: "cache_fallback",
          warning: "Using cached data due to API error"
        });
      }
    }
    
    res.status(500).json({ 
      error: "Something went wrong", 
      details: err.message 
    });
  }
});

// ✅ Endpoint جديد KAST (محسن)
app.post("/kast", async (req, res) => {
  const { much } = req.body;
  if (!much) return res.status(400).json({ error: "much is required" });

  try {
    // استخدام الكاش أولاً
    let data = warmCache.data;
    let source = "cache";
    
    if (!data) {
      data = await fetchBinanceData();
      warmCache.data = data;
      warmCache.timestamp = Date.now();
      source = "binance";
    }

    const coinInfo = data.find((c) => c.coin === "USDT");

    if (!coinInfo) return res.status(404).json({ error: "USDT not found" });

    const ALLOWED_KAST_NETWORKS = [
      "BSC", "MATIC", "ARBITRUM", "SOL", "TRX", "ETH", "AVAXC"
    ];

    const validNetworks = (coinInfo.networkList || [])
      .filter((n) =>
        ALLOWED_KAST_NETWORKS.includes(n.network) &&
        n.withdrawEnable &&
        parseFloat(much) >= parseFloat(n.withdrawMin)
      )
      .sort((a, b) => parseFloat(a.withdrawFee) - parseFloat(b.withdrawFee));

    if (validNetworks.length === 0) {
      return res.json({ error: "No suitable network found for this amount" });
    }

    const best = validNetworks[0];

    res.json({
      coin: "USDT",
      bestNetwork: NETWORK_NAME_MAP[best.network] || best.network,
      withdrawFee: best.withdrawFee,
      timestamp: new Date().toISOString(),
      source: source
    });

  } catch (err) {
    console.error("🔥 Unexpected error:", err);
    
    if (warmCache.data) {
      const coinInfo = warmCache.data.find((c) => c.coin === "USDT");
      if (coinInfo) {
        const ALLOWED_KAST_NETWORKS = [
          "BSC", "MATIC", "ARBITRUM", "SOL", "TRX", "ETH", "AVAXC"
        ];

        const validNetworks = (coinInfo.networkList || [])
          .filter((n) =>
            ALLOWED_KAST_NETWORKS.includes(n.network) &&
            n.withdrawEnable &&
            parseFloat(much) >= parseFloat(n.withdrawMin)
          )
          .sort((a, b) => parseFloat(a.withdrawFee) - parseFloat(b.withdrawFee));

        if (validNetworks.length > 0) {
          const best = validNetworks[0];
          return res.json({
            coin: "USDT",
            bestNetwork: NETWORK_NAME_MAP[best.network] || best.network,
            withdrawFee: best.withdrawFee,
            timestamp: new Date().toISOString(),
            source: "cache_fallback",
            warning: "Using cached data due to API error"
          });
        }
      }
    }
    
    res.status(500).json({ 
      error: "Something went wrong", 
      details: err.message 
    });
  }
});

// ✅ إضافة endpoint لتفريغ الكاش يدوياً
app.post("/refresh-cache", async (req, res) => {
  try {
    const data = await fetchBinanceData();
    warmCache.data = data;
    warmCache.timestamp = Date.now();
    
    res.json({ 
      message: "Cache refreshed successfully",
      timestamp: new Date().toISOString(),
      dataCount: data.length
    });
  } catch (error) {
    res.status(500).json({ 
      error: "Failed to refresh cache", 
      details: error.message 
    });
  }
});

// ✅ endpoint لحالة الكاش
app.get("/cache-status", (req, res) => {
  const now = Date.now();
  const isCacheValid = warmCache.data && warmCache.timestamp && 
                      (now - warmCache.timestamp) < warmCache.CACHE_DURATION;
  
  res.json({
    hasData: !!warmCache.data,
    lastUpdated: warmCache.timestamp ? new Date(warmCache.timestamp).toISOString() : null,
    isCacheValid: isCacheValid,
    cacheAge: warmCache.timestamp ? Math.floor((now - warmCache.timestamp) / 1000) : null,
    cacheDuration: warmCache.CACHE_DURATION / 1000,
    isFetching: warmCache.isFetching
  });
});

// ✅ Keep-alive endpoint للحفاظ على الخادم نشط
app.get("/keep-alive", (req, res) => {
  res.json({ 
    status: "🫀 Server is keeping alive", 
    timestamp: new Date().toISOString(),
    memory: process.memoryUsage(),
    uptime: process.uptime()
  });
});

// ✅ Health check دوري محسن
setInterval(async () => {
  try {
    // تحديث الكاش كل دقيقتين
    if (!warmCache.data || (Date.now() - warmCache.timestamp) > warmCache.CACHE_DURATION) {
      if (!warmCache.isFetching) {
        console.log('🔄 Auto-refreshing cache...');
        warmCache.isFetching = true;
        try {
          const data = await fetchBinanceData();
          warmCache.data = data;
          warmCache.timestamp = Date.now();
          console.log('✅ Cache auto-refreshed successfully');
        } catch (error) {
          console.log('⚠️ Auto-refresh failed:', error.message);
        } finally {
          warmCache.isFetching = false;
        }
      }
    }
    
    // تنظيف الاتصالات القديمة
    const now = Date.now();
    for (const [key, timestamp] of connectionPool.entries()) {
      if (now - timestamp > 300000) { // 5 دقائق
        connectionPool.delete(key);
      }
    }
  } catch (error) {
    console.log('⚠️ Keep-alive routine error:', error.message);
  }
}, 2 * 60 * 1000); // كل دقيقتين

// ✅ Keep-alive سريع كل 30 ثانية للحفاظ على الخادم نشط
setInterval(async () => {
  try {
    // طلب بسيط للحفاظ على النشاط
    await fetch(`http://localhost:${PORT}/keep-alive`).catch(() => {});
  } catch (error) {
    // تجاهل الأخطاء في keep-alive الداخلي
  }
}, 30 * 1000); // كل 30 ثانية

// Start server مع إعدادات محسنة
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
  
  // تسخين الكاش فور بدء التشغيل
  setTimeout(async () => {
    try {
      console.log('🔥 Warming up cache on startup...');
      const data = await fetchBinanceData();
      warmCache.data = data;
      warmCache.timestamp = Date.now();
      console.log('✅ Cache warmed up successfully');
    } catch (error) {
      console.log('⚠️ Cache warm up failed:', error.message);
    }
  }, 500);
});
