import { LoadingSpinner } from './LoadingSpinner';

export function LoadingScreen() {
  return (
    <div className="loading-screen">
      <div className="loading-screen-content">
        <img
          src="/gratonite-icon.png"
          alt="Gratonite"
          className="loading-screen-logo"
          width={64}
          height={64}
        />
        <LoadingSpinner size={28} />
      </div>
    </div>
  );
}
