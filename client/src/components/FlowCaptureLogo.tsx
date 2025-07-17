import { useLocation } from "wouter";

interface FlowCaptureLogoProps {
  className?: string;
  showText?: boolean;
}

export default function FlowCaptureLogo({ className = "", showText = true }: FlowCaptureLogoProps) {
  const [, setLocation] = useLocation();

  const handleClick = () => {
    setLocation("/");
  };

  return (
    <button
      onClick={handleClick}
      className={`flex items-center space-x-3 transition-opacity hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-lg p-1 ${className}`}
      aria-label="Flow Capture - Go to Dashboard"
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
          {/* Background circle with gradient */}
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
          
          {/* Main circle background */}
          <circle
            cx="20"
            cy="20"
            r="18"
            fill="url(#logoGradient)"
            stroke="#0284C7"
            strokeWidth="1"
          />
          
          {/* Flow lines representing data capture */}
          <g stroke="url(#flowGradient)" strokeWidth="2" strokeLinecap="round" fill="none">
            {/* Main flow line */}
            <path d="M8 20 Q15 15 20 20 Q25 25 32 20" strokeWidth="2.5" />
            
            {/* Secondary flow lines */}
            <path d="M8 14 Q15 12 20 14 Q25 16 32 14" strokeWidth="1.5" opacity="0.8" />
            <path d="M8 26 Q15 28 20 26 Q25 24 32 26" strokeWidth="1.5" opacity="0.8" />
            
            {/* Data points/nodes */}
            <circle cx="12" cy="18" r="1.5" fill="white" opacity="0.9" />
            <circle cx="20" cy="20" r="2" fill="white" />
            <circle cx="28" cy="22" r="1.5" fill="white" opacity="0.9" />
          </g>
          
          {/* Capture symbol - subtle document icon */}
          <g fill="white" opacity="0.3">
            <rect x="15" y="10" width="10" height="2" rx="1" />
            <rect x="15" y="13" width="8" height="1" rx="0.5" />
            <rect x="15" y="15" width="6" height="1" rx="0.5" />
          </g>
        </svg>
      </div>
      
      {/* App name */}
      {showText && (
        <div className="flex flex-col">
          <span className="text-xl font-bold text-foreground leading-tight">
            Flow Capture
          </span>
          <span className="text-xs text-muted-foreground leading-tight">
            Data Extraction Platform
          </span>
        </div>
      )}
    </button>
  );
}