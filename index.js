require("dotenv").config();

const express = require("express");
const { MongoClient } = require("mongodb");
const axios = require("axios");

const app = express();
const PORT = 5000;

// ================== MONGODB CONFIG ==================
const mongoUrl = "mongodb://127.0.0.1:27017";
const dbName = "aqiDB";
const collectionName = "aqiData";

const client = new MongoClient(mongoUrl);

// ================== OPENWEATHER CONFIG ==================
const apiKey = "4aa84dd053f9369fb00529d44f67aeed";

// Cities list
const cities = [
  { name: "Tezpur", lat: 26.6516, lon: 92.7950 },
  { name: "Guwahati", lat: 26.1445, lon: 91.7362 },
  { name: "Mumbai", lat: 19.0760, lon: 72.8777 },
  { name: "Delhi", lat: 28.6139, lon: 77.2090 },
  { name: "Bangalore", lat: 12.9716, lon: 77.5946 }
];

// ================== DB CONNECTION ==================
async function connectDB() {
  if (!client.topology?.isConnected()) {
    await client.connect();
    console.log("✅ Connected to MongoDB");
  }
  return client.db(dbName).collection(collectionName);
}

// ================== FETCH AQI FROM API ==================
async function fetchAQI(city) {
  const url = `https://api.openweathermap.org/data/2.5/air_pollution?lat=${city.lat}&lon=${city.lon}&appid=${apiKey}`;
  const response = await axios.get(url);
  return response.data;
}

// ================== SAVE AQI DATA ==================
async function saveAQI() {
  const collection = await connectDB();

  for (const city of cities) {
    try {
      const data = await fetchAQI(city);

      await collection.insertOne({
        city: city.name,
        list: data.list,
        timestamp: new Date()
      });

      console.log(`✅ AQI data saved for ${city.name}`);
    } catch (err) {
      console.error(`❌ Failed for ${city.name}`, err.message);
    }
  }
}

// ================== ROUTES ==================
app.get("/", (req, res) => {
  res.send("✅ Backend is alive");
});

/*
  THIS ROUTE MATCHES YOUR FRONTEND EXACTLY:
  GET /api/aqi?city=Delhi
*/
app.get("/api/aqi", async (req, res) => {
  try {
    const city = req.query.city;
    if (!city) {
      return res.status(400).json({ error: "City is required" });
    }

    const collection = await connectDB();

    const latest = await collection
      .find({ city })
      .sort({ timestamp: -1 })
      .limit(1)
      .toArray();

    if (latest.length === 0) {
      return res.status(404).json({ error: "No AQI data found" });
    }

    const pollution = latest[0].list[0];

    // RETURN EXACT STRUCTURE FRONTEND EXPECTS
    res.json({
      city: city,
      aqi: pollution.main.aqi,
      pm2_5: pollution.components.pm2_5,
      pm10: pollution.components.pm10
    });
  } catch (err) {
    console.error("❌ API error:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});

// ================== START SERVER ==================
app.listen(PORT, async () => {
  console.log(`🚀 Backend running on http://localhost:${PORT}`);
  console.log("⏳ Fetching AQI data for all cities...");
  await saveAQI();
});
