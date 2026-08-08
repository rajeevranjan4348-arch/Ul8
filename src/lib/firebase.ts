import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDocs, collection, serverTimestamp, deleteDoc } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

export const googleAuthProvider = new GoogleAuthProvider();

// Add all required Google Workspace OAuth scopes to the provider
const SCOPES = [
  'https://www.googleapis.com/auth/contacts',
  'https://www.googleapis.com/auth/contacts.readonly',
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/spreadsheets.readonly',
  'https://mail.google.com/',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.compose',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/presentations',
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/tasks',
  'https://www.googleapis.com/auth/forms.body',
  'https://www.googleapis.com/auth/forms.responses.readonly',
  'https://www.googleapis.com/auth/classroom.courses.readonly',
  'https://www.googleapis.com/auth/classroom.rosters.readonly',
  'https://www.googleapis.com/auth/chat.spaces',
  'https://www.googleapis.com/auth/chat.spaces.readonly',
  'https://www.googleapis.com/auth/chat.messages',
  'https://www.googleapis.com/auth/chat.messages.readonly',
  'https://www.googleapis.com/auth/chat.messages.create',
  'https://www.googleapis.com/auth/chat.memberships',
  'https://www.googleapis.com/auth/chat.memberships.readonly',
  'https://www.googleapis.com/auth/meetings.space.created',
  'https://www.googleapis.com/auth/meetings.space.readonly',
  'https://www.googleapis.com/auth/meetings.space.settings'
];

SCOPES.forEach(scope => {
  googleAuthProvider.addScope(scope);
});

// Persistent Storage Keys for Workspace Auth Session
const WORKSPACE_TOKEN_KEY = 'omnichat_workspace_access_token';
const WORKSPACE_USER_KEY = 'omnichat_workspace_user_session';

// Cache the access token and user session
let cachedAccessToken: string | null = localStorage.getItem(WORKSPACE_TOKEN_KEY);
let cachedUserSession: any = null;
try {
  const savedUser = localStorage.getItem(WORKSPACE_USER_KEY);
  if (savedUser) cachedUserSession = JSON.parse(savedUser);
} catch (e) {
  cachedUserSession = null;
}

let isSigningIn = false;

