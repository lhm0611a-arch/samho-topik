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
  startFreshExam: () => void;
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
      
      availableExams: ['모의고사1회', '모의고사2회', '모의고사3회', '모의고사4회', '모의고사5회', '모의고사6회'],
      setAvailableExams: (exams) => set({ availableExams: exams }),

      questions: [],
      setQuestions: (qs) => set((state) => {
        // Only reset answers if questions length changed or not in active exam
        const shouldResetAnswers = !state.isExamRunning || state.answers.length !== qs.length;
        return {
          questions: qs,
          answers: shouldResetAnswers ? new Array(qs.length).fill(null) : state.answers,
          bookmarks: shouldResetAnswers ? new Array(qs.length).fill(false) : state.bookmarks
        };
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
      startExam: () => set((state) => ({ 
        isExamRunning: true, 
        currentScreen: 'test', 
        currentIdx: 0,
        answers: state.answers.length === state.questions.length ? state.answers : new Array(state.questions.length).fill(null),
        bookmarks: state.bookmarks.length === state.questions.length ? state.bookmarks : new Array(state.questions.length).fill(false)
      })),
      startFreshExam: () => set((state) => ({
        isExamRunning: true,
        currentScreen: 'test',
        currentIdx: 0,
        answers: new Array(state.questions.length).fill(null),
        bookmarks: new Array(state.questions.length).fill(false),
        timeLeft: 100 * 60,
        result: null
      })),
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
        selectedLang: state.selectedLang,
        activeExamName: state.activeExamName,
        availableExams: state.availableExams,
        // Only persist candidate, answers, and screen if exam is actively in progress
        candidate: state.isExamRunning ? state.candidate : null,
        answers: state.isExamRunning ? state.answers : [],
        bookmarks: state.isExamRunning ? state.bookmarks : [],
        currentIdx: state.isExamRunning ? state.currentIdx : 0,
        isExamRunning: state.isExamRunning,
        timeLeft: state.isExamRunning ? state.timeLeft : 100 * 60,
        // NEVER persist 'result' screen as startup screen!
        currentScreen: state.isExamRunning ? 'test' : 'main',
        result: state.result
      })
    }
  )
);
