import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, SafeAreaView, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { signOut } from 'firebase/auth';
import { doc, setDoc, updateDoc, collection, query, where, getDocs, getDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { useFocusEffect } from '@react-navigation/native';
import { auth, db } from '../firebase/firebase';
import { createDefaultProgress, TestMode } from '../types/srs';
import { useTheme } from '../context/ThemeContext';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList, Question } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

interface Stats {
    totalWords: number;
    activeWords: number;
    masteredWords: number;
    dueCount: number;
    currentStreak: number;
    todayStudiedCount: number;
    dailyGoal: number;
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
    const { colors, isDark } = useTheme();
    const [stats, setStats] = useState<Stats>({ totalWords: 0, activeWords: 0, masteredWords: 0, dueCount: 0, currentStreak: 0, todayStudiedCount: 0, dailyGoal: 20 });
    const [loading, setLoading] = useState(true);
    const [dueLoading, setDueLoading] = useState(false);

    const fetchStats = useCallback(async () => {
        const uid = auth.currentUser?.uid;
        if (!uid) return;

        try {

            const userRef = doc(db, 'users', uid);
            const userSnap = await getDoc(userRef);

            let totalWords = 0;
            let activeWords = 0;
            let masteredWords = 0;
            let currentStreak = 0;
            let todayStudiedCount = 0;
            let dailyGoal = 20;

            const now = new Date();
            const todayStr = now.toISOString().split('T')[0];

            if (userSnap.exists()) {
                const data = userSnap.data();
                totalWords = data.totalWords || 0;
                activeWords = data.activeWords || 0;
                masteredWords = data.masteredWords || 0;
                currentStreak = data.currentStreak || 0;
                dailyGoal = data.dailyGoal || 20;

                if (data.todayStudiedDate === todayStr) {
                    todayStudiedCount = data.todayStudiedCount || 0;
                }

                const lastStudyDate = data.lastStudyDate || '';
                if (lastStudyDate && lastStudyDate !== todayStr) {
                    const yesterday = new Date(now);
                    yesterday.setDate(yesterday.getDate() - 1);
                    const yesterdayStr = yesterday.toISOString().split('T')[0];
                    if (lastStudyDate !== yesterdayStr) {
                        currentStreak = 0;
                    }
                }
            }
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

            setStats({ totalWords, activeWords, masteredWords, dueCount, currentStreak, todayStudiedCount, dailyGoal });
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
                meanings: w.tr.split(',').map((s: string) => s.trim()).filter((s: string) => s.length > 0),
                direction: w.direction,
            }));

