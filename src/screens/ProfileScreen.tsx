import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    Alert,
    ScrollView,
    ActivityIndicator,
    Switch,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { signOut, updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { doc, getDoc, collection, query, where, getDocs, deleteDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/firebase';
import { useTheme } from '../context/ThemeContext';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Profile'>;

interface UserData {
    totalWords: number;
    activeWords: number;
    masteredWords: number;
    totalTests: number;
    totalCorrect: number;
    totalWrong: number;
    createdAt: any;
}

export default function ProfileScreen({ navigation }: Props) {
    const { isDark, colors, toggleTheme } = useTheme();
    const [userData, setUserData] = useState<UserData | null>(null);
    const [loading, setLoading] = useState(true);
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [passwordLoading, setPasswordLoading] = useState(false);
    const [showPasswordForm, setShowPasswordForm] = useState(false);

    useEffect(() => {
        fetchUserData();
    }, []);

    const fetchUserData = async () => {
        const uid = auth.currentUser?.uid;
        if (!uid) return;

        try {
            const userRef = doc(db, 'users', uid);
            const userSnap = await getDoc(userRef);

            if (userSnap.exists()) {
                const data = userSnap.data();
                setUserData({
                    totalWords: data.totalWords || 0,
                    activeWords: data.activeWords || 0,
                    masteredWords: data.masteredWords || 0,
                    totalTests: data.totalTests || 0,
                    totalCorrect: data.totalCorrect || 0,
                    totalWrong: data.totalWrong || 0,
                    createdAt: data.createdAt,
                });
            }
        } catch (err) {
            console.error('Failed to fetch user data:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleChangePassword = async () => {
        if (!currentPassword || !newPassword || !confirmPassword) {
            Alert.alert('Hata', 'Lütfen tüm alanları doldurun');
            return;
        }

        if (newPassword !== confirmPassword) {
            Alert.alert('Hata', 'Yeni şifreler eşleşmiyor');
            return;
        }

        if (newPassword.length < 6) {
            Alert.alert('Hata', 'Yeni şifre en az 6 karakter olmalı');
            return;
        }

        setPasswordLoading(true);
        try {
            const user = auth.currentUser;
            if (!user || !user.email) throw new Error('Kullanıcı bulunamadı');

            const credential = EmailAuthProvider.credential(user.email, currentPassword);
            await reauthenticateWithCredential(user, credential);
            await updatePassword(user, newPassword);

            Alert.alert('Başarılı', 'Şifreniz güncellendi');
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
            setShowPasswordForm(false);
        } catch (err: any) {
            if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
                Alert.alert('Hata', 'Mevcut şifreniz hatalı');
            } else {
                Alert.alert('Hata', err.message || 'Şifre güncellenemedi');
            }
        } finally {
            setPasswordLoading(false);
        }
    };

    const handleLogout = async () => {
        Alert.alert('Çıkış Yap', 'Hesabınızdan çıkış yapmak istediğinize emin misiniz?', [
            { text: 'İptal', style: 'cancel' },
            {
                text: 'Çıkış Yap',
                style: 'destructive',
                onPress: async () => {
                    try {
                        await signOut(auth);
                    } catch (err) {
                        console.error('Logout error:', err);
                    }
                },
            },
        ]);
    };

    const formatDate = (timestamp: any): string => {
        if (!timestamp) return 'Bilinmiyor';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleDateString('tr-TR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
    };

    const getSuccessRate = (): string => {
        if (!userData) return '0';
        const total = userData.totalCorrect + userData.totalWrong;
        if (total === 0) return '0';
        return Math.round((userData.totalCorrect / total) * 100).toString();
    };

    const handleResetAllData = () => {
        Alert.alert(
            '⚠️ DİKKAT: Kalıcı Silme',
            'Havuzundaki tüm kelimeleri ve istatistiklerini KESİNLİKLE silmek üzeresin. Bu işlemin geri dönüşü yoktur. Devam etmek istiyor musun?',
            [
                { text: 'İptal', style: 'cancel' },
                {
                    text: 'Evet, Her Şeyi Sil!',
                    style: 'destructive',
                    onPress: async () => {
                        const uid = auth.currentUser?.uid;
                        if (!uid) return;
                        setLoading(true);
                        try {
                            const wordsQuery = query(collection(db, 'words'), where('userId', '==', uid));
                            const snapshot = await getDocs(wordsQuery);
                            const promises = snapshot.docs.map(docSnap => deleteDoc(doc(db, 'words', docSnap.id)));
                            await Promise.all(promises);

                            const userRef = doc(db, 'users', uid);
                            await updateDoc(userRef, {
                                totalWords: 0,
                                activeWords: 0,
                                masteredWords: 0,
                                totalTests: 0,
                                totalCorrect: 0,
                                totalWrong: 0,
                                lastWrongIds: [],
                            });

                            Alert.alert('Başarılı', 'Bütün veri ve kelimelerin başarıyla sıfırlandı.');
                            fetchUserData();
                        } catch (err: any) {
                            Alert.alert('Hata', err.message || 'Veriler silinemedi.');
                        } finally {
                            setLoading(false);
                        }
                    }
                }
            ]
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
            <ScrollView style={styles.container} contentContainerStyle={styles.content}>
                <View style={[styles.avatarContainer]}>
                    <View style={styles.avatar}>
                        <Text style={styles.avatarText}>
                            {auth.currentUser?.email?.charAt(0).toUpperCase() || '?'}
                        </Text>
                    </View>
                    <Text style={[styles.email, { color: colors.text }]}>{auth.currentUser?.email}</Text>
                    <Text style={[styles.memberSince, { color: colors.textMuted }]}>Üyelik: {formatDate(userData?.createdAt)}</Text>
                </View>

                <View style={styles.statsGrid}>
                    <View style={[styles.statCard, { backgroundColor: colors.card }]}>
                        <Text style={[styles.statNumber, { color: colors.text }]}>{userData?.totalWords || 0}</Text>
                        <Text style={[styles.statLabel, { color: colors.textMuted }]}>Toplam Kelime</Text>
                    </View>
                    <View style={[styles.statCard, { backgroundColor: colors.card }]}>
                        <Text style={[styles.statNumber, { color: '#34C759' }]}>{userData?.activeWords || 0}</Text>
                        <Text style={[styles.statLabel, { color: colors.textMuted }]}>Aktif</Text>
                    </View>
                    <View style={[styles.statCard, { backgroundColor: colors.card }]}>
                        <Text style={[styles.statNumber, { color: '#8E8E93' }]}>{userData?.masteredWords || 0}</Text>
                        <Text style={[styles.statLabel, { color: colors.textMuted }]}>Ezberlenen</Text>
                    </View>
                    <View style={[styles.statCard, { backgroundColor: colors.card }]}>
                        <Text style={[styles.statNumber, { color: '#5856D6' }]}>{userData?.totalTests || 0}</Text>
                        <Text style={[styles.statLabel, { color: colors.textMuted }]}>Test Sayısı</Text>
                    </View>
                    <View style={[styles.statCard, { backgroundColor: colors.card }]}>
                        <Text style={[styles.statNumber, { color: '#007AFF' }]}>{getSuccessRate()}%</Text>
                        <Text style={[styles.statLabel, { color: colors.textMuted }]}>Başarı Oranı</Text>
                    </View>
                    <View style={[styles.statCard, { backgroundColor: colors.card }]}>
                        <Text style={[styles.statNumber, { color: '#FF9500' }]}>{userData?.totalCorrect || 0}</Text>
                        <Text style={[styles.statLabel, { color: colors.textMuted }]}>Toplam Doğru</Text>
                    </View>
                </View>

                <View style={styles.section}>
                    <View style={[styles.menuItem, { backgroundColor: colors.card }]}>
                        <Text style={[styles.menuItemText, { color: colors.text }]}>🌙 Karanlık Mod</Text>
                        <Switch
                            value={isDark}
                            onValueChange={toggleTheme}
                            trackColor={{ false: '#ddd', true: '#5856D6' }}
                            thumbColor={isDark ? '#fff' : '#f4f4f4'}
                        />
                    </View>
                </View>

                <View style={styles.section}>
                    <TouchableOpacity
                        style={[styles.menuItem, { backgroundColor: colors.card }]}
                        onPress={() => setShowPasswordForm(!showPasswordForm)}
                    >
                        <Text style={[styles.menuItemText, { color: colors.text }]}>🔒 Şifre Değiştir</Text>
                        <Text style={[styles.menuItemArrow, { color: colors.textMuted }]}>{showPasswordForm ? '▲' : '▼'}</Text>
                    </TouchableOpacity>

                    {showPasswordForm && (
                        <View style={styles.passwordForm}>
                            <TextInput
                                style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.inputText }]}
                                placeholder="Mevcut Şifre"
                                placeholderTextColor={colors.textMuted}
                                value={currentPassword}
                                onChangeText={setCurrentPassword}
                                secureTextEntry
                                autoCapitalize="none"
                            />
                            <TextInput
                                style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.inputText }]}
                                placeholder="Yeni Şifre"
                                placeholderTextColor={colors.textMuted}
                                value={newPassword}
                                onChangeText={setNewPassword}
                                secureTextEntry
                                autoCapitalize="none"
                            />
                            <TextInput
                                style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.inputText }]}
                                placeholder="Yeni Şifre (Tekrar)"
                                placeholderTextColor={colors.textMuted}
                                value={confirmPassword}
                                onChangeText={setConfirmPassword}
                                secureTextEntry
                                autoCapitalize="none"
                            />
                            <TouchableOpacity
                                style={[styles.changePasswordButton, passwordLoading && styles.buttonDisabled]}
                                onPress={handleChangePassword}
                                disabled={passwordLoading}
                            >
                                {passwordLoading ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <Text style={styles.changePasswordText}>Şifreyi Güncelle</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    )}
                </View>

                <View style={[styles.section, { marginTop: 10, marginBottom: 20 }]}>
                    <TouchableOpacity
                        style={[styles.menuItem, { backgroundColor: '#FF3B30' }]}
                        onPress={handleResetAllData}
                    >
                        <Text style={[styles.menuItemText, { color: '#fff', fontWeight: '700' }]}>⚠️ Tüm Verilerimi Sıfırla</Text>
                    </TouchableOpacity>
                </View>

                <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                    <Text style={styles.logoutText}>Çıkış Yap</Text>
                </TouchableOpacity>
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
        paddingHorizontal: 24,
        paddingTop: 24,
        paddingBottom: 40,
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f8f9ff',
    },
    avatarContainer: {
        alignItems: 'center',
        marginBottom: 28,
    },
    avatar: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#007AFF',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    avatarText: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#fff',
    },
    email: {
        fontSize: 16,
        color: '#333',
        fontWeight: '500',
    },
    memberSince: {
        fontSize: 13,
        color: '#999',
        marginTop: 4,
    },
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        marginBottom: 24,
    },
    statCard: {
        width: '31%',
        backgroundColor: '#fff',
        borderRadius: 14,
        padding: 14,
        alignItems: 'center',
        marginBottom: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 6,
        elevation: 2,
    },
    statNumber: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#333',
    },
    statLabel: {
        fontSize: 11,
        color: '#888',
        marginTop: 4,
        textAlign: 'center',
    },
    section: {
        marginBottom: 20,
    },
    menuItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#f5f5f5',
        padding: 16,
        borderRadius: 12,
    },
    menuItemText: {
        fontSize: 16,
        color: '#333',
        fontWeight: '500',
    },
    menuItemArrow: {
        fontSize: 14,
        color: '#999',
    },
    passwordForm: {
        marginTop: 12,
        gap: 10,
    },
    input: {
        height: 48,
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 10,
        paddingHorizontal: 16,
        fontSize: 15,
        backgroundColor: '#fafafa',
    },
    changePasswordButton: {
        height: 48,
        backgroundColor: '#007AFF',
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 4,
    },
    changePasswordText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    buttonDisabled: {
        backgroundColor: '#ccc',
    },
    logoutButton: {
        height: 50,
        backgroundColor: '#FF3B30',
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 10,
    },
    logoutText: {
        color: '#fff',
        fontSize: 17,
        fontWeight: '600',
    },
});
