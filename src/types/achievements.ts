export interface Achievement {
    id: string;
    title: string;
    description: string;
    icon: string;
    condition: (stats: AchievementStats) => boolean;
}

export interface AchievementStats {
    totalWords: number;
    activeWords: number;
    masteredWords: number;
    totalTests: number;
    totalCorrect: number;
    totalWrong: number;
    bestStreak: number;
    hasPerfectScore: boolean;
}

export const ACHIEVEMENTS: Achievement[] = [
    {
        id: 'first_word',
        title: 'İlk Adım',
        description: 'İlk kelimeni ekle',
        icon: '🌱',
        condition: (s) => s.totalWords >= 1,
    },
    {
        id: 'words_10',
        title: 'Başlangıç',
        description: '10 kelime ekle',
        icon: '📚',
        condition: (s) => s.totalWords >= 10,
    },
    {
        id: 'words_50',
        title: 'Kelime Avcısı',
        description: '50 kelime ekle',
        icon: '🎯',
        condition: (s) => s.totalWords >= 50,
    },
    {
        id: 'words_100',
        title: 'Kelime Ustası',
        description: '100 kelime ekle',
        icon: '🏅',
        condition: (s) => s.totalWords >= 100,
    },
    {
        id: 'words_250',
        title: 'Kelime Savaşçısı',
        description: '250 kelime ekle',
        icon: '⚔️',
        condition: (s) => s.totalWords >= 250,
    },
    {
        id: 'words_500',
        title: 'Kelime Efsanesi',
        description: '500 kelime ekle',
        icon: '👑',
        condition: (s) => s.totalWords >= 500,
    },
    {
        id: 'first_test',
        title: 'Sınava Gir',
        description: 'İlk testini tamamla',
        icon: '✏️',
        condition: (s) => s.totalTests >= 1,
    },
    {
        id: 'tests_10',
        title: 'Test Meraklısı',
        description: '10 test tamamla',
        icon: '📝',
        condition: (s) => s.totalTests >= 10,
    },
    {
        id: 'tests_50',
        title: 'Test Makinesi',
        description: '50 test tamamla',
        icon: '🤖',
        condition: (s) => s.totalTests >= 50,
    },
    {
        id: 'perfect_score',
        title: 'Mükemmel!',
        description: 'Bir testte %100 skor al',
        icon: '💯',
        condition: (s) => s.hasPerfectScore,
    },
    {
        id: 'streak_5',
        title: 'Seri Başlat',
        description: 'Bir kelimede 5 doğru seri yap',
        icon: '🔥',
        condition: (s) => s.bestStreak >= 5,
    },
    {
        id: 'streak_10',
        title: 'Durdurulamaz',
        description: 'Bir kelimede 10 doğru seri yap',
        icon: '⚡',
        condition: (s) => s.bestStreak >= 10,
    },
    {
        id: 'mastered_10',
        title: 'Hafıza Uzmanı',
        description: '10 kelimeyi ezberle',
        icon: '🧠',
        condition: (s) => s.masteredWords >= 10,
    },
    {
        id: 'mastered_50',
        title: 'Bilge',
        description: '50 kelimeyi ezberle',
        icon: '🦉',
        condition: (s) => s.masteredWords >= 50,
    },
    {
        id: 'correct_100',
        title: 'Doğru Cevap Kralı',
        description: '100 doğru cevap ver',
        icon: '✅',
        condition: (s) => s.totalCorrect >= 100,
    },
    {
        id: 'correct_500',
        title: 'Bilgi Deposu',
        description: '500 doğru cevap ver',
        icon: '💎',
        condition: (s) => s.totalCorrect >= 500,
    },
];

export function checkAchievements(stats: AchievementStats, unlockedIds: string[]): Achievement[] {
    const newlyUnlocked: Achievement[] = [];

    for (const achievement of ACHIEVEMENTS) {
        if (!unlockedIds.includes(achievement.id) && achievement.condition(stats)) {
            newlyUnlocked.push(achievement);
        }
    }

    return newlyUnlocked;
}
