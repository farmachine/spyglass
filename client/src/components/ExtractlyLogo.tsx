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
          viewBox="0 0 40 40"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="drop-shadow-md"
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
          
          {/* Surfboard-like shape */}
          <ellipse
            cx="20"
            cy="20"
            rx="16"
            ry="8"
            fill="url(#logoGradient)"
            stroke="#0284C7"
            strokeWidth="1"
          />
          
          {/* Surfboard fin detail */}
          <path
            d="M20 12 Q22 14 20 16 Q18 14 20 12Z"
            fill="url(#logoGradient)"
            stroke="#0284C7"
            strokeWidth="0.5"
          />
          
          {/* Wave lines flowing across the board */}
          <g stroke="url(#flowGradient)" strokeWidth="2" strokeLinecap="round" fill="none">
            {/* Main wave flow */}
            <path d="M8 20 Q14 18 20 20 Q26 22 32 20" strokeWidth="2.5" />
            
            {/* Secondary wave flows */}
            <path d="M10 17 Q16 16 20 17 Q24 18 30 17" strokeWidth="1.5" opacity="0.8" />
            <path d="M10 23 Q16 24 20 23 Q24 22 30 23" strokeWidth="1.5" opacity="0.8" />
            
            {/* Data flow points */}
            <circle cx="14" cy="19" r="1.2" fill="white" opacity="0.9" />
            <circle cx="20" cy="20" r="1.5" fill="white" />
            <circle cx="26" cy="21" r="1.2" fill="white" opacity="0.9" />
          </g>
          
          {/* Stylized 'E' for Extract */}
          <g fill="white" opacity="0.5">
            <rect x="17" y="16" width="6" height="1" rx="0.5" />
            <rect x="17" y="19" width="4" height="1" rx="0.5" />
            <rect x="17" y="22" width="6" height="1" rx="0.5" />
            <rect x="17" y="16" width="1" height="7" rx="0.5" />
          </g>
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