/**
 * SolarSystemVibe — guild = sun, tasks = orbiting planets. Click a planet
 * to act on its quest. Done planets glow brighter; the sun pulses.
 */
import type { PortalData } from '../Portal';
import { Settings } from 'lucide-react';

export default function SolarSystemVibe(props: PortalData) {
  const { guildName, guildDescription, memberCount, tasks, completionPercent, onTaskAction, onOpenSettings } = props;

  return (
    <div className="vibe-solar-stage">
      <div className="vibe-solar-info">
        <div className="vibe-solar-pill">SYSTEM · {memberCount} MEMBERS</div>
        <h1 className="vibe-solar-title">{guildName}</h1>
        <p className="vibe-solar-desc">
          {guildDescription ?? 'A solar system of conversations and quests.'}
        </p>
        <div className="vibe-solar-stats">
          <div className="vibe-solar-stat">
            <div className="vibe-solar-stat-num">{completionPercent}%</div>
            <div className="vibe-solar-stat-label">setup</div>
          </div>
          <div className="vibe-solar-stat">
            <div className="vibe-solar-stat-num">{tasks.filter((t) => !t.completed).length}</div>
            <div className="vibe-solar-stat-label">quests</div>
          </div>
        </div>
        <button className="vibe-solar-btn" onClick={onOpenSettings}>
          <Settings size={14} /> Customize
        </button>
      </div>

      <div className="vibe-solar-system" aria-hidden={false}>
        <div className="vibe-solar-sun">
          <span className="vibe-solar-sun-letter">{guildName.charAt(0).toUpperCase()}</span>
          <div className="vibe-solar-sun-glow" />
        </div>
        {tasks.map((t, i) => {
          const orbit = 110 + i * 70;
          const duration = 22 + i * 7;
          const phase = (i * 90) % 360;
          return (
            <div
              key={t.id}
              className="vibe-solar-orbit"
              style={{
                width: `${orbit * 2}px`,
                height: `${orbit * 2}px`,
                animationDuration: `calc(${duration}s / max(var(--pt-anim-mult), 0.0001))`,
                animationDelay: `-${phase / (360 / duration)}s`,
              }}
            >
              <button
                className={`vibe-solar-planet ${t.completed ? 'is-done' : ''}`}
                style={{ ['--orbit-r' as any]: `${orbit}px` }}
                onClick={() => !t.completed && onTaskAction(t.id)}
                aria-label={`${t.label} — ${t.completed ? 'done' : 'pending'}`}
                title={t.label}
              >
                <span className="vibe-solar-planet-label">{t.label}</span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
