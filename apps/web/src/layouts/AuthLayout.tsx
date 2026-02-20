import { Outlet } from 'react-router-dom';

export function AuthLayout() {
  return (
    <div className="auth-layout">
      <div className="auth-card">
        <div className="auth-brand">
          <img
            src="/gratonite-icon.png"
            alt="Gratonite"
            className="auth-logo"
            width={48}
            height={48}
          />
          <h1 className="auth-title">Gratonite</h1>
        </div>
        <Outlet />
      </div>
    </div>
  );
}
