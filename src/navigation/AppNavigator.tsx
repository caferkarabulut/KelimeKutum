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
        <Stack.Navigator screenOptions={{ headerShown: true }}>
            <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'Dashboard' }} />
            <Stack.Screen name="AddWord" component={AddWordScreen} options={{ title: 'Add Word' }} />
            <Stack.Screen name="Pool" component={PoolScreen} options={{ title: 'My Pool' }} />
            <Stack.Screen name="TestSetup" component={TestSetupScreen} options={{ title: 'Custom Test' }} />
            <Stack.Screen name="Test" component={TestScreen} options={{ title: 'Test', headerBackVisible: false }} />
            <Stack.Screen name="Result" component={ResultScreen} options={{ title: 'Result', headerBackVisible: false }} />
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

