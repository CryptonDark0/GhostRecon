import nacl from 'tweetnacl';
import naclUtil from 'tweetnacl-util';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_PAIR_STORAGE = 'ghostrecon_keypair';

export interface KeyPair {
  publicKey: string;
  secretKey: string;
}

export interface EncryptedPayload {
  ciphertext: string;
  nonce: string;
  senderPublicKey: string;
}

// Generate or retrieve stored X25519 key pair
export async function getOrCreateKeyPair(): Promise<KeyPair> {
  const stored = await AsyncStorage.getItem(KEY_PAIR_STORAGE);
  if (stored) {
    return JSON.parse(stored);
  }
  const kp = nacl.box.keyPair();
  const pair: KeyPair = {
    publicKey: naclUtil.encodeBase64(kp.publicKey),
    secretKey: naclUtil.encodeBase64(kp.secretKey),
  };
  await AsyncStorage.setItem(KEY_PAIR_STORAGE, JSON.stringify(pair));
  return pair;
}

// Rotate keys (generate new pair, destroy old)
export async function rotateKeyPair(): Promise<KeyPair> {
  await AsyncStorage.removeItem(KEY_PAIR_STORAGE);
  return getOrCreateKeyPair();
}

// Encrypt a message for a recipient
export function encryptMessage(
  plaintext: string,
  recipientPublicKey: string,
  senderSecretKey: string
): EncryptedPayload {
  const nonce = nacl.randomBytes(nacl.box.nonceLength);
  const messageBytes = naclUtil.decodeUTF8(plaintext);
  const recipientPk = naclUtil.decodeBase64(recipientPublicKey);
  const senderSk = naclUtil.decodeBase64(senderSecretKey);

  const encrypted = nacl.box(messageBytes, nonce, recipientPk, senderSk);
  if (!encrypted) throw new Error('Encryption failed');

  const senderKp = nacl.box.keyPair.fromSecretKey(senderSk);

  return {
    ciphertext: naclUtil.encodeBase64(encrypted),
    nonce: naclUtil.encodeBase64(nonce),
    senderPublicKey: naclUtil.encodeBase64(senderKp.publicKey),
  };
}

// Decrypt a message from a sender
export function decryptMessage(
  payload: EncryptedPayload,
  recipientSecretKey: string
): string {
  const ciphertext = naclUtil.decodeBase64(payload.ciphertext);
  const nonce = naclUtil.decodeBase64(payload.nonce);
  const senderPk = naclUtil.decodeBase64(payload.senderPublicKey);
  const recipientSk = naclUtil.decodeBase64(recipientSecretKey);

  const decrypted = nacl.box.open(ciphertext, nonce, senderPk, recipientSk);
  if (!decrypted) throw new Error('Decryption failed - invalid key or corrupted message');

  return naclUtil.encodeUTF8(decrypted);
}

// Generate a shared secret for a conversation (Diffie-Hellman)
export function deriveSharedKey(
  theirPublicKey: string,
  mySecretKey: string
): string {
  const theirPk = naclUtil.decodeBase64(theirPublicKey);
  const mySk = naclUtil.decodeBase64(mySecretKey);
  const shared = nacl.box.before(theirPk, mySk);
  return naclUtil.encodeBase64(shared);
}

// Encrypt with shared key (faster for ongoing conversations)
export function encryptWithShared(
  plaintext: string,
  sharedKey: string
): { ciphertext: string; nonce: string } {
  const nonce = nacl.randomBytes(nacl.box.nonceLength);
  const messageBytes = naclUtil.decodeUTF8(plaintext);
  const key = naclUtil.decodeBase64(sharedKey);

  const encrypted = nacl.box.after(messageBytes, nonce, key);
  if (!encrypted) throw new Error('Encryption failed');

  return {
    ciphertext: naclUtil.encodeBase64(encrypted),
    nonce: naclUtil.encodeBase64(nonce),
  };
}

// Decrypt with shared key
export function decryptWithShared(
  ciphertext: string,
  nonce: string,
  sharedKey: string
): string {
  const ct = naclUtil.decodeBase64(ciphertext);
  const n = naclUtil.decodeBase64(nonce);
  const key = naclUtil.decodeBase64(sharedKey);

  const decrypted = nacl.box.open.after(ct, n, key);
  if (!decrypted) throw new Error('Decryption failed');

  return naclUtil.encodeUTF8(decrypted);
}

// Get public key fingerprint (for verification)
export function getKeyFingerprint(publicKey: string): string {
  const bytes = naclUtil.decodeBase64(publicKey);
  const hash = nacl.hash(bytes);
  return naclUtil.encodeBase64(hash).slice(0, 32);
}
