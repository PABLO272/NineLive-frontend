import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { LiveStream } from "@ninelive/shared";
import { ProductPill } from "./ProductPill";

type StreamCardProps = {
  stream: LiveStream;
};

export function StreamCard({ stream }: StreamCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Image source={{ uri: stream.streamer.avatarUrl }} style={styles.avatar} />
        <View style={styles.meta}>
          <Text style={styles.streamer}>{stream.streamer.displayName}</Text>
          <Text style={styles.title}>{stream.title}</Text>
        </View>
        <View style={styles.liveBadge}>
          <Text style={styles.liveText}>LIVE</Text>
        </View>
      </View>

      <View style={styles.stats}>
        <Text style={styles.category}>{stream.category}</Text>
        <Text style={styles.viewers}>{stream.viewerCount.toLocaleString()} watching</Text>
      </View>

      <View style={styles.products}>
        {stream.featuredProducts.map((product) => (
          <ProductPill key={product.id} title={product.title} price={product.price} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 14,
    gap: 12,
    borderColor: "#f0ece5",
    borderWidth: 1
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#ececec"
  },
  meta: {
    flex: 1
  },
  streamer: {
    fontSize: 14,
    fontWeight: "700",
    color: "#2d2418"
  },
  title: {
    fontSize: 15,
    fontWeight: "600",
    color: "#553f2a",
    marginTop: 2
  },
  liveBadge: {
    backgroundColor: "#d62828",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999
  },
  liveText: {
    color: "white",
    fontWeight: "700",
    fontSize: 11,
    letterSpacing: 0.6
  },
  stats: {
    flexDirection: "row",
    justifyContent: "space-between"
  },
  category: {
    fontSize: 13,
    color: "#6c5a46",
    fontWeight: "600"
  },
  viewers: {
    fontSize: 13,
    color: "#8c7054"
  },
  products: {
    gap: 8
  }
});
