import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    ActivityIndicator,
} from 'react-native';
import { collection, query, where, getDocs, doc, getDoc, orderBy, limit } from 'firebase/firestore';
import { auth, db } from '../firebase/firebase';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Stats'>;

interface TopWrongWord {
    en: string;
    tr: string;
    wrongCount: number;
}

export default function StatsScreen({ navigation }: Props) {
    const [loading, setLoading] = useState(true);
    const [userStats, setUserStats] = useState({
        totalWords: 0,
        activeWords: 0,
        masteredWords: 0,
        totalTests: 0,
        totalCorrect: 0,
        totalWrong: 0,
    });
    const [topWrongWords, setTopWrongWords] = useState<TopWrongWord[]>([]);
    const [avgScore, setAvgScore] = useState(0);
    const [bestStreak, setBestStreak] = useState(0);

    useEffect(() => {
        fetchStats();
    }, []);

    const fetchStats = async () => {
        const uid = auth.currentUser?.uid;
        if (!uid) return;

        try {
            const userRef = doc(db, 'users', uid);
            const userSnap = await getDoc(userRef);

            if (userSnap.exists()) {
                const data = userSnap.data();
                const stats = {
                    totalWords: data.totalWords || 0,
                    activeWords: data.activeWords || 0,
                    masteredWords: data.masteredWords || 0,
                    totalTests: data.totalTests || 0,
                    totalCorrect: data.totalCorrect || 0,
                    totalWrong: data.totalWrong || 0,
                };
                setUserStats(stats);

                const totalAnswers = stats.totalCorrect + stats.totalWrong;
                if (totalAnswers > 0) {
                    setAvgScore(Math.round((stats.totalCorrect / totalAnswers) * 100));
                }
            }

            const wordsQuery = query(
                collection(db, 'words'),
                where('userId', '==', uid),
                where('isActive', '==', true),
            );
            const wordsSnap = await getDocs(wordsQuery);

            const wordsList: TopWrongWord[] = [];
            let maxStreak = 0;

            wordsSnap.forEach((d) => {
                const data = d.data();
                const enWrong = data.enProgress?.wrongCount || 0;
                const trWrong = data.trProgress?.wrongCount || 0;
                const totalWrong = enWrong + trWrong;

                const enStreak = data.enProgress?.streak || 0;
                const trStreak = data.trProgress?.streak || 0;
                if (enStreak > maxStreak) maxStreak = enStreak;
                if (trStreak > maxStreak) maxStreak = trStreak;

                if (totalWrong > 0) {
                    wordsList.push({
                        en: data.en,
                        tr: data.tr,
                        wrongCount: totalWrong,
                    });
                }
            });

            setBestStreak(maxStreak);
            wordsList.sort((a, b) => b.wrongCount - a.wrongCount);
            setTopWrongWords(wordsList.slice(0, 10));
        } catch (err) {
            console.error('Failed to fetch stats:', err);
        } finally {
            setLoading(false);
        }
    };

    const getScoreColor = (score: number) => {
        if (score >= 80) return '#34C759';
        if (score >= 50) return '#FF9500';
        return '#FF3B30';
    };

    if (loading) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color="#007AFF" />
            </View>
        );
    }

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <View style={styles.scoreCard}>
                <Text style={[styles.bigScore, { color: getScoreColor(avgScore) }]}>{avgScore}%</Text>
                <Text style={styles.scoreSubtitle}>Genel Başarı Oranı</Text>
            </View>

            <View style={styles.statsRow}>
                <View style={styles.statItem}>
                    <Text style={[styles.statValue, { color: '#5856D6' }]}>{userStats.totalTests}</Text>
                    <Text style={styles.statTitle}>Test</Text>
                </View>
                <View style={styles.statItem}>
                    <Text style={[styles.statValue, { color: '#34C759' }]}>{userStats.totalCorrect}</Text>
                    <Text style={styles.statTitle}>Doğru</Text>
                </View>
                <View style={styles.statItem}>
                    <Text style={[styles.statValue, { color: '#FF3B30' }]}>{userStats.totalWrong}</Text>
                    <Text style={styles.statTitle}>Yanlış</Text>
                </View>
                <View style={styles.statItem}>
                    <Text style={[styles.statValue, { color: '#FF9500' }]}>{bestStreak}</Text>
                    <Text style={styles.statTitle}>En İyi Seri</Text>
                </View>
            </View>

            <View style={styles.wordsOverview}>
                <Text style={styles.sectionTitle}>Kelime Durumu</Text>
                <View style={styles.wordsBars}>
                    <View style={styles.barRow}>
                        <Text style={styles.barLabel}>Toplam</Text>
                        <View style={[styles.bar, { flex: 1, backgroundColor: '#007AFF' }]} />
                        <Text style={styles.barValue}>{userStats.totalWords}</Text>
                    </View>
                    <View style={styles.barRow}>
                        <Text style={styles.barLabel}>Aktif</Text>
                        <View style={[styles.bar, {
                            flex: userStats.totalWords > 0 ? userStats.activeWords / userStats.totalWords : 0,
                            backgroundColor: '#34C759',
                        }]} />
                        <Text style={styles.barValue}>{userStats.activeWords}</Text>
                    </View>
                    <View style={styles.barRow}>
                        <Text style={styles.barLabel}>Ezberlenen</Text>
                        <View style={[styles.bar, {
                            flex: userStats.totalWords > 0 ? userStats.masteredWords / userStats.totalWords : 0,
                            backgroundColor: '#8E8E93',
                        }]} />
                        <Text style={styles.barValue}>{userStats.masteredWords}</Text>
                    </View>
                </View>
            </View>

            {topWrongWords.length > 0 && (
                <View style={styles.wrongSection}>
                    <Text style={styles.sectionTitle}>En Çok Yanlış Yapılan Kelimeler</Text>
                    {topWrongWords.map((word, index) => (
                        <View key={index} style={styles.wrongItem}>
                            <View style={styles.wrongRank}>
                                <Text style={styles.rankText}>{index + 1}</Text>
                            </View>
                            <View style={styles.wrongContent}>
                                <Text style={styles.wrongEn}>{word.en}</Text>
                                <Text style={styles.wrongTr}>{word.tr}</Text>
                            </View>
                            <View style={styles.wrongBadge}>
                                <Text style={styles.wrongCount}>{word.wrongCount}x</Text>
                            </View>
                        </View>
                    ))}
                </View>
            )}

            {topWrongWords.length === 0 && (
                <View style={styles.emptyWrong}>
                    <Text style={styles.emptyText}>🎉 Henüz yanlış yapılan kelime yok!</Text>
                    <Text style={styles.emptySubtext}>Test çözdükçe burada istatistiklerin görünecek</Text>
                </View>
            )}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    content: {
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 40,
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#fff',
    },
    scoreCard: {
        alignItems: 'center',
        backgroundColor: '#f8f8f8',
        borderRadius: 16,
        padding: 24,
        marginBottom: 20,
    },
    bigScore: {
        fontSize: 48,
        fontWeight: 'bold',
    },
    scoreSubtitle: {
        fontSize: 14,
        color: '#888',
        marginTop: 4,
    },
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 24,
    },
    statItem: {
        flex: 1,
        alignItems: 'center',
        backgroundColor: '#f5f5f5',
        marginHorizontal: 4,
        borderRadius: 12,
        padding: 14,
    },
    statValue: {
        fontSize: 22,
        fontWeight: 'bold',
    },
    statTitle: {
        fontSize: 11,
        color: '#888',
        marginTop: 4,
    },
    wordsOverview: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#333',
        marginBottom: 14,
    },
    wordsBars: {
        gap: 10,
    },
    barRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    barLabel: {
        width: 80,
        fontSize: 13,
        color: '#666',
    },
    bar: {
        height: 20,
        borderRadius: 10,
        minWidth: 4,
    },
    barValue: {
        width: 35,
        fontSize: 14,
        fontWeight: '600',
        color: '#333',
        textAlign: 'right',
    },
    wrongSection: {
        marginBottom: 20,
    },
    wrongItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF5F5',
        borderRadius: 10,
        padding: 12,
        marginBottom: 8,
        borderLeftWidth: 3,
        borderLeftColor: '#FF3B30',
    },
    wrongRank: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#FF3B30',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    rankText: {
        color: '#fff',
        fontSize: 13,
        fontWeight: 'bold',
    },
    wrongContent: {
        flex: 1,
    },
    wrongEn: {
        fontSize: 15,
        fontWeight: '600',
        color: '#333',
    },
    wrongTr: {
        fontSize: 13,
        color: '#888',
        marginTop: 2,
    },
    wrongBadge: {
        backgroundColor: '#FFE5E5',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    wrongCount: {
        fontSize: 13,
        fontWeight: '600',
        color: '#FF3B30',
    },
    emptyWrong: {
        alignItems: 'center',
        padding: 30,
        backgroundColor: '#f8f8f8',
        borderRadius: 16,
    },
    emptyText: {
        fontSize: 16,
        fontWeight: '500',
        color: '#333',
    },
    emptySubtext: {
        fontSize: 13,
        color: '#999',
        marginTop: 6,
    },
});
