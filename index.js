import express from "express";
import Binance from "binance";

const app = express();
app.use(express.json());

// تهيئة Binance client
const client = new Binance().options({
  APIKEY: process.env.BINANCE_API_KEY,
  APISECRET: process.env.BINANCE_API_SECRET
});

// endpoint لاختبار
app.get("/", (req, res) => {
  res.send("🚀 Binance Fees API is running!");
});

// endpoint لجلب رسوم السحب
app.post("/get-withdraw-fees", async (req, res) => {
  try {
    const { asset } = req.body;
    if (!asset) {
      return res.status(400).json({ error: "Asset is required" });
    }

    const fees = await client.withdrawFee(); // الدالة اللي بتجيب رسوم السحب
    const assetFees = fees.find(f => f.coin === asset);

    if (!assetFees) {
      return res.status(404).json({ error: "Asset not found" });
    }

    res.json({ asset: assetFees });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
