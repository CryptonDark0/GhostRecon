import 'react-native-gesture-handler';
import 'react-native-reanimated';

import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import Constants from "expo-constants";

export default function App() {
  const [status, setStatus] = useState("Loading...");
  const BASE_URL = Constants.expoConfig.extra.API_URL;

  useEffect(() => {
    fetch(`${BASE_URL}/health`)
      .then((res) => res.json())
      .then((data) => setStatus("Backend Connected ✅"))
      .catch((err) => setStatus("Error: " + err.message));
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.text}>{status}</Text>
      {status === "Loading..." && <ActivityIndicator size="large" color="#00FF41" />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#050505" },
  text: { color: "#00FF41", fontSize: 20, textAlign: "center", margin: 10 },
});
