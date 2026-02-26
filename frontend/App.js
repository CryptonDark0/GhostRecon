import 'react-native-gesture-handler';
import 'react-native-reanimated';

import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator, Button } from "react-native";

// Import Firebase config and services
import { auth, db } from "./firebaseConfig";
import { signInAnonymously } from "firebase/auth";
import { collection, addDoc, getDocs } from "firebase/firestore";

export default function App() {
  const [status, setStatus] = useState("Loading...");
  const [uid, setUid] = useState(null);

  useEffect(() => {
    // Instead of calling BASE_URL/health, test Firebase directly
    const testFirebase = async () => {
      try {
        // Try reading from Firestore
        const snapshot = await getDocs(collection(db, "test"));
        setStatus("Firebase Connected ✅");
      } catch (err) {
        setStatus("Error: " + err.message);
      }
    };
    testFirebase();
  }, []);

  const handleAnonymousLogin = async () => {
    try {
      const userCredential = await signInAnonymously(auth);
      setUid(userCredential.user.uid);
    } catch (error) {
      setStatus("Auth Error: " + error.message);
    }
  };

  const handleSendTestMessage = async () => {
    try {
      await addDoc(collection(db, "test"), {
        text: "Hello Firebase!",
        timestamp: new Date()
      });
      setStatus("Message sent to Firestore ✅");
    } catch (error) {
      setStatus("Firestore Error: " + error.message);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.text}>{status}</Text>
      {status === "Loading..." && <ActivityIndicator size="large" color="#00FF41" />}
      {!uid ? (
        <Button title="Login Anonymously" onPress={handleAnonymousLogin} />
      ) : (
        <Text style={styles.text}>Logged in as: {uid}</Text>
      )}
      <Button title="Send Test Message" onPress={handleSendTestMessage} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#050505" },
  text: { color: "#00FF41", fontSize: 20, textAlign: "center", margin: 10 },
});
