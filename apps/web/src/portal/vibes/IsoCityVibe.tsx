/**
 * IsoCityVibe — isometric city grid where each task is a tower. Tower
 * height encodes progress, color encodes category index.
 *
 * Identity-only info panel: just the guild name. Member count, description,
 * stats, and Customize live elsewhere. Towers act as the visual progress
 * indicator on their own.
 */
import type { PortalData } from '../Portal';

export default function IsoCityVibe(props: PortalData) {
  const { guildName, tasks, onTaskAction, showQuests = true } = props;
  const cityTasks = showQuests ? tasks : [];

  return (
    <div className="vibe-iso-stage">
      <div className="vibe-iso-info">
        <h1 className="vibe-iso-title">{guildName}</h1>
      </div>

      <div className="vibe-iso-grid">
        <div className="vibe-iso-ground" />
        {cityTasks.map((t, i) => {
          const height = t.completed ? 110 : 60 + (i % 3) * 20;
          return (
            <button
              key={t.id}
              className={`vibe-iso-tower vibe-iso-tower-${i % 4} ${t.completed ? 'is-done' : ''}`}
              style={{
                ['--tower-h' as any]: `${height}px`,
                ['--tower-x' as any]: `${i % 2 === 0 ? -1 : 1}`,
                ['--tower-z' as any]: `${i}`,
                gridColumn: `${(i % 3) + 1}`,
                gridRow: `${Math.floor(i / 3) + 1}`,
              }}
              onClick={() => !t.completed && onTaskAction(t.id)}
              aria-label={t.label}
              title={`${t.label} — ${t.description}`}
            >
              <div className="vibe-iso-tower-top" />
              <div className="vibe-iso-tower-left" />
              <div className="vibe-iso-tower-right" />
              <div className="vibe-iso-tower-label">{t.label}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
