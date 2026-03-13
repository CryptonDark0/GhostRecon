import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView,
  TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft, UserPlus } from 'lucide-react-native';
import { COLORS } from '../src/constants';
import { apiCall, setToken, setUser } from '../src/api';

export default function RegisterPseudonym() {
  const router = useRouter();
  const [alias, setAlias] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!alias.trim() || !password.trim()) {
      Alert.alert('Required', 'Codename and password are required');
      return;
    }
    setLoading(true);
    try {
      const res = await apiCall('/auth/register/pseudonym', {
        method: 'POST',
        body: JSON.stringify({
          alias: alias.trim(),
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
          password: password,
        }),
      });
      await setToken(res.token);
      await setUser(res.user);
      try { await apiCall('/seed', { method: 'POST' }); } catch {}
      router.replace('/home');
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
        <View style={styles.header}>
          <TouchableOpacity testID="back-btn" onPress={() => router.back()} activeOpacity={0.7}>
            <ChevronLeft size={24} color={COLORS.ghost_white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>PSEUDONYM REGISTRATION</Text>
          <View style={{ width: 24 }} />
        </View>
        <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.iconArea}>
            <View style={styles.iconCircle}>
              <UserPlus size={40} color={COLORS.alert_amber} />
            </View>
          </View>

          <Text style={styles.title}>Create Identity</Text>
          <Text style={styles.subtitle}>Optional contact info for recovery.{'\n'}All data is encrypted at rest.</Text>

          <View style={styles.form}>
            <Text style={styles.label}>CODENAME *</Text>
            <TextInput
              testID="alias-input"
              style={styles.input}
              value={alias}
              onChangeText={setAlias}
              placeholder="Your tactical alias..."
              placeholderTextColor={COLORS.stealth_grey}
              autoCapitalize="none"
            />

            <Text style={styles.label}>SECURE EMAIL (OPTIONAL)</Text>
            <TextInput
              testID="email-input"
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="ghost@proton.me"
              placeholderTextColor={COLORS.stealth_grey}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <Text style={styles.label}>PHONE (OPTIONAL)</Text>
            <TextInput
              testID="phone-input"
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="+1 555 000 0000"
              placeholderTextColor={COLORS.stealth_grey}
              keyboardType="phone-pad"
            />

            <Text style={styles.label}>PASSPHRASE *</Text>
            <TextInput
              testID="password-input"
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="Strong passphrase..."
              placeholderTextColor={COLORS.stealth_grey}
              secureTextEntry
            />
          </View>

          <TouchableOpacity
            testID="confirm-pseudonym-btn"
            style={styles.confirmBtn}
            activeOpacity={0.7}
            onPress={handleRegister}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.void_black} />
            ) : (
              <Text style={styles.confirmBtnText}>CREATE SECURE IDENTITY</Text>
            )}
          </TouchableOpacity>
          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.void_black },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: COLORS.armour_grey,
  },
  headerTitle: {
    color: COLORS.ghost_white, fontSize: 14, fontWeight: '700',
    fontFamily: 'monospace', letterSpacing: 2,
  },
  content: { flex: 1, paddingHorizontal: 24 },
  iconArea: { alignItems: 'center', marginTop: 24, marginBottom: 20 },
  iconCircle: {
    width: 80, height: 80, borderRadius: 40,
    borderWidth: 2, borderColor: COLORS.alert_amber,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,176,0,0.05)',
  },
  title: {
    fontSize: 24, fontWeight: '700', color: COLORS.alert_amber,
    textAlign: 'center', fontFamily: 'monospace',
  },
  subtitle: {
    fontSize: 12, color: COLORS.muted_text, textAlign: 'center',
    marginTop: 8, lineHeight: 18, fontFamily: 'monospace',
  },
  form: { marginTop: 24 },
  label: {
    color: COLORS.muted_text, fontSize: 10, fontWeight: '700',
    fontFamily: 'monospace', letterSpacing: 1, marginBottom: 6, marginTop: 16,
  },
  input: {
    backgroundColor: COLORS.gunmetal, borderWidth: 1,
    borderColor: COLORS.border_subtle, borderRadius: 2,
    color: COLORS.ghost_white, fontSize: 14, fontFamily: 'monospace',
    padding: 12, height: 48,
  },
  confirmBtn: {
    height: 52, backgroundColor: COLORS.alert_amber,
    borderRadius: 2, alignItems: 'center', justifyContent: 'center',
    marginTop: 32,
  },
  confirmBtnText: {
    color: COLORS.void_black, fontSize: 14, fontWeight: '700',
    fontFamily: 'monospace', letterSpacing: 2,
  },
});
