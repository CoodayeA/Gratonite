import { useGuildsStore } from '@/stores/guilds.store';

export function HomePage() {
  const guildCount = useGuildsStore((s) => s.guildOrder.length);

  return (
    <div className="home-page">
      <div className="home-content">
        <img
          src="/gratonite-mascot.png"
          alt="Gratonite"
          className="home-mascot"
          width={160}
          height={160}
        />
        <h1 className="home-title">Welcome to Gratonite</h1>
        <p className="home-subtitle">
          {guildCount > 0
            ? 'Select a server from the sidebar to get started.'
            : 'Join or create a server to start chatting.'}
        </p>
      </div>
    </div>
  );
}
