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
          {/* Simple extraction icon for small size */}
          <rect
            x="2"
            y="5"
            width="6"
            height="6"
            rx="1"
            stroke="#40E0D0"
            strokeWidth="1"
            fill="none"
          />
          <path
            d="M9 8 L12 8"
            stroke="#40E0D0"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <path
            d="M14 6 L16 8 L14 10"
            stroke="#4F7CFF"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <line x1="18" y1="7" x2="22" y2="7" stroke="#40E0D0" strokeWidth="1" strokeLinecap="round"/>
          <line x1="18" y1="9" x2="22" y2="9" stroke="#40E0D0" strokeWidth="1" strokeLinecap="round"/>
        </svg>
      </div>
    );
  }

  return (
    <button
      onClick={handleClick}
      className={`flex items-center space-x-5 transition-all duration-200 hover:opacity-80 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-xl ${className}`}
      aria-label="Extractly - Go to Dashboard"
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
            <linearGradient id="extraplGradient1" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#40E0D0" />
              <stop offset="100%" stopColor="#20B2AA" />
            </linearGradient>
            <linearGradient id="extraplGradient2" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#4F7CFF" />
              <stop offset="100%" stopColor="#40E0D0" />
            </linearGradient>
          </defs>
          
          {/* Rounded rectangle background */}
          <rect
            x="2"
            y="2"
            width="76"
            height="36"
            rx="8"
            ry="8"
            stroke="url(#extraplGradient1)"
            strokeWidth="3"
            fill="none"
          />
          
          {/* Document icon */}
          <rect
            x="15"
            y="12"
            width="20"
            height="16"
            rx="2"
            fill="url(#extraplGradient1)"
            opacity="0.8"
          />
          
          {/* Extraction arrows */}
          <path
            d="M40 15 L50 20 L40 25"
            stroke="url(#extraplGradient2)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          
          {/* Data lines */}
          <line x1="55" y1="16" x2="65" y2="16" stroke="url(#extraplGradient1)" strokeWidth="2" strokeLinecap="round"/>
          <line x1="55" y1="20" x2="65" y2="20" stroke="url(#extraplGradient1)" strokeWidth="2" strokeLinecap="round"/>
          <line x1="55" y1="24" x2="65" y2="24" stroke="url(#extraplGradient1)" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      </div>
      
      {/* App name */}
      {showText && (
        <div className="flex flex-col">
          <span className="text-3xl font-bold text-extrapl-gradient leading-tight tracking-tight">
            extrapl
          </span>
        </div>
      )}
    </button>
  );
}