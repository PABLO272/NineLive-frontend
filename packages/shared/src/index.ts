export type StreamStatus = "scheduled" | "live" | "ended";

export interface Streamer {
  id: string;
  displayName: string;
  avatarUrl: string;
}

export interface Product {
  id: string;
  title: string;
  description?: string;
  price: number;
  currency: "TOKENS";
  imageUrl: string;
  inStock: boolean;
}

export interface LiveStream {
  id: string;
  title: string;
  category: string;
  status: StreamStatus;
  viewerCount: number;
  streamer: Streamer;
  featuredProducts: Product[];
}

export interface StreamFeedResponse {
  streams: LiveStream[];
  generatedAt: string;
}
