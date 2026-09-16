import React, { useState } from "react";
import { UserProgress, HistoryItem } from "../types";
import { SUBJECTS } from "../data/subjects";
import LucideIcon from "./LucideIcon";
import { 
  Flame, Award, Target, CheckCircle, 
  XCircle, ChevronDown, ChevronUp, Calendar, Trash2,
  Edit3, Check, X
} from "lucide-react";
import { doc, updateDoc, writeBatch, collection, getDocs, query, where } from "firebase/firestore";
import { db, handleFirestoreError } from "../lib/firebase";

const EDUCATION_LABELS: Record<string, string> = {
  p1: "ป.1",
  p2: "ป.2",
  p3: "ป.3",
  p4: "ป.4",
  p5: "ป.5",
  p6: "ป.6",
  primary: "ประถม",
  m1: "ม.1",
  m2: "ม.2",
  m3: "ม.3",
  junior_high: "ม.ต้น",
  m4: "ม.4",
  m5: "ม.5",
  m6: "ม.6",
  senior_high: "ม.ปลาย",
  university: "มหาวิทยาลัย/ทั่วไป"
};

interface StatDashboardProps {
  progress: UserProgress;
  history: HistoryItem[];
  onRefreshStats: () => void;
  onUpdateDisplayName?: (newName: string) => void;
}

