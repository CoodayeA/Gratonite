import { Star } from 'lucide-react';
import { Outlet } from 'react-router-dom';

const AUTH_STARS = [
  { size: 32, color: '#f59e0b', top: '8%', right: '6%', left: undefined, duration: 2400 },
  { size: 22, color: '#8b5cf6', top: '18%', right: undefined, left: '4%', duration: 2800 },
  { size: 16, color: '#3b82f6', top: '30%', right: '12%', left: undefined, duration: 3200 },
  { size: 12, color: '#6c63ff', top: '42%', right: undefined, left: '10%', duration: 2600 },
  { size: 18, color: '#ef4444', top: '55%', right: '8%', left: undefined, duration: 3000 },
];

export default function AuthLayout() {
  return (
    <div className="auth-container">
      <div className="auth-pattern-bg" />
      <div className="auth-stars">
        {AUTH_STARS.map((star, i) => (
          <Star
            key={i}
            className="auth-star"
            size={star.size}
            fill={star.color}
            color={star.color}
            style={{
              top: star.top,
              ...(star.right ? { right: star.right } : { left: star.left }),
              animationDuration: `${star.duration}ms`,
            }}
          />
        ))}
      </div>
      <Outlet />
    </div>
  );
}
