import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import * as Speech from 'expo-speech';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { calculateNextProgress, Progress } from '../types/srs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList, WrongItem } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Test'>;

function normalize(text: string): string {
    return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

function normalizeProgress(data: any): Progress {
    return {
        intervalDays: data?.intervalDays ?? 0,
        streak: data?.streak ?? 0,
        wrongCount: data?.wrongCount ?? 0,
        nextReviewAt: data?.nextReviewAt ?? null,
        lastTestedAt: data?.lastTestedAt ?? 0,
        lastOutcome: data?.lastOutcome ?? 'correct',
    };
}

export default function TestScreen({ route, navigation }: Props) {
    const { questions, mode } = route.params;
    const [currentIndex, setCurrentIndex] = useState(0);
    const [userAnswer, setUserAnswer] = useState('');
    const [correctCount, setCorrectCount] = useState(0);
    const [wrongItems, setWrongItems] = useState<WrongItem[]>([]);
    const [wrongIds, setWrongIds] = useState<string[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const currentQuestion = questions[currentIndex];
    const isLastQuestion = currentIndex === questions.length - 1;

    const prompt = currentQuestion.direction === 'EN_TR' ? currentQuestion.en : currentQuestion.tr;
    const expected = currentQuestion.direction === 'EN_TR' ? currentQuestion.tr : currentQuestion.en;
    const promptLabel = currentQuestion.direction === 'EN_TR' ? 'İngilizce' : 'Türkçe';
    const answerLabel = currentQuestion.direction === 'EN_TR' ? 'Türkçe' : 'İngilizce';

    const updateProgress = async (wordId: string, direction: 'EN_TR' | 'TR_EN', isCorrect: boolean) => {
        try {
            const wordRef = doc(db, 'words', wordId);
            const progressField = direction === 'EN_TR' ? 'enProgress' : 'trProgress';
            const topLevelField = direction === 'EN_TR' ? 'enNextReviewAt' : 'trNextReviewAt';

            const wordSnap = await getDoc(wordRef);
            let currentProgress: Progress = {
                intervalDays: 0,
                streak: 0,
                wrongCount: 0,
                nextReviewAt: null,
                lastTestedAt: 0,
                lastOutcome: 'correct',
            };

            if (wordSnap.exists()) {
                const data = wordSnap.data();
                currentProgress = normalizeProgress(data[progressField]);
            }

            const newProgress = calculateNextProgress(isCorrect, currentProgress);


            await updateDoc(wordRef, {
                [progressField]: newProgress,
                [topLevelField]: newProgress.nextReviewAt,
            });
        } catch (err) {
            console.error('Failed to update progress:', err);
        }
    };

    const handleNext = async () => {
        if (isSubmitting) return;
        setIsSubmitting(true);

        const normalizedAnswer = normalize(userAnswer);
        const normalizedExpected = normalize(expected);
        const isCorrect = normalizedAnswer === normalizedExpected;


        await updateProgress(currentQuestion.id, currentQuestion.direction, isCorrect);

        let newWrongItems = wrongItems;
        let newWrongIds = wrongIds;

        if (isCorrect) {
            setCorrectCount((prev) => prev + 1);
        } else {
            newWrongItems = [
                ...wrongItems,
                { prompt, expected, userAnswer: userAnswer.trim(), wordId: currentQuestion.id },
            ];
            newWrongIds = [...wrongIds, currentQuestion.id];
            setWrongItems(newWrongItems);
            setWrongIds(newWrongIds);
        }

        if (isLastQuestion) {
            const finalCorrect = isCorrect ? correctCount + 1 : correctCount;
            const finalWrong = questions.length - finalCorrect;
            const score = Math.round((finalCorrect / questions.length) * 100);

            navigation.replace('Result', {
                score,
                correct: finalCorrect,
                wrong: finalWrong,
                wrongItems: newWrongItems,
                wrongIds: newWrongIds,
                mode,
            });
        } else {
            setCurrentIndex((prev) => prev + 1);
            setUserAnswer('');
            setIsSubmitting(false);
        }
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <View style={styles.progressContainer}>
                <Text style={styles.progressText}>
                    Question {currentIndex + 1} / {questions.length}
                </Text>
            </View>

            <View style={styles.questionContainer}>
                <Text style={styles.promptLabel}>{promptLabel}:</Text>
                <View style={styles.promptRow}>
                    <Text style={styles.promptText}>{prompt}</Text>
                    <TouchableOpacity
                        style={styles.speakButton}
                        onPress={() => {
                            const lang = currentQuestion.direction === 'EN_TR' ? 'en-US' : 'tr-TR';
                            Speech.speak(prompt, { language: lang });
                        }}
                    >
                        <Text style={styles.speakIcon}>🔊</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <View style={styles.answerContainer}>
                <Text style={styles.answerLabel}>{answerLabel}:</Text>
                <TextInput
                    style={styles.input}
                    placeholder="Cevabınızı yazın..."
                    value={userAnswer}
                    onChangeText={setUserAnswer}
                    autoCapitalize="none"
                    autoCorrect={false}
                />
            </View>

            <TouchableOpacity
                style={[styles.button, (!userAnswer.trim() || isSubmitting) && styles.buttonDisabled]}
                onPress={handleNext}
                disabled={!userAnswer.trim() || isSubmitting}
            >
                <Text style={styles.buttonText}>
                    {isSubmitting ? 'Kaydediliyor...' : isLastQuestion ? 'Bitir' : 'Sonraki'}
                </Text>
            </TouchableOpacity>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
        paddingHorizontal: 24,
        paddingTop: 32,
    },
    progressContainer: {
        alignItems: 'center',
        marginBottom: 32,
    },
    progressText: {
        fontSize: 16,
        color: '#666',
        fontWeight: '500',
    },
    questionContainer: {
        backgroundColor: '#f0f0f0',
        borderRadius: 12,
        padding: 20,
        marginBottom: 24,
    },
    promptLabel: {
        fontSize: 14,
        color: '#666',
        marginBottom: 8,
    },
    promptText: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#333',
        textAlign: 'center',
    },
    promptRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
    },
    speakButton: {
        padding: 6,
    },
    speakIcon: {
        fontSize: 22,
    },
    answerContainer: {
        marginBottom: 24,
    },
    answerLabel: {
        fontSize: 14,
        color: '#666',
        marginBottom: 8,
    },
    input: {
        height: 50,
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        paddingHorizontal: 16,
        fontSize: 18,
        backgroundColor: '#f9f9f9',
    },
    button: {
        height: 56,
        backgroundColor: '#5856D6',
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
