import React, { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView,
  TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { ChevronLeft, LogIn } from "lucide-react-native";
import { COLORS } from "../src/constants";
import { apiCall, setToken, setUser } from "../src/api";

export default function LoginScreen() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!identifier.trim()) {
      Alert.alert("Required", "Enter your email, phone, or device ID");
      return;
    }
    setLoading(true);
    try {
      const res = await apiCall("/auth/login", {
        method: "POST",
        body: JSON.stringify({
          identifier: identifier.trim(),
          password: password || undefined,
        }),
      });

      if (!res?.token || !res?.user) {
        throw new Error("Invalid response from server");
      }

      await setToken(res.token);
      await setUser(res.user);

      // Navigate to home route
      router.replace("/home");
    } catch (err: any) {
      Alert.alert("Access Denied", err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.flex}
      >
        <View style={styles.header}>
          <TouchableOpacity
            testID="back-btn"
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <ChevronLeft size={24} color={COLORS.ghost_white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>SECURE LOGIN</Text>
          <View style={{ width: 24 }} />
        </View>

        <View style={styles.content}>
          <View style={styles.iconArea}>
            <View style={styles.iconCircle}>
              <LogIn size={40} color={COLORS.terminal_green} />
            </View>
          </View>

          <Text style={styles.label}>IDENTIFIER</Text>
          <TextInput
            testID="identifier-input"
            style={styles.input}
            value={identifier}
            onChangeText={setIdentifier}
            placeholder="Email, phone, or device fingerprint"
            placeholderTextColor={COLORS.stealth_grey}
            autoCapitalize="none"
          />

          <Text style={styles.label}>PASSPHRASE (FOR PSEUDONYM ACCOUNTS)</Text>
          <TextInput
            testID="password-input"
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="Enter passphrase..."
            placeholderTextColor={COLORS.stealth_grey}
            secureTextEntry
          />

          <TouchableOpacity
            testID="login-submit-btn"
            style={styles.loginBtn}
            activeOpacity={0.7}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.void_black} />
            ) : (
              <>
                <LogIn size={18} color={COLORS.void_black} />
                <Text style={styles.loginBtnText}>AUTHENTICATE</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.void_black },
  flex: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.armour_grey,
  },
  headerTitle: {
    color: COLORS.ghost_white,
    fontSize: 14,
    fontWeight: "700",
    fontFamily: "monospace",
    letterSpacing: 2,
  },
  content: { flex: 1, paddingHorizontal: 24, paddingTop: 40 },
  iconArea: { alignItems: "center", marginBottom: 32 },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: COLORS.terminal_green,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,255,65,0.05)",
  },
  label: {
    color: COLORS.muted_text,
    fontSize: 10,
    fontWeight: "700",
    fontFamily: "monospace",
    letterSpacing: 1,
    marginBottom: 6,
    marginTop: 20,
  },
  input: {
    backgroundColor: COLORS.gunmetal,
    borderWidth: 1,
    borderColor: COLORS.border_subtle,
    borderRadius: 2,
    color: COLORS.ghost_white,
    fontSize: 14,
    fontFamily: "monospace",
    padding: 12,
    height: 48,
  },
  loginBtn: {
    height: 52,
    backgroundColor: COLORS.terminal_green,
    borderRadius: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginTop: 32,
  },
  loginBtnText: {
    color: COLORS.void_black,
    fontSize: 14,
    fontWeight: "700",
    fontFamily: "monospace",
    letterSpacing: 2,
  },
});
