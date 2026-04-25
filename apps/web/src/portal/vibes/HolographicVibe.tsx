/**
 * HolographicVibe — perspective-tilted scene with a ringed planet.
 *
 * Identity-only hero: planet + guild name centered. All setup/checklist UI
 * lives outside the vibe (see GuildOverview's portal-next-step-chip).
 */
import type { PortalData } from '../Portal';

export default function HolographicVibe(props: PortalData) {
  const { guildName } = props;

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
        <h1 className="vibe-holo-title">{guildName}</h1>
      </div>
    </div>
  );
}
