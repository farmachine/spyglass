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
      className={`flex items-center space-x-5 transition-all duration-200 hover:opacity-80 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-xl p-4 ${className}`}
      aria-label="Extractly - Go to Dashboard"
    >
      {/* Logo SVG */}
      <div className="relative">
        <svg
          width="60"
          height="60"
          viewBox="0 0 120 80"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="drop-shadow-md"
        >
          <defs>
            <linearGradient id="darkWaveGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#1E90FF" />
              <stop offset="100%" stopColor="#0284C7" />
            </linearGradient>
            <linearGradient id="lightWaveGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#87CEEB" />
              <stop offset="100%" stopColor="#B0E0E6" />
            </linearGradient>
          </defs>
          
          {/* Main dark wave shape */}
          <path
            d="M20 45 Q35 25 50 35 Q65 45 80 30 Q90 25 100 35 L100 65 Q85 55 70 60 Q55 65 40 55 Q25 50 20 60 Z"
            fill="url(#darkWaveGradient)"
          />
          
          {/* Light wave overlay */}
          <path
            d="M15 35 Q30 15 45 25 Q60 35 75 20 Q85 15 95 25 Q105 30 115 25"
            stroke="url(#lightWaveGradient)"
            strokeWidth="8"
            strokeLinecap="round"
            fill="none"
            opacity="0.8"
          />
          
          {/* Secondary light wave */}
          <path
            d="M10 50 Q25 30 40 40 Q55 50 70 35 Q80 30 90 40"
            stroke="url(#lightWaveGradient)"
            strokeWidth="6"
            strokeLinecap="round"
            fill="none"
            opacity="0.6"
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