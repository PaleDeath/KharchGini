# Vercel Deployment Checklist for KharchGini

## Pre-Deployment Checks

### ✅ Code Quality
- [x] TypeScript compilation passes (`npm run typecheck`)
- [x] No console.error statements in production code (kept for debugging)
- [x] All imports are correctly resolved
- [x] No unused dependencies

### ✅ Environment Variables
Required environment variables for Vercel:

#### Firebase Configuration (Public)
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID`

#### AI Configuration (Private)
- `GOOGLE_GENAI_API_KEY`

#### Google Cloud Speech-to-Text API (Private, Optional)
- `GOOGLE_CLOUD_PROJECT_ID`
- `GOOGLE_APPLICATION_CREDENTIALS` (for local development)

### ✅ Firebase Setup
- [x] Firestore Database enabled
- [x] Authentication enabled (Email/Password)
- [x] Security rules configured
- [ ] Add Vercel domain to Firebase Auth authorized domains
- [ ] Verify Firestore indexes are created

### ✅ Build Configuration
- [x] `next.config.ts` optimized for production
- [x] `vercel.json` configuration created
- [x] Package.json scripts are correct

## Deployment Steps

### 1. Local Testing
```bash
# Clean build
rm -rf .next
npm run build
npm run start

# Test the production build locally
```

### 2. Deploy to Vercel

#### Option A: Vercel CLI
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Set environment variables
vercel env add NEXT_PUBLIC_FIREBASE_API_KEY
vercel env add NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
# ... (add all other env vars)
```

#### Option B: GitHub Integration
1. Push code to GitHub
2. Connect repository to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy

### 3. Post-Deployment Configuration

#### Firebase Configuration
1. Go to Firebase Console → Authentication → Settings → Authorized domains
2. Add your Vercel domain (e.g., `your-app.vercel.app`)
3. Add custom domain if using one

#### Verify Deployment
- [ ] Authentication works
- [ ] Firestore read/write operations work
- [ ] AI insights generate correctly
- [ ] All pages load without errors
- [ ] Mobile responsiveness works

## Environment Variables Setup in Vercel

### Via Vercel Dashboard
1. Go to Project Settings → Environment Variables
2. Add each variable with appropriate scope:
   - **Production**: For live site
   - **Preview**: For preview deployments
   - **Development**: For local development

### Via Vercel CLI
```bash
# Production environment
vercel env add NEXT_PUBLIC_FIREBASE_API_KEY production
vercel env add GOOGLE_GENAI_API_KEY production

# Preview environment
vercel env add NEXT_PUBLIC_FIREBASE_API_KEY preview
vercel env add GOOGLE_GENAI_API_KEY preview
```

## Common Issues & Solutions

### Build Errors
- **TypeScript errors**: Fix all type errors before deployment
- **Import errors**: Ensure all imports are correctly resolved
- **Environment variables**: Verify all required env vars are set

### Runtime Errors
- **Firebase connection**: Check API keys and project configuration
- **Authentication**: Verify authorized domains in Firebase
- **AI features**: Ensure Google AI API key is valid and has quota

### Performance Optimization
- **Images**: Use Next.js Image component for optimization
- **Fonts**: Use Next.js font optimization
- **Bundle size**: Check for large dependencies

## Security Checklist
- [ ] Environment variables are properly scoped
- [ ] Firebase security rules are restrictive
- [ ] No sensitive data in client-side code
- [ ] API keys have appropriate restrictions

## Monitoring & Maintenance
- [ ] Set up Vercel Analytics
- [ ] Monitor Firebase usage and quotas
- [ ] Set up error tracking (optional: Sentry)
- [ ] Regular dependency updates

## Rollback Plan
- Keep previous deployment available in Vercel
- Have Firebase backup strategy
- Document configuration changes

---

## Quick Deploy Commands

```bash
# Full deployment check
npm run typecheck && npm run build && vercel --prod

# Environment setup
vercel env add NEXT_PUBLIC_FIREBASE_API_KEY
vercel env add NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
vercel env add NEXT_PUBLIC_FIREBASE_PROJECT_ID
vercel env add NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
vercel env add NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
vercel env add NEXT_PUBLIC_FIREBASE_APP_ID
vercel env add NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
vercel env add GOOGLE_GENAI_API_KEY
``` 