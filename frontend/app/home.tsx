import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, SafeAreaView, SectionList, Platform
} from "react-native";
import { useRouter } from "expo-router";
import { COLORS } from "../src/constants";
import { clearToken, destroyIdentity } from "../src/api";
import { auth, db } from "../src/firebase";
import { doc, onSnapshot, updateDoc, serverTimestamp, collection, query, where, orderBy, deleteDoc } from "firebase/firestore";
import { Shield, MessageSquare, Power, Lock, Users, ChevronRight, Crown, LogOut } from "lucide-react-native";
import AsyncStorage from '@react-native-async-storage/async-storage';

const PROFILE_CACHE_KEY = 'ghostrecon_user_profile';

const ChatItem = React.memo(({ item, onPress, onDelete }: any) => (
  <View style={styles.convWrapper}>
    <TouchableOpacity style={styles.convItem} onPress={() => onPress(item.id)} activeOpacity={0.7}>
      <View style={styles.convIcon}>
        {item.isGroup ? <Users size={20} color={COLORS.terminal_green} /> : <MessageSquare size={20} color={COLORS.terminal_green} />}
      </View>
      <View style={styles.convInfo}>
        <Text style={styles.convTitle}>{item.name || `CHANNEL: ${item.id.substring(0, 8)}`}</Text>
        <Text style={styles.lastMsg} numberOfLines={1}>{item.lastMessage || "Encrypted link active."}</Text>
      </View>
      <ChevronRight size={16} color={COLORS.stealth_grey} />
    </TouchableOpacity>
    <TouchableOpacity style={styles.deleteBtn} onPress={() => onDelete(item.id)} hitSlop={10}>
      <Power size={16} color={COLORS.critical_red} />
    </TouchableOpacity>
  </View>
));

