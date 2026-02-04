import { Mail } from "lucide-react";

export default function ComingSoon() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col items-center justify-center px-4">
      <div className="text-center max-w-2xl mx-auto">
        <div className="mb-12">
          <h1 className="text-6xl md:text-8xl font-bold tracking-tight">
            <span className="bg-gradient-to-r from-[#4F63A4] via-[#6B7FBF] to-[#4F63A4] bg-clip-text text-transparent">
              extrapl
            </span>
            <span className="text-[#4F63A4]">.</span>
          </h1>
          <div className="h-1 w-24 bg-gradient-to-r from-transparent via-[#4F63A4] to-transparent mx-auto mt-4"></div>
        </div>

        <p className="text-slate-400 text-xl md:text-2xl font-light mb-4">
          Reinventing Process.
        </p>
        
        <p className="text-slate-500 text-lg mb-12">
          Coming Soon
        </p>

        <div className="inline-flex items-center gap-3 bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-full px-6 py-3 hover:border-[#4F63A4]/50 transition-colors">
          <Mail className="w-5 h-5 text-[#4F63A4]" />
          <a 
            href="mailto:josh@extrapl.io" 
            className="text-slate-300 hover:text-white transition-colors"
          >
            josh@extrapl.io
          </a>
        </div>
      </div>

      <div className="absolute bottom-8 text-slate-600 text-sm">
        &copy; {new Date().getFullYear()} extrapl. All rights reserved.
      </div>
    </div>
  );
}
