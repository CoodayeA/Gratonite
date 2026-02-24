import { NavLink, useLocation } from 'react-router-dom';

const tabs = [
  {
    label: 'Friends',
    to: '/friends',
    icon: (
      <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M6 7.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM1.5 13.5c0-2.485 2.015-4.5 4.5-4.5s4.5 2.015 4.5 4.5"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M10.5 4a2.5 2.5 0 0 1 0 4M12 9a4.5 4.5 0 0 1 2.5 4.5"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    label: 'Shop',
    to: '/shop',
    icon: (
      <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M2.5 4.5 1 2h14l-1.5 2.5M2.5 4.5v8.5a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1V4.5M2.5 4.5h11M5.5 7.5a2.5 2.5 0 0 0 5 0"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    label: '\u20B2 Gratonite',
    to: '/gratonite',
    icon: (
      <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.4" />
        <path
          d="M9.5 6.2A2.4 2.4 0 0 0 8 5.5C6.62 5.5 5.5 6.62 5.5 8s1.12 2.5 2.5 2.5c.58 0 1.11-.2 1.5-.52V8H8"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    label: 'Leaderboard',
    to: '/leaderboard',
    icon: (
      <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M4.5 14V8.5h-2a.5.5 0 0 0-.5.5v4.5a.5.5 0 0 0 .5.5h2ZM9.25 14V5.5a.5.5 0 0 0-.5-.5h-1.5a.5.5 0 0 0-.5.5V14h2.5ZM14 14V2.5a.5.5 0 0 0-.5-.5h-1.5a.5.5 0 0 0-.5.5V14H14Z"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
] as const;

export function DmTabBar() {
  const location = useLocation();

  // When on /dm/:channelId, no tab should be highlighted
  const isDmChannel = location.pathname.startsWith('/dm/');

  return (
    <nav className="dm-tab-bar">
      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          className={({ isActive }) =>
            `dm-tab${isActive && !isDmChannel ? ' active' : ''}`
          }
        >
          {tab.icon}
          {tab.label}
        </NavLink>
      ))}
    </nav>
  );
}
