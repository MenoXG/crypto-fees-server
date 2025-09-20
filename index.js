import express from "express";
import fetch from "node-fetch";
import crypto from "crypto";

const app = express();
app.use(express.json());

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
        .filter((n) => n.withdrawEnable) // فقط الشبكات المفعلة للسحب
        .map((n) => ({
          network: n.network,
          withdrawFee: n.withdrawFee,
          depositEnable: n.depositEnable,
          withdrawEnable: n.withdrawEnable,
        })),
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
      .filter((n) => n.withdrawEnable) // فقط الشبكات المفعلة للسحب
      .map((n) => ({
        network: n.network,
        withdrawFee: n.withdrawFee,
        depositEnable: n.depositEnable,
        withdrawEnable: n.withdrawEnable,
      }));

    res.json({ coin: coinInfo.coin, name: coinInfo.name || "", networks });

  } catch (err) {
    console.error("🔥 Unexpected error:", err);
    res.status(500).json({ error: "Something went wrong", details: err.message });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

// Self-ping للحفاظ على container نشط
setInterval(() => {
  fetch(`http://localhost:${PORT}/`)
    .then(() => console.log("💓 Self-ping successful"))
    .catch((err) => console.warn("⚠️ Self-ping failed:", err.message));
}, 30000);
