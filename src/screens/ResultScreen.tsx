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
import { doc, updateDoc, serverTimestamp, setDoc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
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
    const { score, correct, wrong, wrongItems, wrongIds, mode } = route.params;
    const [saved, setSaved] = useState(false);
    const [retryLoading, setRetryLoading] = useState(false);

    useEffect(() => {
        const saveWrongIds = async () => {
            if (saved) return;

            const uid = auth.currentUser?.uid;
            if (!uid) return;

            try {
                const userRef = doc(db, 'users', uid);
                const userSnap = await getDoc(userRef);

                if (userSnap.exists()) {
                    await updateDoc(userRef, {
                        lastWrongIds: wrongIds,
                        lastWrongUpdatedAt: serverTimestamp(),
                    });
                } else {
                    await setDoc(userRef, {
                        lastWrongIds: wrongIds,
                        lastWrongUpdatedAt: serverTimestamp(),
                        createdAt: serverTimestamp(),
                        totalWords: 0,
                        activeWords: 0,
                        masteredWords: 0,
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

            const wrongWordMap = new Map<string, { en: string; tr: string }>();
            snapshot.docs.forEach((docSnap) => {
                if (wrongIds.includes(docSnap.id)) {
                    const data = docSnap.data();
                    wrongWordMap.set(docSnap.id, { en: data.en, tr: data.tr });
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
                    });
                }
            }

            if (questions.length === 0) {
                Alert.alert('Error', 'Could not find the wrong words');
                setRetryLoading(false);
                return;
            }


            const shuffled = shuffle(questions);
            const selected = shuffled.slice(0, 20);

            navigation.replace('Test', { questions: selected, mode });
        } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed to start retry test');
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
                <Text style={styles.scoreLabel}>Score</Text>
            </View>

            <View style={styles.statsContainer}>
                <View style={styles.statBox}>
                    <Text style={[styles.statNumber, { color: '#34C759' }]}>{correct}</Text>
                    <Text style={styles.statLabel}>Correct</Text>
                </View>
                <View style={styles.statBox}>
                    <Text style={[styles.statNumber, { color: '#FF3B30' }]}>{wrong}</Text>
                    <Text style={styles.statLabel}>Wrong</Text>
                </View>
            </View>

            {wrongItems.length > 0 && (
                <View style={styles.wrongSection}>
                    <Text style={styles.wrongTitle}>Wrong Answers:</Text>
                    {wrongItems.map((item, index) => (
                        <View key={index} style={styles.wrongCard}>
                            <Text style={styles.wrongPrompt}>{item.prompt}</Text>
                            <Text style={styles.wrongExpected}>Expected: {item.expected}</Text>
                            <Text style={styles.wrongAnswer}>Your answer: {item.userAnswer || '(empty)'}</Text>
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
                            <Text style={styles.buttonText}>Retry Wrong Only ({wrongIds.length})</Text>
                        )}
                    </TouchableOpacity>
                )}

                <TouchableOpacity
                    style={styles.homeButton}
                    onPress={() => navigation.navigate('Home')}
                >
                    <Text style={styles.buttonText}>Back to Home</Text>
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
