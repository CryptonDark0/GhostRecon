import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Alert, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft, AlertTriangle, Trash2 } from 'lucide-react-native';
import { COLORS } from '../src/constants';
import { destroyIdentity } from '../src/api';

export default function PanicWipeScreen() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [wiped, setWiped] = useState(false);

  const handleWipe = async () => {
    setLoading(true);
    try {
      // PERMANENTLY DESTROY IDENTITY
      // This deletes the user from Auth and Firestore, releasing the codename.
      await destroyIdentity();
      setWiped(true);
    } catch (err: any) {
      console.error(err);
      // If re-authentication is required, Firebase might throw an error.
      // For anonymous users, this is rare, but for email/pass it might happen.
      Alert.alert('Protocol Error', 'Identity destruction requires recent authentication. Re-login and try again.');
    } finally {
      setLoading(false);
    }
  };

  if (wiped) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.wipedContent}>
          <Trash2 size={64} color={COLORS.critical_red} />
          <Text style={styles.wipedTitle}>IDENTITY PURGED</Text>
          <Text style={styles.wipedText}>
            Your tactical profile, codename, and all secure{'\n'}data have been permanently erased from the network.
          </Text>
          <TouchableOpacity
            style={styles.returnBtn}
            onPress={() => router.replace('/')}
            activeOpacity={0.7}
          >
            <Text style={styles.returnBtnText}>EXIT SYSTEM</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={styles.backBtn}>
          <ChevronLeft size={24} color={COLORS.ghost_white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>PANIC WIPE</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.content}>
        <View style={styles.warningIcon}>
          <AlertTriangle size={64} color={COLORS.critical_red} />
        </View>

        <Text style={styles.title}>EMERGENCY WIPE</Text>
        <Text style={styles.subtitle}>
          This action will permanently DESTROY your identity:{'\n\n'}
          {'\u2022'} Delete your profile from the cloud{'\n'}
          {'\u2022'} Release your CODENAME for others{'\n'}
          {'\u2022'} Wipe all encryption keys{'\n'}
          {'\u2022'} Terminate all active links{'\n\n'}
          This action IS IRREVERSIBLE.
        </Text>

        {step === 0 && (
          <TouchableOpacity
            style={styles.wipeBtn}
            onPress={() => setStep(1)}
            activeOpacity={0.7}
          >
            <AlertTriangle size={18} color={COLORS.ghost_white} />
            <Text style={styles.wipeBtnText}>INITIATE DESTRUCTION</Text>
          </TouchableOpacity>
        )}

        {step === 1 && (
          <View style={styles.confirmArea}>
            <Text style={styles.confirmText}>CONFIRM PURGE?</Text>
            <TouchableOpacity
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
                  <Text style={styles.finalWipeBtnText}>PURGE IDENTITY</Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity
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
    height: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: COLORS.armour_grey,
  },
  backBtn: { padding: 8 },
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
