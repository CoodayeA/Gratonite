/**
 * SolarSystemVibe — guild = sun, tasks = orbiting planets. Click a planet
 * to act on its quest. Done planets glow brighter; the sun pulses.
 *
 * Identity-only info panel: just the guild name. Member count, description,
 * stats, and Customize live elsewhere.
 */
import type { PortalData } from '../Portal';

export default function SolarSystemVibe(props: PortalData) {
  const { guildName, tasks, onTaskAction, showQuests = true } = props;
  const orbitingTasks = showQuests ? tasks : [];

  return (
    <div className="vibe-solar-stage">
      <div className="vibe-solar-info">
        <h1 className="vibe-solar-title">{guildName}</h1>
      </div>

      <div className="vibe-solar-system" aria-hidden={false}>
        <div className="vibe-solar-sun">
          <span className="vibe-solar-sun-letter">{guildName.charAt(0).toUpperCase()}</span>
          <div className="vibe-solar-sun-glow" />
        </div>
        {orbitingTasks.map((t, i) => {
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
