import { useState, useMemo } from 'react';
import { BarChart2, Clock, Image, Smile, Search, Hash } from 'lucide-react';

interface SlashCommand {
  id: string;
  name: string;
  description: string;
  icon?: typeof BarChart2;
  options?: Array<{ name: string; description: string; required?: boolean }>;
  builtin?: boolean;
}

// Built-in slash commands (handled client-side)
export const BUILTIN_COMMANDS: SlashCommand[] = [
  {
    id: '__poll',
    name: 'poll',
    description: 'Create a quick poll in this channel',
    icon: BarChart2,
    builtin: true,
  },
  {
    id: '__remind',
    name: 'remind',
    description: 'Set a reminder. Usage: /remind [time] [message]',
    icon: Clock,
    options: [
      { name: 'time', description: 'When to remind (e.g. 2h, 30m, 1d)', required: true },
      { name: 'message', description: 'What to remind about', required: true },
    ],
    builtin: true,
  },
  {
    id: '__giphy',
    name: 'giphy',
    description: 'Search and send a GIF',
    icon: Image,
    builtin: true,
  },
  {
    id: '__shrug',
    name: 'shrug',
    description: 'Append a shrug to your message',
    icon: Smile,
    builtin: true,
  },
  {
    id: '__tableflip',
    name: 'tableflip',
    description: 'Flip a table',
    icon: Smile,
    builtin: true,
  },
  {
    id: '__unflip',
    name: 'unflip',
    description: 'Put the table back',
    icon: Smile,
    builtin: true,
  },
  {
    id: '__lenny',
    name: 'lenny',
    description: 'Send a Lenny face',
    icon: Smile,
    builtin: true,
  },
];

// Map of text replacement commands
export const TEXT_COMMANDS: Record<string, string> = {
  shrug: String.raw`\_(ツ)_/¯`,
  tableflip: '(╯°□°)╯︵ ┻━┻',
  unflip: '┬─┬ノ( º _ ºノ)',
  lenny: '( ͡° ͜ʖ ͡°)',
};

// Parse /remind time notation to milliseconds
export function parseRemindTime(input: string): number | null {
  const match = input.match(/^(\d+)(s|m|h|d)$/i);
  if (!match) return null;
  const num = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  const multipliers: Record<string, number> = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  return num * (multipliers[unit] || 0);
}

interface SlashCommandPaletteProps {
  search: string;
  serverCommands: SlashCommand[];
  selectedIndex: number;
  onSelect: (cmd: SlashCommand) => void;
}

export function SlashCommandPalette({ search, serverCommands, selectedIndex, onSelect }: SlashCommandPaletteProps) {
  const allCommands = useMemo(() => {
    return [...BUILTIN_COMMANDS, ...serverCommands];
  }, [serverCommands]);

  const filtered = useMemo(() => {
    if (!search) return allCommands.slice(0, 15);
    return allCommands
      .filter(c => c.name.toLowerCase().includes(search.toLowerCase()))
      .slice(0, 15);
  }, [allCommands, search]);

  if (filtered.length === 0) return null;

  return (
    <div style={{
      position: 'absolute', bottom: 'calc(100% + 12px)', left: '16px',
      background: 'var(--bg-elevated)', border: '1px solid var(--stroke)',
      borderRadius: '12px', padding: '8px', width: '360px',
      boxShadow: '0 10px 30px rgba(0,0,0,0.5)', zIndex: 10,
      display: 'flex', flexDirection: 'column', gap: '2px',
      maxHeight: '300px', overflowY: 'auto',
    }}>
      <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px', padding: '0 8px' }}>
        COMMANDS
      </div>
      {filtered.map((cmd, idx) => {
        const Icon = cmd.icon || Hash;
        return (
          <div
            key={cmd.id}
            onClick={() => onSelect(cmd)}
            style={{
              display: 'flex', alignItems: 'center', gap: '12px', padding: '8px',
              borderRadius: '6px', cursor: 'pointer',
              background: selectedIndex === idx ? 'var(--bg-tertiary)' : 'transparent',
            }}
          >
            <div style={{
              width: '28px', height: '28px', borderRadius: '6px',
              background: cmd.builtin ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: cmd.builtin ? '#000' : 'var(--text-muted)',
              fontWeight: 700, fontSize: '14px', flexShrink: 0,
            }}>
              {cmd.builtin ? <Icon size={14} /> : '/'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: '14px' }}>/{cmd.name}</div>
              {cmd.description && (
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {cmd.description}
                </div>
              )}
            </div>
            {cmd.builtin && (
              <span style={{
                fontSize: '10px', fontWeight: 600, padding: '2px 6px',
                borderRadius: '4px', background: 'rgba(99,102,241,0.12)',
                color: 'var(--accent-primary)', flexShrink: 0,
              }}>
                BUILT-IN
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
