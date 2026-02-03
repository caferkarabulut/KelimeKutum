import React, { useEffect, useState, useCallback } from 'react';
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
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Pool'>;

interface Word {
    id: string;
    en: string;
    tr: string;
    enNorm?: string;
    isActive: boolean;
}

function normalize(text: string): string {
    return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

export default function PoolScreen({ navigation }: Props) {
    const [words, setWords] = useState<Word[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState('');
    const [showActiveOnly, setShowActiveOnly] = useState(false);

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
            const fetchedWords: Word[] = snapshot.docs.map((docSnap) => ({
                id: docSnap.id,
                en: docSnap.data().en,
                tr: docSnap.data().tr,
                enNorm: docSnap.data().enNorm,
                isActive: docSnap.data().isActive ?? true,
            }));
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

                        // Update user counters
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

            // Update user counters
            const userRef = doc(db, 'users', uid);
            const userSnap = await getDoc(userRef);
            if (userSnap.exists()) {
                if (newIsActive) {
                    // Was mastered, now active
                    await updateDoc(userRef, {
                        activeWords: increment(1),
                        masteredWords: increment(-1),
                    });
                } else {
                    // Was active, now mastered
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

    // Filter words based on search query and active filter
    const filteredWords = words.filter((word) => {
        if (showActiveOnly && !word.isActive) return false;

        if (!searchQuery.trim()) return true;
        const normalizedQuery = normalize(searchQuery);
        const enMatch = normalize(word.en).includes(normalizedQuery);
        const trMatch = normalize(word.tr).includes(normalizedQuery);
        const enNormMatch = word.enNorm ? word.enNorm.includes(normalizedQuery) : false;
        return enMatch || trMatch || enNormMatch;
    });

    const renderItem = ({ item }: { item: Word }) => (
        <View style={[styles.card, !item.isActive && styles.cardInactive]}>
            <View style={styles.cardContent}>
                <Text style={[styles.enText, !item.isActive && styles.textInactive]}>{item.en}</Text>
                <Text style={[styles.trText, !item.isActive && styles.textInactive]}>{item.tr}</Text>
            </View>
            <View style={styles.cardActions}>
                <TouchableOpacity
                    style={[styles.statusButton, item.isActive ? styles.activeButton : styles.masteredButton]}
                    onPress={() => handleToggleActive(item)}
                >
                    <Text style={styles.statusButtonText}>
                        {item.isActive ? 'Active' : 'Mastered'}
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => handleDelete(item)}
                >
                    <Text style={styles.deleteButtonText}>Delete</Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    if (loading) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color="#007AFF" />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <TextInput
                style={styles.searchInput}
                placeholder="Search (EN/TR)"
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCapitalize="none"
                autoCorrect={false}
            />

            <View style={styles.filterRow}>
                <Text style={styles.totalText}>Total: {filteredWords.length}</Text>
                <View style={styles.filterToggle}>
                    <Text style={styles.filterLabel}>Active only</Text>
                    <Switch
                        value={showActiveOnly}
                        onValueChange={setShowActiveOnly}
                        trackColor={{ false: '#ddd', true: '#34C759' }}
                    />
                </View>
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            {words.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>No words yet</Text>
                    <Text style={styles.emptySubtext}>Add your first word!</Text>
                </View>
            ) : filteredWords.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>No matches found</Text>
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
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
        paddingHorizontal: 16,
        paddingTop: 16,
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#fff',
    },
    searchInput: {
        height: 44,
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        paddingHorizontal: 16,
        fontSize: 16,
        backgroundColor: '#f9f9f9',
        marginBottom: 12,
    },
    filterRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    totalText: {
        fontSize: 14,
        color: '#666',
    },
    filterToggle: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    filterLabel: {
        fontSize: 14,
        color: '#666',
        marginRight: 8,
    },
    listContent: {
        paddingBottom: 20,
    },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f9f9f9',
        borderRadius: 10,
        padding: 14,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#eee',
    },
    cardInactive: {
        backgroundColor: '#f0f0f0',
        opacity: 0.7,
    },
    cardContent: {
        flex: 1,
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
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 6,
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
    deleteButton: {
        backgroundColor: '#FF3B30',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 6,
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
    emptyText: {
        fontSize: 18,
        color: '#999',
        marginBottom: 8,
    },
    emptySubtext: {
        fontSize: 14,
        color: '#bbb',
    },
    errorText: {
        color: '#FF3B30',
        textAlign: 'center',
        marginBottom: 12,
        fontSize: 14,
    },
});
