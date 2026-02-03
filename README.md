# English Jar - Expo React Native App

Kelime öğrenme uygulaması - Firebase Auth + Firestore + SRS (Spaced Repetition System).

## Çalıştırma

```bash
# Hotspot/tunnel modunda başlat
npx expo start --tunnel -c
```

## Firebase Kurulumu

### 1. Firebase Config

`src/firebase/firebase.ts` dosyasına Firebase Console'dan aldığın config'i yapıştır.

### 2. Firestore Security Rules

Firebase Console → Firestore → Rules:

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

Firebase Console → Firestore → Indexes → Create Index:

| Collection | Fields | Query Scope |
|------------|--------|-------------|
| `words` | `userId` (asc), `createdAt` (desc) | Collection |
| `words` | `userId` (asc), `isActive` (asc), `enNextReviewAt` (asc) | Collection |
| `words` | `userId` (asc), `isActive` (asc), `trNextReviewAt` (asc) | Collection |

> İlk query çalıştığında konsoldaki hata linkine tıklayarak da otomatik oluşturabilirsin.

## Proje Yapısı

```
src/
├── firebase/
│   └── firebase.ts          # Firebase config
├── navigation/
│   └── AppNavigator.tsx     # Navigation stack
├── screens/
│   ├── LoginScreen.tsx
│   ├── RegisterScreen.tsx
│   ├── HomeScreen.tsx       # Dashboard
│   ├── AddWordScreen.tsx
│   ├── PoolScreen.tsx
│   ├── TestSetupScreen.tsx  # Custom test
│   ├── TestScreen.tsx
│   └── ResultScreen.tsx
├── types/
│   └── srs.ts               # SRS types & functions
└── utils/
    └── firebaseErrors.ts    # Error messages
```

## SRS Algoritması

- **Doğru cevap:** intervalDays x2 (1→2→4→8...), streak++
- **Yanlış cevap:** intervalDays=0, 10 dk sonra tekrar, streak=0
- **Due Test:** nextReviewAt ≤ now olan kelimeler
- **Wrong Boost:** Son testteki yanlışların %30'u öncelikli
