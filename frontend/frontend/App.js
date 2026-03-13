import 'react-native-gesture-handler';
import 'react-native-reanimated';

import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator, Button, TextInput, FlatList } from "react-native";
import { auth, db } from "./firebaseConfig";
import {
  signInAnonymously,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword
} from "firebase/auth";
import {
  collection,
  addDoc,
  query,
  onSnapshot,
  orderBy
} from "firebase/firestore";

export default function App() {
  const [status, setStatus] = useState("Loading...");
  const [uid, setUid] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    // Test Firebase connection by listening to a collection
    const q = query(collection(db, "chats", "default", "messages"), orderBy("timestamp"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMessages(msgs);
      setStatus("Firebase Connected ✅");
    }, (err) => {
      setStatus("Error: " + err.message);
    });

    return () => unsubscribe();
  }, []);

  const handleAnonymousLogin = async () => {
    try {
      const userCredential = await signInAnonymously(auth);
      setUid(userCredential.user.uid);
      setStatus("Logged in anonymously ✅");
    } catch (error) {
      setStatus("Auth Error: " + error.message);
    }
  };

  const handleRegister = async () => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      setUid(userCredential.user.uid);
      setStatus("Registered & logged in ✅");
    } catch (error) {
      setStatus("Register Error: " + error.message);
    }
  };

  const handleLogin = async () => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      setUid(userCredential.user.uid);
      setStatus("Logged in ✅");
    } catch (error) {
      setStatus("Login Error: " + error.message);
    }
  };

  const handleSendMessage = async () => {
    if (!uid || !message.trim()) return;
    try {
      await addDoc(collection(db, "chats", "default", "messages"), {
        text: message,
        userId: uid,
        timestamp: new Date()
      });
      setMessage("");
    } catch (error) {
      setStatus("Message Error: " + error.message);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.text}>{status}</Text>
      {status === "Loading..." && <ActivityIndicator size="large" color="#00FF41" />}

      {!uid && (
        <>
          <Button title="Login Anonymously" onPress={handleAnonymousLogin} />
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#888"
            value={email}
            onChangeText={setEmail}
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#888"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
          <Button title="Register" onPress={handleRegister} />
          <Button title="Login" onPress={handleLogin} />
        </>
      )}

      {uid && (
        <>
          <Text style={styles.text}>UID: {uid}</Text>
          <TextInput
            style={styles.input}
            placeholder="Type a message..."
            placeholderTextColor="#888"
            value={message}
            onChangeText={setMessage}
          />
          <Button title="Send Message" onPress={handleSendMessage} />

          <FlatList
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <Text style={styles.text}>
                {item.userId}: {item.text}
              </Text>
            )}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#050505", padding: 20 },
  text: { color: "#00FF41", fontSize: 16, textAlign: "center", margin: 10 },
  input: { borderWidth: 1, borderColor: "#00FF41", color: "#fff", padding: 10, marginVertical: 5, width: "80%" }
});
