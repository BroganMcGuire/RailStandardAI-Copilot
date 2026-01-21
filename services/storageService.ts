
import { RailDocument, ChatMessage } from '../types';

const DB_NAME = 'RailStandardsDB';
const DOC_STORE = 'documents';
const CHAT_STORE = 'chat_history';
const DB_VERSION = 2; // Incremented for new store

export async function initDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      if (!db.objectStoreNames.contains(DOC_STORE)) {
        db.createObjectStore(DOC_STORE, { keyPath: 'id' });
      }
      
      if (!db.objectStoreNames.contains(CHAT_STORE)) {
        db.createObjectStore(CHAT_STORE, { keyPath: 'id' });
      }
    };
  });
}

// --- Document Storage ---
export async function saveDocument(doc: RailDocument): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(DOC_STORE, 'readwrite');
    const store = transaction.objectStore(DOC_STORE);
    const request = store.put(doc);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getAllDocuments(): Promise<RailDocument[]> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(DOC_STORE, 'readonly');
    const store = transaction.objectStore(DOC_STORE);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function deleteDocument(id: string): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(DOC_STORE, 'readwrite');
    const store = transaction.objectStore(DOC_STORE);
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// --- Chat History Storage ---
export async function saveChatMessage(message: ChatMessage): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(CHAT_STORE, 'readwrite');
    const store = transaction.objectStore(CHAT_STORE);
    const request = store.put(message);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getChatHistory(): Promise<ChatMessage[]> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(CHAT_STORE, 'readonly');
    const store = transaction.objectStore(CHAT_STORE);
    const request = store.getAll();
    request.onsuccess = () => {
      const history = request.result as ChatMessage[];
      // Sort by timestamp just in case
      history.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      resolve(history);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function clearChatHistory(): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(CHAT_STORE, 'readwrite');
    const store = transaction.objectStore(CHAT_STORE);
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
