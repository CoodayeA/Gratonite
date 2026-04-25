/**
 * LiquidLavaVibe — soft, organic blobs over molten gradient. Identity-only
 * hero: just the guild name. Setup tasks live in the chip outside the vibe.
 */
import type { PortalData } from '../Portal';

export default function LiquidLavaVibe(props: PortalData) {
  const { guildName } = props;

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
      </div>
    </div>
  );
}
