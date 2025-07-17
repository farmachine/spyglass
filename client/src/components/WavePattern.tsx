interface WavePatternProps {
  className?: string;
  variant?: 'primary' | 'light' | 'accent';
  size?: 'sm' | 'md' | 'lg';
}

export default function WavePattern({ className = "", variant = 'primary', size = 'md' }: WavePatternProps) {
  const sizeClasses = {
    sm: 'w-8 h-6',
    md: 'w-12 h-8', 
    lg: 'w-16 h-10'
  };

  const gradientId = `waveGradient-${variant}-${Math.random().toString(36).substr(2, 9)}`;

  const getGradientColors = () => {
    switch (variant) {
      case 'light':
        return { start: '#87CEEB', end: '#B0E0E6' };
      case 'accent':
        return { start: '#0EA5E9', end: '#0284C7' };
      default:
        return { start: '#1E90FF', end: '#0284C7' };
    }
  };

  const colors = getGradientColors();

  return (
    <svg
      className={`${sizeClasses[size]} ${className}`}
      viewBox="0 0 48 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={colors.start} />
          <stop offset="100%" stopColor={colors.end} />
        </linearGradient>
      </defs>
      
      <path
        d="M4 20 Q12 8 20 16 Q28 24 36 12 Q40 8 44 12"
        stroke={`url(#${gradientId})`}
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />
      
      <path
        d="M2 24 Q10 12 18 20 Q26 28 34 16 Q38 12 42 16"
        stroke={`url(#${gradientId})`}
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
        opacity="0.6"
      />
    </svg>
  );
}