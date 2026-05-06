import { StreamFeedResponse } from "@ninelive/shared";

export const sampleFeed: StreamFeedResponse = {
  generatedAt: new Date().toISOString(),
  streams: [
    {
      id: "seed-1",
      title: "Weekend Closet Deals",
      category: "Fashion",
      status: "live",
      viewerCount: 2401,
      streamer: {
        id: "s-1",
        displayName: "Nora Styles",
        avatarUrl: "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df"
      },
      featuredProducts: [
        {
          id: "p-1",
          title: "Oversized Linen Blazer",
          price: 520,
          currency: "TOKENS",
          imageUrl: "https://images.unsplash.com/photo-1441986300917-64674bd600d8",
          inStock: true
        },
        {
          id: "p-2",
          title: "Minimal Leather Tote",
          price: 790,
          currency: "TOKENS",
          imageUrl: "https://images.unsplash.com/photo-1594223274512-ad4803739b7c",
          inStock: true
        }
      ]
    },
    {
      id: "seed-2",
      title: "Kitchen Gadgets Under 300 Cat Coins",
      category: "Home",
      status: "live",
      viewerCount: 1199,
      streamer: {
        id: "s-2",
        displayName: "Chef Rami",
        avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d"
      },
      featuredProducts: [
        {
          id: "p-3",
          title: "Digital Food Scale",
          price: 170,
          currency: "TOKENS",
          imageUrl: "https://images.unsplash.com/photo-1570222094114-d054a817e56b",
          inStock: true
        },
        {
          id: "p-4",
          title: "Silicone Utensil Set",
          price: 225,
          currency: "TOKENS",
          imageUrl: "https://images.unsplash.com/photo-1584990347449-a6f960e5f388",
          inStock: false
        }
      ]
    },
    {
      id: "seed-3",
      title: "Glow-Up Beauty Flash Sale",
      category: "Beauty",
      status: "live",
      viewerCount: 1842,
      streamer: {
        id: "s-3",
        displayName: "Maya Glow",
        avatarUrl: "https://images.unsplash.com/photo-1544005313-94ddf0286df2"
      },
      featuredProducts: [
        {
          id: "p-5",
          title: "Hydrating Serum Kit",
          price: 340,
          currency: "TOKENS",
          imageUrl: "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9",
          inStock: true
        },
        {
          id: "p-6",
          title: "Velvet Lip Set",
          price: 210,
          currency: "TOKENS",
          imageUrl: "https://images.unsplash.com/photo-1596462502278-27bfdc403348",
          inStock: true
        }
      ]
    },
    {
      id: "seed-4",
      title: "Desk Tech Deals Live",
      category: "Tech",
      status: "live",
      viewerCount: 2630,
      streamer: {
        id: "s-4",
        displayName: "Rayan Tech",
        avatarUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e"
      },
      featuredProducts: [
        {
          id: "p-7",
          title: "Wireless RGB Mouse",
          price: 280,
          currency: "TOKENS",
          imageUrl: "https://images.unsplash.com/photo-1587829741301-dc798b83add3",
          inStock: true
        },
        {
          id: "p-8",
          title: "Foldable Phone Stand",
          price: 120,
          currency: "TOKENS",
          imageUrl: "https://images.unsplash.com/photo-1517336714739-489689fd1ca8",
          inStock: true
        }
      ]
    },
    {
      id: "seed-5",
      title: "Late Night Gaming Drop",
      category: "Gaming",
      status: "live",
      viewerCount: 3110,
      streamer: {
        id: "s-5",
        displayName: "Omar Plays",
        avatarUrl: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d"
      },
      featuredProducts: [
        {
          id: "p-9",
          title: "Pro Controller Grip",
          price: 190,
          currency: "TOKENS",
          imageUrl: "https://images.unsplash.com/photo-1511512578047-dfb367046420",
          inStock: true
        },
        {
          id: "p-10",
          title: "Streaming RGB Light Bar",
          price: 430,
          currency: "TOKENS",
          imageUrl: "https://images.unsplash.com/photo-1612287230202-1ff1d85d1bdf",
          inStock: true
        }
      ]
    },
    {
      id: "seed-6",
      title: "Healthy Snacks Live Tasting",
      category: "Food",
      status: "live",
      viewerCount: 1288,
      streamer: {
        id: "s-6",
        displayName: "Lina Bites",
        avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb"
      },
      featuredProducts: [
        {
          id: "p-11",
          title: "Protein Snack Box",
          price: 260,
          currency: "TOKENS",
          imageUrl: "https://images.unsplash.com/photo-1482049016688-2d3e1b311543",
          inStock: true
        },
        {
          id: "p-12",
          title: "Matcha Energy Pack",
          price: 180,
          currency: "TOKENS",
          imageUrl: "https://images.unsplash.com/photo-1498837167922-ddd27525d352",
          inStock: true
        }
      ]
    }
  ]
};
