import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView,
  TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, Keyboard
} from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft, Shield, Eye, EyeOff, Check, X } from 'lucide-react-native';
import { COLORS } from '../src/constants';
import { createUserWithEmailAndPassword, deleteUser, sendEmailVerification, signOut } from 'firebase/auth';
import { doc, setDoc, serverTimestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../src/firebase';
import { setToken, clearToken } from '../src/api';
import { getOrCreateKeyPair } from '../src/encryption';

const ALIAS_REGEX = /^[a-zA-Z0-9_ .\-]{3,20}$/;

export default function RegisterPseudonym() {
  const router = useRouter();
  const [alias, setAlias] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // ENSURE CLEAN STATE: Sign out any existing ghost session before starting
  useEffect(() => {
    const clearSession = async () => {
      await signOut(auth).catch(() => {});
      await clearToken().catch(() => {});
    };
    clearSession();
  }, []);

  const validatePassword = (pass: string) => {
    return {
      length: pass.length >= 6,
      upper: /[A-Z]/.test(pass),
      lower: /[a-z]/.test(pass),
      number: /[0-9]/.test(pass),
      special: /[!@#$%^&*(),.?":{}|<>]/.test(pass),
    };
  };

  const passStatus = validatePassword(password);
  const isPassValid = Object.values(passStatus).every(Boolean);

  const showAlert = (title: string, msg: string) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}: ${msg}`);
    } else {
      Alert.alert(title, msg);
    }
  };

  const handleRegister = async () => {
    Keyboard.dismiss();
    const trimmedAlias = alias.trim();
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedAlias || !trimmedEmail || !password) {
      showAlert('Required', 'All tactical identifiers must be filled.');
      return;
    }

    if (!ALIAS_REGEX.test(trimmedAlias)) {
      showAlert('Invalid Alias', 'Alias must be 3-20 characters (Alphanumeric, spaces, dots, or underscores only).');
      return;
    }

    if (!isPassValid) {
      showAlert('Security Violation', 'Passphrase does not meet tactical strength requirements.');
      return;
    }

    setLoading(true);
    console.log("[GHOST-PROTOCOL] Initiating Identity Creation...");

    try {
      // 1. Create Auth Identity
      const userCredential = await createUserWithEmailAndPassword(auth, trimmedEmail, password);
      const user = userCredential.user;
      console.log("[GHOST-PROTOCOL] Auth success for:", user.uid);

      try {
        // 2. Uniqueness Check (Must happen while authenticated)
        const usersRef = collection(db, "users");
        const q = query(usersRef, where("alias_lowercase", "==", trimmedAlias.toLowerCase()));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
          console.log("[GHOST-PROTOCOL] Alias collision. Rolling back.");
          await deleteUser(user);
          setLoading(false);
          showAlert('Alias Taken', 'This tactical alias is already assigned to another active agent.');
          return;
        }

        // 3. Email Verification Dispatch
        await sendEmailVerification(user);

        // 4. Cryptographic Handshake
        const keyPair = await getOrCreateKeyPair();

        // 5. Finalize Network Profile
        await setDoc(doc(db, "users", user.uid), {
          alias: trimmedAlias,
          alias_lowercase: trimmedAlias.toLowerCase(),
          email: trimmedEmail,
          publicKey: keyPair.publicKey,
          accountType: 'pseudonym',
          createdAt: serverTimestamp(),
          isOnline: false,
          emailVerified: false,
          storageUsedBytes: 0
        });

        // 6. Terminate session until email is verified (Security Protocol)
        await signOut(auth);
        await clearToken();

        setLoading(false);
        showAlert('HANDSHAKE PENDING', 'Verification link dispatched to Gmail. You MUST verify your email before signing in.');
        router.replace('/');

      } catch (innerErr: any) {
        console.error("[GHOST-PROTOCOL] Profile sync failure:", innerErr);
        await deleteUser(user).catch(() => {});
        throw innerErr;
      }
    } catch (err: any) {
      console.error("[GHOST-PROTOCOL] Handshake Error:", err);
      let msg = err.message;
      if (err.code === 'auth/email-already-in-use') msg = "This email is already linked to an active identity.";
      if (err.code === 'permission-denied') msg = "Access Denied: Please ensure Firestore Rules are published.";
      showAlert('Handshake Failed', msg);
    } finally {
      setLoading(false);
    }
  };

  const Requirement = ({ label, met }: { label: string, met: boolean }) => (
    <View style={styles.requirementRow}>
      {met ? <Check size={12} color={COLORS.terminal_green} /> : <X size={12} color={COLORS.critical_red} />}
      <Text style={[styles.requirementText, { color: met ? COLORS.terminal_green : COLORS.stealth_grey }]}>
        {label}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <ChevronLeft size={24} color="#FFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>INITIALIZE IDENTITY</Text>
            <View style={{ width: 40 }} />
          </View>

          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>TACTICAL ALIAS</Text>
              <TextInput
                style={styles.input}
                value={alias}
                onChangeText={setAlias}
                placeholder="Agent_Shadow"
                placeholderTextColor="#444"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect={false}
                id="alias-field"
                {...Platform.select({ web: { name: 'username' } } as any)}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>EMAIL ADDRESS</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="agent@secure-link.com"
                placeholderTextColor="#444"
                keyboardType="email-address"
                autoComplete="email"
                autoCapitalize="none"
                autoCorrect={false}
                id="email-field"
                {...Platform.select({ web: { name: 'email' } } as any)}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>SECURITY PASSPHRASE</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={[styles.input, { flex: 1, marginBottom: 0 }]}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Tactical Passphrase"
                  placeholderTextColor="#444"
                  secureTextEntry={!showPassword}
                  autoComplete="new-password"
                  id="pass-field"
                  {...Platform.select({ web: { name: 'password' } } as any)}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeBtn}
                >
                  {showPassword ? <EyeOff size={20} color={COLORS.terminal_green} /> : <Eye size={20} color={COLORS.terminal_green} />}
                </TouchableOpacity>
              </View>

              <View style={styles.requirementsContainer}>
                <Requirement label="At least 6 characters" met={passStatus.length} />
                <Requirement label="Uppercase letter" met={passStatus.upper} />
                <Requirement label="Lowercase letter" met={passStatus.lower} />
                <Requirement label="Number" met={passStatus.number} />
                <Requirement label="Special character" met={passStatus.special} />
              </View>
            </View>

            <TouchableOpacity
              style={[styles.confirmBtn, (!isPassValid || loading) && { opacity: 0.6 }]}
              onPress={handleRegister}
              disabled={loading || !isPassValid}
            >
              {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.confirmBtnText}>AUTHORIZE IDENTITY</Text>}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050505' },
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#1A1A1A' },
  backBtn: { padding: 8 },
  headerTitle: { color: '#FFF', fontSize: 12, fontWeight: '700', fontFamily: 'monospace', letterSpacing: 2 },
  scrollContent: { paddingHorizontal: 32, paddingVertical: 40 },
  form: { gap: 24 },
  inputGroup: { gap: 8 },
  label: { color: '#00FF41', fontSize: 10, fontWeight: '700', fontFamily: 'monospace' },
  input: { backgroundColor: '#0F0F0F', padding: 18, color: '#FFF', fontFamily: 'monospace', borderRadius: 2, borderWidth: 1, borderColor: '#333' },
  passwordContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0F0F0F', borderRadius: 2, borderWidth: 1, borderColor: '#333' },
  eyeBtn: { padding: 12 },
  requirementsContainer: { marginTop: 8, gap: 4 },
  requirementRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  requirementText: { fontSize: 10, fontFamily: 'monospace' },
  confirmBtn: { backgroundColor: '#00FF41', padding: 20, borderRadius: 2, alignItems: 'center', marginTop: 20, borderLeftWidth: 4, borderLeftColor: '#FFF' },
  confirmBtnText: { color: '#000', fontWeight: '900', letterSpacing: 2, fontSize: 14, fontFamily: 'monospace' },
});
