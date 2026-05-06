import { LiveStream, StreamFeedResponse } from "@ninelive/shared";

const mockStreams: LiveStream[] = [
  {
    id: "stream-101",
    title: "Tonight's Beauty Drop",
    category: "Beauty",
    status: "live",
    viewerCount: 1382,
    streamer: {
      id: "creator-1",
      displayName: "Lina Glow",
      avatarUrl: "https://images.unsplash.com/photo-1544723795-3fb6469f5b39"
    },
    featuredProducts: [
      {
        id: "item-201",
        title: "Vitamin C Face Serum",
        price: 250,
        currency: "TOKENS",
        imageUrl: "https://images.unsplash.com/photo-1571781926291-c477ebfd024b",
        inStock: true
      },
      {
        id: "item-202",
        title: "Hydrating Night Cream",
        price: 315,
        currency: "TOKENS",
        imageUrl: "https://images.unsplash.com/photo-1556228578-8c89e6adf883",
        inStock: true
      }
    ]
  },
  {
    id: "stream-102",
    title: "Smart Home Finds",
    category: "Home Tech",
    status: "live",
    viewerCount: 809,
    streamer: {
      id: "creator-2",
      displayName: "Marco Picks",
      avatarUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e"
    },
    featuredProducts: [
      {
        id: "item-301",
        title: "Wi-Fi Smart Bulb (2-pack)",
        price: 180,
        currency: "TOKENS",
        imageUrl: "https://images.unsplash.com/photo-1558002038-1055907df827",
        inStock: true
      },
      {
        id: "item-302",
        title: "Indoor Security Camera",
        price: 550,
        currency: "TOKENS",
        imageUrl: "https://images.unsplash.com/photo-1585771724684-38269d6639fd",
        inStock: false
      }
    ]
  }
];

export function getStreamFeed(): StreamFeedResponse {
  return {
    streams: mockStreams,
    generatedAt: new Date().toISOString()
  };
}
