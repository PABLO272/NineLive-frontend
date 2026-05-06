import React from "react";
import { StyleSheet, Text, View } from "react-native";

type ProductPillProps = {
  title: string;
  price: number;
};

export function ProductPill({ title, price }: ProductPillProps) {
  return (
    <View style={styles.pill}>
      <Text style={styles.name} numberOfLines={1}>
        {title}
      </Text>
      <Text style={styles.price}>${price.toFixed(2)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    backgroundColor: "#fbf8f3",
    borderWidth: 1,
    borderColor: "#efe6d8",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8
  },
  name: {
    flex: 1,
    fontSize: 13,
    color: "#433220",
    fontWeight: "600"
  },
  price: {
    color: "#ab5e1c",
    fontWeight: "700",
    fontSize: 13
  }
});
