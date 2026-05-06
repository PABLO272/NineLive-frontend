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

app.listen(port, () => {
  console.log(`Ninelive API running on http://localhost:${port}`);
});
