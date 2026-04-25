/**
 * IsoCityVibe — isometric city grid where each task is a tower. Tower
 * height encodes progress, color encodes category index.
 */
import type { PortalData } from '../Portal';
import { Settings } from 'lucide-react';

export default function IsoCityVibe(props: PortalData) {
  const { guildName, guildDescription, memberCount, tasks, completionPercent, onTaskAction, onOpenSettings } = props;

  return (
    <div className="vibe-iso-stage">
      <div className="vibe-iso-info">
        <div className="vibe-iso-pill">DISTRICT · {memberCount} CITIZENS</div>
        <h1 className="vibe-iso-title">{guildName}</h1>
        <p className="vibe-iso-desc">
          {guildDescription ?? 'A city you build one block at a time.'}
        </p>
        <div className="vibe-iso-progress">
          <div className="vibe-iso-progress-track">
            <div className="vibe-iso-progress-fill" style={{ width: `${completionPercent}%` }} />
          </div>
          <span>{completionPercent}% built</span>
        </div>
        <button className="vibe-iso-btn" onClick={onOpenSettings}>
          <Settings size={14} /> Customize district
        </button>
      </div>

      <div className="vibe-iso-grid">
        <div className="vibe-iso-ground" />
        {tasks.map((t, i) => {
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
