import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { COLORS } from "../src/constants";
import { getToken } from "../src/api";

export default function HomeScreen() {
  const router = useRouter();
  const [token, setTokenState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const storedToken = await getToken();
        setTokenState(storedToken);
      } catch (err) {
        console.error("Error reading token:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator color={COLORS.terminal_green} />
        <Text style={styles.subtitle}>Loading session…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Home Screen 🏠</Text>
      <Text style={styles.subtitle}>
        {token ? `Stored Token: ${token}` : "No token found"}
      </Text>

      <TouchableOpacity
        style={styles.logoutBtn}
        onPress={() => router.replace("/login")}
        activeOpacity={0.7}
      >
        <Text style={styles.logoutText}>LOG OUT</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.void_black,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: COLORS.ghost_white,
    marginBottom: 12,
    fontFamily: "monospace",
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.muted_text,
    marginBottom: 24,
    textAlign: "center",
    fontFamily: "monospace",
  },
  logoutBtn: {
    backgroundColor: COLORS.terminal_green,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 4,
  },
  logoutText: {
    color: COLORS.void_black,
    fontSize: 14,
    fontWeight: "700",
    fontFamily: "monospace",
    letterSpacing: 2,
  },
});
