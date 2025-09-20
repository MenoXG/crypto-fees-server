import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

// ✅ Health check
app.get("/", (req, res) => {
  res.send("🚀 Server is alive!");
});

// ✅ Debug endpoint
app.post("/get-withdraw-fees", async (req, res) => {
  console.log("📩 Incoming request body:", req.body);

  try {
    const { coin } = req.body;

    if (!coin) {
      console.warn("⚠️ Missing 'coin' in request");
      return res.status(400).json({ error: "coin is required" });
    }

    console.log(`🔍 Fetching data for coin: ${coin.toUpperCase()}`);

    const url = "https://api.binance.com/sapi/v1/capital/config/getall";
    console.log("🌍 Binance API URL:", url);

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "X-MBX-APIKEY": process.env.BINANCE_API_KEY,
      },
    });

    console.log("📡 Binance response status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ Binance API error:", errorText);
      return res.status(500).json({ error: "Binance API error", details: errorText });
    }

    const data = await response.json();
    console.log("✅ Binance data received, total coins:", data.length);

    const coinInfo = data.find((c) => c.coin === coin.toUpperCase());

    if (!coinInfo) {
      console.warn(`⚠️ Coin not found: ${coin}`);
      return res.status(404).json({ error: "Coin not found" });
    }

    const result = {
      coin: coinInfo.coin,
      networks: coinInfo.networkList.map((n) => ({
        name: n.network,
        withdrawFee: n.withdrawFee,
        minWithdrawAmount: n.withdrawMin,
      })),
    };

    console.log("📤 Sending response:", result);
    res.json(result);

  } catch (err) {
    console.error("🔥 Unexpected error:", err);
    res.status(500).json({ error: "Something went wrong", details: err.message });
  }
});

// ✅ Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
