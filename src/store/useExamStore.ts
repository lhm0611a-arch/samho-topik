import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Question, Candidate, ExamResult } from '../types';

interface ExamState {
  // Candidate info
  candidate: Candidate | null;
  setCandidate: (info: Candidate) => void;

  // Settings
  selectedLang: 'ko' | 'en' | 'id' | 'vi' | 'ne';
  setSelectedLang: (lang: 'ko' | 'en' | 'id' | 'vi' | 'ne') => void;

  // DB Sync state
  dbSyncStatus: { msg: string; color: string; isCloud: boolean };
  setDbSyncStatus: (msg: string, color: string, isCloud?: boolean) => void;
  activeExamName: string;
  setActiveExamName: (name: string) => void;
  availableExams: string[];
  setAvailableExams: (exams: string[]) => void;
  questions: Question[];
  setQuestions: (qs: Question[]) => void;

  // Exam execution state
  currentIdx: number;
  answers: (number | null)[];
  bookmarks: boolean[];
  setAnswer: (qIdx: number, ansIdx: number) => void;
  toggleBookmark: (qIdx: number) => void;
  nextQuestion: () => void;
  prevQuestion: () => void;
  jumpToQuestion: (idx: number) => void;
  
  isExamRunning: boolean;
  startExam: () => void;
  endExam: () => void;

  timeLeft: number;
  setTimeLeft: (time: number) => void;

  // Final Results
  result: ExamResult | null;
  setResult: (result: ExamResult) => void;
  
  // App navigation
  currentScreen: 'main' | 'intro' | 'waiting' | 'test' | 'result';
  setScreen: (screen: 'main' | 'intro' | 'waiting' | 'test' | 'result') => void;
  
  resetSession: () => void;
}

export const useExamStore = create<ExamState>()(
  persist(
    (set) => ({
      candidate: null,
      setCandidate: (info) => set({ candidate: info }),

      selectedLang: 'ko',
      setSelectedLang: (lang) => set({ selectedLang: lang }),

      dbSyncStatus: { msg: 'CONNECTING...', color: 'text-cyan-600', isCloud: false },
      setDbSyncStatus: (msg, color, isCloud = false) => set({ dbSyncStatus: { msg, color, isCloud } }),
      
      activeExamName: '모의고사1회',
      setActiveExamName: (name) => set({ activeExamName: name }),
      
      availableExams: ['모의고사1회'],
      setAvailableExams: (exams) => set({ availableExams: exams }),

      questions: [],
      setQuestions: (qs) => set({ 
        questions: qs, 
        answers: new Array(qs.length).fill(null),
        bookmarks: new Array(qs.length).fill(false)
      }),

      currentIdx: 0,
      answers: [],
      bookmarks: [],
      setAnswer: (qIdx, ansIdx) => set((state) => {
        const newAnswers = [...state.answers];
        newAnswers[qIdx] = ansIdx;
        return { answers: newAnswers };
      }),
      toggleBookmark: (qIdx) => set((state) => {
        const newBookmarks = [...state.bookmarks];
        newBookmarks[qIdx] = !newBookmarks[qIdx];
        return { bookmarks: newBookmarks };
      }),
      nextQuestion: () => set((state) => ({ 
        currentIdx: Math.min(state.currentIdx + 1, state.questions.length - 1) 
      })),
      prevQuestion: () => set((state) => ({ 
        currentIdx: Math.max(state.currentIdx - 1, 0) 
      })),
      jumpToQuestion: (idx) => set({ currentIdx: idx }),

      isExamRunning: false,
      startExam: () => set({ isExamRunning: true, currentScreen: 'test', currentIdx: 0 }),
      endExam: () => set({ isExamRunning: false }),

      timeLeft: 100 * 60,
      setTimeLeft: (time) => set({ timeLeft: time }),

      result: null,
      setResult: (result) => set({ result }),

      currentScreen: 'main',
      setScreen: (screen) => set({ currentScreen: screen }),
      
      resetSession: () => set({
        candidate: null,
        isExamRunning: false,
        currentScreen: 'main',
        answers: [],
        bookmarks: [],
        result: null,
        currentIdx: 0,
        timeLeft: 100 * 60
      }),
    }),
    {
      name: 'topik-cbt-storage',
      partialize: (state) => ({
        candidate: state.candidate,
        selectedLang: state.selectedLang,
        questions: state.questions,
        answers: state.answers,
        bookmarks: state.bookmarks,
        currentIdx: state.currentIdx,
        isExamRunning: state.isExamRunning,
        timeLeft: state.timeLeft,
        currentScreen: state.currentScreen,
        activeExamName: state.activeExamName
      })
    }
  )
);
