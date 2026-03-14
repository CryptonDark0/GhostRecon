import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView,
  FlatList, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator, Alert, Image, Modal, Linking
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, Send, Lock, Phone, Video, ImageIcon, Paperclip, Clock, Trash2, ShieldAlert } from 'lucide-react-native';
import { COLORS } from '../../src/constants';
import { auth, db } from '../../src/firebase';
import { doc, getDoc, onSnapshot, collection, query, orderBy, addDoc, serverTimestamp, updateDoc, deleteDoc } from 'firebase/firestore';
import { uploadMedia, setTypingStatus, listenTypingStatus, markAsRead, deleteMessageForEveryone, deleteMessageForMe, addReaction, sendMessage } from '../../src/firestoreService';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';

export default function ChatDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [targetAgent, setTargetAgent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sendingMedia, setSendingMedia] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [typingAgents, setTypingAgents] = useState<string[]>([]);
  const [selfDestruct, setSelfDestruct] = useState<number | null>(null);
  const [selectedMsg, setSelectedMsg] = useState<any>(null);
  const [menuVisible, setMenuVisible] = useState(false);

  const flatListRef = useRef<FlatList>(null);
  const currentUser = auth.currentUser;

  useEffect(() => {
    if (!id || !currentUser) return;

    let unsubscribeMessages: () => void;
    let unsubscribeConv: () => void;
    let unsubscribeTyping: () => void;

    const setupChat = async () => {
      try {
        markAsRead(id, currentUser.uid);

        unsubscribeMessages = onSnapshot(query(collection(db, "conversations", id, "messages"), orderBy("created_at", "asc")), (snapshot) => {
          const allMsgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));
          const filtered = allMsgs.filter(m => !m.hiddenFor?.includes(currentUser.uid))
            .map(m => ({ ...m, created_at: m.created_at?.toDate() || new Date() }));
          setMessages(filtered);
          setLoading(false);
        });

        unsubscribeConv = onSnapshot(doc(db, "conversations", id), async (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            const targetId = data.participants.find((p: string) => p !== currentUser.uid);
            onSnapshot(doc(db, "users", targetId), (targetSnap) => {
              if (targetSnap.exists()) setTargetAgent({ uid: targetSnap.id, ...targetSnap.data() });
            });
          }
        });

        unsubscribeTyping = listenTypingStatus(id, (typingIds) => {
          setTypingAgents(typingIds.filter(uid => uid !== currentUser.uid));
        });

      } catch (err) { setLoading(false); }
    };

    setupChat();
    return () => {
      if (unsubscribeConv) unsubscribeConv();
      if (unsubscribeMessages) unsubscribeMessages();
      if (unsubscribeTyping) unsubscribeTyping();
      setTypingStatus(id, currentUser.uid, false);
    };
  }, [id]);

  useEffect(() => {
    const timeouts: any[] = [];
    messages.forEach(msg => {
      if (msg.self_destruct_seconds && msg.created_at) {
        const expiry = msg.created_at.getTime() + (msg.self_destruct_seconds * 1000);
        const diff = expiry - Date.now();
        if (diff <= 0) {
          deleteDoc(doc(db, "conversations", id as string, "messages", msg.id)).catch(()=>{});
        } else {
          timeouts.push(setTimeout(() => deleteDoc(doc(db, "conversations", id as string, "messages", msg.id)).catch(()=>{}), diff));
        }
      }
    });
    return () => timeouts.forEach(t => clearTimeout(t));
  }, [messages]);

  const handleSendMessage = async (type: string = 'text', mediaUrl: string | null = null, fileSize: number = 0, filePath: string | null = null) => {
    if ((!input.trim() && !mediaUrl) || !currentUser || !id) return;
    const text = input.trim();
    if (type === 'text') setInput('');
    setTypingStatus(id, currentUser.uid, false);

    try {
      const userDoc = await getDoc(doc(db, "users", currentUser.uid));
      const senderAlias = userDoc.exists() ? userDoc.data().alias : 'Ghost';

      await addDoc(collection(db, "conversations", id, "messages"), {
        conversation_id: id, sender_id: currentUser.uid, sender_alias: senderAlias,
        content: text, type, fileUrl: mediaUrl, filePath, fileSize, created_at: serverTimestamp(),
        self_destruct_seconds: selfDestruct,
        hiddenFor: [],
        reactions: {}
      });

      await updateDoc(doc(db, "conversations", id), {
        lastMessageAt: serverTimestamp(),
        lastMessage: type === 'text' ? text : `[Tactical ${type}]`
      });
    } catch (err) { Alert.alert("Link Failed", "Handshake failed."); }
  };

  const pickMedia = async (mode: 'image' | 'file') => {
    if (!currentUser) return;
    try {
      let result;
      if (mode === 'image') {
        result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
      } else {
        result = await DocumentPicker.getDocumentAsync({ type: '*/*' });
      }

      if (!result.canceled && result.assets[0]) {
        setSendingMedia(true);
        const media = await uploadMedia(currentUser.uid, result.assets[0].uri, mode, setUploadProgress);
        await handleSendMessage(mode, media.url, media.size, media.path);
      }
    } catch (e: any) { Alert.alert("Handshake Error", "Media dispatch failed."); }
    finally { setSendingMedia(false); setUploadProgress(0); }
  };

  const handleCall = async (type: 'voice' | 'video') => {
    if (!targetAgent || !id) return;
    await handleSendMessage('text', null, 0, null); // Dummy trigger for call node if needed
    router.push(`/call/${type}?target=${targetAgent.uid}`);
  };

  const onMsgAction = async (action: 'everyone' | 'me' | 'react', emoji?: string) => {
    if (!selectedMsg || !id || !currentUser) return;
    setMenuVisible(false);
    try {
      if (action === 'everyone' && selectedMsg.sender_id === currentUser.uid) {
        await deleteMessageForEveryone(id, selectedMsg.id);
      } else if (action === 'me') {
        await deleteMessageForMe(id, selectedMsg.id, currentUser.uid);
      } else if (action === 'react' && emoji) {
        await addReaction(id, selectedMsg.id, currentUser.uid, emoji);
      }
    } catch (e) { Alert.alert("Error", "Action blocked."); }
  };

  const openNode = (url: string) => {
    if (!url) return;
    Linking.openURL(url).catch(() => Alert.alert("Error", "Could not open link."));
  };

  const renderMessage = ({ item }: { item: any }) => {
    const isMine = item.sender_id === auth.currentUser?.uid;
    const reactions = Object.values(item.reactions || {});

    return (
      <TouchableOpacity
        activeOpacity={0.9}
        onLongPress={() => { setSelectedMsg(item); setMenuVisible(true); }}
        onPress={() => item.fileUrl && openNode(item.fileUrl)}
        style={[styles.msgRow, isMine && styles.msgRowMine]}
      >
        <View style={[styles.msgBubble, isMine ? styles.msgBubbleMine : styles.msgBubbleOther]}>
          {!isMine && (
            <View style={styles.senderHeader}>
              <View style={[styles.statusIndicator, { backgroundColor: targetAgent?.isOnline ? COLORS.terminal_green : COLORS.critical_red }]} />
              <Text style={styles.msgSender}>{item.sender_alias}</Text>
            </View>
          )}
          {item.type === 'image' ? (
            <Image source={{ uri: item.fileUrl }} style={styles.msgImage} resizeMode="contain" />
          ) : item.type === 'file' ? (
            <View style={styles.fileBox}>
              <Paperclip size={16} color={isMine ? "#000" : COLORS.terminal_green} />
              <Text style={[styles.fileText, isMine && {color: "#000"}]}>TACTICAL_INTEL.DAT</Text>
            </View>
          ) : (
            <Text style={[styles.msgText, isMine && styles.msgTextMine]} selectable={false}>{item.content}</Text>
          )}
          {reactions.length > 0 && <View style={styles.reactionBadge}><Text style={{fontSize: 10}}>{reactions.join('')}</Text></View>}
          <View style={styles.msgMeta}>
            {item.self_destruct_seconds && <Clock size={10} color={isMine ? "#000" : COLORS.critical_red} />}
            <Lock size={10} color={isMine ? "rgba(0,0,0,0.4)" : COLORS.terminal_green} />
            <Text style={[styles.msgTime, isMine && {color: 'rgba(0,0,0,0.4)'}]}>
              {item.created_at.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) return <View style={styles.loading}><ActivityIndicator color={COLORS.terminal_green} /></View>;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.replace('/home')} style={styles.headerBtn}><ChevronLeft size={24} color="#FFF" /></TouchableOpacity>
        <View style={styles.headerCenter}>
          <View style={styles.nameRow}>
            <View style={[styles.statusIndicatorHeader, { backgroundColor: targetAgent?.isOnline ? COLORS.terminal_green : COLORS.critical_red }]} />
            <Text style={styles.headerTitle}>{targetAgent?.alias?.toUpperCase() || "AGENT"}</Text>
          </View>
          <Text style={[styles.headerStatus, { color: targetAgent?.isOnline ? COLORS.terminal_green : COLORS.critical_red }]}>
            {typingAgents.length > 0 ? "AGENT COMPOSING..." : (targetAgent?.isOnline ? "SECURE LINK ACTIVE" : "OFFLINE")}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerIconBtn} onPress={() => handleCall('voice')}><Phone size={18} color={COLORS.terminal_green} /></TouchableOpacity>
          <TouchableOpacity style={styles.headerIconBtn} onPress={() => handleCall('video')}><Video size={18} color={COLORS.terminal_green} /></TouchableOpacity>
        </View>
      </View>

      <FlatList ref={flatListRef} data={messages} renderItem={renderMessage} keyExtractor={item => item.id} contentContainerStyle={styles.list} onContentSizeChange={() => flatListRef.current?.scrollToEnd()} />

      {sendingMedia && (
        <View style={styles.progress}>
          <ActivityIndicator color={COLORS.terminal_green} size="small" />
          <Text style={styles.progressText}>DISPATCHING: {uploadProgress.toFixed(0)}%</Text>
        </View>
      )}

      <View style={styles.timerRow}>
        <Clock size={12} color={COLORS.muted_text} />
        {[null, 10, 30, 60].map((t) => (
          <TouchableOpacity key={String(t)} style={[styles.timerOption, selfDestruct === t && styles.timerOptionActive]} onPress={() => setSelfDestruct(t)}>
            <Text style={[styles.timerOptionText, selfDestruct === t && styles.timerOptionTextActive]}>{t ? t+'s' : 'OFF'}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.inputArea}>
          <TouchableOpacity onPress={() => pickMedia('image')} style={styles.iconBtn}><ImageIcon size={22} color={COLORS.terminal_green} /></TouchableOpacity>
          <TouchableOpacity onPress={() => pickMedia('file')} style={styles.iconBtn}><Paperclip size={22} color={COLORS.terminal_green} /></TouchableOpacity>
          <TextInput
            style={styles.input} value={input}
            onChangeText={(t) => { setInput(t); setTypingStatus(id!, currentUser!.uid, t.length > 0); }}
            placeholder="Type tactical intel..." placeholderTextColor="#444" multiline
          />
          <TouchableOpacity onPress={() => handleSend()} style={styles.sendBtn}><Send size={20} color="#000" /></TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <Modal visible={menuVisible} transparent animationType="fade">
        <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={() => setMenuVisible(false)}>
          <View style={styles.menuContent}>
            <View style={styles.reactionRow}>
              {['👍', '❤️', '😮', '😂', '🔥', '🎯'].map(emoji => (
                <TouchableOpacity key={emoji} onPress={() => onMsgAction('react', emoji)} style={styles.emojiBtn}><Text style={{fontSize: 24}}>{emoji}</Text></TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={styles.menuItem} onPress={() => onMsgAction('me')}><Trash2 size={18} color="#FFF" /><Text style={styles.menuText}>DELETE FOR ME</Text></TouchableOpacity>
            {selectedMsg?.sender_id === currentUser?.uid && (
              <TouchableOpacity style={[styles.menuItem, {borderTopWidth: 1, borderTopColor: '#222'}]} onPress={() => onMsgAction('everyone')}><ShieldAlert size={18} color={COLORS.critical_red} /><Text style={[styles.menuText, {color: COLORS.critical_red}]}>DELETE FOR EVERYONE</Text></TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050505' },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#050505' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#222', backgroundColor: '#121212' },
  headerBtn: { padding: 8 },
  headerCenter: { flex: 1, marginLeft: 16 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusIndicatorHeader: { width: 8, height: 8, borderRadius: 4 },
  headerTitle: { color: '#FFF', fontSize: 14, fontWeight: '900', fontFamily: 'monospace' },
  headerStatus: { fontSize: 8, fontFamily: 'monospace', marginTop: 2, letterSpacing: 1 },
  headerActions: { flexDirection: 'row', gap: 12 },
  headerIconBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#333', borderRadius: 4 },
  list: { padding: 12 },
  msgRow: { marginBottom: 12, alignItems: 'flex-start' },
  msgRowMine: { alignItems: 'flex-end' },
  msgBubble: { maxWidth: '85%', padding: 12, borderRadius: 2, position: 'relative' },
  msgBubbleMine: { backgroundColor: COLORS.terminal_green },
  msgBubbleOther: { backgroundColor: '#121212', borderLeftWidth: 3, borderLeftColor: COLORS.terminal_green },
  senderHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  statusIndicator: { width: 6, height: 6, borderRadius: 3 },
  msgSender: { color: COLORS.terminal_green, fontSize: 9, fontWeight: '700', fontFamily: 'monospace' },
  msgText: { color: '#FFF', fontSize: 14, lineHeight: 20 },
  msgTextMine: { color: '#000', fontWeight: '600' },
  msgImage: { width: 240, height: 240, borderRadius: 2, marginBottom: 8 },
  fileBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(0,0,0,0.1)', padding: 10 },
  fileText: { color: COLORS.terminal_green, fontSize: 12, fontFamily: 'monospace' },
  msgMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6, justifyContent: 'flex-end' },
  msgTime: { fontSize: 8, color: '#666', fontFamily: 'monospace' },
  progress: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 8, backgroundColor: '#121212' },
  progressText: { color: COLORS.terminal_green, fontSize: 10, fontFamily: 'monospace' },
  timerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: 8, backgroundColor: '#121212', borderTopWidth: 1, borderTopColor: '#222' },
  timerOption: { paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: '#333' },
  timerOptionActive: { borderColor: COLORS.critical_red, backgroundColor: 'rgba(255,0,0,0.1)' },
  timerOptionText: { color: '#666', fontSize: 9, fontFamily: 'monospace' },
  timerOptionTextActive: { color: COLORS.critical_red, fontWeight: '700' },
  inputArea: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10, borderTopWidth: 1, borderTopColor: '#222', backgroundColor: '#121212' },
  iconBtn: { padding: 4 },
  input: { flex: 1, backgroundColor: '#000', color: '#FFF', padding: 10, fontFamily: 'monospace' },
  sendBtn: { width: 44, height: 44, backgroundColor: COLORS.terminal_green, borderRadius: 2, alignItems: 'center', justifyContent: 'center' },
  menuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center' },
  menuContent: { width: '80%', backgroundColor: '#121212', borderRadius: 4, padding: 20, borderWidth: 1, borderColor: '#333' },
  reactionRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  emojiBtn: { padding: 8 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 16 },
  menuText: { color: '#FFF', fontSize: 13, fontWeight: '700', fontFamily: 'monospace' },
  reactionBadge: { position: 'absolute', bottom: -10, right: 10, backgroundColor: '#1A1A1A', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10, borderWidth: 1, borderColor: '#333' }
});
