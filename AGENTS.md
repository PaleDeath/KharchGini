# KharchGini Agent Context

## ARCHITECTURE
- Next.js 15 App Router, src/ directory structure
- Firebase Auth (Email/Password) + Firestore (users/{uid}/transactions,goals,budgets)
- Tailwind CSS + Radix UI components in src/components/ui/
- React Hook Form + Zod for validation
- Server Actions in src/actions/ for all Firebase operations

## CRITICAL CONVENTIONS
- All dates stored as Firestore Timestamps, displayed in IST (UTC+5:30)
- Currency: INR (₹), formatted with Intl.NumberFormat('en-IN')
- Security: All Firestore rules check request.auth.uid == userId
- TypeScript: Strict mode, no 'any' types
- Error handling: Try/catch with Sonner toast notifications

## FILE PATTERNS
- Components: PascalCase, client components only when using hooks
- Utilities: camelCase, pure functions
- Server Actions: async functions, validate inputs with Zod

## DEPENDENCIES TO AVOID
- No Moment.js (use date-fns or native)
- No Lodash (use native ES6+)
- No additional Firebase services (stay on Spark free tier)

## TESTING
- Jest for utilities
- Manual testing for Firebase integration
