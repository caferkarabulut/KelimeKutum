import React, { useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Alert,
    ActivityIndicator,
} from 'react-native';
import { collection, query, where, getDocs, doc, getDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { auth, db } from '../firebase/firebase';
import { TestMode, Progress, createDefaultProgress } from '../types/srs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList, Question } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'TestSetup'>;

const TEST_SIZES = [10, 20, 30, 50] as const;
const TEST_MODES: { value: TestMode; label: string }[] = [
    { value: 'EN_TR', label: 'İng → Tr' },
    { value: 'TR_EN', label: 'Tr → İng' },
    { value: 'MIXED', label: 'Karışık' },
];
const REQUIRED_ACTIVE_WORDS = 50;
const WRONG_BOOST_RATIO = 0.15;

interface WordData {
    id: string;
    en: string;
    tr: string;
    meanings: string[];
    isActive: boolean;
    enNextReviewAt: Timestamp | Date | null;
    trNextReviewAt: Timestamp | Date | null;
    enProgress: Progress;
    trProgress: Progress;
}

function shuffle<T>(array: T[]): T[] {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function getTimestamp(value: Timestamp | Date | null | undefined): number {
    if (!value) return 0;
    if (value instanceof Timestamp) return value.toMillis();
    if (value instanceof Date) return value.getTime();
    return 0;
}

function isDue(nextReviewAt: Timestamp | Date | null, now: number): boolean {
    const nextReview = getTimestamp(nextReviewAt);
    return nextReview <= now;
}

export default function TestSetupScreen({ navigation }: Props) {
    const [selectedSize, setSelectedSize] = useState<number>(20);
    const [selectedMode, setSelectedMode] = useState<TestMode>('MIXED');
    const [loading, setLoading] = useState(false);

    const handleStart = async () => {
        const uid = auth.currentUser?.uid;
        if (!uid) {
            navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
            return;
        }

        setLoading(true);
        try {

            const wordsQuery = query(
                collection(db, 'words'),
                where('userId', '==', uid),
                where('isActive', '==', true)
            );
            const wordsSnapshot = await getDocs(wordsQuery);

            const activeWords: WordData[] = wordsSnapshot.docs.map((d) => {
                const data = d.data();
                // Support both old tr string and new meanings array
                const meanings: string[] = data.meanings && Array.isArray(data.meanings)
                    ? data.meanings
                    : (data.tr ? (data.tr as string).split(',').map((s: string) => s.trim()).filter((s: string) => s.length > 0) : []);
                return {
                    id: d.id,
                    en: data.en as string,
                    tr: data.tr as string,
                    meanings,
                    isActive: true,
                    enNextReviewAt: data.enNextReviewAt ?? null,
                    trNextReviewAt: data.trNextReviewAt ?? null,
                    enProgress: data.enProgress || createDefaultProgress(),
                    trProgress: data.trProgress || createDefaultProgress(),
                };
            });

            if (activeWords.length < REQUIRED_ACTIVE_WORDS) {
                Alert.alert(
                    'Yetersiz Kelime',
                    `Test başlatmak için en az ${REQUIRED_ACTIVE_WORDS} aktif kelimeniz olmalı. Aktif: ${activeWords.length}.`
                );
                setLoading(false);
                return;
            }


            let lastWrongIds: string[] = [];
            let recentTestWordIds: string[] = [];
            try {
                const userDoc = await getDoc(doc(db, 'users', uid));
                if (userDoc.exists()) {
                    lastWrongIds = userDoc.data().lastWrongIds || [];
                    recentTestWordIds = userDoc.data().recentTestWordIds || [];
                }
            } catch (e) {
                console.error('Failed to fetch user doc:', e);
            }

            // Filter out words from last 2 tests (ban list)
            const bannedSet = new Set(recentTestWordIds);

            const now = Date.now();
            const boostCount = Math.round(selectedSize * WRONG_BOOST_RATIO);


            const activeWordIds = new Set(activeWords.map((w) => w.id));

            // Remove banned words from active pool (if enough words remain)
            let availableWords = activeWords;
            if (activeWords.length - recentTestWordIds.length >= selectedSize) {
                availableWords = activeWords.filter(w => !bannedSet.has(w.id));
            }


            const validWrongIds = lastWrongIds.filter((id) => activeWordIds.has(id));
            const wrongBoostIds = shuffle(validWrongIds).slice(0, boostCount);
            const wrongBoostSet = new Set(wrongBoostIds);

            const wrongPick: { word: WordData; direction: 'EN_TR' | 'TR_EN' }[] = [];
            for (const id of wrongBoostIds) {
                const word = activeWords.find((w) => w.id === id);
                if (word) {
                    let direction: 'EN_TR' | 'TR_EN';
                    if (selectedMode === 'MIXED') {
                        direction = Math.random() < 0.5 ? 'EN_TR' : 'TR_EN';
                    } else {
                        direction = selectedMode;
                    }
                    wrongPick.push({ word, direction });
                }
            }


            const remainingAfterWrong = selectedSize - wrongPick.length;
            const duePool: { word: WordData; direction: 'EN_TR' | 'TR_EN' }[] = [];

            for (const word of availableWords) {
                if (wrongBoostSet.has(word.id)) continue;

                let direction: 'EN_TR' | 'TR_EN';
                let nextReviewAt: Timestamp | Date | null;

                if (selectedMode === 'MIXED') {
                    const enDue = isDue(word.enNextReviewAt, now);
                    const trDue = isDue(word.trNextReviewAt, now);

                    if (enDue && trDue) {
                        direction = Math.random() < 0.5 ? 'EN_TR' : 'TR_EN';
                        nextReviewAt = direction === 'EN_TR' ? word.enNextReviewAt : word.trNextReviewAt;
                    } else if (enDue) {
                        direction = 'EN_TR';
                        nextReviewAt = word.enNextReviewAt;
                    } else if (trDue) {
                        direction = 'TR_EN';
                        nextReviewAt = word.trNextReviewAt;
                    } else {
                        continue;
                    }
                } else {
                    direction = selectedMode;
                    nextReviewAt = direction === 'EN_TR' ? word.enNextReviewAt : word.trNextReviewAt;
                    if (!isDue(nextReviewAt, now)) continue;
                }

                duePool.push({ word, direction });
            }

            const shuffledDue = shuffle(duePool);
            const duePick = shuffledDue.slice(0, remainingAfterWrong);
            const duePickSet = new Set(duePick.map((p) => p.word.id));


            const remainingAfterDue = selectedSize - wrongPick.length - duePick.length;
            const restPool: { word: WordData; direction: 'EN_TR' | 'TR_EN'; weight: number }[] = [];

            for (const word of availableWords) {
                if (wrongBoostSet.has(word.id)) continue;
                if (duePickSet.has(word.id)) continue;

                let direction: 'EN_TR' | 'TR_EN';
                if (selectedMode === 'MIXED') {
                    direction = Math.random() < 0.5 ? 'EN_TR' : 'TR_EN';
                } else {
                    direction = selectedMode;
                }

                const progress = direction === 'EN_TR' ? word.enProgress : word.trProgress;
                
                // Weighting Algorithm
                // Base weight = 10
                // Penalty for high streak: -2 per streak
                // Reward for high wrong count: +5 per wrong
                let weight = 10 + (progress.wrongCount * 5) - (progress.streak * 2);
                if (weight < 1) weight = 1;

                restPool.push({ word, direction, weight });
            }

            // Weighted Random Shuffle
            const weightedRest = restPool.map(item => ({
                ...item,
                sortScore: Math.random() * item.weight
            })).sort((a, b) => b.sortScore - a.sortScore);

            const fillPick = weightedRest.slice(0, remainingAfterDue);


            const allPicks = [...wrongPick, ...duePick, ...fillPick];
            const finalShuffled = shuffle(allPicks);

            const questions: Question[] = finalShuffled.map((item) => ({
                id: item.word.id,
                en: item.word.en,
                tr: item.word.tr,
                meanings: item.word.meanings,
                direction: item.direction,
            }));

            // Save current test word IDs to recentTestWordIds (keep last 2 tests)
            const currentTestWordIds = questions.map(q => q.id);
            const uniqueCurrentIds = [...new Set(currentTestWordIds)];
            // Keep only previous test + current test (2 tests total)
            const updatedRecentIds = [...uniqueCurrentIds];
            // Add previous test's words too (up to 2 tests worth)
            const prevTestIds = recentTestWordIds.filter(id => !uniqueCurrentIds.includes(id));
            updatedRecentIds.push(...prevTestIds.slice(0, selectedSize));

            try {
                await updateDoc(doc(db, 'users', uid), {
                    recentTestWordIds: updatedRecentIds,
                });
            } catch (e) {
                console.error('Failed to save recentTestWordIds:', e);
            }

            if (__DEV__) {
                console.log('=== TEST SELECTION DEBUG ===');
                console.log('selectedSize:', selectedSize);
                console.log('lastWrongIds.length:', lastWrongIds.length);
                console.log('wrongPick.length:', wrongPick.length);
                console.log('duePool.length:', duePool.length);
                console.log('duePick.length:', duePick.length);
                console.log('fillPick.length:', fillPick.length);
                console.log('totalQuestions:', questions.length);
                console.log('============================');
            }

            navigation.replace('Test', { questions, mode: selectedMode });
        } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed to start test');
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Test Oluştur</Text>

            <Text style={styles.sectionTitle}>Soru Sayısı</Text>
            <View style={styles.optionsContainer}>
                {TEST_SIZES.map((size) => (
                    <TouchableOpacity
                        key={size}
                        style={[
                            styles.optionButton,
                            selectedSize === size && styles.optionButtonSelected,
                        ]}
                        onPress={() => setSelectedSize(size)}
                    >
                        <Text
                            style={[
                                styles.optionText,
                                selectedSize === size && styles.optionTextSelected,
                            ]}
                        >
                            {size}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            <Text style={styles.sectionTitle}>Mod</Text>
            <View style={styles.optionsContainer}>
                {TEST_MODES.map((mode) => (
                    <TouchableOpacity
                        key={mode.value}
                        style={[
                            styles.optionButton,
                            selectedMode === mode.value && styles.optionButtonSelected,
                        ]}
                        onPress={() => setSelectedMode(mode.value)}
                    >
                        <Text
                            style={[
                                styles.optionText,
                                selectedMode === mode.value && styles.optionTextSelected,
                            ]}
                        >
                            {mode.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            <TouchableOpacity
                style={[styles.startButton, loading && styles.buttonDisabled]}
                onPress={handleStart}
                disabled={loading}
            >
                {loading ? (
                    <ActivityIndicator color="#fff" />
                ) : (
                    <Text style={styles.startButtonText}>Start Test</Text>
                )}
            </TouchableOpacity>

            <TouchableOpacity
                style={styles.backButton}
                onPress={() => navigation.goBack()}
            >
                <Text style={styles.backButtonText}>Back</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
        paddingHorizontal: 24,
        paddingTop: 32,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#333',
        textAlign: 'center',
        marginBottom: 32,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#666',
        marginBottom: 12,
    },
    optionsContainer: {
        flexDirection: 'row',
        marginBottom: 24,
    },
    optionButton: {
        flex: 1,
        height: 48,
        backgroundColor: '#f0f0f0',
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        marginHorizontal: 4,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    optionButtonSelected: {
        backgroundColor: '#E8E7FF',
        borderColor: '#5856D6',
    },
    optionText: {
        fontSize: 16,
        fontWeight: '500',
        color: '#666',
    },
    optionTextSelected: {
        color: '#5856D6',
        fontWeight: '600',
    },
    startButton: {
        height: 56,
        backgroundColor: '#5856D6',
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 16,
    },
    buttonDisabled: {
        backgroundColor: '#ccc',
    },
    startButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
    },
    backButton: {
        height: 48,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 12,
    },
    backButtonText: {
        color: '#007AFF',
        fontSize: 16,
    },
});
