export interface Subject {
  id: string;
  name: string;
  icon: string; // lucide icon name
  color: string; // tailwind color class
  bgLight: string; // tailwind bg color class
  description: string;
  defaultQuestionsCount: number;
}

export interface Question {
  question: string;
  options: string[];
  answerIndex: number;
  explanation: string;
}

export interface UserStats {
  totalAttempted: number;
  totalCorrect: number;
}

export interface UserProgress {
  uid: string;
  email: string;
  displayName: string;
  totalScore: number;
  streakCount: number;
  lastActiveDate: string; // YYYY-MM-DD
  stats: Record<string, UserStats>; // subjectId -> UserStats
  createdAt: string;
}

export interface HistoryItem {
  id: string;
  uid: string;
  subjectId: string;
  subjectName: string;
  difficulty?: "Easy" | "Medium" | "Hard";
  educationLevel?: "p1" | "p2" | "p3" | "p4" | "p5" | "p6" | "m1" | "m2" | "m3" | "m4" | "m5" | "m6" | "primary" | "junior_high" | "senior_high" | "university";
  questionType?: "review" | "comprehension" | "past_exams";
  questionFormat?: "multiple_choice" | "true_false" | "fill_in_blank";
  score: number;
  totalQuestions: number;
  timestamp: any; // Firestore Timestamp or date ISO string
  details: {
    question: string;
    options: string[];
    answerIndex: number;
    selectedOptionIndex: number;
    isCorrect: boolean;
    explanation: string;
  }[];
}
