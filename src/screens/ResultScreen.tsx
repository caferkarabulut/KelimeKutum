import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    ActivityIndicator,
    Alert,
} from 'react-native';
import { doc, updateDoc, serverTimestamp, setDoc, getDoc, collection, query, where, getDocs, increment } from 'firebase/firestore';
import { auth, db } from '../firebase/firebase';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList, Question } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Result'>;

function shuffle<T>(array: T[]): T[] {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

export default function ResultScreen({ route, navigation }: Props) {
    const { score, correct, wrong, wrongItems, wrongIds, mode, masteredCandidates } = route.params;
    const [saved, setSaved] = useState(false);
    const [retryLoading, setRetryLoading] = useState(false);
    const [promptedMastery, setPromptedMastery] = useState(false);

    useEffect(() => {
        const saveWrongIds = async () => {
            if (saved) return;

            const uid = auth.currentUser?.uid;
            if (!uid) return;

            try {
                const userRef = doc(db, 'users', uid);
                const userSnap = await getDoc(userRef);

                const now = new Date();
                const todayStr = now.toISOString().split('T')[0];
                const yesterday = new Date(now);
                yesterday.setDate(yesterday.getDate() - 1);
                const yesterdayStr = yesterday.toISOString().split('T')[0];

                const totalQuestions = correct + wrong;

                if (userSnap.exists()) {
                    const data = userSnap.data();
                    const lastStudyDate = data.lastStudyDate || '';
                    let currentStreak = data.currentStreak || 0;
                    let maxStreak = data.maxStreak || 0;
                    let todayStudiedCount = data.todayStudiedCount || 0;
                    let todayStudiedDate = data.todayStudiedDate || '';

                    if (lastStudyDate === yesterdayStr) {
                        currentStreak += 1;
                    } else if (lastStudyDate !== todayStr) {
                        currentStreak = 1;
                    }

                    if (currentStreak > maxStreak) {
                        maxStreak = currentStreak;
                    }

                    if (todayStudiedDate === todayStr) {
                        todayStudiedCount += totalQuestions;
                    } else {
                        todayStudiedDate = todayStr;
                        todayStudiedCount = totalQuestions;
                    }

                    await updateDoc(userRef, {
                        lastWrongIds: wrongIds,
                        lastWrongUpdatedAt: serverTimestamp(),
                        totalTests: increment(1),
                        totalCorrect: increment(correct),
                        totalWrong: increment(wrong),
                        currentStreak,
                        maxStreak,
                        lastStudyDate: todayStr,
                        todayStudiedDate,
                        todayStudiedCount,
                    });
                } else {
                    await setDoc(userRef, {
                        lastWrongIds: wrongIds,
                        lastWrongUpdatedAt: serverTimestamp(),
                        createdAt: serverTimestamp(),
                        totalWords: 0,
                        activeWords: 0,
                        masteredWords: 0,
                        totalTests: 1,
                        totalCorrect: correct,
                        totalWrong: wrong,
                        currentStreak: 1,
                        maxStreak: 1,
                        lastStudyDate: todayStr,
                        todayStudiedDate: todayStr,
                        todayStudiedCount: totalQuestions,
                        dailyGoal: 20,
                    });
                }

                if (__DEV__) {
                    console.log('=== RESULT: SAVED WRONG IDS ===');
                    console.log('wrongIds:', wrongIds);
                    console.log('===============================');
                }

                setSaved(true);
            } catch (err) {
                console.error('Failed to save wrong ids:', err);
            }
        };

        saveWrongIds();
    }, [wrongIds, saved]);

    useEffect(() => {
        if (!promptedMastery && masteredCandidates && masteredCandidates.length > 0) {
            setPromptedMastery(true);
            const wordsStr = masteredCandidates.map(c => c.en).join(', ');
            Alert.alert(
                'Tebrikler!',
                `Aşağıdaki kelimeleri 20 testtir hiç yanlış yapmadınız:\n\n${wordsStr}\n\nBu kelimeleri "Ezberlendi" olarak işaretlemek ister misiniz? (Artık testlerde karşınıza çıkmazlar)`,
                [
                    { text: 'Hayır', style: 'cancel' },
                    {
                        text: 'Evet, Ezberlendi Yap',
                        onPress: async () => {
                            const uid = auth.currentUser?.uid;
                            if (!uid) return;
                            try {
                                const userRef = doc(db, 'users', uid);
                                let count = 0;
                                for (const candidate of masteredCandidates) {
                                    const wordRef = doc(db, 'words', candidate.id);
                                    await updateDoc(wordRef, { isActive: false });
                                    count++;
                                }
                                await updateDoc(userRef, {
                                    activeWords: increment(-count),
                                    masteredWords: increment(count),
                                });
                                Alert.alert('Başarılı', `${count} adet kelime ezberlendi olarak işaretlendi!`);
                            } catch (err: any) {
                                Alert.alert('Hata', err.message || 'Ezberlendi durumu güncellenemedi');
                            }
                        }
                    }
                ]
            );
        }
    }, [masteredCandidates, promptedMastery]);

    const handleRetryWrongOnly = async () => {
        if (wrongIds.length === 0) {
            Alert.alert('No Wrong Answers', 'All answers were correct!');
            return;
        }

        const uid = auth.currentUser?.uid;
        if (!uid) return;

        setRetryLoading(true);
        try {

            const wordsQuery = query(
                collection(db, 'words'),
                where('userId', '==', uid)
            );
            const snapshot = await getDocs(wordsQuery);

            const wrongWordMap = new Map<string, { en: string; tr: string; meanings: string[] }>();
            snapshot.docs.forEach((docSnap) => {
                if (wrongIds.includes(docSnap.id)) {
                    const data = docSnap.data();
                    const meanings: string[] = data.meanings && Array.isArray(data.meanings)
                        ? data.meanings
                        : (data.tr ? data.tr.split(',').map((s: string) => s.trim()).filter((s: string) => s.length > 0) : []);
                    wrongWordMap.set(docSnap.id, { en: data.en, tr: data.tr, meanings });
                }
            });

            const questions: Question[] = [];
            for (const id of wrongIds) {
                const wordData = wrongWordMap.get(id);
                if (wordData) {
                    let direction: 'EN_TR' | 'TR_EN';
                    if (mode === 'MIXED') {
                        direction = Math.random() < 0.5 ? 'EN_TR' : 'TR_EN';
                    } else {
                        direction = mode;
                    }
                    questions.push({
                        id,
                        en: wordData.en,
                        tr: wordData.tr,
                        direction,
                        meanings: wordData.meanings,
                    });
                }
            }

            if (questions.length === 0) {
                Alert.alert('Hata', 'Yanlış yapılan kelimeler bulunamadı');
                setRetryLoading(false);
                return;
            }


            const shuffled = shuffle(questions);
            const selected = shuffled.slice(0, 20);

            navigation.replace('Test', { questions: selected, mode });
        } catch (err: any) {
            Alert.alert('Hata', err.message || 'Test başlatılamadı');
        } finally {
            setRetryLoading(false);
        }
    };

    const getScoreColor = () => {
        if (score >= 80) return '#34C759';
        if (score >= 50) return '#FF9500';
        return '#FF3B30';
    };

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <View style={[styles.scoreContainer, { borderColor: getScoreColor() }]}>
                <Text style={[styles.scoreText, { color: getScoreColor() }]}>{score}%</Text>
                <Text style={styles.scoreLabel}>Skor</Text>
            </View>

            <View style={styles.statsContainer}>
                <View style={styles.statBox}>
                    <Text style={[styles.statNumber, { color: '#34C759' }]}>{correct}</Text>
                    <Text style={styles.statLabel}>Doğru</Text>
                </View>
                <View style={styles.statBox}>
                    <Text style={[styles.statNumber, { color: '#FF3B30' }]}>{wrong}</Text>
                    <Text style={styles.statLabel}>Yanlış</Text>
                </View>
            </View>

            {wrongItems.length > 0 && (
                <View style={styles.wrongSection}>
                    <Text style={styles.wrongTitle}>Yanlış Cevaplar:</Text>
                    {wrongItems.map((item, index) => (
                        <View key={index} style={styles.wrongCard}>
                            <Text style={styles.wrongPrompt}>{item.prompt}</Text>
                            <Text style={styles.wrongExpected}>Doğru: {item.expected}</Text>
                            <Text style={styles.wrongAnswer}>Senin cevabın: {item.userAnswer || '(boş)'}</Text>
                        </View>
                    ))}
                </View>
            )}

            <View style={styles.buttonContainer}>
                {wrongIds.length > 0 && (
                    <TouchableOpacity
                        style={[styles.retryButton, retryLoading && styles.buttonDisabled]}
                        onPress={handleRetryWrongOnly}
                        disabled={retryLoading}
                    >
                        {retryLoading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.buttonText}>Sadece Yanlışları Tekrarla ({wrongIds.length})</Text>
                        )}
                    </TouchableOpacity>
                )}

                <TouchableOpacity
                    style={styles.homeButton}
                    onPress={() => navigation.navigate('Home')}
                >
                    <Text style={styles.buttonText}>Ana Ekrana Dön</Text>
                </TouchableOpacity>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    content: {
        padding: 24,
        alignItems: 'center',
    },
    scoreContainer: {
        width: 150,
        height: 150,
        borderRadius: 75,
        borderWidth: 6,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
    },
    scoreText: {
        fontSize: 48,
        fontWeight: 'bold',
    },
    scoreLabel: {
        fontSize: 16,
        color: '#666',
    },
    statsContainer: {
        flexDirection: 'row',
        marginBottom: 32,
    },
    statBox: {
        alignItems: 'center',
        marginHorizontal: 24,
    },
    statNumber: {
        fontSize: 36,
        fontWeight: 'bold',
    },
    statLabel: {
        fontSize: 14,
        color: '#666',
    },
    wrongSection: {
        width: '100%',
        marginBottom: 24,
    },
    wrongTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#333',
        marginBottom: 12,
    },
    wrongCard: {
        backgroundColor: '#FFF5F5',
        borderRadius: 8,
        padding: 12,
        marginBottom: 8,
        borderLeftWidth: 3,
        borderLeftColor: '#FF3B30',
    },
    wrongPrompt: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
        marginBottom: 4,
    },
    wrongExpected: {
        fontSize: 14,
        color: '#34C759',
        marginBottom: 2,
    },
    wrongAnswer: {
        fontSize: 14,
        color: '#FF3B30',
    },
    buttonContainer: {
        width: '100%',
    },
    retryButton: {
        height: 56,
        backgroundColor: '#FF9500',
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    homeButton: {
        height: 56,
        backgroundColor: '#007AFF',
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    buttonDisabled: {
        backgroundColor: '#ccc',
    },
    buttonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
    },
});
