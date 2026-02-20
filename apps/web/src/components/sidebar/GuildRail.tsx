import { NavLink } from 'react-router-dom';
import { useGuildsStore } from '@/stores/guilds.store';
import { useGuilds } from '@/hooks/useGuilds';
import { GuildIcon } from '@/components/ui/GuildIcon';

export function GuildRail() {
  // Triggers data fetch + syncs to store
  useGuilds();

  const guilds = useGuildsStore((s) => s.guilds);
  const guildOrder = useGuildsStore((s) => s.guildOrder);

  return (
    <nav className="guild-rail">
      {/* Home button */}
      <NavLink to="/" className="guild-rail-item guild-rail-home" end>
        <div className="guild-rail-icon guild-rail-home-icon">
          <img src="/gratonite-icon.png" alt="Gratonite" width={28} height={28} />
        </div>
      </NavLink>

      <div className="guild-rail-divider" />

      {/* Guild icons */}
      <div className="guild-rail-list">
        {guildOrder.map((id) => {
          const guild = guilds.get(id);
          if (!guild) return null;
          return (
            <NavLink
              key={id}
              to={`/guild/${id}`}
              className={({ isActive }) =>
                `guild-rail-item ${isActive ? 'guild-rail-item-active' : ''}`
              }
            >
              <GuildIcon
                name={guild.name}
                iconHash={guild.iconHash}
                guildId={guild.id}
                size={48}
              />
            </NavLink>
          );
        })}
      </div>

      {/* Add server button */}
      <button
        className="guild-rail-item guild-rail-add"
        onClick={() => {
          // TODO: Open create guild modal
        }}
      >
        <div className="guild-rail-icon guild-rail-add-icon">+</div>
      </button>
    </nav>
  );
}
