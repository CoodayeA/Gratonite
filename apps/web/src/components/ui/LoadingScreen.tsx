import { LoadingSpinner } from './LoadingSpinner';

export function LoadingScreen() {
  return (
    <div className="loading-screen">
      <div className="loading-screen-content">
        <img
          src="/gratonite-icon.png"
          alt="Gratonite"
          className="loading-screen-logo"
          width={120}
          height={120}
        />
        <LoadingSpinner size={28} />
      </div>
    </div>
  );
}
