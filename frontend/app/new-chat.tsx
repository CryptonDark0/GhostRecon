import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView,
  FlatList, TextInput, ActivityIndicator, Alert, Platform
} from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft, Search, MessageSquare } from 'lucide-react-native';
import { COLORS } from '../src/constants';
import { auth, db } from '../src/firebase';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { createConversation } from '../src/firestoreService';

export default function NewChatScreen() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [linking, setLinking] = useState(false);

  const searchUsers = async (text: string) => {
    setSearchQuery(text);
    if (text.trim().length < 2) {
      setResults([]);
      return;
    }

    setLoading(true);
    try {
      const usersRef = collection(db, "users");
      const searchKey = text.trim().toLowerCase();

      const q = query(
        usersRef,
        where("alias_lowercase", ">=", searchKey),
        where("alias_lowercase", "<=", searchKey + '\uf8ff'),
        limit(15)
      );

      const querySnapshot = await getDocs(q);
      const users = querySnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(u => u.id !== auth.currentUser?.uid);

      setResults(users);
    } catch (err) {
      console.error("[GHOST-SEARCH] Error:", err);
    } finally {
      setLoading(false);
    }
  };

  const startChat = async (targetUserId: string) => {
    const user = auth.currentUser;
    if (!user) return;

    setLinking(true);
    try {
      const conv = await createConversation([user.uid, targetUserId]);
      router.replace(`/chat/${conv.id}`);
    } catch (err: any) {
      console.error("[GHOST-SEARCH] Handshake failed:", err);
      if (Platform.OS === 'web') {
        window.alert("LINK FAILURE: Ensure security rules are published.");
      } else {
        Alert.alert("Link Error", "Handshake failed. Check network link.");
      }
    } finally {
      setLinking(false);
    }
  };

  const renderUser = ({ item }: { item: any }) => (
    <View style={styles.userItem}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{(item.alias || '?')[0].toUpperCase()}</Text>
      </View>
      <View style={styles.userInfo}>
        <Text style={styles.userName}>{item.alias}</Text>
        <Text style={styles.userType}>AGENT AUTHORIZED</Text>
      </View>
      <TouchableOpacity
        style={styles.chatBtn}
        onPress={() => startChat(item.id)}
        disabled={linking}
      >
        {linking ? <ActivityIndicator size="small" color="#000" /> : <MessageSquare size={18} color="#000" />}
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        {/* SAFE BACK PROTOCOL */}
        <TouchableOpacity
          onPress={() => router.canGoBack() ? router.back() : router.replace('/home')}
          style={styles.backBtn}
        >
          <ChevronLeft size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>SECURE SEARCH</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.searchBox}>
        <Search size={18} color="#555" />
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={searchUsers}
          placeholder="Search codename..."
          placeholderTextColor="#444"
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      {loading && <ActivityIndicator color={COLORS.terminal_green} style={{ marginTop: 20 }} />}

      <Text style={styles.sectionLabel}>NETWORK RESULTS</Text>
      <FlatList
        data={results}
        renderItem={renderUser}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 40 }}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            {searchQuery.length < 2 ? "Enter 2+ characters to scan..." : "No active agents identified."}
          </Text>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050505' },
  header: { height: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#1A1A1A' },
  backBtn: { padding: 8 },
  headerTitle: { color: '#FFF', fontSize: 13, fontWeight: '700', fontFamily: 'monospace', letterSpacing: 2 },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 10, margin: 16, backgroundColor: '#111', borderWidth: 1, borderColor: '#222', borderRadius: 2, paddingHorizontal: 16, height: 52 },
  searchInput: { flex: 1, color: '#FFF', fontSize: 15, fontFamily: 'monospace' },
  sectionLabel: { color: COLORS.terminal_green, fontSize: 10, fontWeight: '700', fontFamily: 'monospace', paddingHorizontal: 16, marginBottom: 8 },
  userItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#111', gap: 16 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#111', borderWidth: 1, borderColor: COLORS.terminal_green, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: COLORS.terminal_green, fontSize: 18, fontWeight: '700', fontFamily: 'monospace' },
  userInfo: { flex: 1 },
  userName: { color: '#FFF', fontSize: 15, fontWeight: '600', fontFamily: 'monospace' },
  userType: { color: '#666', fontSize: 9, fontFamily: 'monospace', marginTop: 4 },
  chatBtn: { width: 44, height: 44, backgroundColor: COLORS.terminal_green, borderRadius: 2, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: '#444', fontSize: 12, fontFamily: 'monospace', textAlign: 'center', marginTop: 60 },
});
