import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView,
  TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, Keyboard, Image
} from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft, Shield, Eye, EyeOff, Check, X } from 'lucide-react-native';
import { COLORS } from '../src/constants';
import { createUserWithEmailAndPassword, deleteUser, sendEmailVerification, signOut } from 'firebase/auth';
import { doc, setDoc, serverTimestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../src/firebase';
import { setToken, clearToken } from '../src/api';
import { getOrCreateKeyPair } from '../src/encryption';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ALIAS_REGEX = /^[a-zA-Z0-9_ .\-]{3,20}$/;

export default function RegisterPseudonym() {
  const router = useRouter();
  const [alias, setAlias] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // ENSURE CLEAN STATE
  useEffect(() => {
    const forceWipe = async () => {
      await signOut(auth).catch(() => {});
      await clearToken().catch(() => {});
      await AsyncStorage.clear().catch(() => {});
    };
    forceWipe();
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
      showAlert('Invalid Alias', 'Alias must be 3-20 characters.');
      return;
    }

    if (!isPassValid) {
      showAlert('Security Violation', 'Passphrase does not meet tactical strength requirements.');
      return;
    }

    setLoading(true);
    try {
      // 1. Check Alias Uniqueness
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("alias_lowercase", "==", trimmedAlias.toLowerCase()));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        setLoading(false);
        showAlert('Alias Taken', 'This tactical alias is already assigned.');
        return;
      }

      // 2. Auth Identity
      const userCredential = await createUserWithEmailAndPassword(auth, trimmedEmail, password);
      const user = userCredential.user;

      try {
        await sendEmailVerification(user);
        const keyPair = await getOrCreateKeyPair();

        await setDoc(doc(db, "users", user.uid), {
          alias: trimmedAlias,
          alias_lowercase: trimmedAlias.toLowerCase(),
          email: trimmedEmail,
          publicKey: keyPair.publicKey,
          accountType: 'pseudonym',
          createdAt: serverTimestamp(),
          isOnline: false,
          emailVerified: false,
          storageUsedBytes: 0,
          isSubscribed: false
        });

        await signOut(auth);
        await clearToken();
        setLoading(false);
        showAlert('HANDSHAKE PENDING', 'Verification link dispatched to Gmail. Please verify before signing in.');
        router.replace('/');

      } catch (innerErr: any) {
        await deleteUser(user).catch(() => {});
        throw innerErr;
      }
    } catch (err: any) {
      setLoading(false);
      showAlert('Handshake Failed', err.message);
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
            <TouchableOpacity onPress={() => router.replace('/')} style={styles.backBtn}>
              <ChevronLeft size={24} color="#FFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>INITIALIZE IDENTITY</Text>
            <View style={{ width: 40 }} />
          </View>

          <View style={styles.iconArea}>
            <View style={styles.logoCircle}>
              <Image source={require('../assets/images/icon.png')} style={styles.tacticalIcon} resizeMode="contain" />
            </View>
          </View>

          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>TACTICAL ALIAS</Text>
              <TextInput style={styles.input} value={alias} onChangeText={setAlias} placeholder="Agent_Shadow" placeholderTextColor="#444" autoComplete="username" autoCapitalize="none" autoCorrect={false} />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>EMAIL ADDRESS</Text>
              <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="agent@secure-link.com" placeholderTextColor="#444" keyboardType="email-address" autoComplete="email" autoCapitalize="none" autoCorrect={false} />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>SECURITY PASSPHRASE</Text>
              <View style={styles.passwordContainer}>
                <TextInput style={[styles.input, { flex: 1, marginBottom: 0 }]} value={password} onChangeText={setPassword} placeholder="Tactical Passphrase" placeholderTextColor="#444" secureTextEntry={!showPassword} autoComplete="new-password" />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
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

            <TouchableOpacity style={[styles.confirmBtn, (!isPassValid || loading) && { opacity: 0.6 }]} onPress={handleRegister} disabled={loading || !isPassValid}>
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
  iconArea: { alignItems: 'center', marginTop: 32 },
  logoCircle: { width: 80, height: 80, borderRadius: 40, borderWidth: 1, borderColor: COLORS.terminal_green, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,255,65,0.05)', overflow: 'hidden' },
  tacticalIcon: { width: 50, height: 50 },
  scrollContent: { paddingHorizontal: 32, paddingVertical: 20 },
  form: { marginTop: 24, gap: 24 },
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
