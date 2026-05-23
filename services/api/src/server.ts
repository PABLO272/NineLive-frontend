import cors from "cors";
import express from "express";
import { getStreamFeed } from "./mockData";

const app = express();
const port = Number(process.env.PORT ?? 4200);

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "ninelive-api" });
});

app.get("/api/feed", (_req, res) => {
  res.json(getStreamFeed());
});

app.get("/api/live-shops/malls", async (req, res) => {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  const lat = Number(req.query.lat ?? 26.2235);
  const lng = Number(req.query.lng ?? 50.5876);
  const radius = Number(req.query.radius ?? 25000);
  const sponsoredRaw = String(process.env.NINELIVE_SPONSORED_MALL_KEYWORDS ?? "ninelive,nine live");
  const sponsoredKeywords = sponsoredRaw
    .split(",")
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    res.status(400).json({ error: "Invalid lat/lng query values." });
    return;
  }

  if (!apiKey) {
    res.json({
      source: "mock",
      warning: "GOOGLE_MAPS_API_KEY is not set. Returning empty live shops.",
      shops: []
    });
    return;
  }

  try {
    const nearbyUrl = new URL("https://maps.googleapis.com/maps/api/place/nearbysearch/json");
    nearbyUrl.searchParams.set("location", `${lat},${lng}`);
    nearbyUrl.searchParams.set("radius", `${radius}`);
    nearbyUrl.searchParams.set("type", "shopping_mall");
    nearbyUrl.searchParams.set("key", apiKey);

    const response = await fetch(nearbyUrl.toString());
    if (!response.ok) {
      throw new Error(`Google Places request failed with status ${response.status}`);
    }
    const payload = (await response.json()) as {
      results?: Array<{
        place_id?: string;
        name?: string;
        vicinity?: string;
        geometry?: { location?: { lat?: number; lng?: number } };
      }>;
    };

    const shops = (payload.results ?? [])
      .filter((mall) => Number.isFinite(mall.geometry?.location?.lat) && Number.isFinite(mall.geometry?.location?.lng))
      .map((mall, index) => {
        const name = mall.name ?? `Mall ${index + 1}`;
        const locationText = mall.vicinity ?? "Unknown area";
        const nameLc = name.toLowerCase();
        const sponsored = sponsoredKeywords.some((keyword) => nameLc.includes(keyword));
        const [cityGuess, countryGuess] = locationText.split(",").map((part) => part.trim());
        return {
          id: mall.place_id ?? `mall-${index + 1}`,
          name,
          city: cityGuess || "Unknown city",
          country: countryGuess || "Unknown country",
          category: "Shopping Mall",
          logoUrl: "https://images.unsplash.com/photo-1519567241046-7f570eee3ce6?w=400",
          lat: mall.geometry?.location?.lat as number,
          lng: mall.geometry?.location?.lng as number,
          viewers: Math.floor(1800 + Math.random() * 13000),
          sponsored
        };
      })
      .sort((a, b) => Number(b.sponsored) - Number(a.sponsored));

    res.json({
      source: "google-places",
      shops
    });
  } catch (error) {
    res.status(502).json({
      error: "Failed to fetch malls from Google Places.",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

app.listen(port, () => {
  console.log(`Ninelive API running on http://localhost:${port}`);
});
