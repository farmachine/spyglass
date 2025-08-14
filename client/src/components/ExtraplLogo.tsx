import { useLocation } from "wouter";

interface ExtraplLogoProps {
  className?: string;
  showText?: boolean;
  size?: number;
}

export default function ExtraplLogo({ className = "", showText = true, size = 60 }: ExtraplLogoProps) {
  const [, setLocation] = useLocation();

  const handleClick = () => {
    setLocation("/");
  };

  // When used as an indent marker (size 16 or smaller), don't make it clickable
  const isIndentMarker = size <= 16;

  if (isIndentMarker) {
    return (
      <div className={`flex items-center ${className}`}>
        <div className="flex items-center gap-1">
          <span className="text-sm font-bold text-slate-700">extrapl</span>
          <div className="w-1 h-1 rounded-full" style={{ backgroundColor: '#4F63A4' }}></div>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={handleClick}
      className={`flex items-center space-x-5 transition-all duration-200 hover:opacity-80 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-xl ${className}`}
      aria-label="extrapl - Go to Dashboard"
    >
      {/* Simple logo design */}
      <div className="flex items-center gap-2">
        <span className="text-3xl font-bold dark:text-slate-300 text-[#071e54]">extrapl</span>
        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#4F63A4' }}></div>
      </div>
    </button>
  );
}