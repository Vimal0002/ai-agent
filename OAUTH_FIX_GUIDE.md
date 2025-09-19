# Fix OAuth redirect_uri_mismatch Error

## Problem
Your Google OAuth is failing with "Error 400: redirect_uri_mismatch" because the redirect URIs in your Google Cloud Console don't match what Firebase Auth is trying to use.

## Solution Steps

### 1. Configure Google Cloud Console
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project (Project ID: `264831481054`)
3. Navigate to **APIs & Services** → **Credentials**
4. Find your OAuth 2.0 client ID: `97763060323-urb4q7jfhcfn3ag9den6159nnp7eaeqd.apps.googleusercontent.com`
5. Click **Edit** on that credential
6. Under **Authorized redirect URIs**, add these URIs:
   ```
   http://localhost:3000
   http://localhost:3000/__/auth/handler
   http://localhost:3001
   http://localhost:3001/__/auth/handler
   http://localhost:3002
   http://localhost:3002/__/auth/handler
   https://ai-agent-cca27.firebaseapp.com/__/auth/handler
   https://ai-agent-cca27.web.app/__/auth/handler
   ```
7. Click **Save**

### 2. Verify Firebase Auth Domain
Your current auth domain should be: `ai-agent-cca27.firebaseapp.com`

If it's different, update your `.env.local` file accordingly.

### 3. Enable Google Auth in Firebase Console
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: `ai-agent-cca27`
3. Go to **Authentication** → **Sign-in method**
4. Click on **Google** provider
5. Enable it if not already enabled
6. Verify that the OAuth client ID matches: `97763060323-urb4q7jfhcfn3ag9den6159nnp7eaeqd.apps.googleusercontent.com`

### 4. Test the Fix
After making these changes:
1. Restart your Next.js development server
2. Try the Google Sign-in again
3. The error should be resolved

## Common Issues
- Make sure all redirect URIs include `/__/auth/handler` at the end
- Ensure you're using the correct Firebase project ID
- Wait a few minutes after making changes in Google Cloud Console for them to propagate

## Your Current Configuration
- Project ID: `ai-agent-cca27`
- Auth Domain: `ai-agent-cca27.firebaseapp.com`
- Google Client ID: `97763060323-urb4q7jfhcfn3ag9den6159nnp7eaeqd.apps.googleusercontent.com`