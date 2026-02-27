import { useNavigate } from 'react-router-dom';

export function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#2c2c3e', color: '#e8e4e0', gap: 16 }}>
      <div style={{ fontSize: 96, fontWeight: 900, color: '#d4af37', lineHeight: 1 }}>404</div>
      <div style={{ fontSize: 20, fontWeight: 600 }}>This page doesn't exist</div>
      <div style={{ fontSize: 14, color: '#a8a4b8' }}>The page you're looking for has moved or never existed.</div>
      <button onClick={() => navigate('/')} style={{ marginTop: 8, padding: '10px 24px', background: '#d4af37', color: '#1a1a2e', border: 'none', borderRadius: 'var(--radius-md)', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>Go Home</button>
    </div>
  );
}
