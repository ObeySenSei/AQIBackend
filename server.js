// ================== IMPORT MODULES ==================
const express = require("express");
const mongoose = require("mongoose");
const axios = require("axios");
const cors = require("cors");
const cron = require("node-cron");

// ================== INIT APP ==================
const app = express();
app.use(cors());
app.use(express.json());

// ================== ENV VARIABLES ==================
const PORT = process.env.PORT || 5000;
const API_KEY = process.env.API_KEY || "4aa84dd053f9369fb00529d44f67aeed"; // Set in Railway
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://mongo:bobeANdgAaWpiVHXrkoBBlphUEOeVWKg@yamabiko.proxy.rlwy.net:41800/aqiDB";

// ================== CONNECT MONGODB ==================
mongoose
  .connect(MONGODB_URI)
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch((err) => console.error("❌ MongoDB error:", err));

// ================== SCHEMA ==================
const AQISchema = new mongoose.Schema({
  city: String,
  aqi: Number,
  pm2_5: Number,
  pm10: Number,
  timestamp: { type: Date, default: Date.now },
});

const AQI = mongoose.model("AQI", AQISchema);

// ================== CITIES ==================
const cities = [
  { name: "Tezpur", lat: 26.6528, lon: 92.7926 },
  { name: "Guwahati", lat: 26.1445, lon: 91.7362 },
  { name: "Delhi", lat: 28.6139, lon: 77.2090 },
  { name: "Mumbai", lat: 19.0760, lon: 72.8777 },
  { name: "Bangalore", lat: 12.9716, lon: 77.5946 },
];

// ================== TEST ROUTE ==================
app.get("/", (req, res) => {
  res.send("✅ Backend is alive");
});

// ================== FETCH AQI MANUALLY ==================
app.get("/api/fetch-aqi", async (req, res) => {
  try {
    for (const city of cities) {
      const url = `http://api.openweathermap.org/data/2.5/air_pollution?lat=${city.lat}&lon=${city.lon}&appid=${API_KEY}`;
      const response = await axios.get(url);
      const p = response.data.list[0];

      await AQI.create({
        city: city.name,
        aqi: p.main.aqi,
        pm2_5: p.components.pm2_5,
        pm10: p.components.pm10,
      });
    }
    res.send("✅ AQI data fetched for all cities");
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ================== GET LATEST AQI PER CITY ==================
app.get("/api/aqi", async (req, res) => {
  try {
    const city = req.query.city;
    if (!city) return res.status(400).json({ error: "City query parameter is required" });

    const latestAQI = await AQI.find({ city })
      .sort({ timestamp: -1 })
      .limit(1);

    if (latestAQI.length === 0)
      return res.status(404).json({ error: "No AQI data found for this city" });

    res.json(latestAQI[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ================== AUTO FETCH AQI EVERY HOUR ==================
cron.schedule("0 * * * *", async () => {
  console.log("⏰ Auto fetching AQI...");
  for (const city of cities) {
    try {
      const url = `http://api.openweathermap.org/data/2.5/air_pollution?lat=${city.lat}&lon=${city.lon}&appid=${API_KEY}`;
      const response = await axios.get(url);
      const p = response.data.list[0];

      await AQI.create({
        city: city.name,
        aqi: p.main.aqi,
        pm2_5: p.components.pm2_5,
        pm10: p.components.pm10,
      });
    } catch (err) {
      console.error(`Error fetching AQI for ${city.name}:`, err.message);
    }
  }
});

// ================== START SERVER ==================
app.listen(PORT, () => {
  console.log(`🚀 Backend running on port ${PORT}`);
});
