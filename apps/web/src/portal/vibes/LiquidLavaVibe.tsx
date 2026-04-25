/**
 * LiquidLavaVibe — soft, organic, blob-radius cards over molten gradient
 * blobs. Warm and playful. Asymmetric border-radius makes nothing rigid.
 *
 * Identity-only hero: just the guild name. Member count, description, and
 * Customize live elsewhere.
 */
import type { PortalData } from '../Portal';

export default function LiquidLavaVibe(props: PortalData) {
  const { guildName, tasks, completionPercent, onTaskAction, showQuests = true } = props;

  return (
    <div className="vibe-lava-stage">
      <div className="vibe-lava-blob vibe-lava-blob-1" />
      <div className="vibe-lava-blob vibe-lava-blob-2" />
      <div className="vibe-lava-blob vibe-lava-blob-3" />

      <div className="vibe-lava-content">
        <div className="vibe-lava-hero">
          <h1 className="vibe-lava-title">
            <span>{guildName}</span>
          </h1>
        </div>

        {showQuests && tasks.length > 0 && (
        <div className="vibe-lava-quests-card">
          <div className="vibe-lava-quests-head">
            <h2>Warm-up</h2>
            <span className="vibe-lava-percent">{completionPercent}%</span>
          </div>
          <ul className="vibe-lava-quest-list">
            {tasks.map((t, i) => (
              <li
                key={t.id}
                className={`vibe-lava-quest vibe-lava-quest-${i % 3} ${t.completed ? 'is-done' : ''}`}
              >
                <button
                  className="vibe-lava-quest-check"
                  onClick={() => !t.completed && onTaskAction(t.id)}
                  aria-pressed={t.completed}
                  aria-label={`Mark ${t.label} as complete`}
                >
                  {t.completed ? '✓' : '○'}
                </button>
                <div>
                  <div className="vibe-lava-quest-label">{t.label}</div>
                  <div className="vibe-lava-quest-desc">{t.description}</div>
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
