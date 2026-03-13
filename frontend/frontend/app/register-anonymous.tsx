import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Fingerprint, ChevronLeft } from 'lucide-react-native';
import { COLORS } from '../src/constants';
import { signInAnonymously, updateProfile } from 'firebase/auth';
import { doc, setDoc, serverTimestamp, collection, query, where, getDocs, getDoc } from 'firebase/firestore';
import { auth, db } from '../src/firebase';
import { setToken } from '../src/api';

export default function RegisterAnonymous() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [alias, setAlias] = useState('');

  useEffect(() => {
    if (auth.currentUser) {
      router.replace('/home');
    }
  }, []);

  const handleRegister = async () => {
    const trimmedAlias = alias.trim();
    if (trimmedAlias.length < 3) {
      Alert.alert('Invalid ID', 'Ghost codename must be at least 3 characters.');
      return;
    }

    setLoading(true);
    try {
      // 1. UNIQUE CODENAME CHECK
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("alias_lowercase", "==", trimmedAlias.toLowerCase()));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        setLoading(false);
        Alert.alert('Unavailable', 'This codename is already assigned to another agent.');
        return;
      }

      // 2. ESTABLISH SECURE LINK
      const userCredential = await signInAnonymously(auth);
      const user = userCredential.user;

      // 3. BURN IDENTITY
      await updateProfile(user, { displayName: trimmedAlias });

      const userDocRef = doc(db, "users", user.uid);
      await setDoc(userDocRef, {
        alias: trimmedAlias,
        alias_lowercase: trimmedAlias.toLowerCase(),
        accountType: 'anonymous',
        createdAt: serverTimestamp(),
        isOnline: true,
      });

      // 4. PERSIST AND ADVANCE
      await setToken(user.uid);
      router.replace('/home');
    } catch (err: any) {
      console.error(err);
      Alert.alert('Handshake Failed', 'Database synchronization failed. Check your network or Firebase rules.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
        >
          <ChevronLeft size={24} color={COLORS.ghost_white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>GHOST ACCESS</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
        <View style={styles.content}>
          <View style={styles.iconArea}>
            <Fingerprint size={64} color={COLORS.terminal_green} />
          </View>

          <Text style={styles.title}>Secure Handshake</Text>
          <Text style={styles.subtitle}>Enter a codename to establish a temporary link.</Text>

          <View style={styles.inputBox}>
            <Text style={styles.label}>GHOST CODENAME</Text>
            <RNTextInput
              style={styles.input}
              value={alias}
              onChangeText={setAlias}
              placeholder="Enter designation..."
              placeholderTextColor={COLORS.stealth_grey}
              autoCapitalize="none"
            />
          </View>

          <TouchableOpacity
            style={styles.confirmBtn}
            onPress={handleRegister}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color={COLORS.void_black} /> : <Text style={styles.confirmBtnText}>ESTABLISH LINK</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

import { TextInput as RNTextInput } from 'react-native';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.void_black },
  flex: { flex: 1 },
  header: { height: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: COLORS.armour_grey },
  backBtn: { padding: 8, zIndex: 100 },
  headerTitle: { color: COLORS.ghost_white, fontSize: 14, fontWeight: '700', fontFamily: 'monospace', letterSpacing: 2, flex: 1, textAlign: 'center' },
  content: { flex: 1, paddingHorizontal: 32, justifyContent: 'center' },
  iconArea: { alignItems: 'center', marginBottom: 24 },
  title: { fontSize: 24, fontWeight: '900', color: COLORS.terminal_green, textAlign: 'center', fontFamily: 'monospace' },
  subtitle: { fontSize: 12, color: COLORS.muted_text, textAlign: 'center', marginTop: 10, fontFamily: 'monospace' },
  inputBox: { marginTop: 48 },
  label: { color: COLORS.terminal_green, fontSize: 10, fontWeight: '700', fontFamily: 'monospace', marginBottom: 10 },
  input: { backgroundColor: COLORS.gunmetal, padding: 18, color: COLORS.ghost_white, fontFamily: 'monospace', borderRadius: 4, borderWidth: 1, borderColor: COLORS.border_subtle, fontSize: 16 },
  confirmBtn: { backgroundColor: COLORS.terminal_green, padding: 18, borderRadius: 4, alignItems: 'center', marginTop: 40 },
  confirmBtnText: { color: COLORS.void_black, fontWeight: '900', letterSpacing: 2, fontSize: 14 },
});
