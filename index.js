import express from "express";
import bodyParser from "body-parser";
import fetch from "node-fetch";

const app = express();
app.use(bodyParser.json());

// Endpoint لاستقبال العملة من العميل
app.post("/get-withdraw-fees", async (req, res) => {
  try {
    const { coin } = req.body;

    if (!coin) {
      return res.status(400).json({ error: "coin is required" });
    }

    console.log("✅ Request received for coin:", coin);

    // استدعاء Binance API
    const response = await fetch("https://api.binance.com/sapi/v1/capital/config/getall", {
      method: "GET",
      headers: {
        "X-MBX-APIKEY": process.env.BINANCE_API_KEY, // المفتاح من Railway
      },
    });

    if (!response.ok) {
      console.error("❌ Binance API error:", response.status, await response.text());
      return res.status(500).json({ error: "Failed to fetch from Binance API" });
    }

    const data = await response.json();
    console.log("📦 Binance response received");

    // البحث عن العملة المطلوبة
    const currencyInfo = data.find(
      (c) => c.coin.toUpperCase() === coin.toUpperCase()
    );

    if (!currencyInfo) {
      return res.status(404).json({ error: "Currency not found" });
    }

    // تجهيز النتيجة
    const result = currencyInfo.networkList.map((network) => ({
      network: network.network,
      withdrawFee: network.withdrawFee,
      withdrawMin: network.withdrawMin,
    }));

    console.log("✅ Result prepared for:", coin);

    res.json({
      coin: coin.toUpperCase(),
      networks: result,
    });
  } catch (error) {
    console.error("🔥 Error in /get-withdraw-fees:", error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

// تشغيل السيرفر
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
