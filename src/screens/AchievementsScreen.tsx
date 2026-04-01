import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    ActivityIndicator,
    Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../firebase/firebase';
import { useTheme } from '../context/ThemeContext';
import { ACHIEVEMENTS, checkAchievements, AchievementStats } from '../types/achievements';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Achievements'>;

export default function AchievementsScreen({ navigation }: Props) {
    const { colors } = useTheme();
    const [loading, setLoading] = useState(true);
    const [unlockedIds, setUnlockedIds] = useState<string[]>([]);
    const [newlyUnlocked, setNewlyUnlocked] = useState<string[]>([]);

    useEffect(() => {
        checkAndUpdateAchievements();
    }, []);

    const checkAndUpdateAchievements = async () => {
        const uid = auth.currentUser?.uid;
        if (!uid) return;

        try {
            const userRef = doc(db, 'users', uid);
            const userSnap = await getDoc(userRef);

            let stats: AchievementStats = {
                totalWords: 0,
                activeWords: 0,
                masteredWords: 0,
                totalTests: 0,
                totalCorrect: 0,
                totalWrong: 0,
                bestStreak: 0,
                hasPerfectScore: false,
            };

            let previouslyUnlocked: string[] = [];

            if (userSnap.exists()) {
                const data = userSnap.data();
                stats = {
                    totalWords: data.totalWords || 0,
                    activeWords: data.activeWords || 0,
                    masteredWords: data.masteredWords || 0,
                    totalTests: data.totalTests || 0,
                    totalCorrect: data.totalCorrect || 0,
                    totalWrong: data.totalWrong || 0,
                    bestStreak: 0,
                    hasPerfectScore: data.hasPerfectScore || false,
                };
                previouslyUnlocked = data.unlockedAchievements || [];
            }

            const wordsQuery = query(
                collection(db, 'words'),
                where('userId', '==', uid),
            );
            const wordsSnap = await getDocs(wordsQuery);

            let maxStreak = 0;
            wordsSnap.forEach((d) => {
                const data = d.data();
                const enStreak = data.enProgress?.streak || 0;
                const trStreak = data.trProgress?.streak || 0;
                if (enStreak > maxStreak) maxStreak = enStreak;
                if (trStreak > maxStreak) maxStreak = trStreak;
            });
            stats.bestStreak = maxStreak;

            const newAchievements = checkAchievements(stats, previouslyUnlocked);
            const allUnlocked = [...previouslyUnlocked, ...newAchievements.map(a => a.id)];

            if (newAchievements.length > 0) {
                await updateDoc(userRef, {
                    unlockedAchievements: allUnlocked,
                });

                setNewlyUnlocked(newAchievements.map(a => a.id));

                const names = newAchievements.map(a => `${a.icon} ${a.title}`).join('\n');
                Alert.alert(
                    '🎉 Yeni Başarım!',
                    `Tebrikler! Yeni rozet(ler) kazandın:\n\n${names}`
                );
            }

            setUnlockedIds(allUnlocked);
        } catch (err) {
            console.error('Failed to check achievements:', err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color="#007AFF" />
            </View>
        );
    }

    const unlockedCount = unlockedIds.length;
    const totalCount = ACHIEVEMENTS.length;

    return (
        <LinearGradient colors={[colors.backgroundGradientStart, colors.backgroundGradientEnd]} style={styles.gradientBg}>
            <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <View style={styles.header}>
                <Text style={styles.progressText}>
                    {unlockedCount} / {totalCount} Başarım
                </Text>
                <View style={styles.progressBar}>
                    <View
                        style={[
                            styles.progressFill,
                            { width: `${(unlockedCount / totalCount) * 100}%` },
                        ]}
                    />
                </View>
            </View>

            <View style={styles.grid}>
                {ACHIEVEMENTS.map((achievement) => {
                    const isUnlocked = unlockedIds.includes(achievement.id);
                    const isNew = newlyUnlocked.includes(achievement.id);

                    return (
                        <View
                            key={achievement.id}
                            style={[
                                styles.card,
                                isUnlocked ? styles.cardUnlocked : styles.cardLocked,
                                isNew && styles.cardNew,
                            ]}
                        >
                            <Text style={[styles.icon, !isUnlocked && styles.iconLocked]}>
                                {isUnlocked ? achievement.icon : '🔒'}
                            </Text>
                            <Text style={[styles.title, !isUnlocked && styles.textLocked]}>
                                {achievement.title}
                            </Text>
                            <Text style={[styles.description, !isUnlocked && styles.textLocked]}>
                                {achievement.description}
                            </Text>
                        </View>
                    );
                })}
            </View>
            </ScrollView>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    gradientBg: {
        flex: 1,
    },
    container: {
        flex: 1,
    },
    content: {
        paddingHorizontal: 16,
        paddingTop: 20,
        paddingBottom: 40,
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f8f9ff',
    },
    header: {
        marginBottom: 24,
        alignItems: 'center',
    },
    progressText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
        marginBottom: 10,
    },
    progressBar: {
        width: '100%',
        height: 10,
        backgroundColor: '#eee',
        borderRadius: 5,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        backgroundColor: '#FFD700',
        borderRadius: 5,
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    card: {
        width: '48%',
        padding: 16,
        borderRadius: 16,
        marginBottom: 12,
        alignItems: 'center',
        borderWidth: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 6,
        elevation: 2,
    },
    cardUnlocked: {
        backgroundColor: '#FFFDE7',
        borderColor: '#FFD700',
    },
    cardLocked: {
        backgroundColor: '#F5F5F5',
        borderColor: '#E0E0E0',
    },
    cardNew: {
        borderColor: '#FF9500',
        backgroundColor: '#FFF8E1',
    },
    icon: {
        fontSize: 36,
        marginBottom: 8,
    },
    iconLocked: {
        opacity: 0.5,
    },
    title: {
        fontSize: 14,
        fontWeight: '700',
        color: '#333',
        textAlign: 'center',
        marginBottom: 4,
    },
    description: {
        fontSize: 11,
        color: '#666',
        textAlign: 'center',
    },
    textLocked: {
        color: '#bbb',
    },
});
