export function getFirebaseErrorMessage(error: any): string {
    const code = error?.code || '';

    switch (code) {
        case 'auth/email-already-in-use':
            return 'Bu e-posta adresi zaten kullanımda.';
        case 'auth/weak-password':
            return 'Şifre çok zayıf (en az 6 karakter).';
        case 'auth/invalid-email':
            return 'Geçersiz e-posta formatı.';
        case 'auth/user-not-found':
            return 'Kullanıcı bulunamadı.';
        case 'auth/wrong-password':
            return 'Hatalı şifre.';
        case 'auth/invalid-credential':
            return 'E-posta veya şifre hatalı.';
        case 'auth/too-many-requests':
            return 'Çok fazla deneme yapıldı. Lütfen bekleyin.';
        default:
            return 'Bir hata oluştu.';
    }
}
