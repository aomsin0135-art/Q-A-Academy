import React, { useState } from "react";
import { SUBJECTS } from "../data/subjects";
import { Question, Subject, UserProgress } from "../types";
import LucideIcon from "./LucideIcon";
import { 
  Sparkles, Trophy, ArrowRight, Check, X, AlertCircle, 
  HelpCircle, ChevronRight, Play, RefreshCw, Flame, Award
} from "lucide-react";
import { doc, updateDoc, writeBatch, collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../lib/firebase";

const EDUCATION_LEVELS_MAP: Record<string, string> = {
  p1: "🎒 ประถมศึกษาปีที่ 1 (ป.1)",
  p2: "🎒 ประถมศึกษาปีที่ 2 (ป.2)",
  p3: "🎒 ประถมศึกษาปีที่ 3 (ป.3)",
  p4: "🎒 ประถมศึกษาปีที่ 4 (ป.4)",
  p5: "🎒 ประถมศึกษาปีที่ 5 (ป.5)",
  p6: "🎒 ประถมศึกษาปีที่ 6 (ป.6)",
  primary: "🎒 ประถมศึกษาตอนต้น-ปลาย (รวม ป.1 - ป.6)",
  m1: "📚 มัธยมศึกษาปีที่ 1 (ม.1)",
  m2: "📚 มัธยมศึกษาปีที่ 2 (ม.2)",
  m3: "📚 มัธยมศึกษาปีที่ 3 (ม.3)",
  junior_high: "📚 มัธยมศึกษาตอนต้น (รวม ม.1 - ม.3)",
  m4: "🎓 มัธยมศึกษาปีที่ 4 (ม.4)",
  m5: "🎓 มัธยมศึกษาปีที่ 5 (ม.5)",
  m6: "🎓 มัธยมศึกษาปีที่ 6 (ม.6)",
  senior_high: "🎓 มัธยมศึกษาตอนปลาย (รวม ม.4 - ม.6)",
  university: "🏛️ มหาวิทยาลัย / บุคคลทั่วไป"
};

interface QuizZoneProps {
  progress: UserProgress;
  onQuizFinished: () => void;
}

export default function QuizZone({ progress, onQuizFinished }: QuizZoneProps) {
  // Setup States
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [difficulty, setDifficulty] = useState<"Easy" | "Medium" | "Hard">("Medium");
  const [quizLength, setQuizLength] = useState<number>(5);
  const [educationLevel, setEducationLevel] = useState<"p1" | "p2" | "p3" | "p4" | "p5" | "p6" | "primary" | "m1" | "m2" | "m3" | "junior_high" | "m4" | "m5" | "m6" | "senior_high" | "university">("junior_high");
  const [questionType, setQuestionType] = useState<"review" | "comprehension" | "past_exams">("comprehension");
  const [questionFormat, setQuestionFormat] = useState<"multiple_choice" | "true_false" | "fill_in_blank">("multiple_choice");

  // Active Quiz States
  const [quizState, setQuizState] = useState<"SETUP" | "LOADING" | "QUESTION" | "FINISHED">("SETUP");
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selectedOptionIndex, setSelectedOptionIndex] = useState<number | null>(null);
  const [answersList, setAnswersList] = useState<{
    question: string;
    options: string[];
    answerIndex: number;
    selectedOptionIndex: number;
    isCorrect: boolean;
    explanation: string;
  }[]>([]);
  
  // Scoring / Loading States
  const [correctAnswersCount, setCorrectAnswersCount] = useState(0);
  const [pointsEarned, setPointsEarned] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [apiError, setApiError] = useState<string | null>(null);

  const currentQuestion = questions[currentQuestionIndex] || null;

  const startQuiz = async () => {
    if (!selectedSubject) return;
    setQuizState("LOADING");
    setApiError(null);
    setCurrentQuestionIndex(0);
    setCorrectAnswersCount(0);
    setPointsEarned(0);
    setAnswersList([]);

    const messages = [
      "จิตวิญญาณแห่งการศึกษา.. กำลังส่งลำแสงสร้างคำถาม",
      "ระบบ AI กำลังวิเคราะห์วิชานี้ เพื่อตั้งโจทย์ที่คุณคาดเดาไม่ได้ทั้งหมดในคราวเดียว...",
      "กำลังร่างชุดคำถามที่มีความท้าทายตามระดับความยากวิชาที่เลือก...",
      "เรียบเรียงตัวเลือก ข้อถูกและคำอธิบายโดยสมบูรณ์ระดับพรีเมียม..."
    ];
    setLoadingMessage(messages[Math.floor(Math.random() * messages.length)]);

    try {
      const response = await fetch(
  "https://q-a-academy.onrender.com/api/generate-questions-bulk",
        {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: selectedSubject.name,
          difficulty: difficulty,
          educationLevel: educationLevel,
          questionType: questionType,
          questionFormat: questionFormat,
          count: quizLength
        })
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || "ล้มเหลวในการเชื่อมต่อระบบข้อสอบกลุ่มของ AI");
      }

      const data = await response.json();
      if (!data.questions || !Array.isArray(data.questions) || data.questions.length === 0) {
        throw new Error("โครงสร้างข้อมูลวิชาเรียนของ AI บกพร่อง กรุณาลองใหม่อีกครั้ง");
      }

      setQuestions(data.questions);
      setAnswersList([]);
      setQuizState("QUESTION");
    } catch (err: any) {
      setApiError(err.message || "ไม่สามารถเชื่อมต่อระบบ AI ได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง");
      setQuizState("SETUP");
    }
  };

  const handleOptionSelect = (index: number) => {
    setSelectedOptionIndex(index);
  };

  const handleConfirmAnswerAndNext = async () => {
    if (selectedOptionIndex === null || !currentQuestion) return;

    const isCorrect = selectedOptionIndex === currentQuestion.answerIndex;
    const newAnswerObj = {
      question: currentQuestion.question,
      options: currentQuestion.options,
      answerIndex: currentQuestion.answerIndex,
      selectedOptionIndex: selectedOptionIndex,
      isCorrect: isCorrect,
      explanation: currentQuestion.explanation
    };

    const updatedAnswersList = [...answersList, newAnswerObj];
    setAnswersList(updatedAnswersList);

    const isLastQuestion = currentQuestionIndex + 1 >= questions.length;

    if (isLastQuestion) {
      setQuizState("LOADING");
      setLoadingMessage("กำลังตรวจสถิติคำตอบ และประมวลคะแนนผู้เรียนรู้...");

      const finalCorrectCount = updatedAnswersList.filter(a => a.isCorrect).length;
      setCorrectAnswersCount(finalCorrectCount);

      const diffMultiplier = difficulty === "Easy" ? 5 : difficulty === "Medium" ? 10 : 20;
      const finalPoints = updatedAnswersList.reduce((sum, item) => {
        return sum + (item.isCorrect ? diffMultiplier : 0);
      }, 0);
      setPointsEarned(finalPoints);

      await saveQuizSession(updatedAnswersList, finalCorrectCount, finalPoints);
      setQuizState("FINISHED");
    } else {
      setSelectedOptionIndex(null);
      setCurrentQuestionIndex(prev => prev + 1);
    }
  };

  // Persists statistics and session results to Firestore
  const saveQuizSession = async (finalAnswers: typeof answersList, finalCorrectCount: number, finalPoints: number) => {
    if (!selectedSubject) return;

    try {
      const sessionCorrect = finalCorrectCount;
      const sessionAttempted = finalAnswers.length;
      const sessionPoints = finalPoints;

      const subjectStat = progress.stats?.[selectedSubject.id] || { totalCorrect: 0, totalAttempted: 0 };
      const updatedStats = {
        ...progress.stats,
        [selectedSubject.id]: {
          totalAttempted: subjectStat.totalAttempted + sessionAttempted,
          totalCorrect: subjectStat.totalCorrect + sessionCorrect
        }
      };

      const todayStr = new Date().toISOString().split("T")[0];
      const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split("T")[0];
      let newStreak = progress.streakCount || 0;

      if (progress.lastActiveDate === yesterdayStr) {
        newStreak += 1;
      } else if (progress.lastActiveDate !== todayStr) {
        newStreak = 1; // restarted or newly joined streak
      }

      if (progress.uid.startsWith("offline_") || progress.uid.startsWith("local_")) {
        const storageKeyProg = progress.uid.startsWith("local_") ? `progress_${progress.uid}` : "local_progress";
        const storageKeyHist = progress.uid.startsWith("local_") ? `history_${progress.uid}` : "local_history";
        // 1. Save user progress locally
        const localProgressObj = {
          ...progress,
          totalScore: (progress.totalScore || 0) + sessionPoints,
          stats: updatedStats,
          streakCount: newStreak,
          lastActiveDate: todayStr
        };
        localStorage.setItem(storageKeyProg, JSON.stringify(localProgressObj));

        // 2. Clear out offline local history and update
        const localHistoryList = JSON.parse(localStorage.getItem(storageKeyHist) || "[]");
        const newHistoryItem = {
          id: "hist_" + Date.now(),
          uid: progress.uid,
          subjectId: selectedSubject.id,
          subjectName: selectedSubject.name,
          difficulty: difficulty,
          educationLevel: educationLevel,
          questionType: questionType,
          questionFormat: questionFormat,
          score: sessionCorrect,
          totalQuestions: sessionAttempted,
          timestamp: new Date().toISOString(),
          details: finalAnswers
        };
        localHistoryList.unshift(newHistoryItem);
        localStorage.setItem(storageKeyHist, JSON.stringify(localHistoryList));
        return;
      }

      // Calculate new totalScore & update streak
      const refUser = doc(db, "users", progress.uid);

      // 1. Save user object updates
      try {
        await updateDoc(refUser, {
          totalScore: (progress.totalScore || 0) + sessionPoints,
          stats: updatedStats,
          streakCount: newStreak,
          lastActiveDate: todayStr
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `users/${progress.uid}`);
        return;
      }

      // 2. Add history node
      try {
        await addDoc(collection(db, "history"), {
          uid: progress.uid,
          subjectId: selectedSubject.id,
          subjectName: selectedSubject.name,
          difficulty: difficulty,
          educationLevel: educationLevel,
          questionType: questionType,
          questionFormat: questionFormat,
          score: sessionCorrect,
          totalQuestions: sessionAttempted,
          timestamp: new Date().toISOString(),
          details: finalAnswers
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, "history");
        return;
      }
    } catch (error) {
      console.error("Error saving quiz session: ", error);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-2">
      
      {/* SECTION 1: SETUP DESIGN PANEL */}
      {quizState === "SETUP" && (
        <div className="space-y-6">
          <div className="text-center space-y-2 mt-4">
            <div className="inline-flex p-3 bg-violet-50 dark:bg-violet-950/20 text-violet-600 dark:text-violet-400 rounded-2xl border border-violet-100 dark:border-violet-800/80 mb-2">
              <Sparkles className="w-8 h-8 animate-pulse" />
            </div>
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">พื้นที่เรียนรู้และตอบคำถาม (AI Study Zone)</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-md mx-auto">
              เลือกวิชาที่คุณประสงค์จะทดสอบความรู้ AI อัจฉริยะจะสุ่มร่างบทเรียนคำถามใหม่ล่าสุดมาถามคุณเสมอเพื่อความท้าทายไร้ขีดจำกัด
            </p>
          </div>

          {apiError && (
            <div className="bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 text-red-600 dark:text-red-400 font-medium rounded-2xl p-4 text-xs flex gap-2 items-center">
              <AlertCircle size={18} className="shrink-0" />
              <span>{apiError}</span>
            </div>
          )}

          {/* Subject Selecting Slider */}
          <div className="space-y-3.5">
            <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-300">1. เลือกรายวิชาสัมฤทธิ์ผล (Choose Subject)</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              {SUBJECTS.map((subject) => {
                const isSelected = selectedSubject?.id === subject.id;
                return (
                  <div
                    key={subject.id}
                    onClick={() => setSelectedSubject(subject)}
                    className={`p-4 rounded-2xl border cursor-pointer flex gap-4 items-center transition-all duration-200 hover:shadow-md ${
                      isSelected
                        ? "border-violet-600 bg-violet-50/20 ring-1 ring-violet-600/30 dark:border-brand-indigo dark:bg-brand-card/40"
                        : "border-zinc-100/60 bg-white dark:bg-brand-card dark:border-brand-border"
                    }`}
                  >
                    <div className={`p-3 rounded-xl border shrink-0 ${subject.color}`}>
                      <LucideIcon name={subject.icon} size={22} />
                    </div>
                    <div className="min-w-0 pr-2">
                      <h4 className="font-bold text-sm text-zinc-800 dark:text-zinc-200">{subject.name}</h4>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 line-clamp-1 leading-snug">{subject.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Level, Format, and Type configurations */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-300">2. ตั้งค่ารูปแบบคำถามและการศึกษา (Specialization & Format)</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Level select */}
              <div className="bg-white dark:bg-brand-card p-4 rounded-2xl border border-zinc-150 dark:border-brand-border space-y-3">
                <div className="flex items-center justify-between">
                  <span className="block text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">ระดับชั้นเรียน</span>
                  <span className="text-[10px] bg-violet-100 text-violet-700 px-2.5 py-0.5 rounded-full font-black dark:bg-brand-indigo/30 dark:text-zinc-200">
                    เจาะลึกทุกชั้นปี
                  </span>
                </div>
                
                <div className="space-y-3.5 max-h-[380px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-zinc-250">
                  {/* ประถมศึกษา */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 block uppercase">🎒 ประถมศึกษา</span>
                    <div className="grid grid-cols-3 gap-1">
                      {[
                        { id: "p1", label: "ป.1" },
                        { id: "p2", label: "ป.2" },
                        { id: "p3", label: "ป.3" },
                        { id: "p4", label: "ป.4" },
                        { id: "p5", label: "ป.5" },
                        { id: "p6", label: "ป.6" },
                      ].map((lvl) => {
                        const isSel = educationLevel === lvl.id;
                        return (
                          <button
                            key={lvl.id}
                            type="button"
                            onClick={() => setEducationLevel(lvl.id as any)}
                            className={`text-center py-1.5 text-xs font-extrabold rounded-lg border transition-all duration-150 ${
                              isSel
                                ? "bg-violet-100 border-violet-500 text-violet-700 dark:bg-brand-indigo/25 dark:border-brand-indigo dark:text-zinc-150"
                                : "bg-zinc-50/50 hover:bg-zinc-100/80 border-zinc-150/80 dark:bg-brand-bg/40 dark:border-brand-border/60 dark:hover:bg-brand-bg/80 text-zinc-650 dark:text-zinc-400"
                            }`}
                          >
                            {lvl.label}
                          </button>
                        );
                      })}
                    </div>
                    <button
                      type="button"
                      onClick={() => setEducationLevel("primary")}
                      className={`w-full text-center py-1.5 text-[10px] font-black rounded-lg border transition-all duration-150 ${
                        educationLevel === "primary"
                          ? "bg-violet-100 border-violet-500 text-violet-700 dark:bg-brand-indigo/25 dark:border-brand-indigo dark:text-zinc-150"
                          : "bg-zinc-50/50 hover:bg-zinc-100/80 border-zinc-150/80 dark:bg-brand-bg/40 dark:border-brand-border/60 dark:hover:bg-brand-bg/80 text-zinc-500 dark:text-zinc-400/80"
                      }`}
                    >
                      รวมระดับประถมศึกษา (ป.1 - ป.6)
                    </button>
                  </div>

                  {/* มัธยมศึกษาตอนต้น */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 block uppercase">📚 มัธยมศึกษาตอนต้น</span>
                    <div className="grid grid-cols-3 gap-1">
                      {[
                        { id: "m1", label: "ม.1" },
                        { id: "m2", label: "ม.2" },
                        { id: "m3", label: "ม.3" },
                      ].map((lvl) => {
                        const isSel = educationLevel === lvl.id;
                        return (
                          <button
                            key={lvl.id}
                            type="button"
                            onClick={() => setEducationLevel(lvl.id as any)}
                            className={`text-center py-1.5 text-xs font-extrabold rounded-lg border transition-all duration-150 ${
                              isSel
                                ? "bg-violet-100 border-violet-500 text-violet-700 dark:bg-brand-indigo/25 dark:border-brand-indigo dark:text-zinc-150"
                                : "bg-zinc-50/50 hover:bg-zinc-100/80 border-zinc-150/80 dark:bg-brand-bg/40 dark:border-brand-border/60 dark:hover:bg-brand-bg/80 text-zinc-650 dark:text-zinc-400"
                            }`}
                          >
                            {lvl.label}
                          </button>
                        );
                      })}
                    </div>
                    <button
                      type="button"
                      onClick={() => setEducationLevel("junior_high")}
                      className={`w-full text-center py-1.5 text-[10px] font-black rounded-lg border transition-all duration-150 ${
                        educationLevel === "junior_high"
                          ? "bg-violet-100 border-violet-500 text-violet-700 dark:bg-brand-indigo/25 dark:border-brand-indigo dark:text-zinc-150"
                          : "bg-zinc-50/50 hover:bg-zinc-100/80 border-zinc-150/80 dark:bg-brand-bg/40 dark:border-brand-border/60 dark:hover:bg-brand-bg/80 text-zinc-500 dark:text-zinc-400/80"
                      }`}
                    >
                      รวมระดับ ม.ต้น (ม.1 - ม.3)
                    </button>
                  </div>

                  {/* มัธยมศึกษาตอนปลาย */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 block uppercase">🎓 มัธยมศึกษาตอนปลาย</span>
                    <div className="grid grid-cols-3 gap-1">
                      {[
                        { id: "m4", label: "ม.4" },
                        { id: "m5", label: "ม.5" },
                        { id: "m6", label: "ม.6" },
                      ].map((lvl) => {
                        const isSel = educationLevel === lvl.id;
                        return (
                          <button
                            key={lvl.id}
                            type="button"
                            onClick={() => setEducationLevel(lvl.id as any)}
                            className={`text-center py-1.5 text-xs font-extrabold rounded-lg border transition-all duration-150 ${
                              isSel
                                ? "bg-violet-100 border-violet-500 text-violet-700 dark:bg-brand-indigo/25 dark:border-brand-indigo dark:text-zinc-150"
                                : "bg-zinc-50/50 hover:bg-zinc-100/80 border-zinc-150/80 dark:bg-brand-bg/40 dark:border-brand-border/60 dark:hover:bg-brand-bg/80 text-zinc-650 dark:text-zinc-400"
                            }`}
                          >
                            {lvl.label}
                          </button>
                        );
                      })}
                    </div>
                    <button
                      type="button"
                      onClick={() => setEducationLevel("senior_high")}
                      className={`w-full text-center py-1.5 text-[10px] font-black rounded-lg border transition-all duration-150 ${
                        educationLevel === "senior_high"
                          ? "bg-violet-100 border-violet-500 text-violet-700 dark:bg-brand-indigo/25 dark:border-brand-indigo dark:text-zinc-150"
                          : "bg-zinc-50/50 hover:bg-zinc-100/80 border-zinc-150/80 dark:bg-brand-bg/40 dark:border-brand-border/60 dark:hover:bg-brand-bg/80 text-zinc-500 dark:text-zinc-400/80"
                      }`}
                    >
                      รวมระดับ ม.ปลาย (ม.4 - ม.6)
                    </button>
                  </div>

                  {/* อุดมศึกษา */}
                  <div className="space-y-1.5 font-sans pt-1">
                    <span className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 block uppercase">🏛️ ระดับอุดมศึกษา / อื่นๆ</span>
                    <button
                      type="button"
                      onClick={() => setEducationLevel("university")}
                      className={`w-full text-left px-3 py-2 text-xs font-black rounded-lg border transition-all duration-150 ${
                        educationLevel === "university"
                          ? "bg-violet-100 border-violet-500 text-violet-700 dark:bg-brand-indigo/25 dark:border-brand-indigo dark:text-zinc-150"
                          : "bg-zinc-50/50 hover:bg-zinc-100/80 border-zinc-150/80 dark:bg-brand-bg/40 dark:border-brand-border/60 dark:hover:bg-brand-bg/80 text-zinc-600 dark:text-zinc-400"
                      }`}
                    >
                      🏛️ มหาวิทยาลัย / บุคคลทั่วไป
                    </button>
                  </div>
                </div>
              </div>

              {/* Type select */}
              <div className="bg-white dark:bg-brand-card p-4 rounded-2xl border border-zinc-150 dark:border-brand-border space-y-2.5">
                <span className="block text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">ประเภทข้อชี้แนะ/ความรู้</span>
                <div className="flex flex-col gap-1.5">
                  {[
                    { id: "review", label: "📝 คำถามทบทวนเนื้อหา" },
                    { id: "comprehension", label: "🔍 คำถามวัดความเข้าใจ" },
                    { id: "past_exams", label: "🏛️ คำถามจากข้อสอบเก่า" }
                  ].map((t) => {
                    const isSel = questionType === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setQuestionType(t.id as any)}
                        className={`text-left px-3 py-2 text-xs font-bold rounded-xl border transition-all duration-150 ${
                          isSel
                            ? "bg-violet-50 border-violet-500 text-violet-700 dark:bg-brand-indigo/15 dark:border-brand-indigo dark:text-zinc-150"
                            : "bg-zinc-50/50 hover:bg-zinc-50 border-zinc-150 dark:bg-brand-bg/40 dark:border-brand-border/60 dark:hover:bg-brand-bg/80 text-zinc-600 dark:text-zinc-400"
                        }`}
                      >
                        {t.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Format select */}
              <div className="bg-white dark:bg-brand-card p-4 rounded-2xl border border-zinc-150 dark:border-brand-border space-y-2.5">
                <span className="block text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">รูปแบบคำถามของ AI</span>
                <div className="flex flex-col gap-1.5">
                  {[
                    { id: "multiple_choice", label: "🔸 ปรนัย 4 ตัวเลือก" },
                    { id: "true_false", label: "⚖️ คำถามถูก / ผิด" },
                    { id: "fill_in_blank", label: "✍️ เติมคำในช่องว่าง" }
                  ].map((fmt) => {
                    const isSel = questionFormat === fmt.id;
                    return (
                      <button
                        key={fmt.id}
                        type="button"
                        onClick={() => setQuestionFormat(fmt.id as any)}
                        className={`text-left px-3 py-2 text-xs font-bold rounded-xl border transition-all duration-150 ${
                          isSel
                            ? "bg-violet-50 border-violet-500 text-violet-700 dark:bg-brand-indigo/15 dark:border-brand-indigo dark:text-zinc-150"
                            : "bg-zinc-50/50 hover:bg-zinc-50 border-zinc-150 dark:bg-brand-bg/40 dark:border-brand-border/60 dark:hover:bg-brand-bg/80 text-zinc-600 dark:text-zinc-400"
                        }`}
                      >
                        {fmt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full">
            {/* Difficulty selectors */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-300">3. เลือกระดับความยาก (Difficulty)</h3>
              <div className="flex gap-2">
                {(["Easy", "Medium", "Hard"] as const).map((level) => {
                  const label = level === "Easy" ? "ง่าย (5 xp)" : level === "Medium" ? "ปานกลาง (10 xp)" : "ท้าทาย (20 xp)";
                  const isSelected = difficulty === level;
                  return (
                    <button
                      key={level}
                      onClick={() => setDifficulty(level)}
                      className={`flex-1 py-3 text-xs font-bold rounded-xl border transition-all duration-150 ${
                        isSelected
                          ? "bg-violet-605 hover:bg-violet-700 text-white border-violet-600 dark:bg-brand-indigo dark:border-brand-indigo hover:dark:bg-brand-indigo-hover dark:text-white"
                          : "bg-white dark:bg-brand-card border-zinc-200 dark:border-brand-border text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-brand-bg/50"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quiz count selection */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-300">4. จำนวนข้อปัญหา (Quiz Volume)</h3>
              <div className="flex gap-2">
                {([5, 10, 15] as const).map((count) => {
                  const isSelected = quizLength === count;
                  return (
                    <button
                      key={count}
                      onClick={() => setQuizLength(count)}
                      className={`flex-1 py-3 text-xs font-bold rounded-xl border transition-all duration-150 ${
                        isSelected
                          ? "bg-violet-605 hover:bg-violet-700 text-white border-violet-600 dark:bg-brand-indigo dark:border-brand-indigo hover:dark:bg-brand-indigo-hover dark:text-white"
                          : "bg-white dark:bg-brand-card border-zinc-200 dark:border-brand-border text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-brand-bg/50"
                      }`}
                    >
                      {count} ข้อ
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <button
            onClick={startQuiz}
            disabled={!selectedSubject}
            className={`w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-sm font-bold transition-all duration-200 shadow-lg ${
              selectedSubject
                ? "bg-gradient-to-r from-violet-600 to-indigo-700 hover:from-violet-700 hover:to-indigo-800 text-white shadow-violet-600/10 cursor-pointer"
                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 border border-zinc-200 dark:border-zinc-700 cursor-not-allowed"
            }`}
          >
            <Play size={16} className="fill-current" />
            สร้างคำถามด้วย AI และเริ่มต้นทันที
          </button>
        </div>
      )}

      {/* SECTION 2: AI GENERATING LOADER */}
      {quizState === "LOADING" && (
        <div className="flex flex-col items-center justify-center py-24 text-center space-y-6">
          <div className="relative">
            <div className="w-16 h-16 rounded-full border-4 border-violet-100 dark:border-violet-950 border-t-violet-600 dark:border-t-violet-400 animate-spin"></div>
            <Sparkles className="w-6 h-6 text-amber-400 fill-amber-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
          </div>
          <div className="space-y-2 max-w-sm">
            <h3 className="font-bold text-zinc-800 dark:text-zinc-200 text-base">กำลังสร้างคำถามใหม่ด้วยระบบ AI...</h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 italic leading-relaxed">{loadingMessage}</p>
          </div>
        </div>
      )}

      {/* SECTION 3: INTERACTIVE QUESTION SCREEN */}
      {quizState === "QUESTION" && currentQuestion && (
        <div className="space-y-6">
          
          {/* Progress and indicators bar */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2.5 text-xs text-zinc-500 dark:text-zinc-400 font-bold bg-zinc-50/50 dark:bg-brand-bg/30 p-3.5 rounded-2xl border border-zinc-150 dark:border-brand-border">
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex items-center gap-1.5 shrink-0">
                  <span className={`inline-block w-2.5 h-2.5 rounded-full ${selectedSubject?.color.split(" ")[0] || "bg-violet-500"}`}></span>
                  <span className="text-zinc-800 dark:text-zinc-200">{selectedSubject?.name}</span>
                </span>
                <span className="text-zinc-300 dark:text-zinc-700 hidden sm:inline">|</span>
                <span className="bg-violet-50 dark:bg-violet-950/40 border border-violet-100 dark:border-violet-900/40 text-violet-700 dark:text-violet-400 px-2 py-0.5 rounded-lg text-[10px]">
                  {EDUCATION_LEVELS_MAP[educationLevel] || educationLevel}
                </span>
                <span className="bg-sky-50 dark:bg-sky-950/40 border border-sky-100 dark:border-sky-900/40 text-sky-600 dark:text-sky-400 px-2 py-0.5 rounded-lg text-[10px]">
                  {questionType === "review" ? "📝 ทบทวน" : questionType === "comprehension" ? "🔍 วัดความเข้าใจ" : "🏛️ ข้อสอบเก่า"}
                </span>
                <span className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/40 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-lg text-[10px]">
                  {questionFormat === "multiple_choice" ? "🔸 ปรนัย" : questionFormat === "true_false" ? "⚖️ ถูก/ผิด" : "✍️ เติมคำในช่องว่าง"}
                </span>
                <span className="bg-amber-50 dark:bg-amber-950/40 border border-amber-100 dark:border-amber-900/40 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-lg text-[10px]">
                  {difficulty === "Easy" ? "ง่าย" : difficulty === "Medium" ? "ปานกลาง" : "ท้าทาย"}
                </span>
              </div>
              <span className="shrink-0 text-zinc-550 dark:text-zinc-400 text-[11px] font-mono sm:ml-auto">ข้อที่ {currentQuestionIndex + 1} จาก {questions.length}</span>
            </div>
            {/* Top progress indicator track */}
            <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-2 rounded-full overflow-hidden">
              <div 
                className="bg-violet-600 dark:bg-violet-400 h-full rounded-full transition-all duration-300"
                style={{ width: `${((currentQuestionIndex) / questions.length) * 100}%` }}
              ></div>
            </div>
          </div>

          {/* Main Core Question Card */}
          <div className="bg-white dark:bg-brand-card border border-zinc-100 dark:border-brand-border p-5 sm:p-7 rounded-3xl shadow-sm text-zinc-900 dark:text-zinc-100 space-y-6">
            
            {/* Header: Question label */}
            <div className="flex gap-3 align-top">
              <HelpCircle className="w-6 h-6 text-violet-500 shrink-0 mt-0.5" />
              <h3 className="text-base sm:text-lg font-bold leading-relaxed">{currentQuestion.question}</h3>
            </div>

            {/* Options lists */}
            <div className="space-y-3">
              {currentQuestion.options.map((option, idx) => {
                const isSelected = selectedOptionIndex === idx;

                let optionStyle = "border-zinc-100 bg-zinc-50/50 hover:bg-zinc-50 hover:border-zinc-200 text-zinc-700 dark:bg-brand-bg dark:border-brand-border/80 dark:text-zinc-200 dark:hover:bg-brand-border/40";

                if (isSelected) {
                  optionStyle = "border-violet-600 bg-violet-50 text-violet-700 ring-2 ring-violet-600/10 dark:border-brand-indigo dark:bg-brand-indigo/20 dark:text-zinc-100";
                }

                return (
                  <div
                    key={idx}
                    onClick={() => handleOptionSelect(idx)}
                    className={`p-4 rounded-2xl border text-sm flex items-center justify-between gap-3 transition-all duration-150 relative cursor-pointer ${optionStyle}`}
                  >
                    <div className="flex gap-3 items-center min-w-0 pr-2">
                      <span className={`w-6 h-6 rounded-lg text-xs font-bold flex items-center justify-center shrink-0 border ${
                        isSelected
                          ? "bg-violet-100 text-violet-700 border-violet-400 dark:bg-brand-indigo dark:text-white"
                          : "bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-500"
                      }`}>
                        {String.fromCharCode(65 + idx)}
                      </span>
                      <span className="leading-snug text-xs sm:text-sm font-medium">{option}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Primary screen controls (Confirm and Next) */}
          <div className="flex justify-end gap-3.5">
            <button
              onClick={handleConfirmAnswerAndNext}
              disabled={selectedOptionIndex === null}
              className={`py-3 px-8 rounded-xl text-xs sm:text-sm font-bold transition-all duration-150 flex items-center gap-2 ${
                selectedOptionIndex !== null
                  ? "bg-violet-600 hover:bg-violet-700 text-white cursor-pointer"
                  : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed"
              }`}
            >
              {currentQuestionIndex + 1 >= questions.length ? "ตรวจชุดคำตอบทั้งหมด" : "ข้อถัดไป"}
              <ArrowRight size={15} />
            </button>
          </div>
        </div>
      )}

      {/* SECTION 4: LESSON SCORE SUMMARY & DETAILED REVIEWS */}
      {quizState === "FINISHED" && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-brand-card border border-zinc-100 dark:border-brand-border rounded-3xl p-6 sm:p-10 text-center space-y-7 shadow-lg mt-4">
            <div className="max-w-xs mx-auto space-y-4">
              <div className="inline-flex p-4 bg-amber-100 dark:bg-amber-950/20 text-amber-500 rounded-3xl border border-amber-200 dark:border-amber-800/80">
                <Trophy className="w-12 h-12 filter drop-shadow animate-pulse" />
              </div>
              <div className="space-y-1">
                <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">เสร็จสิ้นบทเรียนอัจฉริยะ!</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed max-w-sm mx-auto">
                  คุณตอบโจทย์วิชา <span className="font-semibold text-violet-600 dark:text-violet-400">{selectedSubject?.name}</span> สำหรับชั้นปี <span className="font-mono">({EDUCATION_LEVELS_MAP[educationLevel] || educationLevel})</span> แบบ <span className="font-semibold text-zinc-700 dark:text-zinc-300">{questionType === "review" ? "ทบทวนความรู้" : questionType === "comprehension" ? "วัดความเข้าใจ" : "แนวข้อสอบเก่า"}</span> ระดับ <span className="text-amber-500 font-semibold">{difficulty === "Easy" ? "ง่าย" : difficulty === "Medium" ? "ปานกลาง" : "ท้าทาย"}</span> เรียบร้อยแล้ว!
                </p>
                
                {/* User Name Badge representing the registration/login identity */}
                <div className="pt-2">
                  <div className="inline-flex items-center gap-1.5 bg-violet-50 dark:bg-violet-950/30 border border-violet-100 dark:border-violet-900/50 rounded-full px-3.5 py-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    ผู้เรียน: <span className="font-extrabold text-violet-700 dark:text-violet-400">{progress?.displayName || localStorage.getItem("currentUser") || "ผู้เรียนรู้"}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Results Score Metrics Grid */}
            <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto">
              <div className="p-4 bg-zinc-50 dark:bg-brand-bg rounded-2xl border border-zinc-100/50 dark:border-brand-border flex flex-col justify-center items-center">
                <span className="block text-xs font-semibold text-zinc-400">ระดับคะแนนสำเร็จ</span>
                <span className="text-2xl font-extrabold text-zinc-800 dark:text-zinc-200 mt-1">
                  {correctAnswersCount} / {quizLength} <span className="text-xs text-zinc-400 font-normal">ข้อ</span>
                </span>
              </div>
              <div className="p-4 bg-zinc-50 dark:bg-brand-bg rounded-2xl border border-zinc-100/50 dark:border-brand-border flex flex-col justify-center items-center">
                <span className="block text-xs font-semibold text-zinc-400">คะแนนพลังเรียนรู้</span>
                <span className="text-2xl font-extrabold text-violet-650 dark:text-brand-indigo mt-1 flex items-center gap-1">
                  <Award className="w-5 h-5 shrink-0" />
                  +{pointsEarned} XP
                </span>
              </div>
            </div>

            {/* Detail review of errors */}
            <div className="text-left space-y-4 max-w-2xl mx-auto pt-6 border-t border-zinc-100 dark:border-brand-border mt-6">
              <h4 className="text-sm font-extrabold text-zinc-800 dark:text-zinc-200 uppercase tracking-wide flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500 animate-pulse" />
                เฉลยละเอียดและวิเคราะห์ข้อสอบ (AI Review & Explanation Board)
              </h4>
              <div className="space-y-4">
                {answersList.map((item, qIdx) => {
                  return (
                    <div key={qIdx} className={`p-5 rounded-2xl border transition-all duration-150 ${
                      item.isCorrect 
                        ? "border-emerald-100 bg-emerald-50/10 dark:border-emerald-950/40 dark:bg-emerald-950/5" 
                        : "border-rose-100 bg-rose-50/10 dark:border-rose-950/40 dark:bg-rose-950/5"
                    }`}>
                      <div className="flex gap-2.5 items-start">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase shrink-0 mt-0.5 ${
                          item.isCorrect 
                            ? "bg-emerald-105 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800" 
                            : "bg-rose-105 dark:bg-rose-950 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800"
                        }`}>
                          {item.isCorrect ? "✓ ถูกต้อง" : "✗ ผิดพลาด"}
                        </span>
                        <h5 className="font-bold text-xs sm:text-sm text-zinc-800 dark:text-zinc-200 leading-relaxed">
                          ข้อที่ {qIdx + 1}: {item.question}
                        </h5>
                      </div>

                      <div className="mt-3.5 space-y-2">
                        {item.options.map((option, oIdx) => {
                          const isSelectedByMe = item.selectedOptionIndex === oIdx;
                          const isTheCorrectOne = item.answerIndex === oIdx;

                          let badgeStyle = "border-transparent bg-zinc-50 dark:bg-zinc-900/40 text-zinc-550 dark:text-zinc-400";
                          let statusIcon = null;

                          if (isTheCorrectOne) {
                            badgeStyle = "border-emerald-200 bg-emerald-100/45 dark:border-emerald-900/65 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-400 font-semibold";
                            statusIcon = <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />;
                          } else if (isSelectedByMe && !isTheCorrectOne) {
                            badgeStyle = "border-rose-200 bg-rose-100/45 dark:border-rose-900/65 dark:bg-rose-950/40 text-rose-800 dark:text-rose-400";
                            statusIcon = <X className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />;
                          }

                          return (
                            <div 
                              key={oIdx} 
                              className={`px-3 py-2 rounded-xl text-xs flex justify-between items-center gap-2 border ${badgeStyle}`}
                            >
                              <span className="flex items-center gap-2 min-w-0">
                                <span className="font-bold opacity-60 text-[10px]">{String.fromCharCode(65 + oIdx)}.</span>
                                <span className="truncate">{option}</span>
                              </span>
                              <div className="flex items-center gap-1.5">
                                {isSelectedByMe && (
                                  <span className="text-[9px] opacity-70">คำตอบของคุณ</span>
                                )}
                                {statusIcon}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <div className="mt-4 p-3 bg-violet-50/40 dark:bg-violet-950/10 border border-violet-100/40 dark:border-violet-900/20 rounded-xl space-y-1">
                        <span className="block text-[10px] font-bold text-violet-700 dark:text-violet-400 uppercase tracking-wide">
                          💡 อรรถาธิบายเฉลยวิเคราะห์ (AI Review)
                        </span>
                        <p className="text-xs text-zinc-650 dark:text-zinc-300 leading-relaxed font-sans">
                          {item.explanation}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="space-y-3.5 max-w-sm mx-auto pt-4">
              <button
                onClick={() => setQuizState("SETUP")}
                className="w-full py-3 bg-violet-600 hover:bg-violet-700 text-white dark:bg-brand-indigo dark:hover:bg-brand-indigo-hover rounded-xl text-xs sm:text-sm font-bold transition-all duration-150 flex items-center justify-center gap-2 shadow-md cursor-pointer"
              >
                <RefreshCw size={14} />
                เริ่มทดสอบวิชาอื่นเพิ่มเติม
              </button>
              <button
                onClick={onQuizFinished}
                className="w-full py-3 bg-zinc-100 hover:bg-zinc-250 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-200 text-zinc-700 rounded-xl text-xs sm:text-sm font-bold transition-all duration-150 cursor-pointer"
              >
                เปิดกระดานสถิติและความก้าวหน้า
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
