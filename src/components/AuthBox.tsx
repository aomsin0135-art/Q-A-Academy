import React, { useState, useEffect } from "react";
import { LogIn, UserPlus, Star, Award, Shield } from "lucide-react";

interface AuthBoxProps {
  onSuccess: (user: any) => void;
  onOfflineMode?: (displayName: string) => void;
}

export default function AuthBox({ onSuccess, onOfflineMode }: AuthBoxProps) {
  const [activeTab, setActiveTab] = useState<"login" | "register">("login");
  const [regUsername, setRegUsername] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  useEffect(() => {
    // Expose registration function globally to match the exact user specification
    (window as any).register = () => {
      const usernameInput = document.getElementById("regUsername") as HTMLInputElement | null;
      const passwordInput = document.getElementById("regPassword") as HTMLInputElement | null;
      
      const username = usernameInput ? usernameInput.value.trim() : "";
      const password = passwordInput ? passwordInput.value : "";

      if (!username || !password) {
        alert("กรุณากรอกข้อมูลให้ครบ");
        return;
      }

      if (localStorage.getItem(username)) {
        alert("ชื่อผู้ใช้นี้มีอยู่แล้ว");
        return;
      }

      const userData = {
        username: username,
        password: password,
        createdAt: new Date().toISOString()
      };

      localStorage.setItem(username, JSON.stringify(userData));
      localStorage.setItem("currentUser", username);
      localStorage.setItem("offline_display_name", username);

      alert("สมัครสมาชิกสำเร็จ ยินดีต้อนรับ " + username);
      
      // Auto login after registration
      onSuccess({
        uid: "local_" + username,
        email: username + "@local.com",
        displayName: username
      });
    };

    // Expose login function globally to match the exact user specification
    (window as any).login = () => {
      const usernameInput = document.getElementById("loginUsername") as HTMLInputElement | null;
      const passwordInput = document.getElementById("loginPassword") as HTMLInputElement | null;
      
      const username = usernameInput ? usernameInput.value.trim() : "";
      const password = passwordInput ? passwordInput.value : "";

      if (!username || !password) {
        alert("กรุณากรอกข้อมูลให้ครบ");
        return;
      }

      const userData = localStorage.getItem(username);

      if (!userData) {
        alert("ไม่พบบัญชีผู้ใช้");
        return;
      }

      const user = JSON.parse(userData);

      if (user.password === password) {
        localStorage.setItem("currentUser", username);
        localStorage.setItem("offline_display_name", username);

        alert("เข้าสู่ระบบสำเร็จ ยินดีต้อนรับ " + username);

        // Notify React application state of authentication success
        onSuccess({
          uid: "local_" + username,
          email: username + "@local.com",
          displayName: username
        });
      } else {
        alert("รหัสผ่านไม่ถูกต้อง");
      }
    };

    return () => {
      delete (window as any).register;
      delete (window as any).login;
    };
  }, [onSuccess]);

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    (window as any).register();
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    (window as any).login();
  };

  return (
    <div className="w-full max-w-md mx-auto bg-brand-card rounded-3xl shadow-xl border border-brand-border overflow-hidden">
      {/* Decorative Brand Header */}
      <div className="bg-gradient-to-br from-indigo-600 to-violet-700 py-8 px-6 text-center text-white relative">
        <div className="absolute right-4 top-4 opacity-15">
          <Award size={80} />
        </div>
        <div className="inline-flex p-3 bg-white/10 backdrop-blur-md rounded-2xl mb-3 border border-white/20">
          <Star className="text-amber-300 fill-amber-300" size={28} />
        </div>
        <h2 className="text-2xl font-black text-white tracking-wider">Q&A ACADEMY</h2>
        <p className="text-violet-100 text-xs mt-1">สถาบันประลองปัญญาและแบบทดสอบอัจฉริยะ AI</p>
      </div>

      {/* Tabs Selector */}
      <div className="flex border-b border-brand-border">
        <button
          onClick={() => setActiveTab("login")}
          className={`flex-1 py-4 text-sm font-semibold transition-colors duration-200 ${
            activeTab === "login"
              ? "text-slate-100 border-b-2 border-brand-indigo bg-brand-card"
              : "text-slate-400 hover:text-zinc-200 bg-brand-bg/50"
          }`}
        >
          เข้าสู่ระบบ
        </button>
        <button
          onClick={() => setActiveTab("register")}
          className={`flex-1 py-4 text-sm font-semibold transition-colors duration-200 ${
            activeTab === "register"
              ? "text-slate-100 border-b-2 border-brand-indigo bg-brand-card"
              : "text-slate-400 hover:text-zinc-200 bg-brand-bg/50"
          }`}
        >
          สมัครสมาชิกใหม่
        </button>
      </div>

      <div className="p-6 bg-brand-card">
        {activeTab === "login" && (
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                ชื่อผู้ใช้
              </label>
              <input
                type="text"
                id="loginUsername"
                required
                className="w-full px-4 py-2.5 rounded-xl border border-brand-border bg-brand-bg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 text-slate-100 placeholder-slate-500"
                placeholder="ชื่อผู้ใช้สำหรับเข้าสู่ระบบ"
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                รหัสผ่าน
              </label>
              <input
                type="password"
                id="loginPassword"
                required
                className="w-full px-4 py-2.5 rounded-xl border border-brand-border bg-brand-bg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 text-slate-100 placeholder-slate-500"
                placeholder="ป้อนรหัสผ่านของคุณ"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
              />
            </div>
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 py-3 bg-brand-indigo hover:bg-brand-indigo-hover text-white rounded-xl text-sm font-semibold transition-all duration-150 shadow-md cursor-pointer"
            >
              <LogIn size={16} />
              เข้าสู่ระบบ
            </button>
          </form>
        )}

        {activeTab === "register" && (
          <form onSubmit={handleRegisterSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                ชื่อผู้ใช้
              </label>
              <input
                type="text"
                id="regUsername"
                required
                className="w-full px-4 py-2.5 rounded-xl border border-brand-border bg-brand-bg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 text-slate-100 placeholder-slate-500"
                placeholder="ชื่อผู้ใช้สำหรับเริ่มความก้าวหน้า"
                value={regUsername}
                onChange={(e) => setRegUsername(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                รหัสผ่าน
              </label>
              <input
                type="password"
                id="regPassword"
                required
                className="w-full px-4 py-2.5 rounded-xl border border-brand-border bg-brand-bg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 text-slate-100 placeholder-slate-500"
                placeholder="ตั้งรหัสผ่านสำหรับข้อมูลส่วนบุคคล"
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
              />
            </div>
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 py-3 bg-brand-indigo hover:bg-brand-indigo-hover text-white rounded-xl text-sm font-semibold transition-all duration-150 shadow-md cursor-pointer"
            >
              <UserPlus size={16} />
              สมัครสมาชิก
            </button>
          </form>
        )}

        {/* Footer info showing security status */}
        <div className="mt-5 pt-4 border-t border-brand-border/60 flex items-center justify-center gap-1.5 text-[10px] text-slate-500">
          <Shield size={11} />
          <span>ข้อมูลสมาชิกและคะแนน XP บันทึกแบบออฟไลน์บนเบราว์เซอร์นี้อย่างปลอดภัย</span>
        </div>
      </div>
    </div>
  );
}