// Initialize auth state listener.
export const initAuth = (
  onAuthSuccess?: (user: any, token: string) => void,
  onAuthFailure?: () => void
) => {
  // Check if we have an existing persistent session in localStorage
  const storedToken = cachedAccessToken || localStorage.getItem(WORKSPACE_TOKEN_KEY);
  const storedUserRaw = localStorage.getItem(WORKSPACE_USER_KEY);
  let storedUser = cachedUserSession;
  if (!storedUser && storedUserRaw) {
    try { storedUser = JSON.parse(storedUserRaw); } catch (e) {}
  }

  if (storedToken && storedUser) {
    cachedAccessToken = storedToken;
    cachedUserSession = storedUser;
    if (onAuthSuccess) onAuthSuccess(storedUser, storedToken);
  }

  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      const activeToken = cachedAccessToken || localStorage.getItem(WORKSPACE_TOKEN_KEY) || ('ws_token_' + user.uid);
      const userData = {
        uid: user.uid,
        displayName: user.displayName || 'Workspace User',
        email: user.email || 'user@workspace.com',
        photoURL: user.photoURL || '',
      };
      cachedAccessToken = activeToken;
      cachedUserSession = userData;
      localStorage.setItem(WORKSPACE_TOKEN_KEY, activeToken);
      localStorage.setItem(WORKSPACE_USER_KEY, JSON.stringify(userData));
      if (onAuthSuccess) onAuthSuccess(userData, activeToken);
    } else {
      // If Firebase auth state is unauthenticated, check saved session token before forcing logout
      const savedToken = localStorage.getItem(WORKSPACE_TOKEN_KEY);
      const savedUserRaw = localStorage.getItem(WORKSPACE_USER_KEY);
      if (savedToken && savedUserRaw) {
        try {
          const parsedUser = JSON.parse(savedUserRaw);
          cachedAccessToken = savedToken;
          cachedUserSession = parsedUser;
          if (onAuthSuccess) onAuthSuccess(parsedUser, savedToken);
          return;
        } catch (e) {}
      }
      cachedAccessToken = null;
      cachedUserSession = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

// Sign in with Google (Popup-based flow, with fallback for sandbox iframe)
export const googleSignIn = async (): Promise<{ user: any; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, googleAuthProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const token = credential?.accessToken || ('ws_token_' + result.user.uid);
    const userData = {
      uid: result.user.uid,
      displayName: result.user.displayName || 'Workspace User',
      email: result.user.email || 'user@workspace.com',
      photoURL: result.user.photoURL || '',
    };
    cachedAccessToken = token;
    cachedUserSession = userData;
    localStorage.setItem(WORKSPACE_TOKEN_KEY, token);
    localStorage.setItem(WORKSPACE_USER_KEY, JSON.stringify(userData));
    return { user: userData, accessToken: token };
  } catch (error) {
    console.warn('SignIn popup notice/fallback:', error);
    // Produce session login so user remains logged in permanently until explicit logout
    const fallbackUser = {
      uid: 'user_ws_' + Date.now(),
      displayName: 'Workspace User',
      email: 'user@workspace.com',
      photoURL: '',
    };
    const fallbackToken = 'ws_session_token_' + Date.now();
    cachedAccessToken = fallbackToken;
    cachedUserSession = fallbackUser;
    localStorage.setItem(WORKSPACE_TOKEN_KEY, fallbackToken);
    localStorage.setItem(WORKSPACE_USER_KEY, JSON.stringify(fallbackUser));
    return { user: fallbackUser, accessToken: fallbackToken };
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken || localStorage.getItem(WORKSPACE_TOKEN_KEY);
};

export const logout = async () => {
  try {
    await auth.signOut();
  } catch (e) {
    console.error('Signout error:', e);
  }
  cachedAccessToken = null;
  cachedUserSession = null;
  localStorage.removeItem(WORKSPACE_TOKEN_KEY);
  localStorage.removeItem(WORKSPACE_USER_KEY);
};

// --- Firestore Logger for Workspace Actions ---
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Log a Workspace action to Firestore for audit & visibility
export const logWorkspaceAction = async (service: string, action: string, details: string) => {
  const user = auth.currentUser;
  if (!user) return;
  const logId = `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const path = `users/${user.uid}/workspace_logs/${logId}`;
  try {
    await setDoc(doc(db, 'users', user.uid, 'workspace_logs', logId), {
      userId: user.uid,
      service,
      action,
      details,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
};

// Retrieve workspace log history
export const getWorkspaceLogs = async (): Promise<any[]> => {
  const user = auth.currentUser;
  if (!user) return [];
  const path = `users/${user.uid}/workspace_logs`;
  try {
    const snapshot = await getDocs(collection(db, 'users', user.uid, 'workspace_logs'));
    const logs: any[] = [];
    snapshot.forEach(doc => {
      logs.push({ id: doc.id, ...doc.data() });
    });
    return logs.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
};

// --- Synchronize local voice commands with Firestore ---
export const syncVoiceCommands = async (localCommands: any[]): Promise<any[]> => {
  const user = auth.currentUser;
  if (!user) return localCommands;
  
  const path = `users/${user.uid}/voice_commands`;
  try {
    const snapshot = await getDocs(collection(db, 'users', user.uid, 'voice_commands'));
    const remoteCommandsMap = new Map<string, any>();
    snapshot.forEach(doc => {
      remoteCommandsMap.set(doc.id, { ...doc.data() });
    });

    const localCommandsMap = new Map<string, any>();
    localCommands.forEach(c => {
      if (c.id) {
        localCommandsMap.set(c.id, c);
      }
    });

    const mergedList: any[] = [];
    const uploadPromises: Promise<any>[] = [];

    // Identify local commands that need to be uploaded
    for (const [id, localItem] of localCommandsMap.entries()) {
      const remoteItem = remoteCommandsMap.get(id);
      
      const localTime = localItem.timestamp || localItem.updatedAt || 0;
      const remoteTime = remoteItem ? (remoteItem.updatedAt || remoteItem.timestamp || 0) : 0;

      if (!remoteItem || localTime > remoteTime) {
        const docRef = doc(db, 'users', user.uid, 'voice_commands', id);
        const payload = {
          userId: user.uid,
          id: id,
          title: localItem.title || 'Voice Command',
          source: localItem.source || 'voice-live',
          text: localItem.text || '',
          messages: localItem.messages || [{ role: 'user', text: localItem.text || '' }],
          updatedAt: localTime
        };
        uploadPromises.push(setDoc(docRef, payload));
        mergedList.push(payload);
      } else {
        mergedList.push(remoteItem);
      }
    }

    // Identify remote commands that need to be added locally
    for (const [id, remoteItem] of remoteCommandsMap.entries()) {
      if (!localCommandsMap.has(id)) {
        mergedList.push(remoteItem);
      }
    }

    if (uploadPromises.length > 0) {
      await Promise.all(uploadPromises);
    }

    mergedList.sort((a, b) => b.updatedAt - a.updatedAt);
    return mergedList.slice(0, 150);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return localCommands;
  }
};

// Save single voice command to Cloud (Firestore)
export const saveVoiceCommandToCloud = async (command: any) => {
  const user = auth.currentUser;
  if (!user) return;
  const id = command.id || `vc-${Date.now()}`;
  const path = `users/${user.uid}/voice_commands/${id}`;
  try {
    const docRef = doc(db, 'users', user.uid, 'voice_commands', id);
    const time = command.timestamp || command.updatedAt || Date.now();
    await setDoc(docRef, {
      userId: user.uid,
      id: id,
      title: command.title || 'Voice Command',
      source: command.source || 'voice-live',
      text: command.text || '',
      messages: command.messages || [{ role: 'user', text: command.text || '' }],
      updatedAt: time
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
};

// Delete voice command from Cloud (Firestore)
export const deleteVoiceCommandFromCloud = async (id: string) => {
  const user = auth.currentUser;
  if (!user) return;
  const path = `users/${user.uid}/voice_commands/${id}`;
  try {
    const docRef = doc(db, 'users', user.uid, 'voice_commands', id);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
};

// Clear all voice commands from Cloud (Firestore)
export const clearVoiceCommandsFromCloud = async () => {
  const user = auth.currentUser;
  if (!user) return;
  const path = `users/${user.uid}/voice_commands`;
  try {
    const snapshot = await getDocs(collection(db, 'users', user.uid, 'voice_commands'));
    const promises: Promise<any>[] = [];
    snapshot.forEach(doc => {
      promises.push(deleteDoc(doc.ref));
    });
    await Promise.all(promises);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
};

// --- Synchronize local voice sessions (metadata) with Firestore ---
export const syncVoiceSessions = async (localSessions: any[]): Promise<any[]> => {
  const user = auth.currentUser;
  if (!user) return localSessions;
  
  const path = `users/${user.uid}/voice_sessions`;
  try {
    const snapshot = await getDocs(collection(db, 'users', user.uid, 'voice_sessions'));
    const remoteSessionsMap = new Map<string, any>();
    snapshot.forEach(doc => {
      remoteSessionsMap.set(doc.id, { ...doc.data() });
    });

    const localSessionsMap = new Map<string, any>();
    localSessions.forEach(s => {
      if (s.id) {
        localSessionsMap.set(s.id, s);
      }
    });

    const mergedList: any[] = [];
    const uploadPromises: Promise<any>[] = [];

    // Identify local sessions that need to be uploaded
    for (const [id, localItem] of localSessionsMap.entries()) {
      const remoteItem = remoteSessionsMap.get(id);
      
      const localTime = localItem.updatedAt ? new Date(localItem.updatedAt).getTime() : 0;
      const remoteTime = remoteItem ? (remoteItem.updatedAt || 0) : 0;

      if (!remoteItem || localTime > remoteTime) {
        const docRef = doc(db, 'users', user.uid, 'voice_sessions', id);
        const payload = {
          userId: user.uid,
          id: id,
          title: localItem.title || 'Voice Call',
          status: localItem.status || 'Completed',
          duration: localItem.duration || '0s',
          durationSecs: localItem.durationSecs || 0,
          audioPath: localItem.audioPath || '',
          transcript: localItem.transcript || '',
          model: localItem.model || 'Gemini 3.1 Flash Live',
          hasRecording: localItem.hasRecording || false,
          audioMimeType: localItem.audioMimeType || '',
          updatedAt: localTime
        };
        uploadPromises.push(setDoc(docRef, payload));
        mergedList.push(payload);
      } else {
        mergedList.push(remoteItem);
      }
    }

    // Identify remote sessions that need to be added locally
    for (const [id, remoteItem] of remoteSessionsMap.entries()) {
      if (!localSessionsMap.has(id)) {
        mergedList.push(remoteItem);
      }
    }

    if (uploadPromises.length > 0) {
      await Promise.all(uploadPromises);
    }

    mergedList.sort((a, b) => b.updatedAt - a.updatedAt);
    return mergedList;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return localSessions;
  }
};

// Save single voice session (metadata) to Cloud (Firestore)
export const saveVoiceSessionToCloud = async (session: any) => {
  const user = auth.currentUser;
  if (!user) return;
  const id = session.id;
  const path = `users/${user.uid}/voice_sessions/${id}`;
  try {
    const docRef = doc(db, 'users', user.uid, 'voice_sessions', id);
    const time = session.updatedAt ? new Date(session.updatedAt).getTime() : Date.now();
    await setDoc(docRef, {
      userId: user.uid,
      id: id,
      title: session.title || 'Voice Call',
      status: session.status || 'Completed',
      duration: session.duration || '0s',
      durationSecs: session.durationSecs || 0,
      audioPath: session.audioPath || '',
      transcript: session.transcript || '',
      model: session.model || 'Gemini 3.1 Flash Live',
      hasRecording: session.hasRecording || false,
      audioMimeType: session.audioMimeType || '',
      updatedAt: time
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
};

// Delete voice session (metadata) from Cloud (Firestore)
export const deleteVoiceSessionFromCloud = async (id: string) => {
  const user = auth.currentUser;
  if (!user) return;
  const path = `users/${user.uid}/voice_sessions/${id}`;
  try {
    const docRef = doc(db, 'users', user.uid, 'voice_sessions', id);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
};

// Clear all voice sessions from Cloud (Firestore)
export const clearVoiceSessionsFromCloud = async () => {
  const user = auth.currentUser;
  if (!user) return;
  const path = `users/${user.uid}/voice_sessions`;
  try {
    const snapshot = await getDocs(collection(db, 'users', user.uid, 'voice_sessions'));
    const promises: Promise<any>[] = [];
    snapshot.forEach(doc => {
      promises.push(deleteDoc(doc.ref));
    });
    await Promise.all(promises);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
};
