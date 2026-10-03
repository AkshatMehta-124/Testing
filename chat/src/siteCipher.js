// apps/chat/src/siteCipher.js

const SITE_ORIGIN = "https://aksh-studio.github.io";
const INTERNAL_SALT = "aksh_chat_vault_2026_xK9";
const PAYLOAD_PREFIX = "enc:v1:";

function createKeyStream(keyStr) {
  const S = new Uint8Array(256);
  for (let i = 0; i < 256; i++) {
    S[i] = i;
  }

  let j = 0;
  for (let i = 0; i < 256; i++) {
    j = (j + S[i] + keyStr.charCodeAt(i % keyStr.length)) % 256;
    const temp = S[i];
    S[i] = S[j];
    S[j] = temp;
  }
  return S;
}

function transformBytes(bytes, keyStr) {
  const S = createKeyStream(keyStr);
  const result = new Uint8Array(bytes.length);
  let i = 0, j = 0;

  for (let k = 0; k < bytes.length; k++) {
    i = (i + 1) % 256;
    j = (j + S[i]) % 256;

    const temp = S[i];
    S[i] = S[j];
    S[j] = temp;

    const K = S[(S[i] + S[j]) % 256];
    result[k] = bytes[k] ^ K;
  }
  return result;
}

function getSiteKey() {
  const origin = (typeof window !== "undefined" && window.location.origin.includes("aksh-studio.github.io"))
    ? window.location.origin
    : SITE_ORIGIN;
  return origin + "::" + INTERNAL_SALT;
}

/**
 * Encrypts plain message into a scrambled Base64 string prefixed with enc:v1:
 */
export function encryptMessage(plainText) {
  if (!plainText) return "";
  const key = getSiteKey();
  const encoder = new TextEncoder();
  const textBytes = encoder.encode(plainText);
  const cipherBytes = transformBytes(textBytes, key);

  let binary = "";
  for (let i = 0; i < cipherBytes.length; i++) {
    binary += String.fromCharCode(cipherBytes[i]);
  }
  return PAYLOAD_PREFIX + btoa(binary);
}

/**
 * Decrypts scrambled Base64 string back into readable message.
 * Safely falls back to returning the raw string if it was sent prior to encryption.
 */
export function decryptMessage(encryptedPayload) {
  if (!encryptedPayload) return "";

  // 1. If message doesn't have the prefix, treat it as legacy plain text
  if (!encryptedPayload.startsWith(PAYLOAD_PREFIX)) {
    return encryptedPayload;
  }

  try {
    const rawBase64 = encryptedPayload.slice(PAYLOAD_PREFIX.length);
    const key = getSiteKey();
    const binary = atob(rawBase64);
    const cipherBytes = new Uint8Array(binary.length);

    for (let i = 0; i < binary.length; i++) {
      cipherBytes[i] = binary.charCodeAt(i);
    }

    const plainBytes = transformBytes(cipherBytes, key);
    return new TextDecoder().decode(plainBytes);
  } catch (err) {
    // Fallback if parsing fails
    return encryptedPayload;
  }
}
