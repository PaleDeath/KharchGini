# KharchGini - Personal Finance Tracker

A comprehensive personal finance management application built with Next.js, Firebase, and AI-powered insights.

## Features

- 📊 **Transaction Management** - Track income and expenses with categorization
- 🎯 **Financial Goals** - Set and monitor progress towards financial objectives
- 💰 **Budget Tracking** - Create budgets and monitor spending limits
- 🔄 **Recurring Transactions** - Automate regular income and expenses
- 📈 **Analytics & Insights** - AI-powered financial analysis and forecasting
- 🚨 **Anomaly Detection** - Identify unusual spending patterns
- 📱 **Responsive Design** - Works seamlessly on desktop and mobile

## Tech Stack

- **Frontend**: Next.js 15, React 18, TypeScript
- **UI**: Tailwind CSS, Radix UI, Lucide Icons
- **Backend**: Firebase (Firestore, Authentication)
- **AI**: Google Gemini AI for financial insights, Google Cloud Speech-to-Text for voice input
- **Charts**: Recharts
- **Forms**: React Hook Form with Zod validation

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Firebase project
- Google AI API key
- Google Cloud project with Speech-to-Text API enabled (optional, for enhanced voice input)

### Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd kharchgini
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
Create a `.env.local` file in the root directory:

```env
# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key_here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id_here
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id_here
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id_here
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=your_measurement_id_here

# Google AI (Gemini) Configuration
GOOGLE_GENAI_API_KEY=your_google_ai_api_key_here

# Google Cloud Speech-to-Text API Configuration (Optional)
GOOGLE_APPLICATION_CREDENTIALS=path/to/service-account-key.json
GOOGLE_CLOUD_PROJECT_ID=your_google_cloud_project_id
```

4. Set up Firebase:
   - Create a new Firebase project
   - Enable Firestore Database
   - Enable Authentication (Email/Password)
   - Copy your Firebase config to the environment variables

5. Set up Google AI:
   - Get a Google AI API key from Google AI Studio
   - Add it to your environment variables

6. Set up Google Cloud Speech-to-Text API (optional, for enhanced voice input):
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select existing project
   - Enable the Speech-to-Text API:
     - Go to APIs & Services > Library
     - Search for "Cloud Speech-to-Text API" and enable it
   - Create a Service Account:
     - Go to IAM & Admin > Service Accounts
     - Create a new service account with "Cloud Speech Client" role
     - Download the JSON key file
   - Add the credentials to your environment variables

7. Run the development server:
```bash
npm run dev
```

Open [http://localhost:9002](http://localhost:9002) to view the application.

## Deployment on Vercel

### Quick Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/your-username/kharchgini)

### Manual Deployment

1. **Prepare for deployment:**
   ```bash
   npm run build
   npm run typecheck
   ```

2. **Deploy to Vercel:**
   - Install Vercel CLI: `npm i -g vercel`
   - Run: `vercel`
   - Follow the prompts

3. **Set Environment Variables in Vercel:**
   Go to your Vercel dashboard → Project Settings → Environment Variables and add:
   
   - `NEXT_PUBLIC_FIREBASE_API_KEY`
   - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
   - `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
   - `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
   - `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
   - `NEXT_PUBLIC_FIREBASE_APP_ID`
   - `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID`
   - `GOOGLE_GENAI_API_KEY`

4. **Configure Firebase for production:**
   - Add your Vercel domain to Firebase Authentication authorized domains
   - Update Firestore security rules if needed

## Firebase Security Rules

The app uses the following Firestore security rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can only access their own data
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
      
      // Nested collections: transactions, goals, and budgets
      match /{collection}/{document} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }
    
    // Deny all other access
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

## Project Structure

```
src/
├── app/                    # Next.js app router
│   ├── (main)/            # Main app pages
│   ├── auth/              # Authentication pages
│   └── layout.tsx         # Root layout
├── components/            # Reusable UI components
│   ├── ui/               # Base UI components
│   └── ...               # Feature components
├── contexts/             # React contexts
├── hooks/                # Custom React hooks
├── lib/                  # Utility libraries
│   ├── firebase/         # Firebase configuration
│   └── ...              # Other utilities
└── actions/              # Server actions
```

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run typecheck` - Run TypeScript type checking

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and type checking
5. Submit a pull request

## License

This project is licensed under the MIT License. 