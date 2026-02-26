import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Fingerprint, ChevronLeft } from 'lucide-react-native';
import { COLORS } from '../src/constants';
import { registerAnonymous } from '../src/auth'; // MODIFIED: Use direct Firebase auth

export default function RegisterAnonymous() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [alias, setAlias] = useState('');

  const handleRegister = async () => {
    setLoading(true);
    try {
      // MODIFIED: Call the correct registration function from auth.ts
      await registerAnonymous(alias.trim());
      // On success, navigate home
      router.replace('/home');
    } catch (err: any) {
      Alert.alert('Registration Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <View style={styles.header}>
          <TouchableOpacity testID="back-btn" onPress={() => router.back()} activeOpacity={0.7}>
            <ChevronLeft size={24} color={COLORS.ghost_white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>ANONYMOUS ACCESS</Text>
          <View style={{ width: 24 }} />
        </View>

        <View style={styles.content}>
          <View style={styles.iconArea}>
            <View style={styles.iconCircle}>
              <Fingerprint size={48} color={COLORS.terminal_green} />
            </View>
          </View>

          <Text style={styles.title}>Ghost Protocol</Text>
          <Text style={styles.subtitle}>
            No email. No phone. No identity.{'\n'}
            Your device fingerprint is your only key.
          </Text>

          <View style={styles.infoBox}>
            <Text style={styles.infoLabel}>// SECURITY BRIEF</Text>
            <Text style={styles.infoText}>
              {'\u2022'} Device-generated cryptographic fingerprint{'\n'}
              {'\u2022'} No personal data collected or stored{'\n'}
              {'\u2022'} AES-256-GCM encryption on all messages{'\n'}
              {'\u2022'} Zero-knowledge server architecture{'\n'}
              {'\u2022'} Auto-rotating encryption keys
            </Text>
          </View>

          <View style={styles.aliasBox}>
            <Text style={styles.aliasLabel}>CODENAME (OPTIONAL)</Text>
            {/* This faux-input is purely for display */}
            <View style={styles.inputRow}>
              <View style={styles.textInputWrapper}>
                <RNTextInput
                  testID="alias-input"
                  style={styles.realInput}
                  value={alias}
                  onChangeText={setAlias}
                  placeholder="Enter codename..."
                  placeholderTextColor={COLORS.stealth_grey}
                  autoCapitalize="none"
                />
              </View>
            </View>
          </View>

          <TouchableOpacity
            testID="confirm-anonymous-btn"
            style={styles.confirmBtn}
            activeOpacity={0.7}
            onPress={handleRegister}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.void_black} />
            ) : (
              <>
                <Fingerprint size={20} color={COLORS.void_black} />
                <Text style={styles.confirmBtnText}>INITIALIZE GHOST PROTOCOL</Text>
              </>
            )}
          </TouchableOpacity>

          <Text style={styles.disclaimer}>
            By proceeding, you acknowledge that losing device access{'\n'}
            means permanent loss of this identity.
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

import { TextInput as RNTextInput } from 'react-native';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.void_black },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.armour_grey,
  },
  headerTitle: {
    color: COLORS.ghost_white,
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'monospace',
    letterSpacing: 2,
  },
  content: { flex: 1, paddingHorizontal: 24, paddingTop: 32 },
  iconArea: { alignItems: 'center', marginBottom: 24 },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: COLORS.terminal_green,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,255,65,0.05)',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.terminal_green,
    textAlign: 'center',
    fontFamily: 'monospace',
  },
  subtitle: {
    fontSize: 13,
    color: COLORS.muted_text,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
    fontFamily: 'monospace',
  },
  infoBox: {
    backgroundColor: COLORS.gunmetal,
    borderLeftWidth: 2,
    borderLeftColor: COLORS.terminal_green,
    padding: 16,
    marginTop: 24,
  },
  infoLabel: {
    color: COLORS.terminal_green,
    fontSize: 10,
    fontWeight: '700',
    fontFamily: 'monospace',
    letterSpacing: 1,
    marginBottom: 8,
  },
  infoText: {
    color: COLORS.ghost_white,
    fontSize: 12,
    lineHeight: 22,
    fontFamily: 'monospace',
  },
  aliasBox: { marginTop: 24 },
  aliasLabel: {
    color: COLORS.muted_text,
    fontSize: 10,
    fontWeight: '700',
    fontFamily: 'monospace',
    letterSpacing: 1,
    marginBottom: 8,
  },
  inputRow: { marginBottom: 0 },
  textInputWrapper: {
    backgroundColor: COLORS.gunmetal,
    borderWidth: 1,
    borderColor: COLORS.border_subtle,
    borderRadius: 2,
  },
  realInput: {
    color: COLORS.ghost_white,
    fontSize: 14,
    fontFamily: 'monospace',
    padding: 12,
    height: 48,
  },
  confirmBtn: {
    height: 52,
    backgroundColor: COLORS.terminal_green,
    borderRadius: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 24,
  },
  confirmBtnText: {
    color: COLORS.void_black,
    fontSize: 13,
    fontWeight: '700',
    fontFamily: 'monospace',
    letterSpacing: 1,
  },
  disclaimer: {
    color: COLORS.stealth_grey,
    fontSize: 10,
    textAlign: 'center',
    marginTop: 16,
    fontFamily: 'monospace',
    lineHeight: 16,
  },
});
