export interface Question {
  num: string | number;
  realIdx: number | string;
  type: '듣기' | '읽기';
  passage: string;
  question: string;
  image: string;
  options: string[];
  answer: number | "";
  score: number;
  // For Admin usage
  _orig_image?: string;
  _orig_opt1?: string;
  _orig_opt2?: string;
  _orig_opt3?: string;
  _orig_opt4?: string;
}

export interface Candidate {
  regNo: string;
  name: string;
  company: string;
  firstName: string;
  lastName: string;
  lang: 'ko' | 'en' | 'id' | 'vi' | 'ne';
}

export interface ExamResult {
  examName: string;
  registrationNo: string;
  studentName: string;
  company: string;
  score: number;
  lcScore: number;
  rcScore: number;
  correctCount: number;
  totalQuestions: number;
  detailedAnswers: Record<string, number>;
  timestamp?: any;
}
