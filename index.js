import express from "express";
import fetch from "node-fetch";
import crypto from "crypto";

const app = express();
app.use(express.json());

// قائمة الشبكات المسموح بها
const ALLOWED_NETWORKS = [
  "ETH", "BSC", "MATIC", "ARBITRUM",
  "TON", "BTC", "APT", "SOL", "XRP", "TRX",
  "LTC"
];

// خريطة لتغيير أسماء الشبكات للعرض
const NETWORK_NAME_MAP = {
  "ETH": "✅ Ethereum (ERC20)",
  "BSC": "✅ BNB Smart Chain (BEP20)",
  "MATIC": "✅ Polygon (MATIC)",
  "ARBITRUM": "✅ Arbitrum",
  "TON": "✅ TON",
  "BTC": "✅ Bitcoin (BTC)",
  "APT": "✅ Aptos (APT)",
  "SOL": "✅ Solana (SOL)",
  "XRP": "✅ Ripple (XRP)",
  "TRX": "✅ TRC20 (Tron)",
  "LTC": "✅ Litecoin (LTC)"
};

// تحذير إذا لم يتم ضبط API Key أو Secret
if (!process.env.BINANCE_API_KEY || !process.env.BINANCE_API_SECRET) {
  console.warn("⚠️ BINANCE_API_KEY or BINANCE_API_SECRET is not set! API requests will fail.");
}

// Health check
app.get("/", (req, res) => res.send("🚀 Server is alive!"));

// Helper لتوليد signature
function signQuery(queryString) {
  return crypto
    .createHmac("sha256", process.env.BINANCE_API_SECRET)
    .update(queryString)
    .digest("hex");
}

/* ------------------------------------------------------------------
   ✅ Endpoint لعرض جميع العملات مع الشبكات المسموح بها
------------------------------------------------------------------ */
app.get("/all-coins-fees", async (req, res) => {
  try {
    const timestamp = Date.now();
    const queryString = `timestamp=${timestamp}`;
    const signature = signQuery(queryString);

    const url = `https://api.binance.com/sapi/v1/capital/config/getall?${queryString}&signature=${signature}`;
    const response = await fetch(url, {
      method: "GET",
      headers: { "X-MBX-APIKEY": process.env.BINANCE_API_KEY },
    });

    if (!response.ok) {
      const text = await response.text();
      return res.status(500).json({ error: "Binance API error", details: text });
    }

    const data = await response.json();
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

    res.json(result);
  } catch (err) {
    console.error("🔥 Unexpected error:", err);
    res.status(500).json({ error: "Something went wrong", details: err.message });
  }
});

/* ------------------------------------------------------------------
   ✅ Endpoint للحصول على شبكات عملة واحدة
------------------------------------------------------------------ */
app.post("/get-withdraw-fees", async (req, res) => {
  const { coin } = req.body;
  if (!coin) return res.status(400).json({ error: "coin is required" });

  try {
    const timestamp = Date.now();
    const queryString = `timestamp=${timestamp}`;
    const signature = signQuery(queryString);

    const url = `https://api.binance.com/sapi/v1/capital/config/getall?${queryString}&signature=${signature}`;
    const response = await fetch(url, {
      method: "GET",
      headers: { "X-MBX-APIKEY": process.env.BINANCE_API_KEY },
    });

    if (!response.ok) {
      const text = await response.text();
      return res.status(500).json({ error: "Binance API error", details: text });
    }

    const data = await response.json();
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
      return res.json({ coin: coinInfo.coin, name: coinInfo.name || "", networks: [], warning: "No allowed networks available" });
    }

    res.json({ coin: coinInfo.coin, name: coinInfo.name || "", networks });
  } catch (err) {
    console.error("🔥 Unexpected error:", err);
    res.status(500).json({ error: "Something went wrong", details: err.message });
  }
});

/* ------------------------------------------------------------------
   ✅ Endpoint جديد: سعر الـ Convert من USDT → أي عملة
------------------------------------------------------------------ */
app.post("/convert-rate", async (req, res) => {
  const { targetCoin } = req.body;
  if (!targetCoin) return res.status(400).json({ error: "targetCoin is required" });

  try {
    const timestamp = Date.now();
    const body = {
      fromAsset: "USDT",       // دائماً نبدأ من USDT
      toAsset: targetCoin.toUpperCase(),
      fromAmount: 1,           // نجيب سعر 1 USDT
      timestamp,
    };

    const query = new URLSearchParams(body).toString();
    const signature = signQuery(query);

    const response = await fetch(`https://api.binance.com/sapi/v1/convert/getQuote?${query}&signature=${signature}`, {
      method: "POST",
      headers: {
        "X-MBX-APIKEY": process.env.BINANCE_API_KEY,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const text = await response.text();
      return res.status(500).json({ error: "Binance Convert API error", details: text });
    }

    const data = await response.json();
    return res.json({
      from: "USDT",
      to: targetCoin.toUpperCase(),
      rate: data.toAmount, // السعر المحسوب من 1 USDT
    });
  } catch (err) {
    console.error("🔥 Convert error:", err);
    res.status(500).json({ error: "Something went wrong", details: err.message });
  }
});

/* ------------------------------------------------------------------
   ✅ تشغيل السيرفر
------------------------------------------------------------------ */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
