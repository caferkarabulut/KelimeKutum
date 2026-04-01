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
    ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { doc, setDoc, getDoc, updateDoc, increment, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase/firebase';
import { createDefaultProgress } from '../types/srs';
import { useTheme } from '../context/ThemeContext';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'AddWord'>;

const MAX_EN = 80;
const MAX_MEANING = 60;

function normalize(text: string): string {
    return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

export default function AddWordScreen({ navigation, route }: Props) {
    const { colors, isDark } = useTheme();
    const editParams = route.params;
    const isEdit = !!editParams?.editWordId;

    const [en, setEn] = useState(editParams?.currentEn || '');
    const [meanings, setMeanings] = useState<string[]>(
        editParams?.currentMeanings && editParams.currentMeanings.length > 0
            ? editParams.currentMeanings
            : ['']
    );
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const addMeaningBox = () => {
        if (meanings.length >= 5) {
            Alert.alert('Limit', 'En fazla 5 anlam ekleyebilirsiniz');
            return;
        }
        setMeanings([...meanings, '']);
    };

    const removeMeaningBox = (index: number) => {
        if (meanings.length <= 1) return;
        setMeanings(meanings.filter((_, i) => i !== index));
    };

    const updateMeaning = (index: number, text: string) => {
        const updated = [...meanings];
        updated[index] = text;
        setMeanings(updated);
    };

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
        const validMeanings = meanings.map(m => m.trim()).filter(m => m.length > 0);

        if (!trimmedEn || validMeanings.length === 0) {
            setError('İngilizce kelime ve en az bir anlam girin');
            return;
        }

        const normalizedEn = normalize(trimmedEn);
        const docId = `${uid}_${normalizedEn}`;

        setLoading(true);
        try {
            if (isEdit) {
                const wordRef = doc(db, 'words', editParams.editWordId!);
                await updateDoc(wordRef, {
                    meanings: validMeanings,
                    tr: validMeanings.join(', '),
                    updatedAt: serverTimestamp(),
                });

                Alert.alert('Başarılı', 'Kelime anlamları güncellendi!', [
                    { text: 'Tamam', onPress: () => navigation.goBack() },
                ]);
            } else {
                const docId = `${uid}_${normalize(trimmedEn)}`;
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
                    tr: validMeanings.join(', '),
                    meanings: validMeanings,
                    enNorm: normalize(trimmedEn),
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
                setMeanings(['']);

                Alert.alert('Başarılı', 'Kelime eklendi!', [
                    { text: 'Tamam', onPress: () => navigation.goBack() },
                ]);
            }
        } catch (err: any) {
            setError(err.message || 'Kelime kaydedilemedi');
        } finally {
            setLoading(false);
        }
    };

    return (
        <LinearGradient colors={[colors.backgroundGradientStart, colors.backgroundGradientEnd]} style={styles.gradient}>
            <KeyboardAvoidingView
                style={styles.container}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                <ScrollView contentContainerStyle={styles.scrollContent}>
                    <Text style={[styles.title, { color: colors.text }]}>
                        {isEdit ? 'Anlam Düzenle' : 'Yeni Kelime Ekle'}
                    </Text>

                    {error ? <Text style={styles.errorText}>{error}</Text> : null}

                    <View style={styles.card}>
                        <View style={styles.inputGroup}>
                            <View style={styles.labelRow}>
                                <Text style={styles.label}>🇬🇧 İngilizce</Text>
                                <Text style={styles.charCount}>{en.length}/{MAX_EN}</Text>
                            </View>
                            <TextInput
                                style={[styles.input, isEdit && styles.inputDisabled]}
                                placeholder="İngilizce kelime"
                                placeholderTextColor="#999"
                                value={en}
                                onChangeText={setEn}
                                autoCapitalize="none"
                                autoCorrect={false}
                                maxLength={MAX_EN}
                                editable={!isEdit}
                            />
                            {isEdit && (
                                <Text style={styles.editWarning}>
                                    İngilizce kelimeler değiştirilemez. Sadece anlamlarını değiştirebilirsiniz.
                                </Text>
                            )}
                        </View>

                        <View style={styles.meaningsSection}>
                            <View style={styles.labelRow}>
                                <Text style={styles.label}>🇹🇷 Türkçe Anlamlar</Text>
                                <TouchableOpacity style={styles.addButton} onPress={addMeaningBox}>
                                    <Text style={styles.addButtonText}>+ Anlam Ekle</Text>
                                </TouchableOpacity>
                            </View>

                            {meanings.map((meaning, index) => (
                                <View key={index} style={styles.meaningRow}>
                                    <View style={styles.meaningBadge}>
                                        <Text style={styles.meaningBadgeText}>{index + 1}</Text>
                                    </View>
                                    <TextInput
                                        style={styles.meaningInput}
                                        placeholder={`${index + 1}. anlam`}
                                        placeholderTextColor="#999"
                                        value={meaning}
                                        onChangeText={(text) => updateMeaning(index, text)}
                                        maxLength={MAX_MEANING}
                                    />
                                    {meanings.length > 1 && (
                                        <TouchableOpacity
                                            style={styles.removeButton}
                                            onPress={() => removeMeaningBox(index)}
                                        >
                                            <Text style={styles.removeButtonText}>✕</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            ))}

                            <Text style={styles.hintText}>
                                💡 Örnek: patient → 1. hasta  2. sabırlı  3. müşteri
                            </Text>
                        </View>
                    </View>

                    <TouchableOpacity
                        style={[styles.saveButton, loading && styles.buttonDisabled]}
                        onPress={handleSave}
                        disabled={loading}
                        activeOpacity={0.8}
                    >
                        <LinearGradient
                            colors={loading ? ['#ccc', '#ccc'] : ['#34C759', '#2DB44D']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.saveButtonGradient}
                        >
                            <Text style={styles.saveButtonText}>
                                {loading ? 'Kaydediliyor...' : 'Kaydet'}
                            </Text>
                        </LinearGradient>
                    </TouchableOpacity>
                </ScrollView>
            </KeyboardAvoidingView>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    gradient: {
        flex: 1,
    },
    container: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 24,
        paddingTop: 24,
        paddingBottom: 40,
    },
    title: {
        fontSize: 24,
        fontWeight: '700',
        textAlign: 'center',
        marginBottom: 24,
        color: '#333',
    },
    card: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 5,
        marginBottom: 20,
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
        borderColor: '#eee',
        borderRadius: 12,
        paddingHorizontal: 16,
        fontSize: 16,
        backgroundColor: '#f5f6fa',
        color: '#333',
    },
    inputDisabled: {
        backgroundColor: '#e0e0e0',
        color: '#888',
    },
    editWarning: {
        fontSize: 12,
        color: '#FF9500',
        marginTop: 6,
        fontStyle: 'italic',
    },
    meaningsSection: {
        marginBottom: 4,
    },
    addButton: {
        backgroundColor: '#E8F5E9',
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 16,
    },
    addButtonText: {
        color: '#34C759',
        fontSize: 13,
        fontWeight: '600',
    },
    meaningRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
        gap: 8,
    },
    meaningBadge: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#5856D6',
        justifyContent: 'center',
        alignItems: 'center',
    },
    meaningBadgeText: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '700',
    },
    meaningInput: {
        flex: 1,
        height: 46,
        borderWidth: 1,
        borderColor: '#eee',
        borderRadius: 10,
        paddingHorizontal: 14,
        fontSize: 15,
        backgroundColor: '#f5f6fa',
        color: '#333',
    },
    removeButton: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: '#FFE5E5',
        justifyContent: 'center',
        alignItems: 'center',
    },
    removeButtonText: {
        color: '#FF3B30',
        fontSize: 14,
        fontWeight: '700',
    },
    hintText: {
        fontSize: 12,
        color: '#999',
        marginTop: 8,
        fontStyle: 'italic',
    },
    saveButton: {
        borderRadius: 14,
        overflow: 'hidden',
        shadowColor: '#34C759',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
    },
    saveButtonGradient: {
        height: 54,
        justifyContent: 'center',
        alignItems: 'center',
    },
    saveButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '700',
    },
    buttonDisabled: {
        shadowOpacity: 0,
        elevation: 0,
    },
    errorText: {
        color: '#FF3B30',
        textAlign: 'center',
        marginBottom: 16,
        fontSize: 14,
        backgroundColor: '#FFF5F5',
        padding: 10,
        borderRadius: 8,
    },
});
