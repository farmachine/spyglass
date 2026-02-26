import { useRive } from '@rive-app/react-canvas';

interface RiveLoaderProps {
  width?: number;
  height?: number;
  className?: string;
  message?: string;
}

export default function RiveLoader({ width = 120, height = 120, className = '', message }: RiveLoaderProps) {
  const { RiveComponent } = useRive({
    src: '/chaos_to_order.riv',
    autoplay: true,
  });

  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <div style={{ width, height }}>
        <RiveComponent />
      </div>
      {message && <p className="text-sm text-gray-500 mt-2">{message}</p>}
    </div>
  );
}
