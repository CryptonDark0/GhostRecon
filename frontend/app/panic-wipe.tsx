import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Alert, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft, AlertTriangle, Trash2 } from 'lucide-react-native';
import { COLORS } from '../src/constants';
import { apiCall, clearAuth } from '../src/api';

export default function PanicWipeScreen() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [wiped, setWiped] = useState(false);

  const handleWipe = async () => {
    setLoading(true);
    try {
      await apiCall('/security/panic-wipe', {
        method: 'POST',
        body: JSON.stringify({ confirm_code: 'WIPE-CONFIRM' }),
      });
      setWiped(true);
      await clearAuth();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  if (wiped) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.wipedContent}>
          <Trash2 size={64} color={COLORS.critical_red} />
          <Text style={styles.wipedTitle}>DATA DESTROYED</Text>
          <Text style={styles.wipedText}>
            All messages, conversations, contacts,{'\n'}and call history have been permanently wiped.
          </Text>
          <TouchableOpacity
            testID="return-btn"
            style={styles.returnBtn}
            onPress={() => router.replace('/')}
            activeOpacity={0.7}
          >
            <Text style={styles.returnBtnText}>EXIT</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity testID="back-btn" onPress={() => router.back()} activeOpacity={0.7}>
          <ChevronLeft size={24} color={COLORS.ghost_white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>PANIC WIPE</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.content}>
        <View style={styles.warningIcon}>
          <AlertTriangle size={64} color={COLORS.critical_red} />
        </View>

        <Text style={styles.title}>EMERGENCY WIPE</Text>
        <Text style={styles.subtitle}>
          This action will permanently destroy ALL data:{'\n\n'}
          {'\u2022'} All encrypted messages{'\n'}
          {'\u2022'} All conversation history{'\n'}
          {'\u2022'} All contacts and trust network{'\n'}
          {'\u2022'} All call records{'\n\n'}
          This action CANNOT be undone.
        </Text>

        {step === 0 && (
          <TouchableOpacity
            testID="wipe-step1-btn"
            style={styles.wipeBtn}
            onPress={() => setStep(1)}
            activeOpacity={0.7}
          >
            <AlertTriangle size={18} color={COLORS.ghost_white} />
            <Text style={styles.wipeBtnText}>INITIATE WIPE PROTOCOL</Text>
          </TouchableOpacity>
        )}

        {step === 1 && (
          <View style={styles.confirmArea}>
            <Text style={styles.confirmText}>ARE YOU ABSOLUTELY SURE?</Text>
            <TouchableOpacity
              testID="wipe-confirm-btn"
              style={styles.finalWipeBtn}
              onPress={handleWipe}
              disabled={loading}
              activeOpacity={0.7}
            >
              {loading ? (
                <ActivityIndicator color={COLORS.ghost_white} />
              ) : (
                <>
                  <Trash2 size={18} color={COLORS.ghost_white} />
                  <Text style={styles.finalWipeBtnText}>CONFIRM DESTRUCTION</Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              testID="wipe-cancel-btn"
              style={styles.cancelBtn}
              onPress={() => setStep(0)}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelBtnText}>ABORT</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.void_black },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: COLORS.armour_grey,
  },
  headerTitle: { color: COLORS.critical_red, fontSize: 14, fontWeight: '700', fontFamily: 'monospace', letterSpacing: 2 },
  content: { flex: 1, paddingHorizontal: 24, paddingTop: 48, alignItems: 'center' },
  warningIcon: { marginBottom: 24 },
  title: { color: COLORS.critical_red, fontSize: 24, fontWeight: '900', fontFamily: 'monospace', letterSpacing: 3 },
  subtitle: {
    color: COLORS.muted_text, fontSize: 13, fontFamily: 'monospace',
    lineHeight: 22, marginTop: 16, textAlign: 'center',
  },
  wipeBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    height: 52, width: '100%', backgroundColor: COLORS.critical_red,
    borderRadius: 2, marginTop: 32,
  },
  wipeBtnText: { color: COLORS.ghost_white, fontSize: 14, fontWeight: '700', fontFamily: 'monospace', letterSpacing: 1 },
  confirmArea: { marginTop: 32, width: '100%', alignItems: 'center' },
  confirmText: {
    color: COLORS.alert_amber, fontSize: 16, fontWeight: '700',
    fontFamily: 'monospace', letterSpacing: 2, marginBottom: 24,
  },
  finalWipeBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    height: 52, width: '100%', backgroundColor: COLORS.critical_red, borderRadius: 2,
  },
  finalWipeBtnText: { color: COLORS.ghost_white, fontSize: 14, fontWeight: '700', fontFamily: 'monospace', letterSpacing: 1 },
  cancelBtn: {
    height: 48, width: '100%', borderWidth: 1, borderColor: COLORS.border_subtle,
    borderRadius: 2, alignItems: 'center', justifyContent: 'center', marginTop: 12,
  },
  cancelBtnText: { color: COLORS.muted_text, fontSize: 14, fontWeight: '600', fontFamily: 'monospace', letterSpacing: 2 },
  wipedContent: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  wipedTitle: { color: COLORS.critical_red, fontSize: 28, fontWeight: '900', fontFamily: 'monospace', marginTop: 24, letterSpacing: 3 },
  wipedText: { color: COLORS.muted_text, fontSize: 13, fontFamily: 'monospace', textAlign: 'center', marginTop: 16, lineHeight: 22 },
  returnBtn: {
    height: 48, paddingHorizontal: 32, borderWidth: 1, borderColor: COLORS.border_subtle,
    borderRadius: 2, alignItems: 'center', justifyContent: 'center', marginTop: 32,
  },
  returnBtnText: { color: COLORS.ghost_white, fontSize: 14, fontWeight: '700', fontFamily: 'monospace', letterSpacing: 2 },
});
