const express = require("express");
const fetch = require("node-fetch");

const app = express();
app.use(express.json());

// 🔹 تحقق من وجود API Key ولكن بدون crash
if (!process.env.BINANCE_API_KEY) {
  console.warn("⚠️ BINANCE_API_KEY is not set! API requests to Binance will fail.");
}

// ✅ Health check
app.get("/", (req, res) => res.send("🚀 Server is alive!"));

// ✅ Endpoint لكل العملات
app.get("/all-coins-fees", async (req, res) => {
  if (!process.env.BINANCE_API_KEY) {
    return res.status(500).json({ error: "BINANCE_API_KEY is missing" });
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

    const result = data.map(coinInfo => ({
      coin: coinInfo.coin,
      name: coinInfo.name || "",
      networks: (coinInfo.networkList || []).map(n => ({
        network: n.network,
        withdrawFee: n.withdrawFee,
        minWithdrawAmount: n.withdrawMin,
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

// ✅ Endpoint لفرد عملة معينة
app.post("/get-withdraw-fees", async (req, res) => {
  const { coin } = req.body;

  if (!coin) return res.status(400).json({ error: "coin is required" });
  if (!process.env.BINANCE_API_KEY) {
    return res.status(500).json({ error: "BINANCE_API_KEY is missing" });
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

    const networks = (coinInfo.networkList || []).map(n => ({
      network: n.network,
      withdrawFee: n.withdrawFee,
      minWithdrawAmount: n.withdrawMin,
      depositEnable: n.depositEnable,
      withdrawEnable: n.withdrawEnable,
    }));

    res.json({
      coin: coinInfo.coin,
      name: coinInfo.name || "",
      networks,
    });

  } catch (err) {
    console.error("🔥 Unexpected error:", err);
    res.status(500).json({ error: "Something went wrong", details: err.message });
  }
});

// ✅ Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
