import React, { useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Alert,
    ActivityIndicator,
} from 'react-native';
import { collection, query, where, getDocs, doc, getDoc, Timestamp } from 'firebase/firestore';
import { auth, db } from '../firebase/firebase';
import type { TestMode, Progress } from '../types/srs';
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
const WRONG_BOOST_RATIO = 0.3;

interface WordData {
    id: string;
    en: string;
    tr: string;
    isActive: boolean;
    enNextReviewAt: Timestamp | Date | null;
    trNextReviewAt: Timestamp | Date | null;
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
                return {
                    id: d.id,
                    en: data.en as string,
                    tr: data.tr as string,
                    isActive: true,
                    enNextReviewAt: data.enNextReviewAt ?? null,
                    trNextReviewAt: data.trNextReviewAt ?? null,
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
            try {
                const userDoc = await getDoc(doc(db, 'users', uid));
                if (userDoc.exists()) {
                    lastWrongIds = userDoc.data().lastWrongIds || [];
                }
            } catch (e) {
                console.error('Failed to fetch user doc:', e);
            }

            const now = Date.now();
            const boostCount = Math.round(selectedSize * WRONG_BOOST_RATIO);


            const activeWordIds = new Set(activeWords.map((w) => w.id));


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

            for (const word of activeWords) {
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
            const restPool: { word: WordData; direction: 'EN_TR' | 'TR_EN' }[] = [];

            for (const word of activeWords) {
                if (wrongBoostSet.has(word.id)) continue;
                if (duePickSet.has(word.id)) continue;

                let direction: 'EN_TR' | 'TR_EN';
                if (selectedMode === 'MIXED') {
                    direction = Math.random() < 0.5 ? 'EN_TR' : 'TR_EN';
                } else {
                    direction = selectedMode;
                }
                restPool.push({ word, direction });
            }

            const shuffledRest = shuffle(restPool);
            const fillPick = shuffledRest.slice(0, remainingAfterDue);


            const allPicks = [...wrongPick, ...duePick, ...fillPick];
            const finalShuffled = shuffle(allPicks);

            const questions: Question[] = finalShuffled.map((item) => ({
                id: item.word.id,
                en: item.word.en,
                tr: item.word.tr,
                direction: item.direction,
            }));

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
