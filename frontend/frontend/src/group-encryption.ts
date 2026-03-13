import nacl from 'tweetnacl';
import naclUtil from 'tweetnacl-util';
import { apiCall } from './api';
import { getOrCreateKeyPair, encryptMessage, decryptMessage } from './encryption';

/**
 * Generate a random symmetric group key
 */
export function generateGroupKey(): string {
  const key = nacl.randomBytes(32);
  return naclUtil.encodeBase64(key);
}

/**
 * Encrypt the group key for each participant using their public key
 */
export async function distributeGroupKey(
  conversationId: string,
  participantIds: string[],
  groupKey: string
): Promise<void> {
  const myKeyPair = await getOrCreateKeyPair();
  const encryptedKeys: Record<string, string> = {};

  for (const pid of participantIds) {
    try {
      const keyData = await apiCall(`/keys/${pid}`);
      if (keyData.public_key) {
        const encrypted = encryptMessage(groupKey, keyData.public_key, myKeyPair.secretKey);
        encryptedKeys[pid] = JSON.stringify(encrypted);
      }
    } catch {
      console.log(`[GroupEncryption] Couldn't get key for ${pid}`);
    }
  }

  await apiCall('/groups/distribute-key', {
    method: 'POST',
    body: JSON.stringify({
      conversation_id: conversationId,
      encrypted_keys: encryptedKeys,
    }),
  });
}

/**
 * Retrieve and decrypt my group key for a conversation
 */
export async function getMyGroupKey(conversationId: string): Promise<string | null> {
  try {
    const myKeyPair = await getOrCreateKeyPair();
    const data = await apiCall(`/groups/${conversationId}/key`);

    if (data.encrypted_key) {
      const payload = JSON.parse(data.encrypted_key);
      return decryptMessage(payload, myKeyPair.secretKey);
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Encrypt a message with the group key (symmetric)
 */
export function encryptGroupMessage(plaintext: string, groupKey: string): string {
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
  const key = naclUtil.decodeBase64(groupKey);
  const messageBytes = naclUtil.decodeUTF8(plaintext);

  const encrypted = nacl.secretbox(messageBytes, nonce, key);
  return JSON.stringify({
    ct: naclUtil.encodeBase64(encrypted),
    n: naclUtil.encodeBase64(nonce),
  });
}

/**
 * Decrypt a message with the group key (symmetric)
 */
export function decryptGroupMessage(ciphertext: string, groupKey: string): string {
  const { ct, n } = JSON.parse(ciphertext);
  const encrypted = naclUtil.decodeBase64(ct);
  const nonce = naclUtil.decodeBase64(n);
  const key = naclUtil.decodeBase64(groupKey);

  const decrypted = nacl.secretbox.open(encrypted, nonce, key);
  if (!decrypted) throw new Error('Group decryption failed');

  return naclUtil.encodeUTF8(decrypted);
}
