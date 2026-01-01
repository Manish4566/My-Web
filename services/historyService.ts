
import { HistoryItem } from "../types";
import { rtdb, auth } from "./firebase";
import { ref, push, set, get, query, orderByChild, limitToLast } from "firebase/database";

const STORAGE_KEY = 'promptforge_history';

export const saveToHistory = async (
  item: Omit<HistoryItem, 'id' | 'timestamp' | 'userName' | 'videoUrl'>,
  videoBase64?: string
): Promise<HistoryItem> => {
  const user = auth.currentUser;
  
  const newItem: HistoryItem = {
    ...item,
    id: Math.random().toString(36).substr(2, 9),
    timestamp: Date.now(),
    userName: user?.displayName || user?.email?.split('@')[0] || 'Anonymous',
    // Storing a simple URL reference for the database
    videoUrl: videoBase64 ? "https://storage.placeholder.com/video_ref" : "no_video_reference"
  };

  // Local storage fallback
  const localHistory = getLocalHistory();
  localStorage.setItem(STORAGE_KEY, JSON.stringify([newItem, ...localHistory].slice(0, 20)));

  // Realtime Database Sync
  if (user) {
    try {
      const historyRef = ref(rtdb, `users/${user.uid}/history`);
      const newHistoryRef = push(historyRef);
      await set(newHistoryRef, newItem);
      
      // Also update user profile in RTDB to ensure it appears in the Data tab
      const profileRef = ref(rtdb, `users/${user.uid}/profile`);
      await set(profileRef, {
        name: user.displayName || 'Anonymous',
        email: user.email,
        lastLogin: Date.now()
      });

      console.log("Synced to Realtime Database for user:", user.displayName);
    } catch (e) {
      console.error("RTDB sync failed:", e);
    }
  }

  return newItem;
};

const getLocalHistory = (): HistoryItem[] => {
  const data = localStorage.getItem(STORAGE_KEY);
  return data ? JSON.parse(data) : [];
};

export const getHistory = async (): Promise<HistoryItem[]> => {
  const user = auth.currentUser;
  
  if (user) {
    try {
      const historyRef = ref(rtdb, `users/${user.uid}/history`);
      const historyQuery = query(historyRef, orderByChild("timestamp"), limitToLast(20));
      const snapshot = await get(historyQuery);
      
      if (snapshot.exists()) {
        const data = snapshot.val();
        // Convert object to sorted array
        return Object.values(data).sort((a: any, b: any) => b.timestamp - a.timestamp) as HistoryItem[];
      }
      return getLocalHistory();
    } catch (e) {
      console.error("Failed to fetch RTDB history:", e);
      return getLocalHistory();
    }
  }
  
  return getLocalHistory();
};

export const clearHistory = () => {
  localStorage.removeItem(STORAGE_KEY);
};
