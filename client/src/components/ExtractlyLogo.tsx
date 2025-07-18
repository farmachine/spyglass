import { useLocation } from "wouter";

interface ExtractlyLogoProps {
  className?: string;
  showText?: boolean;
}

export default function ExtractlyLogo({ className = "", showText = true }: ExtractlyLogoProps) {
  const [, setLocation] = useLocation();

  const handleClick = () => {
    setLocation("/");
  };

  return (
    <button
      onClick={handleClick}
      className={`flex items-center space-x-5 transition-all duration-200 hover:opacity-80 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-xl ${className}`}
      aria-label="Extractly - Go to Dashboard"
    >
      {/* Logo SVG */}
      <div className="relative">
        <svg
          width="60"
          height="60"
          viewBox="0 0 80 40"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="drop-shadow-md"
        >
          <defs>
            <linearGradient id="waveGradient1" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#0EA5E9" />
              <stop offset="100%" stopColor="#0284C7" />
            </linearGradient>
            <linearGradient id="waveGradient2" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#38BDF8" />
              <stop offset="100%" stopColor="#0EA5E9" />
            </linearGradient>
          </defs>
          
          {/* First wave line */}
          <path
            d="M5 15 Q20 8 35 15 Q50 22 65 15 Q72 12 75 15"
            stroke="url(#waveGradient1)"
            strokeWidth="4"
            strokeLinecap="round"
            fill="none"
          />
          
          {/* Second wave line */}
          <path
            d="M5 25 Q20 18 35 25 Q50 32 65 25 Q72 22 75 25"
            stroke="url(#waveGradient2)"
            strokeWidth="4"
            strokeLinecap="round"
            fill="none"
          />
        </svg>
      </div>
      
      {/* App name */}
      {showText && (
        <div className="flex flex-col">
          <span className="text-3xl font-bold text-foreground leading-tight tracking-tight">
            Extractly
          </span>
        </div>
      )}
    </button>
  );
}