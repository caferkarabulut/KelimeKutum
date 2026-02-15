# English Jar - Expo React Native App

A spaced repetition vocabulary learning application built with React Native, Expo, and Firebase.

## Features
- **Spaced Repetition System (SRS):** Efficiently learn new words with a smart review algorithm.
- **Cross-Platform:** Runs on Android, iOS, and Web.
- **Firebase Integration:** Real-time data sync with Firestore and Authentication.
- **Custom Tests:** Create tests based on your learning progress.

## Getting Started

```bash
# Start the app in tunnel mode
npx expo start --tunnel -c
```

## Firebase Setup

### 1. Firebase Config
Paste your Firebase project configuration into `src/firebase/firebase.ts`.

### 2. Firestore Security Rules
Go to **Firebase Console → Firestore → Rules**:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    match /words/{wordId} {
      allow read, write: if request.auth != null && 
        (resource == null || resource.data.userId == request.auth.uid) &&
        (request.resource == null || request.resource.data.userId == request.auth.uid);
    }
  }
}
```

### 3. Firestore Composite Indexes
Go to **Firebase Console → Firestore → Indexes → Create Index**:

| Collection | Fields | Query Scope |
|------------|--------|-------------|
| `words` | `userId` (asc), `createdAt` (desc) | Collection |
| `words` | `userId` (asc), `isActive` (asc), `enNextReviewAt` (asc) | Collection |
| `words` | `userId` (asc), `isActive` (asc), `trNextReviewAt` (asc) | Collection |

> You can also create these automatically by clicking the error link in the console when running your first query.

## Project Structure

```
src/
├── firebase/
│   └── firebase.ts          # Firebase configuration
├── navigation/
│   └── AppNavigator.tsx     # Navigation stack and routing
├── screens/
│   ├── LoginScreen.tsx
│   ├── RegisterScreen.tsx
│   ├── HomeScreen.tsx       # Main dashboard
│   ├── AddWordScreen.tsx
│   ├── PoolScreen.tsx       # Word management
│   ├── TestSetupScreen.tsx  # Test configuration
│   ├── TestScreen.tsx       # Test interface
│   └── ResultScreen.tsx
├── types/
│   └── srs.ts               # SRS algorithms and type definitions
└── utils/
    └── firebaseErrors.ts    # Error handling utilities
```

## SRS Algorithm Details

- **Correct Answer:** Interval doubles (1 → 2 → 4 → 8 days...), streak increases.
- **Wrong Answer:** Interval resets to 0, word re-appears in 10 minutes, streak resets.
- **Due Test:** Words where `nextReviewAt` ≤ `now` are prioritized.
- **Wrong Boost:** 30% of the test questions are prioritized from recently incorrect answers.
