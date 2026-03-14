import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView,
  FlatList, Alert, Platform, Modal, ScrollView, ActivityIndicator, TextInput
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  ChevronLeft, Lock, FileText, ShieldAlert, Plus, Trash2, X,
  ShieldCheck, Eye, EyeOff, Key, Image as ImageIcon, Save, Download, Crown
} from 'lucide-react-native';
import { COLORS, STORAGE_LIMITS } from '../src/constants';
import { auth, db } from '../src/firebase';
import {
  collection, query, orderBy, onSnapshot, addDoc,
  deleteDoc, doc, serverTimestamp
} from 'firebase/firestore';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { uploadMedia, deleteMedia } from '../src/firestoreService';

type VaultItem = {
  id: string;
  type: 'note' | 'credential' | 'file';
  title: string;
  content: string;
  username?: string;
  password?: string;
  fileUrl?: string;
  filePath?: string;
  fileSize?: number;
  createdAt: any;
};

export default function VaultScreen() {
  const router = useRouter();
  const [items, setItems] = useState<VaultItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<VaultItem | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // New Item State
  const [newType, setNewType] = useState<'note' | 'credential' | 'file'>('note');
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewTitleContent] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const currentUser = auth.currentUser;

  useEffect(() => {
    if (!currentUser) return;

    // Load user profile for subscription/storage info
    const unsubProfile = onSnapshot(doc(db, "users", currentUser.uid), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setUserProfile(data);

        // 🛡️ SECURITY GATE: If user is not subscribed, redirect them out of the vault
        if (data.isSubscribed !== true) {
          router.replace('/subscription');
        }
      }
    });

    const vaultRef = collection(db, "users", currentUser.uid, "vault");
    const q = query(vaultRef, orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const vaultItems = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as VaultItem[];
      setItems(vaultItems);
      setLoading(false);
    });

    return () => {
      unsubProfile();
      unsubscribe();
    };
  }, [currentUser]);

  const handleAddItem = async () => {
    if (!newTitle.trim() || !currentUser) {
      Alert.alert("Required", "Tactical designation required.");
      return;
    }

    setIsProcessing(true);
    try {
      const vaultRef = collection(db, "users", currentUser.uid, "vault");
      await addDoc(vaultRef, {
        type: newType,
        title: newTitle,
        content: newContent || "",
        username: newUsername || "",
        password: newPassword || "",
        createdAt: serverTimestamp(),
      });

      resetAddForm();
      setAddModalVisible(false);
    } catch (error) {
      Alert.alert("Failure", "Could not persist asset.");
    } finally {
      setIsProcessing(false);
    }
  };

  const resetAddForm = () => {
    setNewTitle('');
    setNewTitleContent('');
    setNewUsername('');
    setNewPassword('');
    setNewType('note');
  };

  const handleFileUpload = async (uploadType: 'image' | 'file') => {
    if (!currentUser) return;

    let result;
    try {
      if (uploadType === 'image') {
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.3,
          allowsEditing: true,
        });
      } else {
        result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
      }

      if (!result.canceled && result.assets && result.assets[0]) {
        setIsProcessing(true);
        setUploadProgress(0);
        const asset = result.assets[0];

        const media = await uploadMedia(currentUser.uid, asset.uri, uploadType, setUploadProgress);

        const vaultRef = collection(db, "users", currentUser.uid, "vault");
        await addDoc(vaultRef, {
          type: 'file',
          title: asset.name || `Asset_${Date.now()}`,
          fileUrl: media.url,
          filePath: media.path,
          fileSize: media.size,
          createdAt: serverTimestamp(),
        });
      }
    } catch (error: any) {
      Alert.alert("Upload Failed", error.message || "Handshake interrupted.");
    } finally {
      setIsProcessing(false);
      setUploadProgress(0);
    }
  };

  const handleDelete = async (item: VaultItem) => {
    if (!currentUser) return;

    const performWipe = async () => {
      try {
        if (item.type === 'file' && item.filePath) {
          await deleteMedia(currentUser.uid, item.filePath, item.fileSize || 0);
        }
        await deleteDoc(doc(db, "users", currentUser.uid, "vault", item.id));
      } catch (e) {
        Alert.alert("Error", "Asset destruction failed.");
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm("PERMANENTLY WIPE ASSET?")) performWipe();
    } else {
      Alert.alert("CONFIRM WIPE", "Permanently destroy this encrypted asset?", [
        { text: "CANCEL", style: "cancel" },
        { text: "WIPE", style: "destructive", onPress: performWipe }
      ]);
    }
  };

  const openItem = (item: VaultItem) => {
    setIsDecrypting(true);
    setSelectedItem(item);
    setModalVisible(true);
    setShowPassword(false);
    setTimeout(() => setIsDecrypting(false), 1000);
  };

  const formatStorage = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const renderItem = ({ item }: { item: VaultItem }) => (
    <View style={styles.fileItem}>
      <TouchableOpacity
        style={styles.fileClickArea}
        onPress={() => openItem(item)}
        activeOpacity={0.6}
      >
        {item.type === 'note' && <FileText size={20} color={COLORS.terminal_green} />}
        {item.type === 'credential' && <Key size={20} color={COLORS.alert_amber} />}
        {item.type === 'file' && <ImageIcon size={20} color={COLORS.terminal_green} />}

        <View style={styles.fileInfo}>
          <Text style={styles.fileName}>{item.title}</Text>
          <Text style={styles.fileMeta}>
            {item.type.toUpperCase()} // {item.createdAt?.toDate().toLocaleDateString() || '...'}
          </Text>
        </View>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => handleDelete(item)}
        activeOpacity={0.7}
        style={styles.deleteBtn}
      >
        <Trash2 size={18} color={COLORS.critical_red} />
      </TouchableOpacity>
    </View>
  );

  const storageLimit = userProfile?.isSubscribed ? STORAGE_LIMITS.PREMIUM_GB : STORAGE_LIMITS.NORMAL_GB;
  const storageUsed = userProfile?.storageUsedBytes || 0;
  const storagePercent = Math.min((storageUsed / (storageLimit * 1024 * 1024 * 1024)) * 100, 100);

  if (!userProfile?.isSubscribed && !loading) return null;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeft size={24} color={COLORS.ghost_white} />
        </TouchableOpacity>
        <View style={styles.headerTitleRow}>
          <Crown size={14} color={COLORS.alert_amber} />
          <Text style={styles.headerTitle}>ELITE VAULT</Text>
        </View>
        <TouchableOpacity onPress={() => setAddModalVisible(true)} style={styles.addBtn}>
          <Plus size={24} color={COLORS.terminal_green} />
        </TouchableOpacity>
      </View>

      <View style={styles.storageBarContainer}>
        <View style={styles.storageLabelRow}>
          <Text style={styles.storageLabel}>SECURE STORAGE: {formatStorage(storageUsed)}</Text>
          <Text style={styles.storageLabel}>{storageLimit}GB PREMIUM LIMIT</Text>
        </View>
        <View style={styles.progressBarBg}>
          <View style={[styles.progressBarFill, { width: `${storagePercent}%` }]} />
        </View>
      </View>

      <View style={styles.quickActions}>
        <TouchableOpacity style={styles.actionTab} onPress={() => handleFileUpload('image')}>
          <ImageIcon size={18} color={COLORS.terminal_green} />
          <Text style={styles.actionTabText}>UPLOAD INTEL</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionTab} onPress={() => handleFileUpload('file')}>
          <FileText size={18} color={COLORS.terminal_green} />
          <Text style={styles.actionTabText}>STORE DATA</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={items}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <Lock size={40} color={COLORS.stealth_grey} />
              <Text style={styles.emptyText}>VAULT IS EMPTY</Text>
            </View>
          ) : null
        }
      />

      {/* VIEWER MODAL */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <ShieldCheck size={18} color={COLORS.terminal_green} />
              <Text style={styles.modalTitle}>DECRYPTED ASSET</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} hitSlop={20}>
                <X size={24} color={COLORS.ghost_white} />
              </TouchableOpacity>
            </View>

            {isDecrypting ? (
              <View style={styles.decryptingArea}>
                <ActivityIndicator color={COLORS.terminal_green} size="large" />
                <Text style={styles.decryptingText}>BYPASSING ENCRYPTION LAYERS...</Text>
              </View>
            ) : (
              <ScrollView style={styles.readerScroll}>
                <Text style={styles.label}>ASSET DESIGNATION</Text>
                <Text style={styles.valText}>{selectedItem?.title}</Text>

                {selectedItem?.type === 'credential' && (
                  <View style={styles.credBox}>
                    <Text style={styles.label}>IDENTITY / USERNAME</Text>
                    <Text style={styles.valText}>{selectedItem?.username}</Text>

                    <Text style={[styles.label, {marginTop: 16}]}>SECURE PASSPHRASE</Text>
                    <View style={styles.passRow}>
                      <Text style={styles.valText}>
                        {showPassword ? selectedItem?.password : '••••••••••••'}
                      </Text>
                      <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                        {showPassword ? <EyeOff size={20} color={COLORS.terminal_green} /> : <Eye size={20} color={COLORS.terminal_green} />}
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {selectedItem?.type === 'note' && (
                  <View style={styles.contentBox}>
                    <Text style={styles.label}>CLASSIFIED INTEL</Text>
                    <Text style={styles.contentText}>{selectedItem?.content}</Text>
                  </View>
                )}

                {selectedItem?.type === 'file' && (
                  <View style={styles.contentBox}>
                    <Text style={styles.label}>TACTICAL ASSET</Text>
                    <View style={styles.filePreview}>
                      <ImageIcon size={48} color={COLORS.terminal_green} />
                      <Text style={styles.fileNameText}>{selectedItem?.title}</Text>
                    </View>
                    <TouchableOpacity style={styles.downloadBtn} onPress={() => selectedItem?.fileUrl && window.open(selectedItem.fileUrl, '_blank')}>
                      <Download size={18} color={COLORS.void_black} />
                      <Text style={styles.downloadBtnText}>EXTRACT TO DEVICE</Text>
                    </TouchableOpacity>
                  </View>
                )}

                <Text style={styles.footerText}>// SECURE STREAM TERMINATED //</Text>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* ADD ASSET MODAL */}
      <Modal visible={addModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, {height: '75%'}]}>
            <View style={styles.modalHeader}>
              <Plus size={18} color={COLORS.terminal_green} />
              <Text style={styles.modalTitle}>INITIALIZE ASSET</Text>
              <TouchableOpacity onPress={() => setAddModalVisible(false)}>
                <X size={24} color={COLORS.ghost_white} />
              </TouchableOpacity>
            </View>

            <View style={styles.typeSelector}>
              <TouchableOpacity
                style={[styles.typeTab, newType === 'note' && styles.typeTabActive]}
                onPress={() => setNewType('note')}
              >
                <Text style={[styles.typeTabText, newType === 'note' && styles.typeTabTextActive]}>NOTE</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.typeTab, newType === 'credential' && styles.typeTabActive]}
                onPress={() => setNewType('credential')}
              >
                <Text style={[styles.typeTabText, newType === 'credential' && styles.typeTabTextActive]}>IDENTITY</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.readerScroll}>
              <Text style={styles.label}>ASSET DESIGNATION (TITLE)</Text>
              <TextInput
                style={styles.vaultInput}
                value={newTitle}
                onChangeText={setNewTitle}
                placeholder="e.g. Operation_DeepState"
                placeholderTextColor="#444"
              />

              {newType === 'note' ? (
                <>
                  <Text style={[styles.label, {marginTop: 20}]}>INTEL CONTENT</Text>
                  <TextInput
                    style={[styles.vaultInput, {height: 120, textAlignVertical: 'top'}]}
                    value={newContent}
                    onChangeText={setNewTitleContent}
                    multiline
                    placeholder="Enter classified information..."
                    placeholderTextColor="#444"
                  />
                </>
              ) : (
                <>
                  <Text style={[styles.label, {marginTop: 20}]}>USERNAME / LOGIN ID</Text>
                  <TextInput
                    style={styles.vaultInput}
                    value={newUsername}
                    onChangeText={setNewUsername}
                    autoCapitalize="none"
                  />
                  <Text style={[styles.label, {marginTop: 20}]}>PASSPHRASE</Text>
                  <TextInput
                    style={styles.vaultInput}
                    value={newPassword}
                    onChangeText={setNewPassword}
                    secureTextEntry
                  />
                </>
              )}

              <TouchableOpacity style={styles.saveBtn} onPress={handleAddItem} disabled={isProcessing}>
                {isProcessing ? <ActivityIndicator color={COLORS.void_black} /> : (
                  <>
                    <ShieldCheck size={20} color={COLORS.void_black} />
                    <Text style={styles.saveBtnText}>PERSIST TO VAULT</Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {isProcessing && (
        <View style={styles.processingOverlay}>
          <ActivityIndicator color={COLORS.terminal_green} size="large" />
          <Text style={styles.processingText}>DISPATCHING ASSET: {uploadProgress.toFixed(0)}%</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.void_black },
  header: {
    height: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: COLORS.armour_grey,
  },
  backBtn: { position: 'absolute', left: 16, padding: 10 },
  addBtn: { position: 'absolute', right: 16, padding: 10 },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { color: COLORS.ghost_white, fontSize: 14, fontWeight: '700', fontFamily: 'monospace', letterSpacing: 2 },
  storageBarContainer: { padding: 16, backgroundColor: 'rgba(0,255,65,0.02)', borderBottomWidth: 1, borderBottomColor: COLORS.armour_grey },
  storageLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  storageLabel: { color: COLORS.muted_text, fontSize: 9, fontFamily: 'monospace' },
  progressBarBg: { height: 4, backgroundColor: '#111', borderRadius: 2, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: COLORS.terminal_green },
  quickActions: { flexDirection: 'row', padding: 16, gap: 12 },
  actionTab: { flex: 1, height: 44, backgroundColor: COLORS.gunmetal, borderRadius: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: COLORS.border_subtle },
  actionTabText: { color: COLORS.terminal_green, fontSize: 9, fontWeight: '700', fontFamily: 'monospace' },
  list: { padding: 16 },
  fileItem: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.gunmetal, borderWidth: 1, borderColor: COLORS.border_subtle,
    borderRadius: 2, marginBottom: 12, overflow: 'hidden',
  },
  fileClickArea: { flex: 1, flexDirection: 'row', alignItems: 'center', padding: 16, gap: 16 },
  fileInfo: { flex: 1 },
  fileName: { color: COLORS.ghost_white, fontSize: 13, fontWeight: '600', fontFamily: 'monospace' },
  fileMeta: { color: COLORS.stealth_grey, fontSize: 9, fontFamily: 'monospace', marginTop: 4 },
  deleteBtn: { padding: 16, borderLeftWidth: 1, borderLeftColor: COLORS.border_subtle },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 100, gap: 16 },
  emptyText: { color: COLORS.stealth_grey, fontSize: 12, fontFamily: 'monospace', letterSpacing: 2 },

  processingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 999, alignItems: 'center', justifyContent: 'center', gap: 20 },
  processingText: { color: COLORS.terminal_green, fontSize: 10, fontFamily: 'monospace', letterSpacing: 2 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: COLORS.gunmetal, height: '85%', borderTopLeftRadius: 16, borderTopRightRadius: 16,
    borderTopWidth: 2, borderTopColor: COLORS.terminal_green,
  },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: COLORS.armour_grey },
  modalTitle: { color: COLORS.terminal_green, fontSize: 12, fontWeight: '900', fontFamily: 'monospace', letterSpacing: 2 },
  decryptingArea: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20 },
  decryptingText: { color: COLORS.terminal_green, fontSize: 10, fontFamily: 'monospace' },
  readerScroll: { padding: 24 },
  label: { color: COLORS.terminal_green, fontSize: 9, fontWeight: '700', fontFamily: 'monospace', marginBottom: 8 },
  valText: { color: COLORS.ghost_white, fontSize: 16, fontWeight: '700', fontFamily: 'monospace', marginBottom: 24 },
  passRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  credBox: { backgroundColor: 'rgba(0,0,0,0.2)', padding: 16, borderRadius: 4 },
  contentBox: { backgroundColor: 'rgba(0,0,0,0.2)', padding: 16, borderRadius: 4 },
  filePreview: { alignItems: 'center', padding: 30, gap: 16 },
  fileNameText: { color: COLORS.ghost_white, fontSize: 12, fontFamily: 'monospace' },
  contentText: { color: COLORS.ghost_white, fontSize: 14, fontFamily: 'monospace', lineHeight: 22 },
  downloadBtn: { height: 50, backgroundColor: COLORS.terminal_green, borderRadius: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 20 },
  downloadBtnText: { color: COLORS.void_black, fontWeight: '900', fontSize: 12, fontFamily: 'monospace' },
  footerText: { color: COLORS.stealth_grey, fontSize: 8, fontFamily: 'monospace', textAlign: 'center', marginTop: 40, marginBottom: 40 },

  typeSelector: { flexDirection: 'row', padding: 20, gap: 10 },
  typeTab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border_subtle },
  typeTabActive: { backgroundColor: 'rgba(0,255,65,0.1)', borderColor: COLORS.terminal_green },
  typeTabText: { color: COLORS.muted_text, fontSize: 10, fontWeight: '700', fontFamily: 'monospace' },
  typeTabTextActive: { color: COLORS.terminal_green },
  vaultInput: { backgroundColor: COLORS.void_black, borderWidth: 1, borderColor: COLORS.border_subtle, padding: 14, color: COLORS.ghost_white, fontFamily: 'monospace', fontSize: 14, borderRadius: 2 },
  saveBtn: { height: 56, backgroundColor: COLORS.terminal_green, borderRadius: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 32, borderLeftWidth: 4, borderLeftColor: COLORS.ghost_white },
  saveBtnText: { color: COLORS.void_black, fontWeight: '900', fontSize: 14, fontFamily: 'monospace' },
});
