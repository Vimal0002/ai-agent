"use client";

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import {
  getAuth, onAuthStateChanged, GoogleAuthProvider,
  signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut,
  Auth, User
} from "firebase/auth";
import { initializeApp } from "firebase/app";
import {
  getFirestore, onSnapshot, collection, addDoc, query, orderBy, getDoc, doc, setDoc, Firestore
} from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

export default function Home() {
  const appId = "ai-agent-cca27";

  const [userId, setUserId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Array<{
    id: string;
    text: string;
    from: 'user' | 'ai';
    timestamp: number;
  }>>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [loading, setLoading] = useState(false);
  const [auth, setAuth] = useState<Auth | null>(null);
  const [db, setDb] = useState<Firestore | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'offline'>('connecting');
  const [isTyping, setIsTyping] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [chatSettings, setChatSettings] = useState({ 
    fontSize: 'medium', 
    showTimestamps: true, 
    soundEnabled: true,
    autoScroll: true 
  });
  const [filteredMessages, setFilteredMessages] = useState<typeof messages>([]);
  const [notification, setNotification] = useState<{text: string, type: 'success'|'error'|'info'} | null>(null);
  const [showConsentScreen, setShowConsentScreen] = useState(false);
  const [pendingUser, setPendingUser] = useState<User | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const app = initializeApp(firebaseConfig);
      const authInstance = getAuth(app);
      const dbInstance = getFirestore(app);
      
      // Only initialize analytics if measurement ID is provided and not a placeholder
      if (firebaseConfig.measurementId && firebaseConfig.measurementId !== 'G-XXXXXXXXXX') {
        getAnalytics(app);
      }

      setAuth(authInstance);
      setDb(dbInstance);
      setConnectionStatus('connected');

      const unsubscribeAuth = onAuthStateChanged(authInstance, async (user: User | null) => {
        if (user) {
          setUserId(user.uid);
        } else {
          setUserId(null);
        }
      });

      return () => unsubscribeAuth();
    } catch (e) {
      console.error("Firebase initialization failed:", e);
      setConnectionStatus('offline');
      alert('Failed to connect to Firebase. Some features may not work properly.');
    }
  }, []);

  // Auto-scroll to bottom when new messages arrive
  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      
      // Don't close if clicking on the dropdown buttons or their children
      if (!target.closest('.dropdown-container') && !target.closest('.emoji-container')) {
        setShowMoreMenu(false);
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Format timestamp
  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  };

  // Copy message to clipboard
  const copyMessage = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      alert('Message copied to clipboard!');
    } catch (error) {
      console.error('Failed to copy message:', error);
    }
  };

  // Clear chat history
  const clearChat = () => {
    if (confirm('Are you sure you want to clear all messages?')) {
      setMessages([]);
    }
  };

  // Export chat history
  const exportChat = () => {
    const chatData = messages.map(msg => 
      `[${formatTimestamp(msg.timestamp)}] ${msg.from.toUpperCase()}: ${msg.text}`
    ).join('\n');
    
    const blob = new Blob([chatData], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-chat-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Toggle theme
  const toggleTheme = () => {
    setDarkMode(!darkMode);
    document.documentElement.classList.toggle('dark', !darkMode);
    showNotification('Theme switched to ' + (!darkMode ? 'dark' : 'light') + ' mode', 'success');
  };

  // Show notification
  const showNotification = (text: string, type: 'success'|'error'|'info') => {
    setNotification({ text, type });
    setTimeout(() => setNotification(null), 3000);
  };

  // Search messages
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (query.trim()) {
      const filtered = messages.filter(msg => 
        msg.text.toLowerCase().includes(query.toLowerCase())
      );
      setFilteredMessages(filtered);
    } else {
      setFilteredMessages([]);
    }
  };

  // Add emoji to text input
  const addEmoji = (emoji: string) => {
    setTextInput(prev => prev + emoji);
    // Don't auto-close the picker, let user add multiple emojis
  };

  // File upload handler
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        showNotification('File size must be less than 10MB', 'error');
        return;
      }
      
      const reader = new FileReader();
      reader.onload = () => {
        const userMessage = {
          id: `file-${Date.now()}`,
          text: `📁 File shared: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`,
          from: 'user' as const,
          timestamp: Date.now(),
        };
        setMessages(prev => [...prev, userMessage]);
        showNotification('File uploaded successfully', 'success');
      };
      reader.readAsDataURL(file);
    }
  };

  // Message reactions
  const addReaction = (messageId: string, reaction: string) => {
    // In a real app, this would update the message in the database
    showNotification(`Added ${reaction} reaction`, 'success');
  };

  // Update chat settings
  const updateSettings = (newSettings: Partial<typeof chatSettings>) => {
    setChatSettings(prev => ({ ...prev, ...newSettings }));
    showNotification('Settings updated', 'success');
  };

  useEffect(() => {
    if (userId && db) {
      const messagesCollection = collection(db, 'artifacts', appId, 'users', userId, 'messages');
      const q = query(messagesCollection, orderBy("timestamp", "asc"));

      const unsubscribeFirestore = onSnapshot(q, (snapshot) => {
        const fetchedMessages = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            text: data.text || '',
            from: data.from as 'user' | 'ai' || 'user',
            timestamp: data.timestamp || Date.now()
          };
        });
        setMessages(fetchedMessages);
      }, (error) => {
        console.error("Error fetching messages:", error);
      });

      return () => unsubscribeFirestore();
    }
  }, [userId, db]);

  const handleGoogleLogin = async () => {
    if (!auth || !db) {
      showNotification('Authentication system not ready. Please refresh the page and try again.', 'error');
      console.error('Auth or DB not initialized:', { auth: !!auth, db: !!db });
      return;
    }
    
    // Check if we have the required config
    if (!process.env.NEXT_PUBLIC_FIREBASE_API_KEY || !process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN) {
      showNotification('Firebase configuration missing. Please check environment variables.', 'error');
      console.error('Missing Firebase config:', {
        apiKey: !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
        authDomain: !!process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
      });
      return;
    }
    
    setLoading(true);
    showNotification('Opening Google login...', 'info');
    
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // Show consent screen instead of directly logging in
      setPendingUser(user);
      setShowConsentScreen(true);
      showNotification('Please review and accept permissions to continue.', 'info');
    } catch (error: unknown) {
      console.error("Google login error:", error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      const errorCode = (error as { code?: string })?.code || '';
      
      if (errorCode === 'auth/popup-closed-by-user' || errorMessage.includes('popup-closed-by-user')) {
        showNotification('Login cancelled. You closed the popup window.', 'info');
        console.log('User cancelled Google login by closing popup');
      } else if (errorCode === 'auth/cancelled-popup-request') {
        showNotification('Login cancelled. Another popup was already open.', 'info');
      } else if (errorCode === 'auth/popup-blocked') {
        showNotification('Popup blocked. Please allow popups for this site and try again.', 'error');
      } else if (errorMessage.includes('network-request-failed')) {
        showNotification('Network error. Please check your internet connection.', 'error');
      } else if (errorCode === 'auth/unauthorized-domain') {
        showNotification('This domain is not authorized for Google login. Please contact support.', 'error');
      } else {
        showNotification('Google login failed. Please try again or use email/password login.', 'error');
        console.error('Unhandled Google login error:', { errorCode, errorMessage, error });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEmailLogin = async () => {
    if (!auth) {
      alert('Authentication system not ready. Please refresh the page and try again.');
      return;
    }
    
    if (!email || !password) {
      alert('Please enter both email and password.');
      return;
    }
    
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error: unknown) {
      console.error("Email login error:", error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      if (errorMessage.includes('user-not-found')) {
        alert('No account found with this email. Please register first.');
      } else if (errorMessage.includes('wrong-password')) {
        alert('Incorrect password. Please try again.');
      } else if (errorMessage.includes('invalid-email')) {
        alert('Please enter a valid email address.');
      } else if (errorMessage.includes('too-many-requests')) {
        alert('Too many failed attempts. Please try again later.');
      } else {
        alert('Login failed. Please check your credentials and try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEmailRegister = async () => {
    if (!auth || !db) {
      alert('Authentication system not ready. Please refresh the page and try again.');
      return;
    }
    
    if (!email || !password) {
      alert('Please enter both email and password.');
      return;
    }
    
    if (password.length < 6) {
      alert('Password must be at least 6 characters long.');
      return;
    }
    
    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      try {
        const userDocRef = doc(db, 'artifacts', appId, 'users', user.uid);
        await setDoc(userDocRef, {
          email: user.email,
          createdAt: Date.now(),
        });
      } catch (firestoreError: unknown) {
        console.warn('Could not create user document, but registration successful:', firestoreError);
        // Don't block registration if Firestore fails
      }
    } catch (error: unknown) {
      console.error("Email registration error:", error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      if (errorMessage.includes('email-already-in-use')) {
        alert('This email is already registered. Please use a different email or try logging in.');
      } else if (errorMessage.includes('invalid-email')) {
        alert('Please enter a valid email address.');
      } else if (errorMessage.includes('weak-password')) {
        alert('Password is too weak. Please use a stronger password.');
      } else {
        alert('Registration failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    if (!auth) return;
    await signOut(auth);
  };

  const handleAcceptConsent = async () => {
    if (!pendingUser || !auth || !db) return;
    
    setLoading(true);
    try {
      const userDocRef = doc(db, 'artifacts', appId, 'users', pendingUser.uid);
      
      try {
        const userDoc = await getDoc(userDocRef);
        if (!userDoc.exists()) {
          await setDoc(userDocRef, {
            email: pendingUser.email,
            createdAt: Date.now(),
            consentAccepted: true,
            consentDate: Date.now()
          });
        } else {
          await setDoc(userDocRef, {
            consentAccepted: true,
            consentDate: Date.now()
          }, { merge: true });
        }
      } catch (firestoreError: unknown) {
        console.warn('Could not update user document, but login will proceed:', firestoreError);
      }
      
      // Complete the login process
      setUserId(pendingUser.uid);
      setShowConsentScreen(false);
      setPendingUser(null);
      showNotification('Welcome! You can now start chatting with your AI assistant.', 'success');
      
    } catch (error) {
      console.error('Error completing login:', error);
      showNotification('Error completing login. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRejectConsent = async () => {
    if (!auth || !pendingUser) return;
    
    try {
      // Sign out the user since they rejected consent
      await signOut(auth);
      setShowConsentScreen(false);
      setPendingUser(null);
      showNotification('Login cancelled. You can try again anytime.', 'info');
    } catch (error) {
      console.error('Error during consent rejection:', error);
      setShowConsentScreen(false);
      setPendingUser(null);
    }
  };

  const requestMicrophonePermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Stop the stream immediately as we just needed permission
      stream.getTracks().forEach(track => track.stop());
      return true;
    } catch (error) {
      console.error('Microphone permission denied:', error);
      alert('Microphone permission is required for voice input. Please allow microphone access and try again.');
      return false;
    }
  };

  const handleMicClick = async () => {
    if (!isRecording) {
      // Request microphone permission first
      const hasPermission = await requestMicrophonePermission();
      if (!hasPermission) return;

      setIsRecording(true);
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        recognition.onstart = () => {
          console.log("Listening... Speak now!");
        };

        recognition.onresult = (event: SpeechRecognitionEvent) => {
          const transcript = event.results[0][0].transcript;
          console.log("Transcribed text:", transcript);
          handleSendMessage(transcript);
          setIsRecording(false);
        };

        recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
          console.error("Speech recognition error:", event.error);
          let errorMessage = "Speech recognition error occurred.";
          
          switch (event.error) {
            case 'not-allowed':
              errorMessage = "Microphone access denied. Please allow microphone permission and try again.";
              break;
            case 'no-speech':
              errorMessage = "No speech detected. Please try speaking again.";
              break;
            case 'audio-capture':
              errorMessage = "No microphone found. Please connect a microphone and try again.";
              break;
            case 'network':
              errorMessage = "Network error occurred. Please check your connection and try again.";
              break;
            default:
              errorMessage = `Speech recognition error: ${event.error}`;
          }
          
          alert(errorMessage);
          setIsRecording(false);
        };

        recognition.onend = () => {
          console.log("Speech recognition ended.");
          setIsRecording(false);
        };

        try {
          recognition.start();
          recognitionRef.current = recognition;
        } catch (error) {
          console.error('Failed to start speech recognition:', error);
          alert('Failed to start speech recognition. Please try again.');
          setIsRecording(false);
        }
      } else {
        alert('Speech recognition is not supported in this browser. Please use Chrome, Safari, or Edge.');
        setIsRecording(false);
      }
    } else {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsRecording(false);
    }
  };

  const speakResponse = (text: string) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      window.speechSynthesis.speak(utterance);
    } else {
      console.warn("Text-to-speech not supported in this browser.");
    }
  };

  const handleSendMessage = async (text: string) => {
    if (!text.trim()) return;
    if (!userId || !db) {
      console.error("User not authenticated or database not initialized.");
      alert('Please log in to send messages.');
      return;
    }
    setLoading(true);
    
    // Add user message to local state immediately for better UX
    const userMessage = {
      id: `temp-user-${Date.now()}`,
      text,
      from: 'user' as const,
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, userMessage]);
    
    try {
      const messagesCollection = collection(db, 'artifacts', appId, 'users', userId, 'messages');
      
      // Try to save user message to Firebase
      try {
        await addDoc(messagesCollection, {
          text,
          from: 'user',
          timestamp: Date.now(),
        });
      } catch (firestoreError) {
        console.warn('Could not save message to Firebase, continuing with local storage:', firestoreError);
        // Continue anyway - message is already in local state
      }

      // Get AI response with typing indicator
      try {
        setIsTyping(true);
        const apiKey = "AIzaSyBM91RiZ1MTTqtYB_ucy6EMOKPb98DT91I";
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;

        const payload = {
          contents: [{ parts: [{ text: text }] }],
          generationConfig: {
            temperature: 0.7,
            topP: 0.9,
            maxOutputTokens: 1000,
          }
        };

        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          throw new Error(`API request failed: ${response.status}`);
        }

        const result = await response.json();
        const aiResponseText = result?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (aiResponseText) {
          // Add AI response to local state
          const aiMessage = {
            id: `temp-ai-${Date.now()}`,
            text: aiResponseText,
            from: 'ai' as const,
            timestamp: Date.now() + 1,
          };
          setMessages(prev => [...prev, aiMessage]);
          
          // Try to save AI response to Firebase
          try {
            await addDoc(messagesCollection, {
              text: aiResponseText,
              from: 'ai',
              timestamp: Date.now() + 1,
            });
          } catch (firestoreError) {
            console.warn('Could not save AI response to Firebase:', firestoreError);
          }
          
          // Speak the response
          speakResponse(aiResponseText);
        } else {
          throw new Error('No response from AI');
        }
      } catch (apiError) {
        setIsTyping(false);
        console.error("Error fetching AI response:", apiError);
        const errorMessage = "Sorry, I couldn't generate a response at the moment. Please try again.";
        
        // Add error message to local state
        const errorMsg = {
          id: `temp-error-${Date.now()}`,
          text: errorMessage,
          from: 'ai' as const,
          timestamp: Date.now() + 1,
        };
        setMessages(prev => [...prev, errorMsg]);
        
        // Try to save error message to Firebase
        try {
          await addDoc(messagesCollection, {
            text: errorMessage,
            from: 'ai',
            timestamp: Date.now() + 1,
          });
        } catch (firestoreError) {
          console.warn('Could not save error message to Firebase:', firestoreError);
        }
      }
    } catch (error) {
      console.error("Critical error in handleSendMessage:", error);
      alert('An error occurred while processing your message. Please try again.');
    } finally {
      setLoading(false);
      setIsTyping(false);
      setTextInput('');
    }
  };

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSendMessage(textInput);
  };

  // Settings Modal Component
  const SettingsModal = () => (
    <div className={`fixed inset-0 bg-black/50 flex items-center justify-center z-50 ${showSettings ? '' : 'hidden'}`}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-96 max-w-[90vw]">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">Settings</h3>
          <button onClick={() => setShowSettings(false)} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
        </div>
        
        <div className="space-y-4">
          {/* Font Size */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Font Size</label>
            <select 
              value={chatSettings.fontSize} 
              onChange={(e) => updateSettings({ fontSize: e.target.value as 'small'|'medium'|'large' })}
              className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            >
              <option value="small">Small</option>
              <option value="medium">Medium</option>
              <option value="large">Large</option>
            </select>
          </div>
          
          {/* Timestamps */}
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Show Timestamps</label>
            <button
              onClick={() => updateSettings({ showTimestamps: !chatSettings.showTimestamps })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                chatSettings.showTimestamps ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-700'
              }`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                chatSettings.showTimestamps ? 'translate-x-6' : 'translate-x-1'
              }`} />
            </button>
          </div>
          
          {/* Sound Effects */}
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Sound Effects</label>
            <button
              onClick={() => updateSettings({ soundEnabled: !chatSettings.soundEnabled })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                chatSettings.soundEnabled ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-700'
              }`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                chatSettings.soundEnabled ? 'translate-x-6' : 'translate-x-1'
              }`} />
            </button>
          </div>
          
          {/* Auto Scroll */}
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Auto Scroll</label>
            <button
              onClick={() => updateSettings({ autoScroll: !chatSettings.autoScroll })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                chatSettings.autoScroll ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-700'
              }`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                chatSettings.autoScroll ? 'translate-x-6' : 'translate-x-1'
              }`} />
            </button>
          </div>
        </div>
        
        <div className="flex justify-end mt-6">
          <button
            onClick={() => setShowSettings(false)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );


  // Notification Component
  const NotificationComponent = () => {
    if (!notification) return null;
    
    return (
      <div className={`fixed top-4 right-4 px-4 py-2 rounded-lg shadow-lg z-50 ${
        notification.type === 'success' ? 'bg-green-500' : 
        notification.type === 'error' ? 'bg-red-500' : 'bg-blue-500'
      } text-white`}>
        {notification.text}
      </div>
    );
  };

  const renderVoiceAgent = () => (
    <div className={`w-full max-w-4xl ${darkMode ? 'dark' : ''}`}>
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden transition-all duration-500">
        {/* Header with enhanced controls */}
        <div className="bg-gradient-to-r from-indigo-500 to-purple-600 dark:from-indigo-600 dark:to-purple-700 p-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">AI Assistant</h1>
                <div className="flex items-center space-x-2 text-white/80 text-sm">
                  <div className={`w-2 h-2 rounded-full ${
                    connectionStatus === 'connected' ? 'bg-green-400' : 
                    connectionStatus === 'connecting' ? 'bg-yellow-400 animate-pulse' : 
                    'bg-red-400'
                  }`} />
                  <span className="capitalize">{connectionStatus}</span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              {/* Theme Toggle */}
              <button
                onClick={toggleTheme}
                className="p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
                title="Toggle theme"
              >
                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                  {darkMode ? (
                    <path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0 .39-.39.39-1.03 0-1.41l-1.06-1.06zm1.06-10.96c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06zM7.05 18.36c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06z"/>
                  ) : (
                    <path d="M9 2c-1.05 0-2.05.16-3 .46 4.06 1.27 7 5.06 7 9.54 0 4.48-2.94 8.27-7 9.54.95.3 1.95.46 3 .46 5.52 0 10-4.48 10-10S14.52 2 9 2z"/>
                  )}
                </svg>
              </button>
              
              {/* Settings */}
              <button 
                onClick={() => setShowSettings(true)}
                className="p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors" 
                title="Settings"
              >
                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.74,8.87 C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.82,11.69,4.82,12s0.02,0.64,0.07,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z"/>
                </svg>
              </button>
              
              {/* More options */}
              <div className="relative dropdown-container">
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMoreMenu(!showMoreMenu);
                    setShowEmojiPicker(false); // Close emoji picker if open
                  }}
                  className="p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors" 
                  title="More options"
                >
                  <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12,16A2,2 0 0,1 14,18A2,2 0 0,1 12,20A2,2 0 0,1 10,18A2,2 0 0,1 12,16M12,10A2,2 0 0,1 14,12A2,2 0 0,1 12,14A2,2 0 0,1 10,12A2,2 0 0,1 12,10M12,4A2,2 0 0,1 14,6A2,2 0 0,1 12,8A2,2 0 0,1 10,6A2,2 0 0,1 12,4Z" />
                  </svg>
                </button>
                
                {/* More options dropdown */}
                {showMoreMenu && (
                  <div className="absolute right-0 top-12 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-600 py-2 w-56 z-50 animate-in slide-in-from-top-2 duration-200">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowSearch(!showSearch);
                        setShowMoreMenu(false);
                        showNotification('Search activated! Type in the search box above.', 'info');
                      }}
                      className="w-full text-left px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-white flex items-center space-x-3 transition-colors"
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
                      </svg>
                      <span className="font-medium">Search Messages</span>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        document.getElementById('fileInput')?.click();
                        setShowMoreMenu(false);
                      }}
                      className="w-full text-left px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-white flex items-center space-x-3 transition-colors"
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
                      </svg>
                      <span className="font-medium">Upload File</span>
                    </button>
                    <hr className="my-2 border-gray-200 dark:border-gray-600" />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        showNotification('Help & Support: Contact us at help@aiassistant.com for assistance!', 'info');
                        setShowMoreMenu(false);
                      }}
                      className="w-full text-left px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-white flex items-center space-x-3 transition-colors"
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M11,18H13V16H11V18M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,20C7.59,20 4,16.41 4,12C4,7.59 7.59,4 12,4C16.41,4 20,7.59 20,12C20,16.41 16.41,20 12,20M12,6A4,4 0 0,0 8,10H10A2,2 0 0,1 12,8A2,2 0 0,1 14,10C14,12 11,11.75 11,15H13C13,12.75 16,12.5 16,10A4,4 0 0,0 12,6Z" />
                      </svg>
                      <span className="font-medium">Help & Support</span>
                    </button>
                  </div>
                )}
              </div>
              
              <button
                onClick={handleLogout}
                className="p-2 rounded-full bg-red-500/80 hover:bg-red-500 transition-colors"
                title="Logout"
              >
                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M16,17V14H9V10H16V7L21,12L16,17M14,2A2,2 0 0,1 16,4V6H14V4H5V20H14V18H16V20A2,2 0 0,1 14,22H5A2,2 0 0,1 3,20V4A2,2 0 0,1 5,2H14Z" />
                </svg>
              </button>
            </div>
          </div>
          
          {/* Chat controls */}
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/20">
            <div className="flex items-center space-x-2 text-white/80 text-sm">
              <span>{messages.length} messages</span>
              {isTyping && (
                <div className="flex items-center space-x-1">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-white/60 rounded-full animate-bounce" style={{animationDelay: '0ms'}} />
                    <div className="w-2 h-2 bg-white/60 rounded-full animate-bounce" style={{animationDelay: '150ms'}} />
                    <div className="w-2 h-2 bg-white/60 rounded-full animate-bounce" style={{animationDelay: '300ms'}} />
                  </div>
                  <span>AI is typing...</span>
                </div>
              )}
            </div>
            
            <div className="flex items-center space-x-2">
              {showSearch && (
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  placeholder="Search messages..."
                  className="px-3 py-1 text-sm bg-white/20 border border-white/30 rounded-full text-white placeholder-white/70 focus:outline-none focus:ring-2 focus:ring-white/50 w-48"
                />
              )}
              <button onClick={clearChat} className="text-white/60 hover:text-white text-sm transition-colors" title="Clear chat">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z" />
                </svg>
              </button>
              <button onClick={exportChat} className="text-white/60 hover:text-white text-sm transition-colors" title="Export chat">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Enhanced Messages Area */}
        <div 
          ref={chatContainerRef}
          className={`h-[60vh] overflow-y-auto bg-gray-50 dark:bg-gray-800 ${
            chatSettings.fontSize === 'small' ? 'text-sm' : 
            chatSettings.fontSize === 'large' ? 'text-lg' : 'text-base'
          }`}
        >
          <div className="p-4 space-y-4">
            {(searchQuery && filteredMessages.length > 0 ? filteredMessages : messages).map((message) => (
              <div
                key={message.id}
                className={`flex ${message.from === 'user' ? 'justify-end' : 'justify-start'} group`}
              >
                <div className="flex items-end space-x-2 max-w-[70%]">
                  {message.from === 'ai' && (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12,2A2,2 0 0,0 10,4C10,5.38 10.83,6.57 12,7.17C13.17,6.57 14,5.38 14,4A2,2 0 0,0 12,2M21,9V7L15,1H5C3.89,1 3,1.89 3,3V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V9M12,15C10.89,15 10,14.1 10,13S10.89,11 12,11A2,2 0 0,1 14,13C14,14.1 13.1,15 12,15Z" />
                      </svg>
                    </div>
                  )}
                  
                  <div className="flex flex-col">
                    <div
                      className={`relative px-4 py-3 rounded-2xl shadow-sm ${
                        message.from === 'user'
                          ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-br-md'
                          : 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-600 rounded-bl-md'
                      }`}
                    >
                      <p className="whitespace-pre-wrap leading-relaxed">{message.text}</p>
                      
                      {/* Message actions */}
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex space-x-1">
                        <button
                          onClick={() => copyMessage(message.text)}
                          className={`p-1 rounded transition-colors ${
                            message.from === 'user' 
                              ? 'hover:bg-white/20 text-white/70 hover:text-white' 
                              : 'hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                          }`}
                          title="Copy message"
                        >
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
                          </svg>
                        </button>
                        <button
                          onClick={() => addReaction(message.id, '👍')}
                          className={`p-1 rounded transition-colors ${
                            message.from === 'user' 
                              ? 'hover:bg-white/20 text-white/70 hover:text-white' 
                              : 'hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                          }`}
                          title="Like message"
                        >
                          👍
                        </button>
                      </div>
                    </div>
                    
                    {chatSettings.showTimestamps && (
                      <span className={`text-xs mt-1 ${
                        message.from === 'user' ? 'text-right text-gray-500' : 'text-left text-gray-400'
                      }`}>
                        {formatTimestamp(message.timestamp)}
                      </span>
                    )}
                  </div>
                  
                  {message.from === 'user' && (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-400 to-blue-500 flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                      </svg>
                    </div>
                  )}
                </div>
              </div>
            ))}
            
            {/* Typing indicator */}
            {isTyping && (
              <div className="flex justify-start">
                <div className="flex items-end space-x-2 max-w-[70%]">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12,2A2,2 0 0,0 10,4C10,5.38 10.83,6.57 12,7.17C13.17,6.57 14,5.38 14,4A2,2 0 0,0 12,2M21,9V7L15,1H5C3.89,1 3,1.89 3,3V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V9M12,15C10.89,15 10,14.1 10,13S10.89,11 12,11A2,2 0 0,1 14,13C14,14.1 13.1,15 12,15Z" />
                    </svg>
                  </div>
                  <div className="bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-2xl rounded-bl-md px-4 py-3">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0ms'}} />
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '150ms'}} />
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '300ms'}} />
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Enhanced Input Area */}
        <div className="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-end space-x-3">
            {/* Voice button with waveform */}
            <button
              onClick={handleMicClick}
              className={`relative p-4 rounded-full shadow-lg transition-all duration-300 transform hover:scale-105 ${
                isRecording 
                  ? 'bg-gradient-to-br from-red-500 to-red-600 animate-pulse' 
                  : 'bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700'
              }`}
              title={isRecording ? 'Stop recording' : 'Start voice input'}
            >
              <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                {isRecording ? (
                  <path d="M6 6h12v12H6z"/>
                ) : (
                  <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5-3c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-4.08c3.39-.49 6-3.39 6-6.92h-2z"/>
                )}
              </svg>
              
              {isRecording && (
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-300 rounded-full animate-ping" />
              )}
            </button>
            
            {/* Text input with enhanced features */}
            <form onSubmit={handleTextSubmit} className="flex-1 flex items-end space-x-2">
              <div className="flex-1 relative emoji-container">
                <textarea
                  value={textInput}
                  onChange={(e) => {
                    setTextInput(e.target.value);
                    // Auto-resize textarea
                    e.target.style.height = 'auto';
                    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleTextSubmit(e);
                    }
                  }}
                  placeholder="Type your message... (Shift+Enter for new line)"
                  className="w-full px-4 py-3 pr-12 rounded-2xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none min-h-[48px] max-h-[120px]"
                  rows={1}
                />
                
                {/* Emoji button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowEmojiPicker(!showEmojiPicker);
                    setShowMoreMenu(false); // Close more menu if open
                    if (!showEmojiPicker) {
                      showNotification('Emoji picker opened! Click any emoji to add it.', 'info');
                    }
                  }}
                  className={`absolute right-3 top-3 transition-colors ${
                    showEmojiPicker 
                      ? 'text-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-1' 
                      : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                  }`}
                  title="Add emoji"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12,2C6.48,2 2,6.48 2,12C2,17.52 6.48,22 12,22C17.52,22 22,17.52 22,12C22,6.48 17.52,2 12,2M12,20C7.59,20 4,16.41 4,12C4,7.59 7.59,4 12,4C16.41,4 20,7.59 20,12C20,16.41 16.41,20 12,20M16.5,10.5C16.5,9.67 15.83,9 15,9C14.17,9 13.5,9.67 13.5,10.5C13.5,11.33 14.17,12 15,12C15.83,12 16.5,11.33 16.5,10.5M10.5,10.5C10.5,9.67 9.83,9 9,9C8.17,9 7.5,9.67 7.5,10.5C7.5,11.33 8.17,12 9,12C9.83,12 10.5,11.33 10.5,10.5M12,17.23C14.25,17.23 16.13,15.94 16.76,14H7.24C7.87,15.94 9.75,17.23 12,17.23Z" />
                  </svg>
                </button>
                
                {/* Emoji Picker with better positioning */}
                {showEmojiPicker && (
                  <div className="absolute bottom-14 left-0 right-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-2xl p-4 shadow-xl z-20 animate-in slide-in-from-bottom-2 duration-200">
                    <div className="flex justify-between items-center mb-3">
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Choose an emoji</h4>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowEmojiPicker(false);
                        }}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                        </svg>
                      </button>
                    </div>
                    <div className="grid grid-cols-8 gap-1 max-h-48 overflow-y-auto">
                      {['😀', '😃', '😄', '😁', '😊', '😍', '🥰', '😘', '😗', '😙', '😚', '🤗', '🤔', '😎', '🤓', '😇', '🥳', '🎉', '👍', '👎', '👌', '✌️', '🤞', '🤝', '👏', '🙌', '💪', '❤️', '💕', '💖', '💯', '🔥', '⚡', '🎯', '🚀', '💡', '🎨', '🎵', '🎸', '🎤', '📱', '💻', '⌨️', '🖥️', '🖱️'].map((emoji, index) => (
                        <button
                          key={index}
                          onClick={(e) => {
                            e.stopPropagation();
                            addEmoji(emoji);
                            showNotification(`Added ${emoji} to your message!`, 'success');
                          }}
                          className="p-3 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors text-xl hover:scale-110 transform duration-150"
                          title={`Add ${emoji}`}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              
              <button
                type="submit"
                disabled={loading || !textInput.trim()}
                className={`p-3 rounded-full transition-all duration-200 ${
                  loading || !textInput.trim()
                    ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 cursor-not-allowed'
                    : 'bg-gradient-to-br from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transform hover:scale-105'
                }`}
                title="Send message"
              >
                {loading ? (
                  <svg className="w-5 h-5 animate-spin" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12,4V2A10,10 0 0,0 2,12H4A8,8 0 0,1 12,4Z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 transform rotate-45" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                  </svg>
                )}
              </button>
            </form>
          </div>
          
          {/* Status bar */}
          <div className="flex items-center justify-between mt-2 text-xs text-gray-500 dark:text-gray-400">
            <div className="flex items-center space-x-4">
              <span>Press Shift+Enter for new line</span>
              {isRecording && (
                <span className="flex items-center space-x-1 text-red-500">
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  <span>Recording...</span>
                </span>
              )}
            </div>
            
            <div className="flex items-center space-x-2">
              <span>{textInput.length}/1000</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Hidden file input */}
      <input
        id="fileInput"
        type="file"
        onChange={handleFileUpload}
        className="hidden"
        accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.gif"
      />
      
      {/* Render modals and overlays */}
      <SettingsModal />
      <NotificationComponent />
    </div>
  );

  const renderConsentScreen = () => (
    <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-3xl shadow-2xl p-6 md:p-8 transform transition-transform duration-500">
      <div className="text-center mb-6">
        <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/>
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Permissions Required
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Welcome, {pendingUser?.displayName || pendingUser?.email}!
        </p>
      </div>

      <div className="space-y-4 mb-6">
        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
            <svg className="w-5 h-5 mr-2 text-blue-500" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
            What we&apos;ll access:
          </h3>
          <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
            <li className="flex items-start">
              <span className="text-green-500 mr-2">✓</span>
              <span>Your email address for account identification</span>
            </li>
            <li className="flex items-start">
              <span className="text-green-500 mr-2">✓</span>
              <span>Basic profile information (name, profile picture)</span>
            </li>
            <li className="flex items-start">
              <span className="text-green-500 mr-2">✓</span>
              <span>Store your chat history securely in our database</span>
            </li>
          </ul>
        </div>

        <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-xl">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-2 flex items-center">
            <svg className="w-5 h-5 mr-2 text-amber-500" fill="currentColor" viewBox="0 0 24 24">
              <path d="M11,15H13V17H11V15M11,7H13V13H11V7M12,2C6.47,2 2,6.5 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20Z"/>
            </svg>
            Privacy Notice:
          </h3>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            Your data is encrypted and stored securely. We never share your personal information or chat history with third parties. You can delete your account and data at any time.
          </p>
        </div>
      </div>

      <div className="flex space-x-3">
        <button
          onClick={handleRejectConsent}
          disabled={loading}
          className="flex-1 px-4 py-3 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 rounded-xl hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-medium"
        >
          Decline
        </button>
        <button
          onClick={handleAcceptConsent}
          disabled={loading}
          className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl hover:from-blue-600 hover:to-purple-700 transition-colors font-medium flex items-center justify-center"
        >
          {loading ? (
            <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          ) : null}
          Accept & Continue
        </button>
      </div>

      <p className="text-xs text-center text-gray-500 dark:text-gray-400 mt-4">
        By continuing, you agree to our Terms of Service and Privacy Policy.
      </p>
    </div>
  );

  const renderLogin = () => (
    <div className="w-full max-w-sm bg-white dark:bg-gray-900 rounded-3xl shadow-2xl p-6 md:p-8 transform transition-transform duration-500 hover:scale-[1.01]">
      <h1 className="text-3xl font-extrabold text-center text-gray-900 dark:text-white mb-6">
        Welcome
      </h1>
      <div className="space-y-4">
        <p className="text-center text-sm text-gray-600 dark:text-gray-400">
          Sign in to access your AI assistant
        </p>
        
        {/* Google Login Button */}
        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className={`w-full flex items-center justify-center border font-semibold py-3 px-4 rounded-full shadow-sm transition-colors duration-300 ${
            loading 
              ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed' 
              : 'bg-white border-gray-300 text-gray-800 hover:bg-gray-100'
          }`}
        >
          {loading ? (
            <>
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Connecting...
            </>
          ) : (
            <>
              <Image src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google icon" width={20} height={20} className="mr-2" />
              Login with Google
            </>
          )}
        </button>

        <div className="flex items-center">
          <hr className="flex-grow border-gray-300 dark:border-gray-700" />
          <span className="mx-2 text-gray-500 dark:text-gray-400 text-sm">or</span>
          <hr className="flex-grow border-gray-300 dark:border-gray-700" />
        </div>

        {/* Email/Password Form */}
        <form onSubmit={(e) => { 
          e.preventDefault(); 
          if (isRegistering) {
            handleEmailRegister();
          } else {
            handleEmailLogin();
          }
        }} className="space-y-4">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="w-full p-3 border border-gray-300 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            required
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full p-3 border border-gray-300 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            required
          />
          <button
            type="submit"
            className="w-full bg-indigo-500 hover:bg-indigo-600 text-white font-semibold py-3 px-4 rounded-full transition-colors duration-300"
            disabled={loading}
          >
            {loading ? 'Loading...' : (isRegistering ? 'Register' : 'Login')}
          </button>
        </form>

        <div className="text-center text-sm mt-4">
          <button
            onClick={() => setIsRegistering(!isRegistering)}
            className="text-indigo-500 hover:underline transition-colors duration-300"
          >
            {isRegistering ? 'Already have an account? Login' : 'Need an account? Register'}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className={`min-h-screen transition-all duration-500 ${
      darkMode 
        ? 'bg-gradient-to-br from-gray-900 via-purple-900 to-indigo-900' 
        : 'bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500'
    } text-gray-100 p-4`}>
      <div className="flex flex-col items-center justify-center min-h-screen">
        {userId ? (
          <div className="w-full flex flex-col items-center">
            <div className="text-xs text-white/60 mb-4 text-center">
              <div className="bg-black/20 rounded-full px-3 py-1 backdrop-blur-sm">
                Connected as: {userId.slice(0, 8)}...{userId.slice(-4)}
              </div>
            </div>
            {renderVoiceAgent()}
          </div>
        ) : showConsentScreen ? (
          renderConsentScreen()
        ) : (
          renderLogin()
        )}
      </div>
    </div>
  );
}