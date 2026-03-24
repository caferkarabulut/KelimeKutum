import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../firebase/firebase';
import type { TestMode } from '../types/srs';

import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import HomeScreen from '../screens/HomeScreen';
import AddWordScreen from '../screens/AddWordScreen';
import PoolScreen from '../screens/PoolScreen';
import TestSetupScreen from '../screens/TestSetupScreen';
import TestScreen from '../screens/TestScreen';
import ResultScreen from '../screens/ResultScreen';
import ProfileScreen from '../screens/ProfileScreen';
import StatsScreen from '../screens/StatsScreen';
import AchievementsScreen from '../screens/AchievementsScreen';

export interface Question {
    id: string;
    en: string;
    tr: string;
    direction: 'EN_TR' | 'TR_EN';
}

export interface WrongItem {
    prompt: string;
    expected: string;
    userAnswer: string;
    wordId: string;
}

export type RootStackParamList = {
    Login: undefined;
    Register: undefined;
    Home: undefined;
    AddWord: undefined;
    Pool: undefined;
    TestSetup: undefined;
    Profile: undefined;
    Stats: undefined;
    Achievements: undefined;
    Test: { questions: Question[]; mode: TestMode; isDueTest?: boolean };
    Result: {
        score: number;
        correct: number;
        wrong: number;
        wrongItems: WrongItem[];
        wrongIds: string[];
        mode: TestMode;
    };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

function AuthStack() {
    return (
        <Stack.Navigator screenOptions={{ headerShown: true }}>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
        </Stack.Navigator>
    );
}

function AppStack() {
    return (
        <Stack.Navigator 
            screenOptions={{ 
                headerShown: true,
                headerStyle: { backgroundColor: '#5856D6' },
                headerTintColor: '#fff',
                headerTitleStyle: { fontWeight: '600', fontSize: 18 },
                headerShadowVisible: false,
                contentStyle: { backgroundColor: '#f8f9fa' }
            }}
        >
            <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'Ana Ekran' }} />
            <Stack.Screen name="AddWord" component={AddWordScreen} options={{ title: 'Kelime Ekle' }} />
            <Stack.Screen name="Pool" component={PoolScreen} options={{ title: 'Havuzum' }} />
            <Stack.Screen name="TestSetup" component={TestSetupScreen} options={{ title: 'Test Oluştur' }} />
            <Stack.Screen name="Test" component={TestScreen} options={{ title: 'Test', headerBackVisible: false }} />
            <Stack.Screen name="Result" component={ResultScreen} options={{ title: 'Sonuç', headerBackVisible: false }} />
            <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profil' }} />
            <Stack.Screen name="Stats" component={StatsScreen} options={{ title: 'İstatistikler' }} />
            <Stack.Screen name="Achievements" component={AchievementsScreen} options={{ title: 'Başarımlar' }} />
        </Stack.Navigator>
    );
}

export default function AppNavigator() {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            setLoading(false);
        });

        return unsubscribe;
    }, []);

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#007AFF" />
                <Text style={styles.loadingText}>Loading...</Text>
            </View>
        );
    }

    return (
        <NavigationContainer>
            {user ? <AppStack /> : <AuthStack />}
        </NavigationContainer>
    );
}

const styles = StyleSheet.create({
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#fff',
    },
    loadingText: {
        marginTop: 10,
        fontSize: 16,
        color: '#666',
    },
});

