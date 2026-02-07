
import { HistoryItem } from "../types";
import { rtdb, auth } from "./firebase";
import { ref, push, set, get, query, orderByChild, limitToLast } from "firebase/database";

const STORAGE_KEY = 'promptforge_history';

export const saveToHistory = async (
  item: Omit<HistoryItem, 'id' | 'timestamp' | 'userName' | 'videoUrl'>,
  videoBase64?: string
): Promise<HistoryItem> => {
  const user = auth.currentUser;
  const timestamp = Date.now();
  const userName = user?.displayName || user?.email?.split('@')[0] || 'Anonymous';
  
  // Create the item structure
  const newItem: HistoryItem = {
    ...item,
    id: '', // Will be set below
    timestamp,
    userName,
    videoUrl: videoBase64 ? "base64_ref" : "no_video"
  };

  // 1. Local storage fallback (Prepend for immediate UI update)
  const localHistory = getLocalHistory();
  const tempId = Math.random().toString(36).substr(2, 9);
  newItem.id = tempId;
  localStorage.setItem(STORAGE_KEY, JSON.stringify([newItem, ...localHistory].slice(0, 30)));

  // 2. Realtime Database Sync
  if (user) {
    try {
      const historyRef = ref(rtdb, `users/${user.uid}/history`);
      const newHistoryRef = push(historyRef);
      const finalId = newHistoryRef.key || tempId;
      
      const dbItem = { ...newItem, id: finalId };
      await set(newHistoryRef, dbItem);
      
      // Update local storage with the real ID if it changed
      const updatedLocal = getLocalHistory();
      if (updatedLocal.length > 0 && updatedLocal[0].id === tempId) {
        updatedLocal[0].id = finalId;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedLocal));
      }

      // Ensure profile exists/is updated
      const profileRef = ref(rtdb, `users/${user.uid}/profile`);
      const profileSnap = await get(profileRef);
      const existingProfile = profileSnap.exists() ? profileSnap.val() : {};
      
      await set(profileRef, {
        ...existingProfile,
        name: userName,
        email: user.email,
        lastLogin: timestamp
      });

      newItem.id = finalId;
    } catch (e) {
      console.error("Database sync failed, relying on local history:", e);
    }
  }

  return newItem;
};

const getLocalHistory = (): HistoryItem[] => {
  const data = localStorage.getItem(STORAGE_KEY);
  if (!data) return [];
  try {
    return JSON.parse(data);
  } catch (e) {
    return [];
  }
};

export const getHistory = async (): Promise<HistoryItem[]> => {
  const user = auth.currentUser;
  
  if (user) {
    try {
      const historyRef = ref(rtdb, `users/${user.uid}/history`);
      // Get last 30 items
      const historyQuery = query(historyRef, orderByChild("timestamp"), limitToLast(30));
      const snapshot = await get(historyQuery);
      
      if (snapshot.exists()) {
        const data = snapshot.val();
        // Convert object to sorted array (Newest first)
        const items = Object.values(data) as HistoryItem[];
        return items.sort((a, b) => b.timestamp - a.timestamp);
      }
    } catch (e) {
      console.error("Failed to fetch cloud history:", e);
    }
  }
  
  return getLocalHistory();
};

export const clearHistory = () => {
  localStorage.removeItem(STORAGE_KEY);
};
