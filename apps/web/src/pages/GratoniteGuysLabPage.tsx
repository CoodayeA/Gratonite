import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';
import { GratoniteGuysPackOpeningLab } from '@/components/gratoniteguys/GratoniteGuysPackOpeningLab';
import { GratoniteGuysNativeLab } from '@/components/gratoniteguys/GratoniteGuysNativeLab';
import manifest from '@/assets/gratoniteguys/element-run-03-manifest.json';
import mythicAliases from '@/assets/gratoniteguys/mythics-gif-aliases.json';

export function GratoniteGuysLabPage() {
  const user = useAuthStore((s) => s.user);
  const [params] = useSearchParams();
  const isAdmin = user?.username === 'ferdinand' || user?.username === 'coodaye';
  const devBypass = params.get('dev') === '1';

  if (!isAdmin && !devBypass) {
    return <Navigate to="/shop" replace />;
  }

  return (
    <div className="shop-page gg-lab-page">
      <header className="shop-hero">
        <div className="shop-eyebrow">GratoniteGuys</div>
        <h1 className="shop-title">Pack Opening Lab</h1>
        <p className="shop-subtitle">
          Prototype integration track for GratoniteGuys. This route is admin/dev gated while we convert the standalone
          prototype into production components.
        </p>
      </header>

      <section className="shop-card gg-lab-stats">
        <h2>Imported Asset Inventory (element-run-03)</h2>
        <div className="gg-lab-stats-grid">
          <div><span>Rarity PNGs</span><strong>{manifest.summary.rarityPngCount}</strong></div>
          <div><span>Mythic GIFs</span><strong>{manifest.summary.mythicGifCount}</strong></div>
          <div><span>Mythic MP4s</span><strong>{manifest.summary.mythicMp4Count}</strong></div>
          <div><span>GIF Alias IDs</span><strong>{mythicAliases.items.length}</strong></div>
        </div>
        <p className="gg-lab-note">
          Manifest and normalized aliases were generated from <code>element-run-03</code> for app-side use.
        </p>
        <Link className="shop-link" to="/shop">Back to Shop</Link>
      </section>

      <GratoniteGuysNativeLab />
      <GratoniteGuysPackOpeningLab />
    </div>
  );
}
