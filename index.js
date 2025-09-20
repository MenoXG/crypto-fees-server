// استخدم CommonJS لتفادي مشاكل ESM
const express = require("express");
const fetch = require("node-fetch");

const app = express();
app.use(express.json());

// 🔹 تحقق من وجود API Key
if (!process.env.BINANCE_API_KEY) {
  console.error("❌ BINANCE_API_KEY is not set! Add it in Railway/Replit Environment");
  process.exit(1);
}

// ✅ Health check
app.get("/", (req, res) => res.send("🚀 Server is alive!"));

// ✅ Endpoint لجلب رسوم السحب
app.post("/get-withdraw-fees", async (req, res) => {
  const { coin } = req.body;

  if (!coin) {
    return res.status(400).json({ error: "coin is required" });
  }

  try {
    const response = await fetch("https://api.binance.com/sapi/v1/capital/config/getall", {
      method: "GET",
      headers: { "X-MBX-APIKEY": process.env.BINANCE_API_KEY },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(500).json({ error: "Binance API error", details: errorText });
    }

    const data = await response.json();
    const coinInfo = data.find(c => c.coin === coin.toUpperCase());

    if (!coinInfo) return res.status(404).json({ error: "Coin not found" });

    res.json({
      coin: coinInfo.coin,
      networks: (coinInfo.networkList || []).map(n => ({
        name: n.network,
        withdrawFee: n.withdrawFee,
        minWithdrawAmount: n.withdrawMin,
      })),
    });

  } catch (err) {
    console.error("🔥 Unexpected error:", err);
    res.status(500).json({ error: "Something went wrong", details: err.message });
  }
});

// ✅ Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
