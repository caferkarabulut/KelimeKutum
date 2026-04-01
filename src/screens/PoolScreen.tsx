import React, { useEffect, useState, useCallback } from 'react';
import * as Speech from 'expo-speech';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    FlatList,
    Alert,
    ActivityIndicator,
    RefreshControl,
    Switch,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
    collection,
    query,
    where,
    orderBy,
    getDocs,
    deleteDoc,
    updateDoc,
    increment,
    doc,
    getDoc,
} from 'firebase/firestore';
import { auth, db } from '../firebase/firebase';
import { useTheme } from '../context/ThemeContext';
import type { Word } from '../types/srs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Pool'>;
type SortMode = 'newest' | 'alphabetical' | 'most_wrong';

function normalize(text: string): string {
    return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

export default function PoolScreen({ navigation }: Props) {
    const { colors } = useTheme();
    const [words, setWords] = useState<Word[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState('');
    const [showActiveOnly, setShowActiveOnly] = useState(false);
    const [sortMode, setSortMode] = useState<SortMode>('newest');

    const fetchWords = useCallback(async () => {
        const uid = auth.currentUser?.uid;
        if (!uid) {
            navigation.reset({
                index: 0,
                routes: [{ name: 'Login' }],
            });
            return;
        }

        try {
            setError('');
            const q = query(
                collection(db, 'words'),
                where('userId', '==', uid),
                orderBy('createdAt', 'desc')
            );
            const snapshot = await getDocs(q);
            const fetchedWords: Word[] = snapshot.docs.map((docSnap) => {
                const data = docSnap.data();
                const meanings: string[] = data.meanings && Array.isArray(data.meanings)
                    ? data.meanings
                    : (data.tr ? data.tr.split(',').map((s: string) => s.trim()).filter((s: string) => s.length > 0) : []);
                return {
                    id: docSnap.id,
                    userId: data.userId || uid,
                    en: data.en,
                    tr: data.tr,
                    meanings,
                    enNorm: data.enNorm,
                    isActive: data.isActive ?? true,
                    enProgress: data.enProgress,
                    trProgress: data.trProgress,
                    enNextReviewAt: data.enNextReviewAt,
                    trNextReviewAt: data.trNextReviewAt,
                    createdAt: data.createdAt,
                };
            });
            setWords(fetchedWords);
        } catch (err: any) {
            setError(err.message || 'Failed to fetch words');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [navigation]);

    useEffect(() => {
        fetchWords();
    }, [fetchWords]);

    const handleRefresh = () => {
        setRefreshing(true);
        fetchWords();
    };

    const handleDelete = (word: Word) => {
        Alert.alert('Delete this word?', `${word.en} - ${word.tr}`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                    const uid = auth.currentUser?.uid;
                    if (!uid) return;

                    try {
                        await deleteDoc(doc(db, 'words', word.id));


                        const userRef = doc(db, 'users', uid);
                        const userSnap = await getDoc(userRef);
                        if (userSnap.exists()) {
                            const updates: any = {
                                totalWords: increment(-1),
                            };
                            if (word.isActive) {
                                updates.activeWords = increment(-1);
                            } else {
                                updates.masteredWords = increment(-1);
                            }
                            await updateDoc(userRef, updates);
                        }

                        setWords((prev) => prev.filter((w) => w.id !== word.id));
                    } catch (err: any) {
                        Alert.alert('Error', err.message || 'Failed to delete');
                    }
                },
            },
        ]);
    };

    const handleToggleActive = async (word: Word) => {
        const uid = auth.currentUser?.uid;
        if (!uid) return;

        try {
            const newIsActive = !word.isActive;
            await updateDoc(doc(db, 'words', word.id), { isActive: newIsActive });


            const userRef = doc(db, 'users', uid);
            const userSnap = await getDoc(userRef);
            if (userSnap.exists()) {
                if (newIsActive) {

                    await updateDoc(userRef, {
                        activeWords: increment(1),
                        masteredWords: increment(-1),
                    });
                } else {

                    await updateDoc(userRef, {
                        activeWords: increment(-1),
                        masteredWords: increment(1),
                    });
                }
            }

            setWords((prev) =>
                prev.map((w) => (w.id === word.id ? { ...w, isActive: newIsActive } : w))
            );
        } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed to update');
        }
    };


    const filteredWords = words.filter((word) => {
        if (showActiveOnly && !word.isActive) return false;

        if (!searchQuery.trim()) return true;
        const normalizedQuery = normalize(searchQuery);
        const enMatch = normalize(word.en).includes(normalizedQuery);
        const trMatch = normalize(word.tr).includes(normalizedQuery);
        const enNormMatch = word.enNorm ? word.enNorm.includes(normalizedQuery) : false;
        return enMatch || trMatch || enNormMatch;
    }).sort((a, b) => {
        if (sortMode === 'alphabetical') {
            return a.en.localeCompare(b.en);
        } else if (sortMode === 'most_wrong') {
            const aWrong = (a.enProgress?.wrongCount || 0) + (a.trProgress?.wrongCount || 0);
            const bWrong = (b.enProgress?.wrongCount || 0) + (b.trProgress?.wrongCount || 0);
            return bWrong - aWrong;
        } else {
            // newest
            const aTime = a.createdAt ? (a.createdAt as any).toMillis?.() || 0 : 0;
            const bTime = b.createdAt ? (b.createdAt as any).toMillis?.() || 0 : 0;
            return bTime - aTime;
        }
    });

    const renderItem = ({ item }: { item: Word }) => {
        const enWrong = item.enProgress?.wrongCount || 0;
        const trWrong = item.trProgress?.wrongCount || 0;
        const totalWrong = enWrong + trWrong;
        const enStreak = item.enProgress?.streak || 0;
        const trStreak = item.trProgress?.streak || 0;
        const maxStreak = Math.max(enStreak, trStreak);

        const lastReview = item.enProgress?.lastTestedAt 
            ? new Date(item.enProgress.lastTestedAt).toLocaleDateString()
            : 'Hiç test edilmedi';

        return (
        <View style={[styles.card, !item.isActive && styles.cardInactive]}>
            <View style={styles.cardContent}>
                <View style={styles.wordRow}>
                    <Text style={[styles.enText, !item.isActive && styles.textInactive]}>{item.en}</Text>
                    <TouchableOpacity
                        style={styles.speakButton}
                        onPress={async () => {
                            try {
                                if (await Speech.isSpeakingAsync()) await Speech.stop();
                                Speech.speak(item.en, { language: 'en', rate: 0.8 });
                            } catch (e) {
                                console.warn('Speech error:', e);
                            }
                        }}
                    >
                        <Text style={styles.speakIcon}>🔊</Text>
                    </TouchableOpacity>
                </View>
                <Text style={[styles.trText, !item.isActive && styles.textInactive]}>{item.meanings.join(', ')}</Text>
                
                <View style={styles.statsRow}>
                    <Text style={styles.statLine}>Doğru Seri: <Text style={styles.statValueGreen}>{maxStreak}</Text></Text>
                    <Text style={styles.statLine}>Yanlışlar: <Text style={styles.statValueRed}>{totalWrong}</Text></Text>
                    <Text style={styles.statLine}>Son: <Text style={styles.statValueMuted}>{lastReview}</Text></Text>
                </View>
            </View>
            <View style={styles.cardActions}>
                <TouchableOpacity
                    style={[styles.statusButton, item.isActive ? styles.activeButton : styles.masteredButton]}
                    onPress={() => handleToggleActive(item)}
                >
                    <Text style={styles.statusButtonText}>
                        {item.isActive ? 'Aktif' : 'Ezberlendi'}
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={styles.editButton}
                    onPress={() => navigation.navigate('AddWord', { editWordId: item.id, currentEn: item.en, currentMeanings: item.meanings })}
                >
                    <Text style={styles.editButtonText}>✏️</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => handleDelete(item)}
                >
                    <Text style={styles.deleteButtonText}>Sil</Text>
                </TouchableOpacity>
            </View>
        </View>
        );
    };

    if (loading) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color="#007AFF" />
            </View>
        );
    }

    return (
        <LinearGradient colors={[colors.backgroundGradientStart, colors.backgroundGradientEnd]} style={styles.gradientBg}>
            <View style={styles.container}>
                <View style={[styles.searchWrapper, { backgroundColor: colors.card }]}>
                    <Text style={styles.searchIcon}>🔍</Text>
                    <TextInput
                        style={[styles.searchInput, { color: colors.text }]}
                        placeholder="Kelime ara (İng/Tr)"
                        placeholderTextColor={colors.textMuted}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        autoCapitalize="none"
                        autoCorrect={false}
                    />
                </View>

                <View style={styles.filterRow}>
                    <View style={styles.filterControls}>
                        <TouchableOpacity
                            style={[styles.sortButton, sortMode === 'newest' && styles.sortButtonActive]}
                            onPress={() => setSortMode('newest')}
                        >
                            <Text style={[styles.sortButtonText, sortMode === 'newest' && styles.sortButtonTextActive]}>Yeni</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.sortButton, sortMode === 'alphabetical' && styles.sortButtonActive]}
                            onPress={() => setSortMode('alphabetical')}
                        >
                            <Text style={[styles.sortButtonText, sortMode === 'alphabetical' && styles.sortButtonTextActive]}>A-Z</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.sortButton, sortMode === 'most_wrong' && styles.sortButtonActive]}
                            onPress={() => setSortMode('most_wrong')}
                        >
                            <Text style={[styles.sortButtonText, sortMode === 'most_wrong' && styles.sortButtonTextActive]}>Zorlar</Text>
                        </TouchableOpacity>
                    </View>
                    <View style={styles.filterToggle}>
                        <Text style={[styles.filterText, { color: colors.text }]}>Sadece Aktif</Text>
                        <Switch
                            value={showActiveOnly}
                            onValueChange={setShowActiveOnly}
                            trackColor={{ false: '#ddd', true: '#34C759' }}
                        />
                    </View>
                </View>
                <View style={styles.infoRow}>
                    <Text style={[styles.totalText, { color: colors.textMuted }]}>📝 Gösterilen: {filteredWords.length}</Text>
                    <Text style={styles.muteHint}>
                        💡 Not: iPhone'da sesi duymak için yandaki çentiğin açık olması gerekir.
                    </Text>
                </View>

                {error ? <Text style={styles.errorText}>{error}</Text> : null}

                {words.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyEmoji}>📭</Text>
                        <Text style={styles.emptyText}>Henüz kelime yok</Text>
                        <Text style={styles.emptySubtext}>İlk kelimeni ekle!</Text>
                    </View>
                ) : filteredWords.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyEmoji}>🔍</Text>
                        <Text style={styles.emptyText}>Eşleşme bulunamadı</Text>
                    </View>
                ) : (
                    <FlatList
                        data={filteredWords}
                        keyExtractor={(item) => item.id}
                        renderItem={renderItem}
                        contentContainerStyle={styles.listContent}
                        refreshControl={
                            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
                        }
                    />
                )}
            </View>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    gradientBg: {
        flex: 1,
    },
    container: {
        flex: 1,
        paddingHorizontal: 16,
        paddingTop: 16,
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f8f9ff',
    },
    searchWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 14,
        paddingHorizontal: 14,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 3,
    },
    searchIcon: {
        fontSize: 18,
        marginRight: 10,
    },
    searchInput: {
        flex: 1,
        height: 46,
        fontSize: 16,
        color: '#333',
    },
    filterRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    filterControls: {
        flexDirection: 'row',
        gap: 6,
    },
    sortButton: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        backgroundColor: '#e0e0e0',
    },
    sortButtonActive: {
        backgroundColor: '#5856D6',
    },
    sortButtonText: {
        fontSize: 12,
        color: '#666',
        fontWeight: '600',
    },
    sortButtonTextActive: {
        color: '#fff',
    },
    totalText: {
        fontSize: 14,
        fontWeight: '500',
        marginBottom: 12,
    },
    filterToggle: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    filterText: {
        fontSize: 13,
        fontWeight: '500',
    },
    infoRow: {
        flexDirection: 'column',
    },
    muteHint: {
        fontSize: 11,
        color: '#999',
        fontStyle: 'italic',
        marginBottom: 8,
    },
    statsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 8,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#f0f0f0',
    },
    statLine: {
        fontSize: 12,
        color: '#666',
    },
    statValueGreen: {
        color: '#34C759',
        fontWeight: '700',
    },
    statValueRed: {
        color: '#FF3B30',
        fontWeight: '700',
    },
    statValueMuted: {
        color: '#999',
        fontWeight: '500',
    },
    listContent: {
        paddingBottom: 20,
    },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 14,
        padding: 16,
        marginBottom: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 6,
        elevation: 2,
    },
    cardInactive: {
        backgroundColor: '#f5f5f5',
        opacity: 0.7,
    },
    cardContent: {
        flex: 1,
    },
    wordRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    speakButton: {
        padding: 4,
    },
    speakIcon: {
        fontSize: 18,
    },
    enText: {
        fontSize: 17,
        fontWeight: '600',
        color: '#333',
        marginBottom: 4,
    },
    trText: {
        fontSize: 15,
        color: '#666',
    },
    textInactive: {
        color: '#999',
    },
    cardActions: {
        flexDirection: 'column',
        gap: 6,
    },
    statusButton: {
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 8,
    },
    activeButton: {
        backgroundColor: '#34C759',
    },
    masteredButton: {
        backgroundColor: '#8E8E93',
    },
    statusButtonText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '600',
        textAlign: 'center',
    },
    editButton: {
        backgroundColor: '#FF9500',
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 8,
    },
    editButtonText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '600',
        textAlign: 'center',
    },
    deleteButton: {
        backgroundColor: '#FF3B30',
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 8,
    },
    deleteButtonText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '600',
        textAlign: 'center',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyEmoji: {
        fontSize: 48,
        marginBottom: 12,
    },
    emptyText: {
        fontSize: 18,
        color: '#666',
        fontWeight: '500',
        marginBottom: 6,
    },
    emptySubtext: {
        fontSize: 14,
        color: '#999',
    },
    errorText: {
        color: '#FF3B30',
        textAlign: 'center',
        marginBottom: 12,
        fontSize: 14,
        backgroundColor: '#FFF5F5',
        padding: 10,
        borderRadius: 8,
    },
});
