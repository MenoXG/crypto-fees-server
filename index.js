import express from "express";
import fetch from "node-fetch";
import crypto from "crypto";

const app = express();
app.use(express.json());

// قائمة الشبكات المسموح بها
const ALLOWED_NETWORKS = [
  "ETH", "BSC", "MATIC", "ARBITRUM",
  "TON", "BTC", "APT", "SOL", "XRP", "TRX",
  "LTC", "OPTIMISM", "AVAXC", "SONIC", "CELO", "BASE", "PLASMA", "KAIA"
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
  "BASE": "✅ Base",
  "KAIA": "✅ Kaia",
  "PLASMA": "✅ Plasma"
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

// ✅ Endpoint لكل العملات
app.get("/all-coins-fees", async (req, res) => {
  if (!process.env.BINANCE_API_KEY || !process.env.BINANCE_API_SECRET) {
    return res.json({ warning: "API Key/Secret not set", coins: [] });
  }

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
          network: NETWORK_NAME_MAP[n.network] || n.network, // تغيير الاسم للعرض
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

// ✅ Endpoint لعملة واحدة
app.post("/get-withdraw-fees", async (req, res) => {
  const { coin } = req.body;
  if (!coin) return res.status(400).json({ error: "coin is required" });

  if (!process.env.BINANCE_API_KEY || !process.env.BINANCE_API_SECRET) {
    return res.json({ warning: "API Key/Secret not set", coin, networks: [] });
  }

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
        network: NETWORK_NAME_MAP[n.network] || n.network, // تغيير الاسم للعرض
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

// ✅ Endpoint جديد KAST
app.post("/kast", async (req, res) => {
  const { much } = req.body;
  if (!much) return res.status(400).json({ error: "much is required" });

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
    const coinInfo = data.find((c) => c.coin === "USDT");

    if (!coinInfo) return res.status(404).json({ error: "USDT not found" });

    // الشبكات المطلوبة فقط
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

    // إيجاد الحد الأدنى المتوفر بين جميع الشبكات المسموح بها
    const allNetworks = (coinInfo.networkList || [])
      .filter((n) =>
        ALLOWED_KAST_NETWORKS.includes(n.network) &&
        n.withdrawEnable
      );

    if (allNetworks.length === 0) {
      return res.json({ error: "No suitable network found" });
    }

    // إيجاد أقل حد أدنى متوفر
    const minWithdrawAmount = Math.min(...allNetworks.map(n => parseFloat(n.withdrawMin)));
    
    // إيجاد جميع الشبكات التي لديها هذا الحد الأدنى
    const networksWithMinAmount = allNetworks.filter(n => parseFloat(n.withdrawMin) === minWithdrawAmount);
    
    // من بين هذه الشبكات، إيجاد الشبكة ذات أقل رسوم سحب
    const minRequiredNetwork = networksWithMinAmount.reduce((min, network) => {
      return parseFloat(network.withdrawFee) < parseFloat(min.withdrawFee) ? network : min;
    });

    const minRequiredAmount = minRequiredNetwork.withdrawMin;
    const minRequiredNetworkName = NETWORK_NAME_MAP[minRequiredNetwork.network] || minRequiredNetwork.network;

    if (validNetworks.length === 0) {
      return res.json({ 
        error: "No suitable network found for this amount",
        minRequired: minRequiredAmount,
        minRequiredNetwork: minRequiredNetworkName
      });
    }

    const best = validNetworks[0];

    res.json({
      coin: "USDT",
      bestNetwork: NETWORK_NAME_MAP[best.network] || best.network,
      withdrawFee: best.withdrawFee
    });

  } catch (err) {
    console.error("🔥 Unexpected error:", err);
    res.status(500).json({ error: "Something went wrong", details: err.message });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
