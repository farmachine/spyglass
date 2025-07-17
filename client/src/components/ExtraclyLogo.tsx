import { useLocation } from "wouter";

interface ExtraclyLogoProps {
  className?: string;
  showText?: boolean;
}

export default function ExtraclyLogo({ className = "", showText = true }: ExtraclyLogoProps) {
  const [, setLocation] = useLocation();

  const handleClick = () => {
    setLocation("/");
  };

  return (
    <button
      onClick={handleClick}
      className={`flex items-center space-x-3 transition-opacity hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-lg p-1 ${className}`}
      aria-label="Extracly - Go to Dashboard"
    >
      {/* Logo SVG */}
      <div className="relative">
        <svg
          width="40"
          height="40"
          viewBox="0 0 40 40"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="drop-shadow-sm"
        >
          {/* Wave-like shape with gradient */}
          <defs>
            <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#0EA5E9" />
              <stop offset="100%" stopColor="#0284C7" />
            </linearGradient>
            <linearGradient id="flowGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.9" />
              <stop offset="50%" stopColor="#FFFFFF" stopOpacity="0.7" />
              <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.9" />
            </linearGradient>
          </defs>
          
          {/* Wave-like background shape */}
          <path
            d="M5 20 Q10 8 20 12 Q30 16 35 10 Q37 12 35 20 Q30 32 20 28 Q10 24 5 30 Q3 28 5 20Z"
            fill="url(#logoGradient)"
            stroke="#0284C7"
            strokeWidth="1"
          />
          
          {/* Dynamic flow lines representing data extraction */}
          <g stroke="url(#flowGradient)" strokeWidth="2" strokeLinecap="round" fill="none">
            {/* Main extraction flow */}
            <path d="M8 20 Q15 12 20 18 Q25 24 32 16" strokeWidth="2.5" />
            
            {/* Secondary data flows */}
            <path d="M10 15 Q17 10 22 16 Q27 22 34 14" strokeWidth="1.5" opacity="0.8" />
            <path d="M8 25 Q15 22 20 26 Q25 30 30 24" strokeWidth="1.5" opacity="0.8" />
            
            {/* Data extraction points */}
            <circle cx="12" cy="17" r="1.5" fill="white" opacity="0.9" />
            <circle cx="20" cy="19" r="2" fill="white" />
            <circle cx="28" cy="18" r="1.5" fill="white" opacity="0.9" />
          </g>
          
          {/* Extract symbol - stylized 'E' */}
          <g fill="white" opacity="0.4">
            <rect x="16" y="12" width="8" height="1.5" rx="0.5" />
            <rect x="16" y="18" width="6" height="1.5" rx="0.5" />
            <rect x="16" y="24" width="8" height="1.5" rx="0.5" />
            <rect x="16" y="12" width="1.5" height="13.5" rx="0.5" />
          </g>
        </svg>
      </div>
      
      {/* App name */}
      {showText && (
        <div className="flex flex-col">
          <span className="text-xl font-bold text-foreground leading-tight">
            Extracly
          </span>
          <span className="text-xs text-muted-foreground leading-tight">
            Data Extraction Platform
          </span>
        </div>
      )}
    </button>
  );
}