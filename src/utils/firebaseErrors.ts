// Firebase error code to user-friendly message mapping (EN/TR)
export function getFirebaseErrorMessage(error: any): string {
    const code = error?.code || '';

    switch (code) {
        case 'auth/email-already-in-use':
            return 'This email is already registered. / Bu email zaten kayıtlı.';
        case 'auth/weak-password':
            return 'Password too weak (min 6 chars). / Şifre çok zayıf (en az 6 karakter).';
        case 'auth/invalid-email':
            return 'Invalid email format. / Email formatı hatalı.';
        case 'auth/user-not-found':
            return 'User not found. / Kullanıcı bulunamadı.';
        case 'auth/wrong-password':
            return 'Wrong password. / Şifre hatalı.';
        case 'auth/invalid-credential':
            return 'Invalid email or password. / Email veya şifre hatalı.';
        case 'auth/too-many-requests':
            return 'Too many attempts. Please wait. / Çok fazla deneme. Lütfen bekleyin.';
        default:
            return 'An error occurred. / Bir hata oluştu.';
    }
}
