import React, { useState, useEffect } from "react";
import { onAuthStateChanged, signOut, User as FirebaseUser } from "firebase/auth";
import { doc, getDoc, collection, query, where, orderBy, getDocs } from "firebase/firestore";
import { auth, db, handleFirestoreError, OperationType } from "./lib/firebase";
import { UserProgress, HistoryItem } from "./types";
import AuthBox from "./components/AuthBox";
import StatDashboard from "./components/StatDashboard";
import QuizZone from "./components/QuizZone";
import LeaderboardView from "./components/LeaderboardView";
import { 
  Award, LogOut, Code, GraduationCap, LayoutDashboard, 
  Sparkles, Trophy, BookOpen, Flame, Play, LogIn, X, User,
  Compass, Zap, ShieldCheck, ArrowRight, Home
} from "lucide-react";

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [offlineDisplayName, setOfflineDisplayName] = useState("ผู้เรียนทั่วไป (ออฟไลน์)");
  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [inGameScreen, setInGameScreen] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [activeTab, setActiveTab] = useState<"dashboard" | "quiz" | "leaderboard">("quiz");

  // Sync Auth State & default dark mode body classes
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  useEffect(() => {
    // Check local storage for custom registered user login first
    const localUser = localStorage.getItem("currentUser") || localStorage.getItem("offline_display_name");
    if (localUser && localUser !== "ผู้เรียนทั่วไป (ออฟไลน์)") {
      const mockUser = {
        uid: "local_" + localUser,
        email: localUser + "@local.com",
        displayName: localUser
      };
      setUser(mockUser as any);
      setIsOfflineMode(false);
      fetchUserAllData("local_" + localUser, localUser);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setIsOfflineMode(false);
        fetchUserAllData(currentUser.uid, currentUser.displayName || undefined);
        setUser(currentUser);
      } else {
        const savedName = localStorage.getItem("currentUser") || localStorage.getItem("offline_display_name") || "ผู้เรียนทั่วไป (ออฟไลน์)";
        setIsOfflineMode(true);
        setOfflineDisplayName(savedName);
        fetchUserAllData("offline_user", savedName);
      }
    });
    return () => unsubscribe();
  }, []);

  // Fetch companion Firestore metrics
  const fetchUserAllData = async (uid: string, customName?: string) => {
    setLoading(true);
    const registeredName = customName || localStorage.getItem("currentUser") || localStorage.getItem("offline_display_name") || (customName !== "ผู้เรียนทั่วไป (ออฟไลน์)" ? customName : undefined);
    
    if (uid.startsWith("offline_") || uid.startsWith("local_")) {
      const storageKeyProg = uid.startsWith("local_") ? `progress_${uid}` : "local_progress";
      const storageKeyHist = uid.startsWith("local_") ? `history_${uid}` : "local_history";
      try {
        const localProgRaw = localStorage.getItem(storageKeyProg) || localStorage.getItem("local_progress");
        let localProg: UserProgress;
        const finalDisplayName = registeredName || (localProgRaw ? JSON.parse(localProgRaw).displayName : "ผู้เรียนรู้คนสำคัญ");

        if (localProgRaw) {
          localProg = JSON.parse(localProgRaw);
          if (registeredName && registeredName !== "ผู้เรียนทั่วไป (ออฟไลน์)") {
            localProg.displayName = registeredName;
            localProg.email = `${registeredName}@local.com`;
          }
          localStorage.setItem(storageKeyProg, JSON.stringify(localProg));
        } else {
          localProg = {
            uid: uid,
            email: `${finalDisplayName || "user"}@local.com`,
            displayName: finalDisplayName || "ผู้เรียนรู้คนสำคัญ",
            totalScore: 0,
            stats: {},
            lastActiveDate: "",
            streakCount: 0,
            createdAt: new Date().toISOString()
          };
          localStorage.setItem(storageKeyProg, JSON.stringify(localProg));
        }
        setProgress(localProg);

        const localHist = JSON.parse(localStorage.getItem(storageKeyHist) || localStorage.getItem("local_history") || "[]");
        setHistory(localHist);
      } catch (err) {
        console.error("Local data fallback load failed: ", err);
      } finally {
        setLoading(false);
      }
      return;
    }

    try {
      // 1. Fetch profile/progress stats
      const userDocRef = doc(db, "users", uid);
      let userDocSnap;
      try {
        userDocSnap = await getDoc(userDocRef);
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, `users/${uid}`);
        return;
      }
      if (userDocSnap.exists()) {
        setProgress({
          uid: uid,
          ...userDocSnap.data()
        } as UserProgress);
      }

      // 2. Fetch recent quiz logs history
      const q = query(
        collection(db, "history"),
        where("uid", "==", uid),
        orderBy("timestamp", "desc")
      );
      let querySnap;
      try {
        querySnap = await getDocs(q);
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, "history");
        return;
      }
      const list: HistoryItem[] = [];
      querySnap.forEach((docItem) => {
        const d = docItem.data();
        list.push({
          id: docItem.id,
          ...d
         } as HistoryItem);
      });
      setHistory(list);
    } catch (err) {
      console.error("Error fetching user companion data: ", err);
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshStats = () => {
    if (isOfflineMode) {
      fetchUserAllData("offline_user");
    } else if (user) {
      fetchUserAllData(user.uid);
    }
  };

  const handleLogout = async () => {
    setLoading(true);
    try {
      localStorage.removeItem("currentUser");
      localStorage.removeItem("offline_mode_active");
      localStorage.removeItem("offline_display_name");
      setUser(null);
      setProgress(null);
      setHistory([]);
      setIsOfflineMode(true);
      setOfflineDisplayName("ผู้เรียนทั่วไป (ออฟไลน์)");
      try {
        await signOut(auth);
      } catch (authErr) {
        // Safe to ignore
      }
    } catch (err) {
      console.error("Error signing out: ", err);
    } finally {
      setLoading(false);
      setInGameScreen(false);
    }
  };

  const handlePlayClick = () => {
    if (!progress) {
      const savedName = localStorage.getItem("currentUser") || localStorage.getItem("offline_display_name") || "ผู้เรียนรู้คนสำคัญ";
      fetchUserAllData("offline_user", savedName);
    }
    setActiveTab("quiz");
    setInGameScreen(true);
  };

  // Full Screen Load state
  if (loading && !progress) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-brand-bg text-white">
        <div className="w-10 h-10 rounded-full border-4 border-zinc-900 border-t-brand-indigo animate-spin"></div>
        <span className="text-xs font-semibold text-slate-400 animate-pulse">กำลังเตรียมความพร้อม Q&A ACADEMY...</span>
      </div>
    );
  }

  // TITLE / LANDING SCREEN (หน้าก่อนเข้าเล่น Q&A ACADEMY)
  if (!inGameScreen) {
    const currentUserName = user?.displayName || progress?.displayName || localStorage.getItem("currentUser");
    const isLoggedAccount = Boolean(currentUserName && currentUserName !== "ผู้เรียนทั่วไป (ออฟไลน์)");

    return (
      <div className="min-h-screen relative flex flex-col justify-between bg-gradient-to-b from-[#0B0F19] via-[#111827] to-[#0B0F19] text-slate-100 overflow-x-hidden select-none">
        
        {/* Subtle Background Glows */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[350px] bg-violet-600/15 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute top-1/3 left-1/3 w-[300px] h-[300px] bg-indigo-600/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-20 right-1/4 w-[350px] h-[250px] bg-fuchsia-600/10 rounded-full blur-3xl pointer-events-none"></div>

        {/* Top Header */}
        <header className="relative z-10 px-6 py-5 flex justify-between items-center max-w-7xl mx-auto w-full">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-indigo-500 via-violet-600 to-purple-600 text-white rounded-2xl shadow-lg shadow-indigo-500/20 border border-white/15">
              <GraduationCap size={24} className="text-amber-300" />
            </div>
            <div>
              <span className="font-black text-lg tracking-wider text-white">Q&A ACADEMY</span>
              <span className="block text-[10px] text-violet-300 font-medium tracking-widest uppercase">Adaptive AI Quiz Platform</span>
            </div>
          </div>

          {/* Quick status if already logged in */}
          {isLoggedAccount && (
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-slate-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>ผู้เล่น: <strong className="text-white">{currentUserName}</strong></span>
              <span className="text-amber-400 font-bold ml-1">({progress?.totalScore || 0} XP)</span>
            </div>
          )}
        </header>

        {/* Center Hero / Action Screen */}
        <main className="relative z-10 max-w-4xl mx-auto w-full px-6 flex-1 flex flex-col items-center justify-center text-center py-10">
          
          {/* Academy Emblem & Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-violet-950/60 border border-violet-500/30 text-violet-300 rounded-full text-xs font-bold shadow-inner mb-6 backdrop-blur-md">
            <Sparkles size={14} className="text-amber-400 animate-spin" />
            <span>สถาบันประลองปัญญา & แบบทดสอบอัจฉริยะ AI</span>
          </div>

          {/* Prominent Title */}
          <h1 className="text-5xl sm:text-7xl md:text-8xl font-black tracking-tight mb-4 text-white drop-shadow-md">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 via-indigo-200 to-fuchsia-400">
              Q&A ACADEMY
            </span>
          </h1>

          <p className="text-base sm:text-lg text-slate-300 max-w-2xl leading-relaxed mb-8">
            ท้าทายความรู้ 8 หมวดวิชาหลักสูตรสากล พร้อมระบบสร้างโจทย์ AI สดใหม่ทุกรอบ 
            สะสมค่าประสบการณ์ XP และไต่อันดับสู่จุดสูงสุดของสถาบัน
          </p>

          {/* Feature Highlights Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-2xl w-full mb-10">
            <div className="p-3 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm flex flex-col items-center">
              <BookOpen size={20} className="text-indigo-400 mb-1" />
              <span className="text-xs font-bold text-slate-200">8 หมวดวิชา</span>
              <span className="text-[10px] text-slate-400">ครอบคลุมทุกสาย</span>
            </div>
            <div className="p-3 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm flex flex-col items-center">
              <Sparkles size={20} className="text-violet-400 mb-1" />
              <span className="text-xs font-bold text-slate-200">AI คำถามสด</span>
              <span className="text-[10px] text-slate-400">ไม่ซ้ำและมีเฉลย</span>
            </div>
            <div className="p-3 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm flex flex-col items-center">
              <Trophy size={20} className="text-amber-400 mb-1" />
              <span className="text-xs font-bold text-slate-200">Leaderboard</span>
              <span className="text-[10px] text-slate-400">ชิงอันดับเกียรติยศ</span>
            </div>
            <div className="p-3 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm flex flex-col items-center">
              <Flame size={20} className="text-rose-400 mb-1" />
              <span className="text-xs font-bold text-slate-200">Streak & XP</span>
              <span className="text-[10px] text-slate-400">วัดความต่อเนื่อง</span>
            </div>
          </div>

          {/* Central Prominent PLAY Button */}
          <div className="flex flex-col items-center gap-3">
            <button
              onClick={handlePlayClick}
              id="play-button"
              className="group relative px-12 py-5 sm:px-16 sm:py-6 bg-gradient-to-r from-violet-600 via-indigo-600 to-fuchsia-600 hover:from-violet-500 hover:via-indigo-500 hover:to-fuchsia-500 text-white font-black text-2xl sm:text-3xl rounded-3xl shadow-2xl shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer flex items-center justify-center gap-3.5 border border-white/25 ring-4 ring-violet-500/20"
            >
              <div className="p-2 bg-white/20 rounded-2xl group-hover:bg-white/30 transition-colors">
                <Play className="fill-white w-6 h-6 sm:w-8 sm:h-8 translate-x-0.5" />
              </div>
              <span className="tracking-widest">PLAY</span>
            </button>
            <span className="text-xs text-violet-300/80 font-medium">กด PLAY เพื่อเริ่มทำแบบทดสอบได้ทันที</span>
          </div>

        </main>

        {/* Footer */}
        <footer className="relative z-10 py-5 text-center text-xs text-slate-500 border-t border-white/5 max-w-7xl mx-auto w-full px-6">
          <span>Q&A ACADEMY © 2026 • ระบบประเมินผลการเรียนรู้อัจฉริยะ ขับเคลื่อนด้วย AI</span>
        </footer>

        {/* BOTTOM RIGHT CORNER: SIGN IN BUTTON */}
        <div className="fixed bottom-6 right-6 z-40">
          {isLoggedAccount ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowAuthModal(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-slate-900/90 hover:bg-slate-800 border border-violet-500/40 hover:border-violet-400 rounded-2xl text-slate-200 text-xs sm:text-sm font-bold shadow-xl backdrop-blur-md transition-all hover:scale-105 cursor-pointer"
                title="สลับบัญชีหรือจัดการโปรไฟล์"
              >
                <div className="w-5 h-5 rounded-full bg-violet-600 flex items-center justify-center text-[10px] text-white font-black">
                  {currentUserName?.charAt(0).toUpperCase()}
                </div>
                <span>{currentUserName}</span>
              </button>
              <button
                onClick={handleLogout}
                className="p-2.5 bg-slate-900/90 hover:bg-rose-950/60 border border-slate-700 hover:border-rose-500/50 rounded-2xl text-slate-400 hover:text-rose-400 text-xs shadow-xl backdrop-blur-md transition-all cursor-pointer"
                title="ออกจากระบบ"
              >
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowAuthModal(true)}
              id="signin-bottom-right-btn"
              className="flex items-center gap-2.5 px-5 py-3 bg-gradient-to-r from-violet-700 to-indigo-700 hover:from-violet-600 hover:to-indigo-600 border border-violet-400/40 rounded-2xl text-white text-xs sm:text-sm font-bold shadow-2xl shadow-indigo-600/40 hover:shadow-indigo-600/60 backdrop-blur-md transition-all hover:scale-105 active:scale-95 cursor-pointer ring-2 ring-white/10"
            >
              <LogIn size={18} className="text-amber-300" />
              <span className="tracking-wide">Sign In</span>
            </button>
          )}
        </div>

        {/* AUTHENTICATION MODAL POPUP */}
        {showAuthModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
            <div className="relative w-full max-w-md">
              {/* Close Button */}
              <button
                onClick={() => setShowAuthModal(false)}
                className="absolute -top-3 -right-3 z-10 p-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-full text-slate-300 hover:text-white transition-colors cursor-pointer shadow-lg"
                title="ปิดหน้าต่าง"
              >
                <X size={18} />
              </button>
              
              <AuthBox
                onSuccess={(u) => {
                  fetchUserAllData(u.uid);
                  setShowAuthModal(false);
                }}
                onOfflineMode={(name) => {
                  localStorage.setItem("offline_mode_active", "true");
                  localStorage.setItem("offline_display_name", name);
                  setIsOfflineMode(true);
                  setOfflineDisplayName(name);
                  fetchUserAllData("offline_user", name);
                  setShowAuthModal(false);
                }}
              />
            </div>
          </div>
        )}

      </div>
    );
  }

  // IN-GAME / DASHBOARD MAIN APPLICATION
  return (
    <div className="min-h-screen transition-colors duration-200 flex flex-col bg-brand-bg text-slate-100">
      
      {/* AUTHENTICATED SYSTEM NAVBAR */}
      <nav className={`sticky top-0 z-40 border-b border-zinc-100 dark:border-brand-border backdrop-blur-md bg-white/80 dark:bg-brand-bg/80`}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-4">
          
          {/* Logo Brand left with click to return to Title screen */}
          <button 
            onClick={() => setInGameScreen(false)}
            className="flex items-center gap-2.5 text-left hover:opacity-85 transition-opacity cursor-pointer"
            title="กลับไปหน้าหลัก Q&A ACADEMY"
          >
            <div className="p-2 bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-600 text-white rounded-xl shadow-sm border border-white/10">
              <GraduationCap size={18} className="text-amber-300" />
            </div>
            <div>
              <span className="font-black tracking-wider text-sm text-white hidden sm:inline-block">Q&A ACADEMY</span>
              <span className="text-[10px] text-violet-400 block sm:hidden font-black">Q&A ACADEMY</span>
            </div>
          </button>

          {/* Tab Selecting Elements */}
          <div className="flex bg-zinc-100 dark:bg-brand-card rounded-xl p-1 shrink-0 gap-1 border dark:border-brand-border">
            <button
              onClick={() => setActiveTab("quiz")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all duration-150 cursor-pointer ${
                activeTab === "quiz"
                  ? "bg-white dark:bg-brand-border text-violet-400 dark:text-slate-100 shadow-sm"
                  : "text-zinc-500 hover:text-zinc-700 dark:hover:text-slate-300"
              }`}
            >
              <Sparkles size={14} />
              <span>ทำโจทย์ AI</span>
            </button>
            <button
              onClick={() => setActiveTab("dashboard")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all duration-150 cursor-pointer ${
                activeTab === "dashboard"
                  ? "bg-white dark:bg-brand-border text-violet-400 dark:text-slate-100 shadow-sm"
                  : "text-zinc-500 hover:text-zinc-700 dark:hover:text-slate-300"
              }`}
            >
              <LayoutDashboard size={14} />
              <span className="hidden xs:inline">สถิติเรียนรู้</span>
            </button>
            <button
              onClick={() => setActiveTab("leaderboard")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all duration-150 cursor-pointer ${
                activeTab === "leaderboard"
                  ? "bg-white dark:bg-brand-border text-violet-400 dark:text-slate-100 shadow-sm"
                  : "text-zinc-500 hover:text-zinc-700 dark:hover:text-slate-300"
              }`}
            >
              <Trophy size={14} />
              <span>อันดับเด่น</span>
            </button>
          </div>

          {/* User profile actions right */}
          <div className="flex items-center gap-3">
            {progress && (
              <div className="hidden md:flex flex-col text-right leading-none shrink-0 min-w-[70px]">
                <span className="font-bold text-xs truncate max-w-[140px] text-zinc-900 dark:text-zinc-100">
                  {progress.displayName}
                </span>
                <span className="text-[10px] text-violet-600 dark:text-violet-400 font-extrabold mt-0.5">
                  {progress.totalScore || 0} XP
                </span>
              </div>
            )}

            {/* Home button to title screen */}
            <button
              onClick={() => setInGameScreen(false)}
              className="p-2 border border-zinc-100 dark:border-brand-border bg-zinc-50 dark:bg-brand-card text-zinc-400 hover:text-violet-300 rounded-xl transition-colors duration-150 cursor-pointer"
              title="กลับหน้าหลัก (Title Screen)"
            >
              <Home size={15} />
            </button>

            <button
              onClick={handleLogout}
              className="p-2 border border-zinc-100 dark:border-brand-border bg-zinc-50 dark:bg-brand-card text-zinc-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50/20 rounded-xl transition-colors duration-150 cursor-pointer"
              title="ออกจากระบบ"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </nav>

      {/* CORE DISPLAY WINDOW FOR SELECTED TAB */}
      <main className="flex-grow max-w-5xl mx-auto w-full py-8 pb-16 px-4">
        {activeTab === "quiz" && progress && (
          <QuizZone 
            progress={progress} 
            onQuizFinished={() => {
              handleRefreshStats();
              setActiveTab("dashboard");
            }} 
          />
        )}

        {activeTab === "dashboard" && progress && (
          <StatDashboard 
            progress={progress} 
            history={history} 
            onRefreshStats={handleRefreshStats} 
            onUpdateDisplayName={(newName) => {
              if (progress) {
                setProgress({
                  ...progress,
                  displayName: newName,
                  email: `${newName}@local.com`
                });
              }
              setOfflineDisplayName(newName);
            }}
          />
        )}

        {activeTab === "leaderboard" && (
          <LeaderboardView progress={progress} />
        )}
      </main>

      <footer className="py-6 text-center text-[10px] text-zinc-400 dark:text-slate-500 border-t border-zinc-100 dark:border-brand-border w-full mt-auto">
        <span>Q&A ACADEMY • สถาบันทดสอบความรู้และประลองปัญญา AI • รองรับทุกอุปกรณ์</span>
      </footer>
    </div>
  );
}
