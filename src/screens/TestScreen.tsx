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
import { LinearGradient } from 'expo-linear-gradient';
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

type FeedbackState = null | { isCorrect: boolean; correctAnswer: string; otherMeanings: string[] };

export default function TestScreen({ route, navigation }: Props) {
    const { questions, mode } = route.params;
    const [currentIndex, setCurrentIndex] = useState(0);
    const [userAnswer, setUserAnswer] = useState('');
    const [correctCount, setCorrectCount] = useState(0);
    const [wrongItems, setWrongItems] = useState<WrongItem[]>([]);
    const [wrongIds, setWrongIds] = useState<string[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [feedback, setFeedback] = useState<FeedbackState>(null);
    const [masteredCandidates, setMasteredCandidates] = useState<{ id: string; en: string; tr: string }[]>([]);

    const currentQuestion = questions[currentIndex];
    const isLastQuestion = currentIndex === questions.length - 1;

    const prompt = currentQuestion.direction === 'EN_TR' ? currentQuestion.en : currentQuestion.tr;
    const expected = currentQuestion.direction === 'EN_TR' ? currentQuestion.tr : currentQuestion.en;
    const promptLabel = currentQuestion.direction === 'EN_TR' ? 'İngilizce' : 'Türkçe';
    const answerLabel = currentQuestion.direction === 'EN_TR' ? 'Türkçe' : 'İngilizce';

    // Get meanings for answer checking
    const getMeanings = (): string[] => {
        if (currentQuestion.direction === 'EN_TR') {
            // Asking English, expecting Turkish - use meanings array
            return currentQuestion.meanings && currentQuestion.meanings.length > 0
                ? currentQuestion.meanings
                : [currentQuestion.tr];
        } else {
            // Asking Turkish, expecting English - only one answer
            return [currentQuestion.en];
        }
    };

    const speakWord = async (text: string, lang: string) => {
        try {
            const isSpeaking = await Speech.isSpeakingAsync();
            if (isSpeaking) {
                await Speech.stop();
            }
            Speech.speak(text, { language: lang, rate: 0.8 });
        } catch (err) {
            console.warn('Speech error:', err);
        }
    };

    const updateProgress = async (wordId: string, direction: 'EN_TR' | 'TR_EN', isCorrect: boolean): Promise<Progress | null> => {
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
            return newProgress;
        } catch (err) {
            console.error('Failed to update progress:', err);
            return null;
        }
    };

    const handleCheck = async () => {
        if (isSubmitting || feedback) return;
        setIsSubmitting(true);

        const normalizedAnswer = normalize(userAnswer);
        const possibleAnswers = getMeanings().map(m => normalize(m)).filter(m => m.length > 0);
        const isCorrect = possibleAnswers.some(opt => normalizedAnswer === opt);

        const newProgress = await updateProgress(currentQuestion.id, currentQuestion.direction, isCorrect);

        if (isCorrect) {
            setCorrectCount((prev) => prev + 1);
            if (newProgress && newProgress.streak >= 20) {
                // Sadece daha önce eklenmemişse ekle (aynı testte başka yönden de gelebilir)
                setMasteredCandidates(prev => {
                    if (prev.find(c => c.id === currentQuestion.id)) return prev;
                    return [...prev, { id: currentQuestion.id, en: currentQuestion.en, tr: currentQuestion.tr }];
                });
            }
        } else {
            setWrongItems(prev => [
                ...prev,
                { prompt, expected, userAnswer: userAnswer.trim(), wordId: currentQuestion.id },
            ]);
            setWrongIds(prev => [...prev, currentQuestion.id]);
        }

        // Show other meanings (excluding the matched one)
        const allMeanings = getMeanings();
        const matchedMeaning = allMeanings.find(m => normalize(m) === normalizedAnswer) || allMeanings[0];
        const otherMeanings = allMeanings.filter(m => m !== matchedMeaning);

        setFeedback({
            isCorrect,
            correctAnswer: allMeanings[0],
            otherMeanings: isCorrect ? otherMeanings : allMeanings,
        });
        setIsSubmitting(false);
    };

    const handleNext = () => {
        if (isLastQuestion) {
            const finalCorrect = correctCount;
            const finalWrong = questions.length - finalCorrect;
            const score = Math.round((finalCorrect / questions.length) * 100);

            navigation.replace('Result', {
                score,
                correct: finalCorrect,
                wrong: finalWrong,
                wrongItems,
                wrongIds,
                mode,
                masteredCandidates,
            });
        } else {
            setCurrentIndex((prev) => prev + 1);
            setUserAnswer('');
            setFeedback(null);
        }
    };

    const progressPercent = ((currentIndex) / questions.length) * 100;

    return (
        <LinearGradient colors={['#f8f9ff', '#e8ecf4']} style={styles.gradient}>
            <KeyboardAvoidingView
                style={styles.container}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
                    {/* Progress Bar */}
                    <View style={styles.progressBarContainer}>
                        <View style={styles.progressBarBg}>
                            <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
                        </View>
                        <Text style={styles.progressText}>
                            {currentIndex + 1} / {questions.length}
                        </Text>
                    </View>

                    {/* Question Card */}
                    <View style={styles.questionCard}>
                        <Text style={styles.promptLabel}>{promptLabel}:</Text>
                        <View style={styles.promptRow}>
                            <Text style={styles.promptText}>{prompt}</Text>
                            <TouchableOpacity
                                style={styles.speakButton}
                                onPress={() => {
                                    const lang = currentQuestion.direction === 'EN_TR' ? 'en' : 'tr';
                                    speakWord(prompt, lang);
                                }}
                            >
                                <Text style={styles.speakIcon}>🔊</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Answer Input */}
                    <View style={styles.answerSection}>
                        <Text style={styles.answerLabel}>{answerLabel}:</Text>
                        <TextInput
                            style={[
                                styles.input,
                                feedback && (feedback.isCorrect ? styles.inputCorrect : styles.inputWrong),
                            ]}
                            placeholder="Cevabınızı yazın..."
                            placeholderTextColor="#999"
                            value={userAnswer}
                            onChangeText={setUserAnswer}
                            autoCapitalize="none"
                            autoCorrect={false}
                            editable={!feedback}
                        />
                    </View>

                    <Text style={styles.muteHint}>
                        💡 Not: iPhone (iOS) cihazlarda sesi duyabilmek için yan taraftaki sessiz (çentik) anahtarının açık olması gerekir.
                    </Text>

                    {/* Feedback */}
                    {feedback && (
                        <View style={[
                            styles.feedbackCard,
                            feedback.isCorrect ? styles.feedbackCorrect : styles.feedbackWrong,
                        ]}>
                            <Text style={styles.feedbackEmoji}>
                                {feedback.isCorrect ? '✅' : '❌'}
                            </Text>
                            <Text style={[
                                styles.feedbackTitle,
                                { color: feedback.isCorrect ? '#34C759' : '#FF3B30' },
                            ]}>
                                {feedback.isCorrect ? 'Doğru!' : 'Yanlış!'}
                            </Text>

                            {!feedback.isCorrect && (
                                <Text style={styles.correctAnswerLabel}>
                                    Doğru cevap: <Text style={styles.correctAnswerText}>{feedback.correctAnswer}</Text>
                                </Text>
                            )}

                            {feedback.otherMeanings.length > 0 && (
                                <View style={styles.otherMeaningsBox}>
                                    <Text style={styles.otherMeaningsLabel}>
                                        {feedback.isCorrect ? 'Diğer anlamlar:' : 'Tüm anlamlar:'}
                                    </Text>
                                    {feedback.otherMeanings.map((m, i) => (
                                        <Text key={i} style={styles.otherMeaningItem}>• {m}</Text>
                                    ))}
                                </View>
                            )}
                        </View>
                    )}

                    {/* Action Button */}
                    {!feedback ? (
                        <TouchableOpacity
                            style={[styles.checkButton, (!userAnswer.trim() || isSubmitting) && styles.buttonDisabled]}
                            onPress={handleCheck}
                            disabled={!userAnswer.trim() || isSubmitting}
                            activeOpacity={0.8}
                        >
                            <LinearGradient
                                colors={(!userAnswer.trim() || isSubmitting) ? ['#ccc', '#ccc'] : ['#5856D6', '#7B68EE']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.buttonGradient}
                            >
                                <Text style={styles.buttonText}>
                                    {isSubmitting ? 'Kontrol ediliyor...' : '🔍 Kontrol Et'}
                                </Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity
                            style={styles.nextButton}
                            onPress={handleNext}
                            activeOpacity={0.8}
                        >
                            <LinearGradient
                                colors={isLastQuestion ? ['#FF9500', '#FF6B00'] : ['#34C759', '#2DB44D']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.buttonGradient}
                            >
                                <Text style={styles.buttonText}>
                                    {isLastQuestion ? '🏁 Bitir' : '➡️ Sonraki'}
                                </Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    )}
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
        paddingTop: 20,
        paddingBottom: 40,
    },
    progressBarContainer: {
        marginBottom: 24,
        alignItems: 'center',
    },
    progressBarBg: {
        width: '100%',
        height: 8,
        backgroundColor: '#e0e0e0',
        borderRadius: 4,
        overflow: 'hidden',
        marginBottom: 8,
    },
    progressBarFill: {
        height: '100%',
        backgroundColor: '#5856D6',
        borderRadius: 4,
    },
    progressText: {
        fontSize: 14,
        color: '#666',
        fontWeight: '500',
    },
    questionCard: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 24,
        marginBottom: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 5,
    },
    promptLabel: {
        fontSize: 13,
        color: '#888',
        marginBottom: 10,
        fontWeight: '500',
    },
    promptRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 14,
    },
    promptText: {
        fontSize: 26,
        fontWeight: '700',
        color: '#333',
        textAlign: 'center',
    },
    speakButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#f0f0ff',
        justifyContent: 'center',
        alignItems: 'center',
    },
    speakIcon: {
        fontSize: 22,
    },
    answerSection: {
        marginBottom: 16,
    },
    muteHint: {
        fontSize: 12,
        color: '#999',
        fontStyle: 'italic',
        marginBottom: 16,
        paddingHorizontal: 8,
    },
    answerLabel: {
        fontSize: 13,
        color: '#888',
        marginBottom: 8,
        fontWeight: '500',
    },
    input: {
        height: 52,
        borderWidth: 2,
        borderColor: '#e0e0e0',
        borderRadius: 14,
        paddingHorizontal: 16,
        fontSize: 18,
        backgroundColor: '#fff',
        color: '#333',
    },
    inputCorrect: {
        borderColor: '#34C759',
        backgroundColor: '#F0FFF4',
    },
    inputWrong: {
        borderColor: '#FF3B30',
        backgroundColor: '#FFF5F5',
    },
    feedbackCard: {
        borderRadius: 16,
        padding: 20,
        marginBottom: 20,
        alignItems: 'center',
        borderWidth: 2,
    },
    feedbackCorrect: {
        backgroundColor: '#F0FFF4',
        borderColor: '#34C759',
    },
    feedbackWrong: {
        backgroundColor: '#FFF5F5',
        borderColor: '#FF3B30',
    },
    feedbackEmoji: {
        fontSize: 36,
        marginBottom: 8,
    },
    feedbackTitle: {
        fontSize: 20,
        fontWeight: '700',
        marginBottom: 8,
    },
    correctAnswerLabel: {
        fontSize: 15,
        color: '#555',
        marginBottom: 8,
    },
    correctAnswerText: {
        fontWeight: '700',
        color: '#333',
    },
    otherMeaningsBox: {
        backgroundColor: 'rgba(0,0,0,0.03)',
        borderRadius: 10,
        padding: 12,
        width: '100%',
        marginTop: 6,
    },
    otherMeaningsLabel: {
        fontSize: 13,
        color: '#888',
        fontWeight: '600',
        marginBottom: 4,
    },
    otherMeaningItem: {
        fontSize: 14,
        color: '#555',
        marginTop: 2,
    },
    checkButton: {
        borderRadius: 14,
        overflow: 'hidden',
        shadowColor: '#5856D6',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
    },
    nextButton: {
        borderRadius: 14,
        overflow: 'hidden',
        shadowColor: '#34C759',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
    },
    buttonGradient: {
        height: 56,
        justifyContent: 'center',
        alignItems: 'center',
    },
    buttonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '700',
    },
    buttonDisabled: {
        shadowOpacity: 0,
        elevation: 0,
    },
});
