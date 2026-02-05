import { useState, useEffect } from "react";
import { Mail, Sun, Moon } from "lucide-react";

export default function ComingSoon() {
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDark]);

  return (
    <div className={`min-h-screen flex flex-col items-center justify-center px-4 transition-colors duration-500 ${
      isDark
        ? 'bg-gradient-to-br from-[#0B1120] via-[#111B33] to-[#0B1120]'
        : 'bg-gradient-to-br from-slate-50 via-white to-slate-100'
    }`}>
      <button
        onClick={() => setIsDark(!isDark)}
        className={`absolute top-6 right-6 p-3 rounded-full transition-all duration-300 ${
          isDark
            ? 'bg-slate-800/60 hover:bg-slate-700/80 text-amber-400'
            : 'bg-slate-200/80 hover:bg-slate-300 text-slate-600'
        }`}
        aria-label="Toggle theme"
      >
        {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
      </button>

      <div className="text-center max-w-3xl mx-auto">
        <div className="mb-14">
          <div className="flex items-center justify-center gap-3">
            <span className={`text-7xl md:text-9xl font-bold tracking-tight transition-colors duration-500 ${
              isDark ? 'text-slate-200' : 'text-[#071e54]'
            }`}>
              extrapl
            </span>
            <div className="w-4 h-4 md:w-5 md:h-5 rounded-full bg-[#4F63A4] mt-4 md:mt-6" />
          </div>
          <div className="h-[2px] w-32 bg-gradient-to-r from-transparent via-[#4F63A4]/60 to-transparent mx-auto mt-6" />
        </div>

        <p className={`text-xl md:text-2xl font-light mb-4 transition-colors duration-500 ${
          isDark ? 'text-slate-400' : 'text-slate-500'
        }`}>
          Reinventing Process.
        </p>

        <p className={`text-lg mb-14 transition-colors duration-500 ${
          isDark ? 'text-slate-500' : 'text-slate-400'
        }`}>
          Coming Soon
        </p>

        <div className={`inline-flex items-center gap-3 backdrop-blur-sm rounded-full px-7 py-3.5 transition-all duration-500 ${
          isDark
            ? 'bg-slate-800/50 border border-slate-700/50 hover:border-[#4F63A4]/50'
            : 'bg-white border border-slate-200 hover:border-[#4F63A4]/50 shadow-sm'
        }`}>
          <Mail className="w-5 h-5 text-[#4F63A4]" />
          <a
            href="mailto:josh@extrapl.io"
            className={`transition-colors duration-300 ${
              isDark ? 'text-slate-300 hover:text-white' : 'text-slate-600 hover:text-[#071e54]'
            }`}
          >
            josh@extrapl.io
          </a>
        </div>
      </div>

      <div className={`absolute bottom-8 text-sm transition-colors duration-500 ${
        isDark ? 'text-slate-600' : 'text-slate-400'
      }`}>
        &copy; {new Date().getFullYear()} extrapl. All rights reserved.
      </div>
    </div>
  );
}
