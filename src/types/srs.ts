import { Timestamp } from 'firebase/firestore';

export interface Progress {
    intervalDays: number;
    streak: number;
    wrongCount: number;
    nextReviewAt: Timestamp | Date | null;
    lastTestedAt: number;
    lastOutcome: 'correct' | 'wrong';
}

export interface Word {
    id: string;
    userId: string;
    en: string;
    tr: string;
    enNorm: string;
    isActive: boolean;
    enProgress: Progress;
    trProgress: Progress;

    enNextReviewAt: Timestamp | Date | null;
    trNextReviewAt: Timestamp | Date | null;
    createdAt: Timestamp | Date | null;
}

export interface UserStats {
    totalWords: number;
    activeWords: number;
    masteredWords: number;
    lastWrongIds: string[];
    lastWrongUpdatedAt: Timestamp | Date | null;
    createdAt: Timestamp | Date | null;
}

export type TestMode = 'EN_TR' | 'TR_EN' | 'MIXED';

export function createDefaultProgress(): Progress {
    return {
        intervalDays: 0,
        streak: 0,
        wrongCount: 0,
        nextReviewAt: new Date(),
        lastTestedAt: 0,
        lastOutcome: 'correct',
    };
}

export function getNextReviewDate(intervalDays: number): Date {
    const date = new Date();
    date.setDate(date.getDate() + intervalDays);
    return date;
}

export function getNextReviewDateMinutes(minutes: number): Date {
    const date = new Date();
    date.setMinutes(date.getMinutes() + minutes);
    return date;
}

export function calculateNextProgress(isCorrect: boolean, currentProgress: Progress): Progress {
    const now = Date.now();

    if (isCorrect) {
        const newIntervalDays = currentProgress.intervalDays === 0
            ? 1
            : currentProgress.intervalDays * 2;
        return {
            intervalDays: newIntervalDays,
            streak: currentProgress.streak + 1,
            wrongCount: currentProgress.wrongCount,
            nextReviewAt: getNextReviewDate(newIntervalDays),
            lastTestedAt: now,
            lastOutcome: 'correct',
        };
    } else {
        return {
            intervalDays: 0,
            streak: 0,
            wrongCount: currentProgress.wrongCount + 1,
            nextReviewAt: getNextReviewDateMinutes(10),
            lastTestedAt: now,
            lastOutcome: 'wrong',
        };
    }
}
