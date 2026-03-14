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

      const docSnap = await getDoc(doc(db, "users", user.uid));
      if (docSnap.exists()) {
        const profileData = docSnap.data();
        await AsyncStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(profileData));
      }

      await setToken(user.uid);
      router.replace("/home");
    } catch (err: any) {
      console.error(err);
      showAlert("Access Denied", "Authentication failed. Verify credentials.");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      showAlert("Required", "Enter email to receive reset instructions.");
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email.trim());
      showAlert("Dispatch Sent", "Reset instructions transmitted to your email.");
    } catch (err: any) {
      showAlert("Error", "Could not initiate reset protocol.");
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.flex}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.replace('/')} style={styles.backBtn}>
            <ChevronLeft size={24} color={COLORS.ghost_white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>SECURE AUTHENTICATION</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.content}>
          <View style={styles.iconArea}>
            <View style={styles.iconCircle}>
              <Image source={require('../assets/images/icon.png')} style={styles.tacticalIcon} resizeMode="contain" />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>TACTICAL EMAIL</Text>
            <TextInput
              id="login-email"
              name="email"
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="agent@secure-link.com"
              placeholderTextColor={COLORS.stealth_grey}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>SECURITY PASSPHRASE</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                id="login-password"
                name="password"
                style={[styles.input, { flex: 1, marginBottom: 0, borderWidth: 0 }]}
                value={password}
                onChangeText={setPassword}
                placeholder="Passphrase"
                placeholderTextColor={COLORS.stealth_grey}
                secureTextEntry={!showPassword}
                autoComplete="current-password"
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                {showPassword ? <EyeOff size={20} color={COLORS.terminal_green} /> : <Eye size={20} color={COLORS.terminal_green} />}
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity style={styles.loginBtn} onPress={handleLogin} disabled={loading}>
            {loading ? <ActivityIndicator color={COLORS.void_black} /> : <Text style={styles.loginBtnText}>ESTABLISH LINK</Text>}
          </TouchableOpacity>

          <TouchableOpacity style={styles.forgotBtn} onPress={handleForgotPassword}>
            <Text style={styles.forgotBtnText}>FORGOT PASSPHRASE?</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.void_black },
  flex: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: COLORS.armour_grey, paddingVertical: 16 },
  backBtn: { padding: 8 },
  headerTitle: { color: COLORS.ghost_white, fontSize: 12, fontWeight: "700", fontFamily: "monospace", letterSpacing: 2 },
  content: { flex: 1, paddingHorizontal: 32, paddingTop: 40 },
  iconArea: { alignItems: "center", marginBottom: 40 },
  iconCircle: { width: 80, height: 80, borderRadius: 40, borderWidth: 1, borderColor: COLORS.terminal_green, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,255,65,0.05)", overflow: 'hidden' },
  tacticalIcon: { width: 50, height: 50 },
  inputGroup: { marginBottom: 20 },
  label: { color: COLORS.terminal_green, fontSize: 10, fontWeight: "700", fontFamily: "monospace", marginBottom: 8 },
  input: { backgroundColor: COLORS.gunmetal, borderRadius: 2, color: COLORS.ghost_white, fontSize: 14, fontFamily: "monospace", padding: 16, borderWidth: 1, borderColor: COLORS.border_subtle },
  passwordContainer: { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.gunmetal, borderRadius: 2, borderWidth: 1, borderColor: COLORS.border_subtle },
  eyeBtn: { padding: 12 },
  loginBtn: { height: 56, backgroundColor: COLORS.terminal_green, borderRadius: 2, alignItems: "center", justifyContent: "center", marginTop: 20, borderLeftWidth: 4, borderLeftColor: COLORS.ghost_white },
  loginBtnText: { color: COLORS.void_black, fontSize: 14, fontWeight: "900", fontFamily: "monospace", letterSpacing: 2 },
  forgotBtn: { alignItems: "center", marginTop: 32, paddingVertical: 10 },
  forgotBtnText: { color: COLORS.muted_text, fontSize: 11, fontFamily: "monospace", fontWeight: "700" },
});
