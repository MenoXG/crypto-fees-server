import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

// ✅ اختبار
app.get("/", (req, res) => {
  res.json({ message: "Crypto Fees Server is running ✅" });
});

// ✅ API لرسوم السحب من Binance
app.post("/get-withdraw-fees", async (req, res) => {
  try {
    const { asset } = req.body;

    if (!asset) {
      return res.status(400).json({ error: "Asset is required" });
    }

    const response = await fetch("https://api.binance.com/sapi/v1/capital/config/getall", {
      method: "GET",
      headers: {
        "X-MBX-APIKEY": process.env.BINANCE_API_KEY
      }
    });

    if (!response.ok) {
      throw new Error("Binance API error");
    }

    const data = await response.json();

    const coin = data.find((c) => c.coin === asset.toUpperCase());
    if (!coin) {
      return res.status(404).json({ error: "Asset not found" });
    }

    res.json({
      coin: coin.coin,
      networks: coin.networkList.map((n) => ({
        name: n.network,
        withdrawFee: n.withdrawFee,
        minWithdraw: n.withdrawMin
      }))
    });
  } catch (err) {
    console.error("Error:", err.message);
    res.status(500).json({ error: "Something went wrong" });
  }
});

// ✅ Railway يحدد PORT تلقائي
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
