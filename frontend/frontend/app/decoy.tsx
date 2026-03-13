import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Calculator, ChevronLeft } from 'lucide-react-native';
import { COLORS } from '../src/constants';

const SECRET_CODE = '1337';

export default function DecoyScreen() {
  const router = useRouter();
  const [display, setDisplay] = useState('0');
  const [secretBuffer, setSecretBuffer] = useState('');

  const handlePress = (val: string) => {
    if (val === 'C') {
      setDisplay('0');
      setSecretBuffer('');
      return;
    }
    if (val === '=') {
      const newBuffer = secretBuffer + display;
      if (newBuffer.includes(SECRET_CODE)) {
        router.replace('/home');
        return;
      }
      try {
        const result = eval(display);
        setDisplay(String(result));
      } catch {
        setDisplay('Error');
      }
      setSecretBuffer('');
      return;
    }
    if (['+', '-', '*', '/'].includes(val)) {
      setDisplay(display + val);
      return;
    }
    if (display === '0' || display === 'Error') {
      setDisplay(val);
      setSecretBuffer(secretBuffer + val);
    } else {
      setDisplay(display + val);
      setSecretBuffer(secretBuffer + val);
    }
  };

  const buttons = [
    ['7', '8', '9', '/'],
    ['4', '5', '6', '*'],
    ['1', '2', '3', '-'],
    ['C', '0', '=', '+'],
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity testID="decoy-back-btn" onPress={() => router.back()} activeOpacity={0.7}>
          <ChevronLeft size={24} color="#666" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Calculator</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.displayArea}>
        <Text testID="calc-display" style={styles.displayText} numberOfLines={1} adjustsFontSizeToFit>
          {display}
        </Text>
      </View>

      <View style={styles.buttonsGrid}>
        {buttons.map((row, ri) => (
          <View key={ri} style={styles.buttonRow}>
            {row.map((btn) => (
              <TouchableOpacity
                key={btn}
                testID={`calc-btn-${btn}`}
                style={[
                  styles.calcBtn,
                  ['+', '-', '*', '/', '='].includes(btn) && styles.opBtn,
                  btn === 'C' && styles.clearBtn,
                ]}
                onPress={() => handlePress(btn)}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.calcBtnText,
                  ['+', '-', '*', '/', '='].includes(btn) && styles.opBtnText,
                  btn === 'C' && styles.clearBtnText,
                ]}>
                  {btn}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        ))}
      </View>

      <Text style={styles.hint}>Enter code 1337= to unlock</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: '#1a1a1a',
  },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '500' },
  displayArea: {
    flex: 1, justifyContent: 'flex-end',
    paddingHorizontal: 24, paddingBottom: 20,
    backgroundColor: '#000',
  },
  displayText: { color: '#fff', fontSize: 56, fontWeight: '300', textAlign: 'right' },
  buttonsGrid: { paddingHorizontal: 8, paddingBottom: 16 },
  buttonRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  calcBtn: {
    flex: 1, height: 72, borderRadius: 36,
    backgroundColor: '#333', alignItems: 'center', justifyContent: 'center',
  },
  calcBtnText: { color: '#fff', fontSize: 28, fontWeight: '400' },
  opBtn: { backgroundColor: '#FF9500' },
  opBtnText: { color: '#fff', fontWeight: '500' },
  clearBtn: { backgroundColor: '#a5a5a5' },
  clearBtnText: { color: '#000' },
  hint: { color: '#222', fontSize: 8, textAlign: 'center', paddingBottom: 8 },
});
