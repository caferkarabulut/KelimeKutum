import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
} from 'react-native';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase/firebase';
import { getFirebaseErrorMessage } from '../utils/firebaseErrors';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Register'>;

export default function RegisterScreen({ navigation }: Props) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleRegister = async () => {
        setError('');
        const trimmedEmail = email.trim();

        if (!trimmedEmail || !password || !confirmPassword) {
            setError('Lütfen tüm alanları doldurun');
            return;
        }

        if (password !== confirmPassword) {
            setError('Şifreler eşleşmiyor');
            return;
        }

        if (password.length < 6) {
            setError('Şifre en az 6 karakter olmalı');
            return;
        }

        setLoading(true);
        try {
            const userCredential = await createUserWithEmailAndPassword(
                auth,
                trimmedEmail,
                password
            );

            await setDoc(doc(db, 'users', userCredential.user.uid), {
                createdAt: serverTimestamp(),
                askedWordIds: [],
                testCount: 0,
            });

        } catch (err: any) {
            setError(getFirebaseErrorMessage(err));
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <ScrollView contentContainerStyle={styles.scrollContainer}>
                <View style={styles.innerContainer}>
                    <Text style={styles.title}>Kayıt Ol</Text>

                    {error ? <Text style={styles.errorText}>{error}</Text> : null}

                    <TextInput
                        style={styles.input}
                        placeholder="E-posta"
                        value={email}
                        onChangeText={setEmail}
                        autoCapitalize="none"
                        keyboardType="email-address"
                        autoCorrect={false}
                    />

                    <TextInput
                        style={styles.input}
                        placeholder="Şifre"
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry
                        autoCapitalize="none"
                    />

                    <TextInput
                        style={styles.input}
                        placeholder="Şifreyi Onayla"
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                        secureTextEntry
                        autoCapitalize="none"
                    />

                    <TouchableOpacity
                        style={[styles.button, loading && styles.buttonDisabled]}
                        onPress={handleRegister}
                        disabled={loading}
                    >
                        <Text style={styles.buttonText}>
                            {loading ? 'Kayıt Yapılıyor...' : 'Kayıt Ol'}
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.linkButton}
                        onPress={() => navigation.goBack()}
                    >
                        <Text style={styles.linkText}>Zaten hesabın var mı? Giriş Yap</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    scrollContainer: {
        flexGrow: 1,
    },
    innerContainer: {
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: 24,
        paddingVertical: 32,
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 32,
        color: '#333',
    },
    input: {
        height: 50,
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        paddingHorizontal: 16,
        marginBottom: 16,
        fontSize: 16,
        backgroundColor: '#f9f9f9',
    },
    button: {
        height: 50,
        backgroundColor: '#34C759',
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 8,
    },
    buttonDisabled: {
        backgroundColor: '#ccc',
    },
    buttonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
    },
    linkButton: {
        marginTop: 20,
        alignItems: 'center',
    },
    linkText: {
        color: '#007AFF',
        fontSize: 16,
    },
    errorText: {
        color: '#FF3B30',
        textAlign: 'center',
        marginBottom: 16,
        fontSize: 14,
    },
});
