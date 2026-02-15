export function getFirebaseErrorMessage(error: any): string {
    const code = error?.code || '';

    switch (code) {
        case 'auth/email-already-in-use':
            return 'This email is already registered.';
        case 'auth/weak-password':
            return 'Password too weak (min 6 chars).';
        case 'auth/invalid-email':
            return 'Invalid email format.';
        case 'auth/user-not-found':
            return 'User not found.';
        case 'auth/wrong-password':
            return 'Wrong password.';
        case 'auth/invalid-credential':
            return 'Invalid email or password.';
        case 'auth/too-many-requests':
            return 'Too many attempts. Please wait.';
        default:
            return 'An error occurred.';
    }
}
