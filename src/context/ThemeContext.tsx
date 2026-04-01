import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface ThemeColors {
    // Backgrounds
    background: string;
    backgroundGradientStart: string;
    backgroundGradientEnd: string;
    card: string;
    cardAlt: string;

    // Text
    text: string;
    textSecondary: string;
    textMuted: string;

    // Input
    inputBackground: string;
    inputBorder: string;
    inputText: string;

    // Status bar
    statusBarStyle: 'light-content' | 'dark-content';

    // Misc
    separator: string;
    overlay: string;
}

const lightColors: ThemeColors = {
    background: '#ffffff',
    backgroundGradientStart: '#f8f9ff',
    backgroundGradientEnd: '#e8ecf4',
    card: '#ffffff',
    cardAlt: '#f5f6fa',

    text: '#333333',
    textSecondary: '#666666',
    textMuted: '#999999',

    inputBackground: '#f5f6fa',
    inputBorder: '#eeeeee',
    inputText: '#333333',

    statusBarStyle: 'dark-content',

    separator: '#e0e0e0',
    overlay: 'rgba(0,0,0,0.05)',
};

const darkColors: ThemeColors = {
    background: '#1C1C1E',
    backgroundGradientStart: '#1C1C1E',
    backgroundGradientEnd: '#2C2C2E',
    card: '#2C2C2E',
    cardAlt: '#3A3A3C',

    text: '#FFFFFF',
    textSecondary: '#ABABAB',
    textMuted: '#8E8E93',

    inputBackground: '#3A3A3C',
    inputBorder: '#48484A',
    inputText: '#FFFFFF',

    statusBarStyle: 'light-content',

    separator: '#48484A',
    overlay: 'rgba(255,255,255,0.05)',
};

interface ThemeContextType {
    isDark: boolean;
    colors: ThemeColors;
    toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
    isDark: false,
    colors: lightColors,
    toggleTheme: () => {},
});

const THEME_KEY = '@kelimekutum_theme';

export function ThemeProvider({ children }: { children: ReactNode }) {
    const [isDark, setIsDark] = useState(false);

    useEffect(() => {
        loadTheme();
    }, []);

    const loadTheme = async () => {
        try {
            const saved = await AsyncStorage.getItem(THEME_KEY);
            if (saved === 'dark') {
                setIsDark(true);
            }
        } catch (e) {
            // ignore
        }
    };

    const toggleTheme = async () => {
        const newValue = !isDark;
        setIsDark(newValue);
        try {
            await AsyncStorage.setItem(THEME_KEY, newValue ? 'dark' : 'light');
        } catch (e) {
            // ignore
        }
    };

    const colors = isDark ? darkColors : lightColors;

    return (
        <ThemeContext.Provider value={{ isDark, colors, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    return useContext(ThemeContext);
}
