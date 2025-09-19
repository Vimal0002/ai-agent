# 🔐 Authentication Fix Guide

## 🚨 **Issue Identified**
Your login page isn't working on Netlify because:
1. Firebase Authentication doesn't have your Netlify domain authorized
2. Environment variables may not be properly configured for production

## ✅ **Step-by-Step Fix**

### 1. Add Netlify Domain to Firebase Console
**⚠️ CRITICAL STEP - Must be done manually:**

1. Go to [Firebase Console](https://console.firebase.google.com/project/ai-agent-cca27/authentication/settings)
2. Click on "Authentication" → "Settings" → "Authorized domains"
3. Click "Add domain"
4. Add: `ai-agent-vimal.netlify.app`
5. Click "Save"

### 2. Configure Environment Variables on Netlify
We need to add environment variables to your Netlify deployment:

**Go to:** https://app.netlify.com/sites/ai-agent-vimal/settings/env-vars

**Add these variables:**
```
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyAEZ0yRlYITZxCVYi7HMwJAPAPk7zVVQi8
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=ai-agent-cca27.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=ai-agent-cca27
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=ai-agent-cca27.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=264831481054
NEXT_PUBLIC_FIREBASE_APP_ID=1:264831481054:web:2d0d7b9f47aa146a703e4f
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX
GOOGLE_CLIENT_ID=97763060323-urb4q7jfhcfn3ag9den6159nnp7eaeqd.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=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
```

### 3. Update Google OAuth Settings
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project: `ai-agent-cca27`
3. Go to "APIs & Services" → "Credentials"
4. Click on your OAuth 2.0 Client ID
5. Under "Authorized JavaScript origins", add:
   - `https://ai-agent-vimal.netlify.app`
6. Under "Authorized redirect URIs", add:
   - `https://ai-agent-vimal.netlify.app/__/auth/handler`
7. Click "Save"

## 🔧 **Quick Command to Set Netlify Env Vars**

```bash
# If you have Netlify CLI installed:
netlify env:set NEXT_PUBLIC_FIREBASE_API_KEY "AIzaSyAEZ0yRlYITZxCVYi7HMwJAPAPk7zVVQi8"
netlify env:set NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN "ai-agent-cca27.firebaseapp.com"
netlify env:set NEXT_PUBLIC_FIREBASE_PROJECT_ID "ai-agent-cca27"
netlify env:set NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET "ai-agent-cca27.appspot.com"
netlify env:set NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID "264831481054"
netlify env:set NEXT_PUBLIC_FIREBASE_APP_ID "1:264831481054:web:2d0d7b9f47aa146a703e4f"
```

## 🚀 **After Making These Changes**

1. **Redeploy your site:**
   ```bash
   npm run deploy:netlify
   ```

2. **Test the authentication:**
   - Go to https://ai-agent-vimal.netlify.app
   - Try both Google login and email/password login
   - Both should work now!

## 🔍 **Common Errors & Solutions**

### Error: "This domain is not authorized"
- **Solution**: Add your Netlify domain to Firebase authorized domains

### Error: "Google OAuth popup blocked"
- **Solution**: Add Netlify domain to Google OAuth settings

### Error: "Configuration not found"
- **Solution**: Set environment variables on Netlify

## ✅ **Verification Checklist**

- [ ] Added `ai-agent-vimal.netlify.app` to Firebase authorized domains
- [ ] Set all environment variables on Netlify
- [ ] Added Netlify domain to Google OAuth settings  
- [ ] Redeployed the application
- [ ] Tested Google login on live site
- [ ] Tested email/password login on live site

Once you complete these steps, your authentication will work perfectly on the deployed site!