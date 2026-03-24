import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
    Alert,
} from 'react-native';
import { doc, setDoc, getDoc, updateDoc, increment, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase/firebase';
import { createDefaultProgress } from '../types/srs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'AddWord'>;

const MAX_EN = 80;
const MAX_TR = 120;

function normalize(text: string): string {
    return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

export default function AddWordScreen({ navigation }: Props) {
    const [en, setEn] = useState('');
    const [tr, setTr] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSave = async () => {
        setError('');

        const uid = auth.currentUser?.uid;
        if (!uid) {
            navigation.reset({
                index: 0,
                routes: [{ name: 'Login' }],
            });
            return;
        }

        const trimmedEn = en.trim();
        const trimmedTr = tr.trim();

        if (!trimmedEn || !trimmedTr) {
            setError('Please fill in both fields');
            return;
        }

        const normalizedEn = normalize(trimmedEn);
        const docId = `${uid}_${normalizedEn}`;

        setLoading(true);
        try {
            const wordRef = doc(db, 'words', docId);
            const snap = await getDoc(wordRef);

            if (snap.exists()) {
                setError('Bu kelime zaten ekli');
                setLoading(false);
                return;
            }

            const defaultProgress = createDefaultProgress();
            const now = new Date();

            await setDoc(wordRef, {
                userId: uid,
                en: trimmedEn,
                tr: trimmedTr,
                enNorm: normalizedEn,
                isActive: true,
                enProgress: defaultProgress,
                trProgress: defaultProgress,
                enNextReviewAt: now,
                trNextReviewAt: now,
                createdAt: serverTimestamp(),
            });


            const userRef = doc(db, 'users', uid);
            const userSnap = await getDoc(userRef);

            if (userSnap.exists()) {
                await updateDoc(userRef, {
                    totalWords: increment(1),
                    activeWords: increment(1),
                    updatedAt: serverTimestamp(),
                });
            } else {
                await setDoc(userRef, {
                    totalWords: 1,
                    activeWords: 1,
                    masteredWords: 0,
                    lastWrongIds: [],
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                });
            }

            setEn('');
            setTr('');

            Alert.alert('Başarılı', 'Kelime kaydedildi!', [
                { text: 'Tamam', onPress: () => navigation.goBack() },
            ]);
        } catch (err: any) {
            setError(err.message || 'Kelime kaydedilemedi');
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <View style={styles.innerContainer}>
                <Text style={styles.title}>Yeni Kelime Ekle</Text>

                {error ? <Text style={styles.errorText}>{error}</Text> : null}

                <View style={styles.inputGroup}>
                    <View style={styles.labelRow}>
                        <Text style={styles.label}>İngilizce</Text>
                        <Text style={styles.charCount}>{en.length}/{MAX_EN}</Text>
                    </View>
                    <TextInput
                        style={styles.input}
                        placeholder="İngilizce kelime"
                        value={en}
                        onChangeText={setEn}
                        autoCapitalize="none"
                        autoCorrect={false}
                        maxLength={MAX_EN}
                    />
                </View>

                <View style={styles.inputGroup}>
                    <View style={styles.labelRow}>
                        <Text style={styles.label}>Türkçe</Text>
                        <Text style={styles.charCount}>{tr.length}/{MAX_TR}</Text>
                    </View>
                    <TextInput
                        style={styles.input}
                        placeholder="Türkçe karşılığı"
                        value={tr}
                        onChangeText={setTr}
                        maxLength={MAX_TR}
                    />
                </View>

                <TouchableOpacity
                    style={[styles.button, loading && styles.buttonDisabled]}
                    onPress={handleSave}
                    disabled={loading}
                >
                    <Text style={styles.buttonText}>
                        {loading ? 'Kaydediliyor...' : 'Kaydet'}
                    </Text>
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    innerContainer: {
        flex: 1,
        paddingHorizontal: 24,
        paddingTop: 32,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 32,
        color: '#333',
    },
    inputGroup: {
        marginBottom: 20,
    },
    labelRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    label: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
    },
    charCount: {
        fontSize: 12,
        color: '#999',
    },
    input: {
        height: 50,
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        paddingHorizontal: 16,
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
    errorText: {
        color: '#FF3B30',
        textAlign: 'center',
        marginBottom: 16,
        fontSize: 14,
    },
});
