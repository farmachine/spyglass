import React from 'react';
import { LucideProps } from 'lucide-react';

// Sea-themed icons for Flow Capture
export const WaveIcon = ({ className, ...props }: LucideProps) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M2 12c2-4 6-4 8 0s6 4 8 0 6-4 8 0" />
    <path d="M2 20c2-4 6-4 8 0s6 4 8 0 6-4 8 0" />
  </svg>
);

export const DropletIcon = ({ className, ...props }: LucideProps) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
  </svg>
);

export const FlowIcon = ({ className, ...props }: LucideProps) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M3 12h18" />
    <path d="M3 8c4 0 8-2 12 0" />
    <path d="M3 16c4 0 8 2 12 0" />
    <circle cx="19" cy="12" r="2" />
    <circle cx="5" cy="12" r="2" />
  </svg>
);

export const RippleIcon = ({ className, ...props }: LucideProps) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <circle cx="12" cy="12" r="3" />
    <circle cx="12" cy="12" r="7" strokeDasharray="2 2" opacity="0.6" />
    <circle cx="12" cy="12" r="11" strokeDasharray="3 3" opacity="0.3" />
  </svg>
);

export const StreamIcon = ({ className, ...props }: LucideProps) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M3 6c3 0 6 2 9 2s6-2 9-2" />
    <path d="M3 12c3 0 6 2 9 2s6-2 9-2" />
    <path d="M3 18c3 0 6 2 9 2s6-2 9-2" />
  </svg>
);

export const TideIcon = ({ className, ...props }: LucideProps) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M2 12c2-3 4-3 6 0s4 3 6 0 4-3 6 0 4 3 6 0" />
    <path d="M2 18c2-2 4-2 6 0s4 2 6 0 4-2 6 0 4 2 6 0" />
    <path d="M8 6c1-2 3-2 4 0s3 2 4 0" />
  </svg>
);

export const ShipIcon = ({ className, ...props }: LucideProps) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M2 20c0-1 2-3 8-3s8 2 8 3" />
    <path d="M4 18h16" />
    <path d="M6 14h12l-2-6H8l-2 6z" />
    <path d="M12 8V3" />
    <path d="M8 3h8" />
  </svg>
);

export const FishIcon = ({ className, ...props }: LucideProps) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M6.5 12c.94-3.46 4.94-6 8.5-6 3.56 0 6.06 2.54 7 6-.94 3.46-3.44 6-7 6s-7.56-2.54-8.5-6Z" />
    <path d="M18 12v.5" />
    <path d="M16 17.93a9.77 9.77 0 0 1 0-11.86" />
    <path d="M7 10.67C7 8 5.58 5.97 2.73 5.5c-1.13-.19-1.13 3.31 0 3.5C5.58 9.5 7 11.5 7 14.33" />
    <path d="M10.46 7.26C10.2 5.88 9.17 4.24 8 3H6l-1.17 2.34C4.25 6.24 3.38 8.06 2.73 10.5c-.19 1.13 3.31 1.13 3.5 0C6.63 8.84 8.57 6.89 10.46 7.26Z" />
  </svg>
);