export default function HomeScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [sections, setSections] = useState<any[]>([
    { title: "CHATS", data: [] },
    { title: "GROUPS", data: [] }
  ]);

  useEffect(() => {
    let unsubscribeProfile: () => void;
    let unsubscribeConvs: () => void;

    // ⚡ INSTANT IDENTITY LOCK
    const initSession = async () => {
      try {
        const cached = await AsyncStorage.getItem(PROFILE_CACHE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached);
          setUserProfile(parsed);
          setLoading(false);
        }
      } catch (e) {}
    };
    initSession();

    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      if (user) {
        updateDoc(doc(db, "users", user.uid), { isOnline: true, lastSeen: serverTimestamp() }).catch(() => {});

        unsubscribeProfile = onSnapshot(doc(db, "users", user.uid), (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            setUserProfile(data);
            AsyncStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(data));
          }
          setLoading(false);
        }, (err) => {
          console.error("Profile handshake failed:", err);
          setLoading(false);
        });

        const q = query(
          collection(db, "conversations"),
          where("participants", "array-contains", user.uid),
          orderBy("lastMessageAt", "desc")
        );

        unsubscribeConvs = onSnapshot(q, (snapshot) => {
          const all = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setSections([
            { title: "CHATS", data: all.filter((c: any) => !c.isGroup) },
            { title: "GROUPS", data: all.filter((c: any) => c.isGroup) }
          ]);
        });

      } else {
        AsyncStorage.removeItem(PROFILE_CACHE_KEY);
        router.replace("/");
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
      if (unsubscribeConvs) unsubscribeConvs();
    };
  }, []);

  const handleOpenVault = () => userProfile?.isSubscribed ? router.push('/vault') : router.push('/subscription');

  if (loading && !userProfile) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={COLORS.terminal_green} size="large" />
        <Text style={styles.loadingText}>SYNCHRONIZING SECURE IDENTITY...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerLabel}>OPERATOR</Text>
          <View style={styles.nameRow}>
            <Text style={styles.codename}>{userProfile?.alias?.toUpperCase() || "AGENT_PENDING"}</Text>
            {userProfile?.isSubscribed && <Crown size={14} color={COLORS.alert_amber} style={{ marginLeft: 4 }} />}
            <View style={[styles.statusDot, { backgroundColor: COLORS.terminal_green }]} />
          </View>
        </View>
        <TouchableOpacity style={styles.profileBtn} onPress={() => router.push('/settings')}>
          <Shield size={24} color={COLORS.terminal_green} />
        </TouchableOpacity>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ChatItem item={item} onPress={(id: string) => router.replace(`/chat/${id}`)} onDelete={async (id: string) => {
            if (Platform.OS === 'web') {
              if (window.confirm("WIPE CHANNEL?")) await deleteDoc(doc(db, "conversations", id));
            } else {
              Alert.alert("WIPE", "Destroy channel?", [{text:"CANCEL"}, {text:"WIPE", onPress:()=>deleteDoc(doc(db,"conversations",id))}]);
            }
          }} />
        )}
        renderSectionHeader={({ section: { title, data } }) => (
          data.length > 0 ? <Text style={styles.sectionTitle}>{title}</Text> : null
        )}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.actionGrid}>
            <TouchableOpacity style={styles.gridItem} onPress={() => router.replace('/new-chat')}>
              <MessageSquare size={24} color={COLORS.terminal_green} />
              <Text style={styles.gridLabel}>CHAT</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.gridItem} onPress={() => router.replace('/new-group')}>
              <Users size={24} color={COLORS.terminal_green} />
              <Text style={styles.gridLabel}>GROUP</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.gridItem} onPress={handleOpenVault}>
              <Lock size={24} color={userProfile?.isSubscribed ? COLORS.terminal_green : COLORS.stealth_grey} />
              <Text style={[styles.gridLabel, !userProfile?.isSubscribed && { color: COLORS.stealth_grey }]}>VAULT</Text>
              {!userProfile?.isSubscribed && <Crown size={10} color={COLORS.alert_amber} style={{ position: 'absolute', top: 8, right: 8 }} />}
            </TouchableOpacity>
          </View>
        }
        ListFooterComponent={
          <View style={styles.footer}>
            <TouchableOpacity style={styles.logoutBtn} onPress={async () => {
              await auth.signOut();
              await AsyncStorage.removeItem(PROFILE_CACHE_KEY);
              router.replace("/");
            }}>
              <LogOut size={14} color={COLORS.muted_text} />
              <Text style={styles.logoutText}>LOGOUT</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.void_black },
  loadingContainer: { flex: 1, backgroundColor: COLORS.void_black, alignItems: "center", justifyContent: "center" },
  loadingText: { color: COLORS.terminal_green, fontFamily: "monospace", marginTop: 16, fontSize: 10, letterSpacing: 2 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 24, paddingVertical: 20, borderBottomWidth: 1, borderBottomColor: COLORS.armour_grey },
  headerLabel: { color: COLORS.muted_text, fontSize: 10, fontFamily: "monospace", letterSpacing: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  codename: { color: COLORS.ghost_white, fontSize: 18, fontWeight: "900", fontFamily: "monospace", letterSpacing: 1 },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginLeft: 4 },
  profileBtn: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: COLORS.terminal_green, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,255,65,0.05)' },
  content: { padding: 24 },
  actionGrid: { flexDirection: 'row', gap: 12, marginBottom: 32 },
  gridItem: { flex: 1, height: 80, backgroundColor: COLORS.gunmetal, borderRadius: 4, alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: COLORS.border_subtle, position: 'relative' },
  gridLabel: { color: COLORS.ghost_white, fontSize: 9, fontWeight: '700', fontFamily: "monospace" },
  sectionTitle: { color: COLORS.terminal_green, fontSize: 10, fontWeight: '700', fontFamily: "monospace", letterSpacing: 2, marginBottom: 16, marginTop: 12 },
  convWrapper: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  convItem: { flex: 1, flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: COLORS.gunmetal, borderRadius: 4, borderWidth: 1, borderColor: COLORS.border_subtle },
  convIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,255,65,0.05)', alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  convInfo: { flex: 1 },
  convTitle: { color: COLORS.ghost_white, fontSize: 13, fontWeight: '700', fontFamily: 'monospace' },
  lastMsg: { color: COLORS.stealth_grey, fontSize: 11, fontFamily: 'monospace', marginTop: 4 },
  deleteBtn: { padding: 16 },
  footer: { marginTop: 40, gap: 12, paddingBottom: 40 },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 12, opacity: 0.6 },
  logoutText: { color: COLORS.ghost_white, fontSize: 10, fontWeight: "700", fontFamily: "monospace" },
});