            navigation.navigate('Test', { questions, mode: 'MIXED', isDueTest: true });
        } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed to start due test');
        } finally {
            setDueLoading(false);
        }
    };


    // Geliştirici test fonksiyonları kaldırıldı

    if (loading) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color="#007AFF" />
            </View>
        );
    }

    return (
        <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
            <View style={styles.container}>
                
                {/* Header Area */}
                <View style={styles.header}>
                    <View style={styles.headerTextContainer}>
                        <Text style={[styles.greeting, { color: colors.textMuted }]}>Hoş Geldin 👋</Text>
                        <Text style={[styles.userName, { color: colors.text }]} numberOfLines={1}>
                            {auth.currentUser?.email?.split('@')[0] || 'Öğrenci'}
                        </Text>
                    </View>
                    <TouchableOpacity onPress={() => navigation.navigate('Profile')} style={[styles.headerAvatar, { backgroundColor: colors.card }]}>
                        <Ionicons name="person" size={20} color={isDark ? '#FFF' : '#333'} />
                    </TouchableOpacity>
                </View>

                {/* Insights and Goals */}
                <View style={[styles.goalContainer, { backgroundColor: isDark ? '#1C1C1E' : '#F5F9FF' }]}>
                    <View style={styles.goalHeader}>
                        <View style={styles.rowCenter}>
                            <Ionicons name="flame" size={20} color={stats.currentStreak > 0 ? "#FF9500" : "#A1A1A1"} />
                            <Text style={[styles.streakText, { color: isDark ? '#FFF' : '#333' }]}> {stats.currentStreak} Gün Seri</Text>
                        </View>
                        <Text style={[styles.goalText, { color: isDark ? '#A1A1A1' : '#666' }]}>Hedef: {stats.todayStudiedCount} / {stats.dailyGoal}</Text>
                    </View>
                    <View style={[styles.progressBarBg, { backgroundColor: isDark ? '#333' : '#E5E5EA' }]}>
                        <View style={[styles.progressBarFill, { width: `${Math.min(100, (stats.todayStudiedCount / stats.dailyGoal) * 100)}%` }]} />
                    </View>
                    <Text style={[styles.insightText, { color: isDark ? '#A1A1A1' : '#555' }]}>
                        {stats.todayStudiedCount >= stats.dailyGoal 
                            ? '💡 Harika, bugünkü hedefini tamamladın!'
                            : stats.dueCount > 0 
                                ? '💡 Tekrar etmen gereken zayıf kelimeler var.'
                                : '💡 Pratik yapmak için hemen bir test oluştur.'}
                    </Text>
                </View>

                {/* Stats Cards */}
                <View style={styles.statsRow}>
                    <View style={[styles.statBox, { backgroundColor: colors.card }]}>
                        <Text style={[styles.statValue, { color: colors.text }]}>{stats.totalWords}</Text>
                        <Text style={[styles.statLabel, { color: colors.textMuted }]}>Toplam</Text>
                    </View>
                    <View style={[styles.statBox, { backgroundColor: colors.card }]}>
                        <Text style={[styles.statValue, { color: '#34C759' }]}>{stats.activeWords}</Text>
                        <Text style={[styles.statLabel, { color: colors.textMuted }]}>Aktif</Text>
                    </View>
                    <View style={[styles.statBox, { backgroundColor: colors.card }]}>
                        <Text style={[styles.statValue, { color: '#FF9500' }]}>{stats.dueCount}</Text>
                        <Text style={[styles.statLabel, { color: colors.textMuted }]}>Tekrar</Text>
                    </View>
                </View>

                {/* Primary Action */}
                <TouchableOpacity 
                    style={styles.primaryCtaContainer} 
                    onPress={() => navigation.navigate('TestSetup')}
                    activeOpacity={0.9}
                >
                    <LinearGradient colors={['#5856D6', '#4B49C6']} style={styles.primaryCtaGradient}>
                        <View style={styles.ctaTextWrapper}>
                            <Text style={styles.primaryCtaTitle}>Test Oluştur</Text>
                            <Text style={styles.primaryCtaSub}>Kendini test et ve pratik yap</Text>
                        </View>
                        <Ionicons name="play-circle" size={40} color="#FFF" style={styles.ctaIcon} />
                    </LinearGradient>
                </TouchableOpacity>

                {/* SRS Review Banner */}
                {stats.dueCount > 0 ? (
                    <TouchableOpacity 
                        style={[styles.dueBanner, dueLoading && styles.disabledBanner, { backgroundColor: isDark ? 'rgba(255,149,0,0.15)' : '#FFF3E0' }]} 
                        onPress={handleStartDueTest}
                        disabled={dueLoading}
                    >
                        <View style={styles.dueIconWrapper}>
                            <Ionicons name="flame" size={24} color="#FF9500" />
                        </View>
                        <View style={styles.dueBannerText}>
                            <Text style={[styles.dueBannerTitle, { color: isDark ? '#FFA726' : '#E65100' }]}>Tekrar Vakti!</Text>
                            <Text style={[styles.dueBannerSub, { color: isDark ? '#FFB74D' : '#F57C00' }]}>{stats.dueCount} kelime seni bekliyor</Text>
                        </View>
                        {dueLoading ? <ActivityIndicator color="#FF9500" size="small" /> : <Ionicons name="chevron-forward" size={20} color="#FF9500" />}
                    </TouchableOpacity>
                ) : (
                    <View style={styles.emptyBannerSpacer} />
                )}

                {/* Secondary Actions Grid */}
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Hızlı İşlemler</Text>
                <View style={styles.grid}>
                    <TouchableOpacity style={[styles.gridItem, { backgroundColor: colors.card }]} onPress={() => navigation.navigate('AddWord')}>
                        <View style={[styles.iconWrapper, { backgroundColor: 'rgba(52,199,89,0.1)' }]}>
                            <Ionicons name="add" size={24} color="#34C759" />
                        </View>
                        <Text style={[styles.gridItemText, { color: colors.text }]}>Kelime Ekle</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={[styles.gridItem, { backgroundColor: colors.card }]} onPress={() => navigation.navigate('Stats')}>
                        <View style={[styles.iconWrapper, { backgroundColor: 'rgba(88,86,214,0.1)' }]}>
                            <Ionicons name="stats-chart" size={20} color="#5856D6" />
                        </View>
                        <Text style={[styles.gridItemText, { color: colors.text }]}>İstatistik</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={[styles.gridItem, { backgroundColor: colors.card }]} onPress={() => navigation.navigate('Achievements')}>
                        <View style={[styles.iconWrapper, { backgroundColor: 'rgba(255,149,0,0.1)' }]}>
                            <Ionicons name="trophy" size={22} color="#FF9500" />
                        </View>
                        <Text style={[styles.gridItemText, { color: colors.text }]}>Başarımlar</Text>
                    </TouchableOpacity>
                </View>
                
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
    },
    container: {
        flex: 1,
        paddingHorizontal: 20,
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 16,
        marginBottom: 24,
    },
    headerTextContainer: {
        flex: 1,
        paddingRight: 16,
    },
    greeting: {
        fontSize: 14,
        marginBottom: 2,
    },
    userName: {
        fontSize: 22,
        fontWeight: '700',
    },
    headerAvatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 24,
        gap: 12,
    },
    statBox: {
        flex: 1,
        borderRadius: 16,
        paddingVertical: 16,
        paddingHorizontal: 8,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 5,
        elevation: 1,
    },
    statValue: {
        fontSize: 24,
        fontWeight: '700',
        marginBottom: 4,
    },
    statLabel: {
        fontSize: 12,
        fontWeight: '500',
    },
    goalContainer: {
        borderRadius: 16,
        padding: 16,
        marginBottom: 24,
    },
    goalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    rowCenter: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    streakText: {
        fontSize: 14,
        fontWeight: '700',
    },
    goalText: {
        fontSize: 13,
        fontWeight: '500',
    },
    progressBarBg: {
        height: 8,
        borderRadius: 4,
        marginBottom: 12,
        overflow: 'hidden',
    },
    progressBarFill: {
        height: '100%',
        backgroundColor: '#34C759',
        borderRadius: 4,
    },
    insightText: {
        fontSize: 13,
        fontWeight: '500',
        fontStyle: 'italic',
    },
    primaryCtaContainer: {
        marginBottom: 16,
        shadowColor: '#5856D6',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
        elevation: 8,
    },
    primaryCtaGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 24,
        borderRadius: 20,
    },
    ctaTextWrapper: {
        flex: 1,
    },
    primaryCtaTitle: {
        color: '#FFF',
        fontSize: 22,
        fontWeight: '700',
        marginBottom: 4,
    },
    primaryCtaSub: {
        color: 'rgba(255,255,255,0.85)',
        fontSize: 13,
    },
    ctaIcon: {
        marginLeft: 16,
    },
    dueBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 16,
        marginBottom: 24,
    },
    disabledBanner: {
        opacity: 0.6,
    },
    dueIconWrapper: {
        marginRight: 12,
    },
    dueBannerText: {
        flex: 1,
    },
    dueBannerTitle: {
        fontSize: 15,
        fontWeight: '700',
        marginBottom: 2,
    },
    dueBannerSub: {
        fontSize: 13,
        fontWeight: '500',
    },
    emptyBannerSpacer: {
        height: 24,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 16,
    },
    grid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 12,
    },
    gridItem: {
        flex: 1,
        borderRadius: 16,
        padding: 16,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 5,
        elevation: 1,
    },
    iconWrapper: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 10,
    },
    gridItemText: {
        fontSize: 12,
        fontWeight: '600',
        textAlign: 'center',
    },
});