export default function StatDashboard({ progress, history, onRefreshStats, onUpdateDisplayName }: StatDashboardProps) {
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(progress.displayName || "");

  const handleSaveName = async () => {
    const trimmed = nameInput.trim();
    if (!trimmed) return;
    
    // Save to local storage keys
    localStorage.setItem("currentUser", trimmed);
    localStorage.setItem("offline_display_name", trimmed);
    
    if (progress.uid.startsWith("offline_") || progress.uid.startsWith("local_")) {
      const storageKeyProg = progress.uid.startsWith("local_") ? `progress_${progress.uid}` : "local_progress";
      const raw = localStorage.getItem(storageKeyProg);
      if (raw) {
        const obj = JSON.parse(raw);
        obj.displayName = trimmed;
        obj.email = `${trimmed}@local.com`;
        localStorage.setItem(storageKeyProg, JSON.stringify(obj));
      }
    } else {
      try {
        const userRef = doc(db, "users", progress.uid);
        await updateDoc(userRef, { displayName: trimmed });
      } catch (err) {
        console.error("Failed to update firestore name: ", err);
      }
    }

    if (onUpdateDisplayName) {
      onUpdateDisplayName(trimmed);
    }
    setIsEditingName(false);
    onRefreshStats();
  };

  // Overall calculations
  const totalCorrect = Object.values(progress.stats || {}).reduce((sum, item) => sum + (item.totalCorrect || 0), 0);
  const totalAttempted = Object.values(progress.stats || {}).reduce((sum, item) => sum + (item.totalAttempted || 0), 0);
  const accuracy = totalAttempted > 0 ? Math.round((totalCorrect / totalAttempted) * 100) : 0;

  // Render subject competency
  const renderSubjectCompetency = () => {
    return SUBJECTS.map((subject) => {
      const stat = progress.stats?.[subject.id] || { totalCorrect: 0, totalAttempted: 0 };
      const subAccuracy = stat.totalAttempted > 0 ? Math.round((stat.totalCorrect / stat.totalAttempted) * 100) : 0;
      
      return (
        <div 
          key={subject.id} 
          className="p-5 bg-white dark:bg-brand-card rounded-2xl border border-zinc-100 dark:border-brand-border shadow-sm flex flex-col justify-between"
        >
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl border ${subject.color}`}>
              <LucideIcon name={subject.icon} size={20} />
            </div>
            <div className="min-w-0">
              <h4 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 truncate">{subject.name}</h4>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">ตอบแล้ว {stat.totalAttempted} ข้อ</p>
            </div>
          </div>

          <div className="mt-4">
            <div className="flex justify-between items-center text-xs text-zinc-500 dark:text-zinc-400 mb-1.5 font-medium">
              <span>ความแม่นยำ</span>
              <span className="font-semibold text-zinc-800 dark:text-zinc-200">{subAccuracy}%</span>
            </div>
            
            {/* Custom progress track */}
            <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-2.5 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${
                  subAccuracy >= 80 
                    ? "bg-emerald-500" 
                    : subAccuracy >= 50 
                      ? "bg-amber-500" 
                      : stat.totalAttempted === 0 
                        ? "bg-zinc-200 dark:bg-zinc-700" 
                        : "bg-rose-500"
                }`}
                style={{ width: `${stat.totalAttempted > 0 ? subAccuracy : 0}%` }}
              ></div>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs font-semibold mt-3 pt-3 border-t border-zinc-50 dark:border-zinc-800/50">
            <span className="text-zinc-400">ถูก/ทั้งหมด</span>
            <span className="text-zinc-800 dark:text-zinc-200">{stat.totalCorrect} / {stat.totalAttempted}</span>
          </div>
        </div>
      );
    });
  };

  const toggleHistoryItem = (id: string) => {
    if (expandedHistoryId === id) {
      setExpandedHistoryId(null);
    } else {
      setExpandedHistoryId(id);
    }
  };

  // Format date helper
  const formatDate = (isoStr: string) => {
    if (!isoStr) return "";
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString("th-TH", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch {
      return isoStr;
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto px-4">
      {/* Personalized Welcome Header showing the registered username */}
      <div className="bg-gradient-to-r from-violet-600 to-indigo-650 dark:from-brand-indigo/90 dark:to-violet-950 p-6 sm:p-8 rounded-3xl text-white shadow-md border border-violet-500/15 relative overflow-hidden">
        <div className="absolute right-0 bottom-0 translate-y-6 translate-x-6 opacity-10 pointer-events-none select-none">
          <Award size={200} className="stroke-[1.5]" />
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center text-3xl font-black border border-white/20 shadow-inner select-none shrink-0 text-white">
              {progress.displayName ? progress.displayName.charAt(0).toUpperCase() : "👤"}
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-[10px] font-black uppercase tracking-wider">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                  ผู้ใช้ลงทะเบียนสำเร็จ
                </span>
                {!isEditingName && (
                  <button
                    onClick={() => {
                      setNameInput(progress.displayName || "");
                      setIsEditingName(true);
                    }}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/10 hover:bg-white/20 text-white/80 hover:text-white text-[10px] font-medium transition-colors cursor-pointer"
                    title="แก้ไขชื่อผู้ใช้"
                  >
                    <Edit3 size={10} />
                    <span>แก้ไขชื่อ</span>
                  </button>
                )}
              </div>

              {isEditingName ? (
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="text"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    placeholder="กรอกชื่อผู้ใช้ของคุณ"
                    className="px-3 py-1 text-sm bg-white/20 border border-white/30 rounded-lg text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-amber-300 font-bold"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveName();
                      if (e.key === "Escape") setIsEditingName(false);
                    }}
                  />
                  <button
                    onClick={handleSaveName}
                    className="p-1.5 bg-emerald-500 hover:bg-emerald-600 rounded-lg text-white transition-colors cursor-pointer shadow-sm"
                    title="บันทึกชื่อ"
                  >
                    <Check size={14} />
                  </button>
                  <button
                    onClick={() => setIsEditingName(false)}
                    className="p-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-colors cursor-pointer"
                    title="ยกเลิก"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <h2 className="text-xl sm:text-2xl font-black tracking-tight">
                  สวัสดี, <span className="text-amber-300">{progress.displayName || "ผู้เรียนรู้คนสำคัญ"}</span> 👋
                </h2>
              )}

              <p className="text-xs text-violet-100 mt-0.5 opacity-90">
                บัญชีผู้ใช้: <strong className="font-semibold text-white">{progress.displayName || "ทั่วไป"}</strong> | เริ่มเรียนรู้เมื่อ {formatDate(progress.createdAt)}
              </p>
            </div>
          </div>
          <div className="shrink-0 bg-white/10 dark:bg-black/20 backdrop-blur-md px-4 py-3 rounded-2xl border border-white/10 text-center sm:text-right">
            <span className="block text-[10px] text-violet-200 font-extrabold uppercase tracking-wide">คะแนนโดยรวมในระบบ</span>
            <span className="text-xl sm:text-2xl font-black text-amber-350">{progress.totalScore || 0} <span className="text-xs font-semibold">XP</span></span>
          </div>
        </div>
      </div>

      {/* 4 Multi-Metric Key Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Total score */}
        <div className="bg-white dark:bg-brand-card p-5 rounded-2xl shadow-sm border border-zinc-100 dark:border-brand-border flex items-center gap-4">
          <div className="p-3 bg-violet-50 dark:bg-zinc-950/40 text-violet-600 dark:text-violet-400 rounded-xl">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <span className="block text-xs font-semibold uppercase tracking-wider text-zinc-400">คะแนนสะสม</span>
            <span className="text-2xl font-bold dark:text-white">{progress.totalScore || 0} xp</span>
          </div>
        </div>

        {/* Metric 2: Streak counter */}
        <div className="bg-white dark:bg-brand-card p-5 rounded-2xl shadow-sm border border-zinc-100 dark:border-brand-border flex items-center gap-4">
          <div className={`p-3 rounded-xl ${
            progress.streakCount > 0 
              ? "bg-amber-500/10 text-amber-500" 
              : "bg-zinc-100 dark:bg-zinc-950/25 text-zinc-400"
          }`}>
            <Flame className="w-6 h-6 fill-current" />
          </div>
          <div>
            <span className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 font-sans">ความต่อเนื่อง</span>
            <span className="text-2xl font-bold dark:text-white">{progress.streakCount || 0} วัน</span>
          </div>
        </div>

        {/* Metric 3: Attempted counter */}
        <div className="bg-white dark:bg-brand-card p-5 rounded-2xl shadow-sm border border-zinc-100 dark:border-brand-border flex items-center gap-4">
          <div className="p-3 bg-sky-50 dark:bg-zinc-950/40 text-sky-600 dark:text-sky-400 rounded-xl">
            <Target className="w-6 h-6" />
          </div>
          <div>
            <span className="block text-xs font-semibold uppercase tracking-wider text-zinc-400">ตอบไปแล้ว</span>
            <span className="text-2xl font-bold dark:text-white">{totalAttempted} ข้อ</span>
          </div>
        </div>

        {/* Metric 4: Accuracy ratio */}
        <div className="bg-white dark:bg-brand-card p-5 rounded-2xl shadow-sm border border-zinc-100 dark:border-brand-border flex items-center gap-4">
          <div className="p-3 bg-emerald-50 dark:bg-zinc-950/40 text-emerald-600 dark:text-emerald-400 rounded-xl">
            <CheckCircle className="w-6 h-6" />
          </div>
          <div>
            <span className="block text-xs font-semibold uppercase tracking-wider text-zinc-400">ความแม่นยำ</span>
            <span className="text-2xl font-bold dark:text-white">{accuracy}%</span>
          </div>
        </div>
      </div>

      {/* Competency breakdown per subject - Bento Grid Style */}
      <div>
        <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-4">ทักษะของฉันตามความเชี่ยวชาญ (Subject Mastery)</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {renderSubjectCompetency()}
        </div>
      </div>

      {/* Detailed session quiz logs/history */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">ประวัติการทำแบบทดสอบแบบละเอียด (Session Logs)</h3>
          <span className="text-xs font-semibold text-zinc-400">ล่าสุด 10 ชุดล่าสุด</span>
        </div>

        {history.length === 0 ? (
          <div className="bg-zinc-50 dark:bg-brand-card rounded-3xl p-10 text-center border border-dashed border-zinc-200 dark:border-brand-border">
            <div className="mx-auto w-12 h-12 rounded-full bg-zinc-100 dark:bg-brand-bg flex items-center justify-center text-zinc-400 mb-3 border dark:border-brand-border">
              <Calendar size={20} />
            </div>
            <h4 className="font-semibold text-zinc-800 dark:text-zinc-200">ยังไม่มีประวัติแบบทดสอบ</h4>
            <p className="text-xs text-zinc-500 mt-1">เริ่มต้นเล่นตอบคำถาม AI เพื่อเก็บสถิติและวิเคราะห์จุดบกพร่องกันเถอะ!</p>
          </div>
        ) : (
          <div className="space-y-3.5">
            {history.map((item) => {
              const dateStr = formatDate(item.timestamp);
              const subject = SUBJECTS.find(s => s.id === item.subjectId);
              const scorePercent = Math.round((item.score / item.totalQuestions) * 100);
              const isExpanded = expandedHistoryId === item.id;

              return (
                <div 
                  key={item.id} 
                  className="bg-white dark:bg-brand-card rounded-2xl border border-zinc-100 dark:border-brand-border shadow-sm overflow-hidden transition-all duration-200"
                >
                  {/* Collapsed Header Bar */}
                  <div 
                    onClick={() => toggleHistoryItem(item.id)}
                    className="p-4 sm:p-5 flex items-center justify-between cursor-pointer hover:bg-zinc-50/50 dark:hover:bg-brand-border/30 transition-colors"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className={`p-2.5 rounded-xl border shrink-0 ${subject?.color || "text-zinc-500 bg-zinc-50"}`}>
                        <LucideIcon name={subject?.icon || "BookOpen"} size={18} />
                      </div>
                      <div className="min-w-0">
                        <span className="font-bold text-zinc-900 dark:text-zinc-100 block text-sm sm:text-base leading-tight truncate">
                          {subject?.name || item.subjectName}
                        </span>
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {item.educationLevel && (
                            <span className="bg-violet-50 dark:bg-violet-950/40 border border-violet-100/30 dark:border-violet-900/40 text-violet-700 dark:text-violet-400 px-1.5 py-0.5 rounded-md text-[9px] font-bold">
                              {EDUCATION_LABELS[item.educationLevel] || item.educationLevel}
                            </span>
                          )}
                          {item.questionType && (
                            <span className="bg-sky-50 dark:bg-sky-950/40 border border-sky-100/30 dark:border-sky-900/40 text-sky-600 dark:text-sky-400 px-1.5 py-0.5 rounded-md text-[9px] font-bold">
                              {item.questionType === "review" ? "ทบทวน" : item.questionType === "comprehension" ? "วัดความเข้าใจ" : "ข้อสอบเก่า"}
                            </span>
                          )}
                          {item.questionFormat && (
                            <span className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100/30 dark:border-emerald-900/40 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded-md text-[9px] font-bold">
                              {item.questionFormat === "multiple_choice" ? "ปรนัย" : item.questionFormat === "true_false" ? "ถูก/ผิด" : "เติมคำ"}
                            </span>
                          )}
                          {item.difficulty && (
                            <span className="bg-amber-50 dark:bg-amber-950/40 border border-amber-100/30 dark:border-amber-900/40 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded-md text-[9px] font-bold">
                              {item.difficulty === "Easy" ? "ง่าย" : item.difficulty === "Medium" ? "ปานกลาง" : "ท้าทาย"}
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-zinc-400 block mt-1">
                          {dateStr}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <span className="text-sm sm:text-base font-bold text-zinc-900 dark:text-zinc-100 block">
                          คะแนน {item.score} / {item.totalQuestions}
                        </span>
                        <span className={`text-xs font-semibold ${
                          scorePercent >= 80 ? "text-emerald-500" : scorePercent >= 50 ? "text-amber-500" : "text-rose-500"
                        }`}>
                          {scorePercent}% ถูกต้อง
                        </span>
                      </div>
                      <div className="text-zinc-400">
                        {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Detailed View */}
                  {isExpanded && (
                    <div className="px-5 pb-5 border-t border-zinc-100 dark:border-brand-border divide-y divide-zinc-100 dark:divide-brand-border">
                      <div className="py-3 text-xs font-bold text-zinc-400 dark:text-zinc-500 tracking-wider uppercase mb-1">
                        เฉลยคำตอบพร้อมคำอธิบายแบบวิเคราะห์รายข้อ
                      </div>
                      {item.details.map((detail, idx) => (
                        <div key={idx} className="py-4 space-y-3">
                          <div className="flex items-start gap-2.5">
                            <span className="font-bold text-sm text-zinc-400 dark:text-zinc-500 pt-0.5 select-none shrink-0">
                              ข้อที่ {idx + 1}.
                            </span>
                            <h5 className="font-semibold text-sm text-zinc-800 dark:text-zinc-100 leading-relaxed">
                              {detail.question}
                            </h5>
                          </div>

                          {/* Options grid */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-7">
                            {detail.options.map((option, optIdx) => {
                              const isSelected = optIdx === detail.selectedOptionIndex;
                              const isCorrectAnswer = optIdx === detail.answerIndex;
                              
                              let optionClass = "bg-zinc-50 dark:bg-brand-bg text-zinc-700 dark:text-zinc-300 border-zinc-200/60 dark:border-brand-border";
                              let iconEl = null;

                              if (isCorrectAnswer) {
                                optionClass = "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 text-emerald-800 dark:text-emerald-300 font-medium";
                                iconEl = <CheckCircle size={15} className="text-emerald-600 inline shrink-0" />;
                              } else if (isSelected && !isCorrectAnswer) {
                                optionClass = "bg-rose-50 dark:bg-rose-950/20 border-rose-200 text-rose-800 dark:text-rose-300 font-medium";
                                iconEl = <XCircle size={15} className="text-rose-600 inline shrink-0" />;
                              }

                              return (
                                <div 
                                  key={optIdx} 
                                  className={`p-3 rounded-xl border text-xs flex items-center justify-between gap-2 ${optionClass}`}
                                >
                                  <span>{option}</span>
                                  {iconEl}
                                </div>
                              );
                            })}
                          </div>

                          {/* Explanation summary */}
                          <div className="pl-7 pt-1.5">
                            <div className="p-3 bg-violet-50/50 dark:bg-brand-bg/60 border border-violet-100/50 dark:border-brand-border rounded-xl">
                              <span className="block text-xs font-bold text-violet-700 dark:text-violet-400 mb-1">
                                💡 เฉลยละเอียดและวิเคราะห์แนวคิด:
                              </span>
                              <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                                {detail.explanation || "ไม่มีอธิบายระบุ"}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
