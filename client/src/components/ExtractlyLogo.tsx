import { useLocation } from "wouter";

interface ExtractlyLogoProps {
  className?: string;
  showText?: boolean;
  size?: number;
}

export default function ExtractlyLogo({ className = "", showText = true, size = 60 }: ExtractlyLogoProps) {
  const [, setLocation] = useLocation();

  const handleClick = () => {
    setLocation("/");
  };

  // When used as an indent marker (size 16 or smaller), don't make it clickable
  const isIndentMarker = size <= 16;

  if (isIndentMarker) {
    return (
      <div className={`flex items-center ${className}`}>
        <svg
          width={size}
          height={size * 0.6}
          viewBox="0 0 24 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* First wave line */}
          <path
            d="M2 6 Q6 3 10 6 Q14 9 18 6 Q20 5 22 6"
            stroke="#6B9EFF"
            strokeWidth="1.5"
            strokeLinecap="round"
            fill="none"
          />
          
          {/* Second wave line */}
          <path
            d="M2 10 Q6 7 10 10 Q14 13 18 10 Q20 9 22 10"
            stroke="#7DD3FC"
            strokeWidth="1.5"
            strokeLinecap="round"
            fill="none"
          />
        </svg>
      </div>
    );
  }

  return (
    <button
      onClick={handleClick}
      className={`flex items-center space-x-5 transition-all duration-200 hover:opacity-80 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-xl ${className}`}
      aria-label="extrapl_ - Go to Dashboard"
    >
      {/* Logo SVG */}
      <div className="relative">
        <svg
          width={size}
          height={size}
          viewBox="0 0 80 40"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="drop-shadow-md"
        >
          <defs>
            <linearGradient id="waveGradient1" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#6B9EFF" />
              <stop offset="100%" stopColor="#7DD3FC" />
            </linearGradient>
            <linearGradient id="waveGradient2" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#7DD3FC" />
              <stop offset="100%" stopColor="#6B9EFF" />
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
          <span className="text-3xl font-bold text-primary leading-tight tracking-wide font-mono">
            extrapl_
          </span>
        </div>
      )}
    </button>
  );
}