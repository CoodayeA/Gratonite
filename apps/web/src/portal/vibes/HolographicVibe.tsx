/**
 * HolographicVibe — perspective-tilted scene with a ringed planet and
 * floating quest cards that read as glass with iridescent edges.
 *
 * Identity-only hero: just the planet + guild name. Member count, description,
 * and CTAs live elsewhere (members panel, ThemePickerButton).
 */
import type { PortalData } from '../Portal';

export default function HolographicVibe(props: PortalData) {
  const { guildName, tasks, completionPercent, onTaskAction, showQuests = true } = props;

  return (
    <div className="vibe-holo-stage">
      <div className="vibe-holo-scene">
        <div className="vibe-holo-planet" aria-hidden>
          <div className="vibe-holo-planet-body">
            <span className="vibe-holo-initial">{guildName.charAt(0).toUpperCase()}</span>
          </div>
          <div className="vibe-holo-ring" />
          <div className="vibe-holo-ring vibe-holo-ring-2" />
        </div>

        <div className="vibe-holo-header-card">
          <h1 className="vibe-holo-title">{guildName}</h1>
        </div>

        {showQuests && tasks.length > 0 && (
        <div className="vibe-holo-quests">
          <div className="vibe-holo-quests-head">
            <h2>First Quests</h2>
            <span className="vibe-holo-progress">{completionPercent}%</span>
          </div>
          <div className="vibe-holo-progress-bar">
            <div className="vibe-holo-progress-fill" style={{ width: `${completionPercent}%` }} />
          </div>
          <ul className="vibe-holo-quest-list">
            {tasks.map((t) => (
              <li
                key={t.id}
                className={`vibe-holo-quest ${t.completed ? 'is-done' : ''}`}
              >
                <button
                  className="vibe-holo-quest-check"
                  onClick={() => !t.completed && onTaskAction(t.id)}
                  aria-pressed={t.completed}
                  aria-label={`Mark ${t.label} as complete`}
                >
                  {t.completed ? '✓' : ''}
                </button>
                <div className="vibe-holo-quest-text">
                  <div className="vibe-holo-quest-label">{t.label}</div>
                  <div className="vibe-holo-quest-desc">{t.description}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
        )}
      </div>
    </div>
  );
}
