import React, { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView,
  TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Image
} from "react-native";
import { useRouter } from "expo-router";
import { ChevronLeft, LogIn, Key, Eye, EyeOff } from "lucide-react-native";
import { COLORS } from "../src/constants";
import { signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { auth, db } from "../src/firebase";
import { setToken } from "../src/api";
import { doc, getDoc } from "firebase/firestore";
import AsyncStorage from '@react-native-async-storage/async-storage';

const PROFILE_CACHE_KEY = 'ghostrecon_user_profile';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  const showAlert = (title: string, msg: string) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}: ${msg}`);
    } else {
      Alert.alert(title, msg);
    }
  };

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      showAlert("Required", "Please enter both email and passphrase.");
      return;
    }

    // 🛡️ Web Accessibility Fix: Clear focus before starting process
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    }

    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
      const user = userCredential.user;

      if (!user.emailVerified) {
        setLoading(false);
        showAlert("Identity Unverified", "Please verify your email before full handshake.");
        return;
      }

      // 🛡️ PRE-NAVIGATION PROFILE LOCK: Fetch name before going home
      const docSnap = await getDoc(doc(db, "users", user.uid));
      if (docSnap.exists()) {
        const profileData = docSnap.data();
        await AsyncStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(profileData));
      }

      await setToken(user.uid);
      router.replace("/home");
    } catch (err: any) {
      console.error(err);
      let msg = "Invalid tactical credentials.";
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        msg = "Authentication failed. Incorrect email or passphrase.";
      }
      showAlert("Access Denied", msg);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      showAlert("Required", "Please enter your tactical email to receive reset instructions.");
      return;
    }

    setResetLoading(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      showAlert("Dispatch Sent", "Handshake reset instructions have been transmitted to your email.");
    } catch (err: any) {
      console.error(err);
      showAlert("Error", "Could not initiate reset protocol. Verify email address.");
    } finally {
      setResetLoading(false);
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
            onPress={() => router.replace('/')}
            activeOpacity={0.7}
            style={styles.backBtn}
          >
            <ChevronLeft size={24} color={COLORS.ghost_white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>SECURE AUTHENTICATION</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.content}>
          <View style={styles.iconArea}>
            <View style={styles.iconCircle}>
              <Image
                source={require('../assets/images/icon.png')}
                style={styles.tacticalIcon}
                resizeMode="contain"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>TACTICAL EMAIL</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="agent@secure-link.com"
              placeholderTextColor={COLORS.stealth_grey}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              id="login-email"
              {...Platform.select({ web: { name: 'email' } } as any)}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>SECURITY PASSPHRASE</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={[styles.input, { flex: 1, borderBottomWidth: 0, marginBottom: 0, borderWidth: 0 }]}
                value={password}
                onChangeText={setPassword}
                placeholder="Enter secure passphrase"
                placeholderTextColor={COLORS.stealth_grey}
                secureTextEntry={!showPassword}
                autoComplete="password"
                id="login-password"
                {...Platform.select({ web: { name: 'password' } } as any)}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeBtn}
              >
                {showPassword ? <EyeOff size={20} color={COLORS.terminal_green} /> : <Eye size={20} color={COLORS.terminal_green} />}
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
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
                <Text style={styles.loginBtnText}>ESTABLISH LINK</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.forgotBtn}
            onPress={handleForgotPassword}
            disabled={resetLoading}
          >
            {resetLoading ? (
              <ActivityIndicator size="small" color={COLORS.terminal_green} />
            ) : (
              <>
                <Key size={14} color={COLORS.muted_text} />
                <Text style={styles.forgotBtnText}>FORGOT PASSPHRASE?</Text>
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
  backBtn: { padding: 8 },
  headerTitle: {
    color: COLORS.ghost_white,
    fontSize: 12,
    fontWeight: "700",
    fontFamily: "monospace",
    letterSpacing: 2,
  },
  content: { flex: 1, paddingHorizontal: 32, paddingTop: 40 },
  iconArea: { alignItems: "center", marginBottom: 40 },
  iconCircle: {
    width: 80, height: 80, borderRadius: 40,
    borderWidth: 2, borderColor: COLORS.terminal_green,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(0,255,65,0.05)",
    overflow: 'hidden'
  },
  tacticalIcon: {
    width: 50,
    height: 50,
  },
  inputGroup: { marginBottom: 20 },
  label: {
    color: COLORS.terminal_green,
    fontSize: 10,
    fontWeight: "700",
    fontFamily: "monospace",
    letterSpacing: 1,
    marginBottom: 8,
  },
  input: {
    backgroundColor: COLORS.gunmetal,
    borderWidth: 1,
    borderColor: COLORS.border_subtle,
    borderRadius: 2,
    color: COLORS.ghost_white,
    fontSize: 14,
    fontFamily: "monospace",
    padding: 16,
  },
  passwordContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.gunmetal,
    borderWidth: 1,
    borderColor: COLORS.border_subtle,
    borderRadius: 2,
  },
  eyeBtn: {
    padding: 12,
  },
  loginBtn: {
    height: 56,
    backgroundColor: COLORS.terminal_green,
    borderRadius: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginTop: 20,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.ghost_white,
  },
  loginBtnText: {
    color: COLORS.void_black,
    fontSize: 14,
    fontWeight: "900",
    fontFamily: "monospace",
    letterSpacing: 2,
  },
  forgotBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 32,
    paddingVertical: 10,
  },
  forgotBtnText: {
    color: COLORS.muted_text,
    fontSize: 11,
    fontFamily: "monospace",
    fontWeight: "700",
    letterSpacing: 1,
  },
});
