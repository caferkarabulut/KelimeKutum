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
    // --- KELİME EKLEME (TOTAL WORDS) ---
    { id: 'words_1', title: 'İlk Adım', description: 'İlk kelimeni ekle', icon: '🌱', condition: (s) => s.totalWords >= 1 },
    { id: 'words_10', title: 'Hoşgeldin', description: '10 kelime ekle', icon: '👋', condition: (s) => s.totalWords >= 10 },
    { id: 'words_50', title: 'Isınma Turu', description: '50 kelime ekle', icon: '🏃', condition: (s) => s.totalWords >= 50 },
    { id: 'words_100', title: 'Kelime Avcısı', description: '100 kelime ekle', icon: '🎯', condition: (s) => s.totalWords >= 100 },
    { id: 'words_250', title: 'Sözlük Yazarı', description: '250 kelime ekle', icon: '📖', condition: (s) => s.totalWords >= 250 },
    { id: 'words_500', title: 'Kelime Savaşçısı', description: '500 kelime ekle', icon: '⚔️', condition: (s) => s.totalWords >= 500 },
    { id: 'words_750', title: 'Kelime Ustası', description: '750 kelime ekle', icon: '🏅', condition: (s) => s.totalWords >= 750 },
    { id: 'words_1000', title: 'Kelime Lordu', description: '1000 kelime ekle', icon: '👑', condition: (s) => s.totalWords >= 1000 },
    { id: 'words_1500', title: 'Kelime Efsanesi', description: '1500 kelime ekle', icon: '🐉', condition: (s) => s.totalWords >= 1500 },
    { id: 'words_2000', title: 'Yürüyen Sözlük', description: '2000 kelime ekle', icon: '🧠', condition: (s) => s.totalWords >= 2000 },
    { id: 'words_5000', title: 'Dil Tanrısı', description: '5000 kelime ekle', icon: '⚡', condition: (s) => s.totalWords >= 5000 },

    // --- TEST ÇÖZME (TOTAL TESTS) ---
    { id: 'tests_1', title: 'Sınava Gir', description: 'İlk testini tamamla', icon: '✏️', condition: (s) => s.totalTests >= 1 },
    { id: 'tests_10', title: 'Test Çırağı', description: '10 test tamamla', icon: '📝', condition: (s) => s.totalTests >= 10 },
    { id: 'tests_25', title: 'Test Kalfası', description: '25 test tamamla', icon: '📜', condition: (s) => s.totalTests >= 25 },
    { id: 'tests_50', title: 'Test Ustası', description: '50 test tamamla', icon: '🎓', condition: (s) => s.totalTests >= 50 },
    { id: 'tests_100', title: 'Test Makinesi', description: '100 test tamamla', icon: '🤖', condition: (s) => s.totalTests >= 100 },
    { id: 'tests_250', title: 'Test Bağımlısı', description: '250 test tamamla', icon: '😵', condition: (s) => s.totalTests >= 250 },
    { id: 'tests_500', title: 'Sonsuz Döngü', description: '500 test tamamla', icon: '♾️', condition: (s) => s.totalTests >= 500 },

    // --- SERİ YAPMA (BEST STREAK) ---
    { id: 'streak_5', title: 'Seri Başlat', description: 'Bir kelimede 5 doğru seri yap', icon: '🔥', condition: (s) => s.bestStreak >= 5 },
    { id: 'streak_10', title: 'Isınıyorum', description: 'Bir kelimede 10 doğru seri yap', icon: '🌡️', condition: (s) => s.bestStreak >= 10 },
    { id: 'streak_15', title: 'Alev Alev', description: 'Bir kelimede 15 doğru seri yap', icon: '☄️', condition: (s) => s.bestStreak >= 15 },
    { id: 'streak_20', title: 'Durdurulamaz', description: 'Bir kelimede 20 doğru seri yap', icon: '🚀', condition: (s) => s.bestStreak >= 20 },
    { id: 'streak_30', title: 'Asla Unutmam', description: 'Bir kelimede 30 doğru seri yap', icon: '🐘', condition: (s) => s.bestStreak >= 30 },
    { id: 'streak_40', title: 'Hafıza Şampiyonu', description: 'Bir kelimede 40 doğru seri yap', icon: '🏆', condition: (s) => s.bestStreak >= 40 },
    { id: 'streak_50', title: 'Zihin Bükücü', description: 'Bir kelimede 50 doğru seri yap', icon: '🌀', condition: (s) => s.bestStreak >= 50 },
    { id: 'streak_75', title: 'Makinemsi', description: 'Bir kelimede 75 doğru seri yap', icon: '⚙️', condition: (s) => s.bestStreak >= 75 },
    { id: 'streak_100', title: 'İnsan Üstü', description: 'Bir kelimede 100 doğru seri yap', icon: '👽', condition: (s) => s.bestStreak >= 100 },

    // --- DOĞRU CEVAPLAR (TOTAL CORRECT) ---
    { id: 'correct_25', title: 'Doğru Bilen', description: '25 doğru cevap ver', icon: '✔️', condition: (s) => s.totalCorrect >= 25 },
    { id: 'correct_100', title: 'Keskin Nişancı', description: '100 doğru cevap ver', icon: '🎯', condition: (s) => s.totalCorrect >= 100 },
    { id: 'correct_250', title: 'Doğruluk Abidesi', description: '250 doğru cevap ver', icon: '🗽', condition: (s) => s.totalCorrect >= 250 },
    { id: 'correct_500', title: 'Bilgi Deposu', description: '500 doğru cevap ver', icon: '💎', condition: (s) => s.totalCorrect >= 500 },
    { id: 'correct_1000', title: 'Bilgi Çağı', description: '1000 doğru cevap ver', icon: '🌐', condition: (s) => s.totalCorrect >= 1000 },
    { id: 'correct_2500', title: 'Bilgi Seli', description: '2500 doğru cevap ver', icon: '🌊', condition: (s) => s.totalCorrect >= 2500 },
    { id: 'correct_5000', title: 'Bilgi Okyanusu', description: '5000 doğru cevap ver', icon: '🐳', condition: (s) => s.totalCorrect >= 5000 },
    { id: 'correct_10000', title: 'Her Şeyi Bilen', description: '10000 doğru cevap ver', icon: '👁️', condition: (s) => s.totalCorrect >= 10000 },

    // --- EZBERLENENLER (MASTERED WORDS) ---
    { id: 'mastered_1', title: 'İlk Ezber', description: '1 kelimeyi tamamen ezberle', icon: '🧠', condition: (s) => s.masteredWords >= 1 },
    { id: 'mastered_5', title: 'Hafıza Çırağı', description: '5 kelimeyi ezberle', icon: '👦', condition: (s) => s.masteredWords >= 5 },
    { id: 'mastered_10', title: 'Hafıza Kalfası', description: '10 kelimeyi ezberle', icon: '👨‍🎓', condition: (s) => s.masteredWords >= 10 },
    { id: 'mastered_25', title: 'Hafıza Uzmanı', description: '25 kelimeyi ezberle', icon: '🧑‍🏫', condition: (s) => s.masteredWords >= 25 },
    { id: 'mastered_50', title: 'Bilge', description: '50 kelimeyi ezberle', icon: '🦉', condition: (s) => s.masteredWords >= 50 },
    { id: 'mastered_100', title: 'Üstat', description: '100 kelimeyi ezberle', icon: '🧙‍♂️', condition: (s) => s.masteredWords >= 100 },
    { id: 'mastered_250', title: 'Gurus', description: '250 kelimeyi ezberle', icon: '🧘', condition: (s) => s.masteredWords >= 250 },
    { id: 'mastered_500', title: 'Dahi', description: '500 kelimeyi ezberle', icon: '🌟', condition: (s) => s.masteredWords >= 500 },
    { id: 'mastered_1000', title: 'Canlı Çevirmen', description: '1000 kelimeyi ezberle', icon: '🗣️', condition: (s) => s.masteredWords >= 1000 },

    // --- ÖZEL / MÜKEMMEL SKOR (PERFECT SCORES OR PERFECT STATE) ---
    { id: 'perfect_1', title: 'Hataya Yer Yok', description: 'Bir testte %100 skor al', icon: '💯', condition: (s) => s.hasPerfectScore },
    { id: 'active_10', title: 'Aktif Öğrenci', description: '10 aktif kelimeye ulaş', icon: '🌱', condition: (s) => s.activeWords >= 10 },
    { id: 'active_50', title: 'Yoğun Mesai', description: '50 aktif kelimeye ulaş', icon: '🔥', condition: (s) => s.activeWords >= 50 },
    { id: 'active_100', title: 'Kaos Eğitimi', description: 'Aynı anda 100 aktif kelime tut', icon: '🌪️', condition: (s) => s.activeWords >= 100 },
    { id: 'active_250', title: 'Yük Altında', description: 'Aynı anda 250 aktif kelime', icon: '🏋️', condition: (s) => s.activeWords >= 250 },
    { id: 'first_wrong', title: 'Öğrenme Fırsatı', description: 'İlk hatanı yap (Her hata bir tecrübedir)', icon: '🙈', condition: (s) => s.totalWrong >= 1 },
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
