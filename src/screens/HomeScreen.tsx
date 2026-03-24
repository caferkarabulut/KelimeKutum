import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { signOut } from 'firebase/auth';
import { doc, setDoc, updateDoc, collection, query, where, getDocs, getDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { useFocusEffect } from '@react-navigation/native';
import { auth, db } from '../firebase/firebase';
import { createDefaultProgress, TestMode } from '../types/srs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList, Question } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

interface Stats {
    totalWords: number;
    activeWords: number;
    masteredWords: number;
    dueCount: number;
}

function shuffle<T>(array: T[]): T[] {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

export default function HomeScreen({ navigation }: Props) {
    const [stats, setStats] = useState<Stats>({ totalWords: 0, activeWords: 0, masteredWords: 0, dueCount: 0 });
    const [loading, setLoading] = useState(true);
    const [dueLoading, setDueLoading] = useState(false);
    const [seedLoading, setSeedLoading] = useState(false);
    const [initLoading, setInitLoading] = useState(false);

    const fetchStats = useCallback(async () => {
        const uid = auth.currentUser?.uid;
        if (!uid) return;

        try {

            const userRef = doc(db, 'users', uid);
            const userSnap = await getDoc(userRef);

            let totalWords = 0;
            let activeWords = 0;
            let masteredWords = 0;

            if (userSnap.exists()) {
                const data = userSnap.data();
                totalWords = data.totalWords || 0;
                activeWords = data.activeWords || 0;
                masteredWords = data.masteredWords || 0;
            }


            const now = new Date();
            const wordsQuery = query(
                collection(db, 'words'),
                where('userId', '==', uid),
                where('isActive', '==', true)
            );
            const snapshot = await getDocs(wordsQuery);

            let dueCount = 0;
            snapshot.docs.forEach((docSnap) => {
                const data = docSnap.data();
                const enNext = data.enNextReviewAt;
                const trNext = data.trNextReviewAt;
                const enDue = enNext && (enNext instanceof Timestamp ? enNext.toDate() : new Date(enNext)) <= now;
                const trDue = trNext && (trNext instanceof Timestamp ? trNext.toDate() : new Date(trNext)) <= now;
                if (enDue || trDue) dueCount++;
            });

            setStats({ totalWords, activeWords, masteredWords, dueCount });
        } catch (err) {
            console.error('Failed to fetch stats:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            setLoading(true);
            fetchStats();
        }, [fetchStats])
    );

    const handleLogout = async () => {
        try {
            await signOut(auth);
        } catch (err) {
            console.error('Logout error:', err);
        }
    };

    const handleStartDueTest = async () => {
        const uid = auth.currentUser?.uid;
        if (!uid) return;

        if (stats.dueCount === 0) {
            Alert.alert('No Due Words', 'No words are due for review right now. Try Custom Test instead.');
            return;
        }

        setDueLoading(true);
        try {
            const now = new Date();
            const wordsQuery = query(
                collection(db, 'words'),
                where('userId', '==', uid),
                where('isActive', '==', true)
            );
            const snapshot = await getDocs(wordsQuery);

            const dueWords: { id: string; en: string; tr: string; direction: 'EN_TR' | 'TR_EN' }[] = [];

            snapshot.docs.forEach((docSnap) => {
                const data = docSnap.data();
                const enNext = data.enNextReviewAt;
                const trNext = data.trNextReviewAt;
                const enDue = enNext && (enNext instanceof Timestamp ? enNext.toDate() : new Date(enNext)) <= now;
                const trDue = trNext && (trNext instanceof Timestamp ? trNext.toDate() : new Date(trNext)) <= now;

                if (enDue && trDue) {

                    const direction = Math.random() < 0.5 ? 'EN_TR' : 'TR_EN';
                    dueWords.push({ id: docSnap.id, en: data.en, tr: data.tr, direction });
                } else if (enDue) {
                    dueWords.push({ id: docSnap.id, en: data.en, tr: data.tr, direction: 'EN_TR' });
                } else if (trDue) {
                    dueWords.push({ id: docSnap.id, en: data.en, tr: data.tr, direction: 'TR_EN' });
                }
            });

            if (dueWords.length === 0) {
                Alert.alert('No Due Words', 'No words are due for review right now.');
                setDueLoading(false);
                return;
            }


            const shuffled = shuffle(dueWords);
            const selected = shuffled.slice(0, 20);

            const questions: Question[] = selected.map((w) => ({
                id: w.id,
                en: w.en,
                tr: w.tr,
                direction: w.direction,
            }));

            navigation.navigate('Test', { questions, mode: 'MIXED', isDueTest: true });
        } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed to start due test');
        } finally {
            setDueLoading(false);
        }
    };


    const handleSeedWords = async () => {
        const uid = auth.currentUser?.uid;
        if (!uid) return;

        setSeedLoading(true);
        try {
            const now = new Date();
            const promises = [];
            for (let i = 1; i <= 50; i++) {
                const num = i.toString().padStart(2, '0');
                const en = `seed_word_${num}`;
                const tr = `seed_kelime_${num}`;
                const enNorm = en;
                const docId = `${uid}_${enNorm}`;
                const defaultProgress = createDefaultProgress();

                promises.push(
                    setDoc(doc(db, 'words', docId), {
                        userId: uid,
                        en,
                        tr,
                        enNorm,
                        isActive: true,
                        enProgress: defaultProgress,
                        trProgress: defaultProgress,
                        enNextReviewAt: now,
                        trNextReviewAt: now,
                        createdAt: serverTimestamp(),
                    })
                );
            }
            await Promise.all(promises);


            const userRef = doc(db, 'users', uid);
            const userSnap = await getDoc(userRef);
            if (userSnap.exists()) {
                await updateDoc(userRef, {
                    totalWords: 50,
                    activeWords: 50,
                    masteredWords: 0,
                    updatedAt: serverTimestamp(),
                });
            } else {
                await setDoc(userRef, {
                    totalWords: 50,
                    activeWords: 50,
                    masteredWords: 0,
                    lastWrongIds: [],
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                });
            }

            Alert.alert('Success', 'Seed completed');
            fetchStats();
        } catch (err: any) {
            Alert.alert('Error', err.message || 'Seed failed');
        } finally {
            setSeedLoading(false);
        }
    };


    const handleInitProgress = async () => {
        const uid = auth.currentUser?.uid;
        if (!uid) return;

        setInitLoading(true);
        try {
            const wordsQuery = query(collection(db, 'words'), where('userId', '==', uid));
            const snapshot = await getDocs(wordsQuery);
            const now = new Date();

            const promises: Promise<void>[] = [];
            snapshot.docs.forEach((docSnap) => {
                const data = docSnap.data();
                if (!data.enNextReviewAt || !data.trNextReviewAt) {
                    promises.push(
                        updateDoc(doc(db, 'words', docSnap.id), {
                            isActive: data.isActive ?? true,
                            enProgress: data.enProgress ?? createDefaultProgress(),
                            trProgress: data.trProgress ?? createDefaultProgress(),
                            enNextReviewAt: data.enNextReviewAt ?? now,
                            trNextReviewAt: data.trNextReviewAt ?? now,
                        })
                    );
                }
            });

            await Promise.all(promises);
            Alert.alert('Başarılı', `${promises.length} kelime için ilerleme başlatıldı`);
            fetchStats();
        } catch (err: any) {
            Alert.alert('Hata', err.message || 'Başlatma başarısız');
        } finally {
            setInitLoading(false);
        }
    };

    if (loading) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color="#007AFF" />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.userInfo}>
                <Text style={styles.emailLabel}>Giriş yapan:</Text>
                <Text style={styles.email}>{auth.currentUser?.email}</Text>
            </View>


            <View style={styles.statsContainer}>
                <View style={styles.statCard}>
                    <Text style={styles.statNumber}>{stats.totalWords}</Text>
                    <Text style={styles.statLabel}>Toplam</Text>
                </View>
                <View style={styles.statCard}>
                    <Text style={[styles.statNumber, { color: '#34C759' }]}>{stats.activeWords}</Text>
                    <Text style={styles.statLabel}>Aktif</Text>
                </View>
                <View style={styles.statCard}>
                    <Text style={[styles.statNumber, { color: '#FF9500' }]}>{stats.dueCount}</Text>
                    <Text style={styles.statLabel}>Tekrar</Text>
                </View>
            </View>


            <View style={styles.menuContainer}>
                <TouchableOpacity
                    style={[styles.menuButton, styles.dueButton, (dueLoading || stats.dueCount === 0) && styles.buttonDisabled]}
                    onPress={handleStartDueTest}
                    disabled={dueLoading || stats.dueCount === 0}
                >
                    {dueLoading ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.menuButtonText}>
                            Tekrara Başla ({stats.dueCount})
                        </Text>
                    )}
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.menuButton, styles.customButton]}
                    onPress={() => navigation.navigate('TestSetup')}
                >
                    <Text style={styles.menuButtonText}>Test Oluştur</Text>
                </TouchableOpacity>

                <View style={styles.rowButtons}>
                    <TouchableOpacity
                        style={[styles.halfButton, styles.poolButton]}
                        onPress={() => navigation.navigate('Pool')}
                    >
                        <Text style={styles.halfButtonText}>Havuzum</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.halfButton, styles.addButton]}
                        onPress={() => navigation.navigate('AddWord')}
                    >
                        <Text style={styles.halfButtonText}>Kelime Ekle</Text>
                    </TouchableOpacity>
                </View>


                {__DEV__ && (
                    <View style={styles.devContainer}>
                        <TouchableOpacity
                            style={[styles.devButton, seedLoading && styles.buttonDisabled]}
                            onPress={handleSeedWords}
                            disabled={seedLoading}
                        >
                            {seedLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.devButtonText}>Seed 50</Text>}
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.devButton, initLoading && styles.buttonDisabled]}
                            onPress={handleInitProgress}
                            disabled={initLoading}
                        >
                            {initLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.devButtonText}>Init Progress</Text>}
                        </TouchableOpacity>
                    </View>
                )}
            </View>

            <TouchableOpacity style={styles.logoutButton} onPress={() => navigation.navigate('Profile')}>
                <Text style={styles.logoutButtonText}>👤 Profil & Ayarlar</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
        paddingHorizontal: 20,
        paddingTop: 20,
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f5f5f5',
    },
    userInfo: {
        alignItems: 'center',
        marginBottom: 20,
    },
    emailLabel: {
        fontSize: 12,
        color: '#666',
    },
    email: {
        fontSize: 14,
        color: '#333',
        fontWeight: '500',
    },
    statsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 24,
    },
    statCard: {
        flex: 1,
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginHorizontal: 4,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    statNumber: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#333',
    },
    statLabel: {
        fontSize: 12,
        color: '#666',
        marginTop: 4,
    },
    menuContainer: {
        flex: 1,
    },
    menuButton: {
        height: 56,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    dueButton: {
        backgroundColor: '#FF9500',
    },
    customButton: {
        backgroundColor: '#5856D6',
    },
    buttonDisabled: {
        backgroundColor: '#ccc',
    },
    menuButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
    },
    rowButtons: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    halfButton: {
        flex: 1,
        height: 50,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        marginHorizontal: 4,
    },
    poolButton: {
        backgroundColor: '#007AFF',
    },
    addButton: {
        backgroundColor: '#34C759',
    },
    halfButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    devContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 8,
    },
    devButton: {
        flex: 1,
        height: 40,
        backgroundColor: '#FF9500',
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        marginHorizontal: 4,
    },
    devButtonText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '600',
    },
    logoutButton: {
        height: 44,
        backgroundColor: '#FF3B30',
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    logoutButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});
