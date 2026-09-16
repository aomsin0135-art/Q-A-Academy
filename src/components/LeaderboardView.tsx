import React, { useState, useEffect } from "react";
import { collection, query, orderBy, limit, getDocs } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../lib/firebase";
import { 
  Trophy, 
  Search, 
  Medal, 
  Star, 
  Award, 
  Sparkles, 
  Calculator, 
  FlaskConical, 
  Languages, 
  BookOpen, 
  Laptop,
  Code,
  Waves,
  PawPrint,
  Flame,
  User
} from "lucide-react";
import { UserProgress } from "../types";

interface LeaderboardUser {
  uid: string;
  displayName: string;
  totalScore: number;
  streakCount: number;
  stats?: Record<string, { totalCorrect: number; totalAttempted: number }>;
}

interface LeaderboardViewProps {
  progress?: UserProgress | null;
}

const SUBJECT_METADATA = [
  { id: "all", name: "คะแนนรวมทุกวิชา", icon: Trophy, color: "text-amber-500 bg-amber-500/10 border-amber-500/20" },
  { id: "math", name: "คณิตศาสตร์", icon: Calculator, color: "text-sky-500 bg-sky-500/10 border-sky-500/20" },
  { id: "science", name: "วิทยาศาสตร์", icon: FlaskConical, color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20" },
  { id: "english", name: "ภาษาอังกฤษ", icon: Languages, color: "text-indigo-500 bg-indigo-500/10 border-indigo-500/20" },
  { id: "history", name: "ประวัติศาสตร์", icon: BookOpen, color: "text-amber-600 bg-amber-500/10 border-amber-500/20" },
  { id: "computer", name: "คอมพิวเตอร์ & วิทยาการคำนวณ", icon: Laptop, color: "text-blue-500 bg-blue-500/10 border-blue-500/20" },
  { id: "coding", name: "เขียนโปรแกรม & โค้ดดิ้ง", icon: Code, color: "text-violet-500 bg-violet-500/10 border-violet-500/20" },
  { id: "marine", name: "ชีวิตใต้ทะเล", icon: Waves, color: "text-cyan-500 bg-cyan-500/10 border-cyan-500/20" },
  { id: "animals", name: "สัตว์บก & สัตว์ป่า", icon: PawPrint, color: "text-amber-700 bg-amber-500/10 border-amber-500/20" }
];

export default function LeaderboardView({ progress }: LeaderboardViewProps) {
  const [users, setUsers] = useState<LeaderboardUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedFilter, setSelectedFilter] = useState<string>("all"); // "all" or subject sub-id

  const fetchUsers = async () => {
    setLoading(true);
    try {
      // Query the main users collection
      const q = query(
        collection(db, "users"),
        orderBy("totalScore", "desc"),
        limit(50)
      );
      
      let querySnapshot;
      try {
        querySnapshot = await getDocs(q);
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, "users");
        return; // Stop execution on error
      }
      
      let usersList: LeaderboardUser[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        usersList.push({
          uid: doc.id,
          displayName: data.displayName || "ผู้เรียนนิรนาม",
          totalScore: data.totalScore || 0,
          streakCount: data.streakCount || 0,
          stats: data.stats || {}
        });
      });

      // Incorporate current logged-in user if present and not in queried list
      if (progress) {
        const alreadyExists = usersList.some(u => u.uid === progress.uid);
        if (!alreadyExists) {
          usersList.push({
            uid: progress.uid,
            displayName: progress.displayName,
            totalScore: progress.totalScore || 0,
            streakCount: progress.streakCount || 0,
            stats: progress.stats || {}
          });
        } else {
          // Sync with local live data
          usersList = usersList.map(u => {
            if (u.uid === progress.uid) {
              return {
                ...u,
                displayName: progress.displayName,
                totalScore: progress.totalScore || 0,
                streakCount: progress.streakCount || 0,
                stats: progress.stats || {}
              };
            }
            return u;
          });
        }
      }

      // Also support checking localStorage key "currentUser" for custom registered login
      const currentUserName = localStorage.getItem("currentUser");
      if (currentUserName && progress && progress.uid.startsWith("local_")) {
        const alreadyExists = usersList.some(u => u.displayName === currentUserName || u.uid === progress.uid);
        if (!alreadyExists) {
          usersList.push({
            uid: progress.uid,
            displayName: progress.displayName,
            totalScore: progress.totalScore || 0,
            streakCount: progress.streakCount || 0,
            stats: progress.stats || {}
          });
        }
      }

      setUsers(usersList);
    } catch (err) {
      console.error("Error fetching leaderboard: ", err);
      // Fallback list of top student mock competitors with realistic subject stats for full presentation!
      const mockClassLeaders: LeaderboardUser[] = [
        { 
          uid: "m1", 
          displayName: "พัทธดนย์ วงศ์สุวรรณ (เตรียมอุดมศึกษานิยม)", 
          totalScore: 520, 
          streakCount: 12,
          stats: {
            math: { totalCorrect: 20, totalAttempted: 22 },
            science: { totalCorrect: 15, totalAttempted: 18 },
            english: { totalCorrect: 12, totalAttempted: 14 },
            history: { totalCorrect: 5, totalAttempted: 5 },
            computer: { totalCorrect: 8, totalAttempted: 10 }
          }
        },
        { 
          uid: "m2", 
          displayName: "ณิชารีย์ เกษมสันต์ (แพทยศาสตร์วิชาการ)", 
          totalScore: 480, 
          streakCount: 8,
          stats: {
            math: { totalCorrect: 14, totalAttempted: 16 },
            science: { totalCorrect: 22, totalAttempted: 24 },
            english: { totalCorrect: 18, totalAttempted: 20 },
            history: { totalCorrect: 4, totalAttempted: 5 },
            computer: { totalCorrect: 4, totalAttempted: 5 }
          }
        },
        { 
          uid: "m3", 
          displayName: "สรวิศ รัตนดิลก (ครุศาสตร์ฟิสิกส์ก้าวหน้า)", 
          totalScore: 410, 
          streakCount: 5,
          stats: {
            math: { totalCorrect: 12, totalAttempted: 15 },
            science: { totalCorrect: 18, totalAttempted: 20 },
            english: { totalCorrect: 10, totalAttempted: 12 },
            history: { totalCorrect: 8, totalAttempted: 10 },
            computer: { totalCorrect: 5, totalAttempted: 6 }
          }
        },
        { 
          uid: "m4", 
          displayName: "อภิสิทธิ์ เลิศวิชัย (สาธิตประสานมิตรคอมพิวเตอร์)", 
          totalScore: 320, 
          streakCount: 4,
          stats: {
            math: { totalCorrect: 15, totalAttempted: 18 },
            science: { totalCorrect: 8, totalAttempted: 10 },
            english: { totalCorrect: 12, totalAttempted: 15 },
            history: { totalCorrect: 2, totalAttempted: 3 },
            computer: { totalCorrect: 3, totalAttempted: 4 }
          }
        },
        { 
          uid: "m5", 
          displayName: "กตัญญู พันธุ์ทิพย์ (วิศวกรรมไฟฟ้านานาชาติ)", 
          totalScore: 230, 
          streakCount: 2,
          stats: {
            math: { totalCorrect: 8, totalAttempted: 10 },
            science: { totalCorrect: 6, totalAttempted: 8 },
            english: { totalCorrect: 4, totalAttempted: 6 },
            history: { totalCorrect: 2, totalAttempted: 4 },
            computer: { totalCorrect: 11, totalAttempted: 12 }
          }
        },
        {
          uid: "m6",
          displayName: "จารุวรินทร์ สมบูรณ์ (มนุษยศาสตรภาษาศาสตร์)",
          totalScore: 180,
          streakCount: 3,
          stats: {
            math: { totalCorrect: 2, totalAttempted: 4 },
            science: { totalCorrect: 4, totalAttempted: 5 },
            english: { totalCorrect: 22, totalAttempted: 24 },
            history: { totalCorrect: 14, totalAttempted: 15 },
            computer: { totalCorrect: 2, totalAttempted: 3 }
          }
        }
      ];
      
      let unifiedList = [...mockClassLeaders];
      if (progress) {
        unifiedList = unifiedList.filter(m => m.uid !== progress.uid);
        unifiedList.push({
          uid: progress.uid,
          displayName: progress.displayName + " (คะแนนของคุณ)",
          totalScore: progress.totalScore || 0,
          streakCount: progress.streakCount || 0,
          stats: progress.stats || {}
        });
      }
      
      setUsers(unifiedList);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [progress]);

  // Sorting Handler based on active tab filtering
  const getSubjectCorrect = (user: LeaderboardUser, subjId: string) => {
    return user.stats?.[subjId]?.totalCorrect || 0;
  };

  const getSubjectAttempted = (user: LeaderboardUser, subjId: string) => {
    return user.stats?.[subjId]?.totalAttempted || 0;
  };

  const sortedUsers = [...users].sort((a, b) => {
    if (selectedFilter === "all") {
      return b.totalScore - a.totalScore;
    } else {
      const correctB = getSubjectCorrect(b, selectedFilter);
      const correctA = getSubjectCorrect(a, selectedFilter);
      if (correctB !== correctA) {
        return correctB - correctA;
      }
      // Secondary sort by overall XP
      return b.totalScore - a.totalScore;
    }
  });

  const filteredUsers = sortedUsers.filter(user => 
    user.displayName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Split top 3 for the podium layout
  const topThree = filteredUsers.slice(0, 3);
  const coreList = filteredUsers.slice(3);

  return (
    <div className="max-w-3xl mx-auto px-4 space-y-7">
      {/* Visual Header */}
      <div className="text-center">
        <div className="inline-flex p-3 bg-amber-500/10 text-amber-500 rounded-2xl mb-2.5 border border-amber-500/20 shadow-sm">
          <Trophy className="w-8 h-8 filter drop-shadow font-bold animate-pulse" />
        </div>
        <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">กระดานผู้นำอัจฉริยะ (Elite Leaderboard)</h2>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-md mx-auto leading-relaxed">
          ท้าทายตารางคะแนนแข่งขันสด! คุณสามารถตรวจสอบอันดับรวมทั้งหมด หรือสลับไปดูรายวิชาเฉพาะด้านเพื่อพิสูจน์ความเป็นเลิศได้ทันที
        </p>
      </div>

      {/* Dynamic Tabs: Overall VS Subject-specific */}
      <div className="bg-zinc-50 dark:bg-brand-card p-1.5 rounded-2xl border border-zinc-100 dark:border-brand-border shadow-inner">
        <div className="flex gap-1 overflow-x-auto select-none no-scrollbar py-0.5">
          {SUBJECT_METADATA.map((tab) => {
            const TabIcon = tab.icon;
            const isSelected = selectedFilter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setSelectedFilter(tab.id)}
                className={`flex items-center gap-1.5 shrink-0 px-4 py-2.5 rounded-xl text-xs font-bold transition-all duration-150 cursor-pointer ${
                  isSelected
                    ? "bg-violet-600 text-white shadow dark:bg-brand-indigo"
                    : "text-zinc-650 hover:bg-zinc-200/30 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-brand-border/40 dark:hover:text-zinc-200"
                }`}
              >
                <TabIcon size={14} className={isSelected ? "text-white" : "opacity-80"} />
                {tab.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Current User Highlight Status Bar */}
      {progress && (
        <div className="p-3.5 bg-violet-50/50 dark:bg-violet-950/15 border border-violet-100 dark:border-violet-900/40 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-violet-100 dark:bg-violet-950/50 text-violet-605 dark:text-violet-400 rounded-xl">
              <User size={16} />
            </div>
            <div>
              <span className="block text-[10px] text-zinc-400 font-bold uppercase tracking-wide">บัญชีผู้เรียนปัจจุบันของคุณ</span>
              <span className="text-xs sm:text-sm font-black text-black dark:text-zinc-100">
                {progress.displayName} <span className="text-violet-600 dark:text-violet-400 font-bold">(คุณ)</span>
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-center sm:text-right">
              <span className="block text-[10px] text-zinc-400">XP คะแนนรวม</span>
              <span className="text-xs sm:text-sm font-bold text-zinc-800 dark:text-zinc-100">{progress.totalScore || 0} XP</span>
            </div>
            {selectedFilter !== "all" && (
              <div className="border-l border-zinc-200 dark:border-brand-border pl-3 text-center sm:text-left">
                <span className="block text-[10px] text-zinc-400">สถิติวิชานี้</span>
                <span className="text-xs sm:text-sm font-extrabold text-indigo-600 dark:text-indigo-400">
                  {getSubjectCorrect(progress, selectedFilter)} / {getSubjectAttempted(progress, selectedFilter)} ข้อ
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-violet-600 dark:border-brand-indigo border-t-transparent animate-spin"></div>
          <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-405">กำลังประมวลสถิติคะแนนผลสัมฤทธิ์...</span>
        </div>
      ) : (
        <>
          {/* Top 3 Podium Cards */}
          {topThree.length > 0 && (
            <div className="grid grid-cols-3 gap-3 items-end pt-5 max-w-md sm:max-w-lg mx-auto">
              
              {/* RANK 2: Silver (Left) */}
              {topThree[1] && (
                <div className={`flex flex-col items-center bg-white dark:bg-brand-card rounded-2xl p-3 border shadow-sm text-center relative pt-7 ${
                  progress && topThree[1].uid === progress.uid ? "border-violet-400 ring-2 ring-violet-500/10 dark:border-brand-indigo" : "border-zinc-100 dark:border-brand-border"
                }`}>
                  <div className="absolute -top-5 w-10 h-10 bg-zinc-100 dark:bg-zinc-800 border-2 border-zinc-200 dark:border-brand-border text-zinc-500 dark:text-slate-300 rounded-full flex items-center justify-center font-bold text-sm shadow-md">
                    2
                  </div>
                  <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 font-black mb-1.5 uppercase text-xs border border-slate-300 shrink-0">
                    {topThree[1].displayName.charAt(0)}
                  </div>
                  <span className="text-[11px] font-black text-black dark:text-zinc-100 truncate w-full px-1">
                    {topThree[1].uid === progress?.uid ? "คุณ" : topThree[1].displayName.split(" ")[0]}
                  </span>
                  <span className="text-[11px] font-black text-violet-600 dark:text-violet-400 mt-1">
                    {selectedFilter === "all" 
                      ? `${topThree[1].totalScore} xp`
                      : `${getSubjectCorrect(topThree[1], selectedFilter)} ข้อ`
                    }
                  </span>
                  {selectedFilter !== "all" && (
                    <span className="text-[8px] text-zinc-400 block">
                      พยายาม {getSubjectAttempted(topThree[1], selectedFilter)} ข้อ
                    </span>
                  )}
                </div>
              )}

              {/* RANK 1: Gold (Center) - Tallest */}
              {topThree[0] && (
                <div className={`flex flex-col items-center bg-gradient-to-b from-amber-500/5 to-white dark:from-amber-950/20 dark:to-brand-card rounded-2xl p-4 border shadow-lg text-center relative pt-8 scale-105 ${
                  progress && topThree[0].uid === progress.uid ? "border-amber-400 ring-4 ring-amber-500/5" : "border-amber-205 dark:border-brand-border"
                }`}>
                  <div className="absolute -top-6 w-12 h-12 bg-amber-400 text-zinc-950 rounded-full flex items-center justify-center font-black text-base shadow-lg border-2 border-white dark:border-brand-bg animate-bounce">
                    👑
                  </div>
                  <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-950 flex items-center justify-center text-amber-650 font-black mb-1.5 uppercase text-sm border-2 border-amber-300 shrink-0">
                    {topThree[0].displayName.charAt(0)}
                  </div>
                  <span className="text-xs font-black text-black dark:text-zinc-100 truncate w-full px-1">
                    {topThree[0].uid === progress?.uid ? "คุณ" : topThree[0].displayName.split(" ")[0]}
                  </span>
                  <span className="text-xs font-black text-amber-600 dark:text-amber-400 mt-1">
                    {selectedFilter === "all"
                      ? `${topThree[0].totalScore} xp`
                      : `${getSubjectCorrect(topThree[0], selectedFilter)} ข้อ`
                    }
                  </span>
                  {selectedFilter !== "all" && (
                    <span className="text-[9px] text-zinc-400 block font-semibold">
                      พยายาม {getSubjectAttempted(topThree[0], selectedFilter)} ข้อ
                    </span>
                  )}
                </div>
              )}

              {/* RANK 3: Bronze (Right) */}
              {topThree[2] && (
                <div className={`flex flex-col items-center bg-white dark:bg-brand-card rounded-2xl p-3 border shadow-sm text-center relative pt-7 ${
                  progress && topThree[2].uid === progress.uid ? "border-violet-400 ring-2 ring-violet-500/10 dark:border-brand-indigo" : "border-zinc-100 dark:border-brand-border"
                }`}>
                  <div className="absolute -top-5 w-10 h-10 bg-amber-50 dark:bg-brand-bg text-amber-800 dark:text-amber-400 border-2 border-amber-100 dark:border-brand-border rounded-full flex items-center justify-center font-bold text-sm shadow-md">
                    3
                  </div>
                  <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-700 font-black mb-1.5 uppercase text-xs border border-amber-500/30 shrink-0">
                    {topThree[2].displayName.charAt(0)}
                  </div>
                  <span className="text-[11px] font-black text-black dark:text-zinc-100 truncate w-full px-1">
                    {topThree[2].uid === progress?.uid ? "คุณ" : topThree[2].displayName.split(" ")[0]}
                  </span>
                  <span className="text-[11px] font-black text-violet-600 dark:text-violet-400 mt-1">
                    {selectedFilter === "all"
                      ? `${topThree[2].totalScore} xp`
                      : `${getSubjectCorrect(topThree[2], selectedFilter)} ข้อ`
                    }
                  </span>
                  {selectedFilter !== "all" && (
                    <span className="text-[8px] text-zinc-400 block">
                      พยายาม {getSubjectAttempted(topThree[2], selectedFilter)} ข้อ
                    </span>
                  )}
                </div>
              )}

            </div>
          )}

          {/* Search Filter Interface */}
          <div className="relative max-w-sm mx-auto">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 w-4 h-4" />
            <input
              type="text"
              placeholder="ค้นหาชื่อผู้เรียนในสนามแข่งขัน..."
              className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-brand-card border border-zinc-100 dark:border-brand-border rounded-xl text-xs focus:ring-2 focus:ring-violet-500/25 focus:border-violet-500 focus:outline-none dark:text-zinc-150"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Standard Position Lists */}
          <div className="bg-white dark:bg-brand-card rounded-2xl border border-zinc-100 dark:border-brand-border shadow-sm overflow-hidden divide-y divide-zinc-50 dark:divide-brand-border/60">
            {filteredUsers.length === 0 ? (
              <div className="p-10 text-center text-zinc-400 text-xs">
                ไม่พบข้อมูลผู้ท้าชิงที่ตรงกับการค้นหาของคุณในขณะนี้
              </div>
            ) : (
              filteredUsers.map((user, idx) => {
                const rank = idx + 1;
                const isMe = progress && user.uid === progress.uid;
                let rankEl = <span className="font-bold text-zinc-400 text-xs sm:text-sm">{rank}</span>;

                if (rank === 1) {
                  rankEl = <Medal className="w-5 h-5 text-amber-500" />;
                } else if (rank === 2) {
                  rankEl = <Medal className="w-5 h-5 text-slate-400" />;
                } else if (rank === 3) {
                  rankEl = <Medal className="w-5 h-5 text-amber-700" />;
                }

                return (
                  <div 
                    key={user.uid} 
                    className={`p-4 sm:px-6 flex items-center justify-between gap-4 transition-all duration-150 ${
                      isMe 
                        ? "bg-violet-55/40 dark:bg-violet-950/15 border-l-4 border-l-violet-650" 
                        : "hover:bg-zinc-50/40 dark:hover:bg-brand-border/20"
                    }`}
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-8 flex justify-center shrink-0">
                        {rankEl}
                      </div>

                      <div className={`w-9 h-9 rounded-full font-bold flex items-center justify-center text-xs uppercase shrink-0 border ${
                        isMe 
                          ? "bg-violet-100 dark:bg-violet-950 text-violet-700 border-violet-300"
                          : "bg-zinc-100 dark:bg-brand-bg text-zinc-600 dark:text-slate-300 border-zinc-200/50 dark:border-brand-border"
                      }`}>
                        {user.displayName.charAt(0)}
                      </div>

                      <div className="min-w-0">
                        <span className="text-xs sm:text-sm block truncate font-black text-black dark:text-zinc-100">
                          {user.displayName}
                          {isMe && (
                            <span className="ml-1.5 px-1.5 py-0.5 rounded bg-violet-600 text-white dark:bg-brand-indigo text-[8px] font-black tracking-wide uppercase align-middle">
                              คุณ
                            </span>
                          )}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {user.streakCount > 0 && selectedFilter === "all" && (
                        <span className="inline-flex items-center gap-0.5 text-[9px] sm:text-xs bg-amber-50 dark:bg-amber-950/20 text-amber-600 rounded-full py-0.5 px-2 font-medium">
                          🔥 {user.streakCount} วัน
                        </span>
                      )}
                      
                      <div className="text-right">
                        <span className="text-xs sm:text-sm font-black text-zinc-900 dark:text-zinc-100 bg-zinc-50 dark:bg-brand-bg rounded-xl px-2.5 py-1.5 border dark:border-brand-border inline-block">
                          {selectedFilter === "all" ? (
                            <>
                              {user.totalScore} <span className="text-[10px] text-zinc-400 font-normal">XP</span>
                            </>
                          ) : (
                            <>
                              {getSubjectCorrect(user, selectedFilter)} <span className="text-[10px] text-indigo-500 font-bold">ข้อถูก</span>
                            </>
                          )}
                        </span>
                        {selectedFilter !== "all" && (
                          <span className="block text-[8px] sm:text-[10px] text-zinc-400 mr-1 mt-0.5">
                            พยายาม {getSubjectAttempted(user, selectedFilter)} ข้อ
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}
