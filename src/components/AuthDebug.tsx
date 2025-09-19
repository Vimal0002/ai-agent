"use client";

import React, { useEffect, useState } from 'react';
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

export default function AuthDebug() {
  const [debugInfo, setDebugInfo] = useState<any>({});
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    const debug: any = {
      environment: 'production',
      url: window.location.href,
      domain: window.location.hostname,
      config: {},
      envVars: {},
      firebase: null,
    };

    // Check environment variables
    debug.envVars = {
      NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ? '✅ Set' : '❌ Missing',
      NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '❌ Missing',
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '❌ Missing',
      NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '❌ Missing',
      NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '❌ Missing',
      NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '❌ Missing',
    };

    // Check Firebase config
    debug.config = firebaseConfig;

    // Test Firebase initialization
    try {
      const app = initializeApp(firebaseConfig);
      const auth = getAuth(app);
      debug.firebase = {
        app: '✅ Initialized',
        auth: '✅ Ready',
        authDomain: auth.config.authDomain,
      };
    } catch (error: any) {
      debug.firebase = {
        error: error.message,
        status: '❌ Failed'
      };
      setErrors(prev => [...prev, `Firebase Init Error: ${error.message}`]);
    }

    // Check for common issues
    if (!process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
      setErrors(prev => [...prev, 'Missing Firebase API Key']);
    }
    if (!process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN) {
      setErrors(prev => [...prev, 'Missing Firebase Auth Domain']);
    }
    if (window.location.hostname !== 'localhost' && window.location.protocol !== 'https:') {
      setErrors(prev => [...prev, 'Not using HTTPS on production']);
    }

    setDebugInfo(debug);
  }, []);

  return (
    <div className="fixed bottom-4 right-4 bg-black/80 text-white p-4 rounded-lg text-xs max-w-md max-h-96 overflow-auto z-50">
      <h3 className="font-bold mb-2">🔍 Auth Debug Info</h3>
      
      <div className="mb-2">
        <strong>Domain:</strong> {debugInfo.domain}
      </div>

      <div className="mb-2">
        <strong>Errors:</strong>
        {errors.length === 0 ? (
          <span className="text-green-400"> ✅ None</span>
        ) : (
          <ul className="text-red-400 list-disc list-inside">
            {errors.map((error, i) => <li key={i}>{error}</li>)}
          </ul>
        )}
      </div>

      <details className="mb-2">
        <summary className="cursor-pointer">Environment Variables</summary>
        <pre className="text-xs mt-1 bg-gray-800 p-2 rounded">
          {JSON.stringify(debugInfo.envVars, null, 2)}
        </pre>
      </details>

      <details className="mb-2">
        <summary className="cursor-pointer">Firebase Config</summary>
        <pre className="text-xs mt-1 bg-gray-800 p-2 rounded">
          {JSON.stringify(debugInfo.config, null, 2)}
        </pre>
      </details>

      <details>
        <summary className="cursor-pointer">Firebase Status</summary>
        <pre className="text-xs mt-1 bg-gray-800 p-2 rounded">
          {JSON.stringify(debugInfo.firebase, null, 2)}
        </pre>
      </details>
    </div>
  );
}