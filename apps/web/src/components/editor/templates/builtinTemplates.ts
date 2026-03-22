/**
 * builtinTemplates.ts — 10 built-in document templates in BlockNote native format.
 */
import type { Block } from '@blocknote/core';

export interface BuiltinTemplate {
  key: string;
  name: string;
  description: string;
  /** Lucide icon name (lowercase, hyphenated). */
  icon: string;
  blocks: Block[];
}

// Helper: paragraph
const p = (text: string): Block => ({
  id: crypto.randomUUID(),
  type: 'paragraph' as const,
  content: text ? [{ type: 'text' as const, text, styles: {} }] : [],
  props: {},
  children: [],
} as any);

// Helper: heading
const h = (text: string, level: 1 | 2 | 3): Block => ({
  id: crypto.randomUUID(),
  type: 'heading' as const,
  content: [{ type: 'text' as const, text, styles: {} }],
  props: { level },
  children: [],
} as any);

// Helper: bullet list item
const bullet = (text: string): Block => ({
  id: crypto.randomUUID(),
  type: 'bulletListItem' as const,
  content: [{ type: 'text' as const, text, styles: {} }],
  props: {},
  children: [],
} as any);

// Helper: numbered list item
const num = (text: string): Block => ({
  id: crypto.randomUUID(),
  type: 'numberedListItem' as const,
  content: [{ type: 'text' as const, text, styles: {} }],
  props: {},
  children: [],
} as any);

// Helper: checklist item
const check = (text: string, checked = false): Block => ({
  id: crypto.randomUUID(),
  type: 'checkListItem' as const,
  content: [{ type: 'text' as const, text, styles: {} }],
  props: { checked },
  children: [],
} as any);

// Helper: table
const table = (headers: string[], rows: string[][]): Block => ({
  id: crypto.randomUUID(),
  type: 'table' as const,
  content: {
    type: 'tableContent',
    rows: [
      { cells: headers.map(h => [{ type: 'text' as const, text: h, styles: {} }]) },
      ...rows.map(row => ({ cells: row.map(cell => [{ type: 'text' as const, text: cell, styles: {} }]) })),
    ],
  },
  props: {},
  children: [],
} as any);

export const BUILTIN_TEMPLATES: BuiltinTemplate[] = [
  {
    key: 'resources',
    name: 'Resources',
    description: 'Links, guides, and helpful resources',
    icon: 'library',
    blocks: [
      h('Resources', 1),
      p('A curated collection of useful links and guides for this server.'),
      h('Getting Started', 2),
      bullet('Link or resource here'),
      bullet('Another resource'),
      h('Guides & Tutorials', 2),
      bullet('Guide link here'),
      h('Tools & Downloads', 2),
      bullet('Tool link here'),
    ],
  },
  {
    key: 'wiki',
    name: 'Wiki',
    description: 'Knowledge base with table of contents',
    icon: 'book-open',
    blocks: [
      h('Wiki', 1),
      h('Overview', 2),
      p('Describe the topic here...'),
      h('Details', 2),
      p('More detailed information...'),
      h('FAQ', 2),
      p('Common questions and answers...'),
    ],
  },
  {
    key: 'rules-info',
    name: 'Rules & Info',
    description: 'Server rules and important info',
    icon: 'shield-check',
    blocks: [
      h('Server Rules', 1),
      p('Please read and follow these rules to keep our community safe and fun!'),
      num('Be respectful to all members'),
      num('No spam or self-promotion'),
      num('No NSFW content'),
      num('No harassment or hate speech'),
      num('Follow Discord TOS'),
      p('Breaking rules may result in warnings, mutes, or bans.'),
    ],
  },
  {
    key: 'roster',
    name: 'Roster / Team Sheet',
    description: 'Team members, roles, availability',
    icon: 'users',
    blocks: [
      h('Team Roster', 1),
      p('Current team composition and availability.'),
      table(['Player', 'Role', 'Main', 'Available'], [['', '', '', ''], ['', '', '', ''], ['', '', '', '']]),
      h('Substitutes', 2),
      table(['Player', 'Role', 'Notes'], [['', '', ''], ['', '', '']]),
    ],
  },
  {
    key: 'event-guide',
    name: 'Event Guide',
    description: 'Plan and document events',
    icon: 'calendar-days',
    blocks: [
      h('Event Name', 1),
      p('Date: TBD | Time: TBD | Location: TBD'),
      h('Description', 2),
      p('What is this event about?'),
      h('Schedule', 2),
      num('Phase 1: ...'),
      num('Phase 2: ...'),
      h('Rules', 2),
      bullet('Rule here'),
      h('Prizes', 2),
      p('What do winners get?'),
    ],
  },
  {
    key: 'changelog',
    name: 'Changelog / Updates',
    description: 'Track server changes',
    icon: 'scroll-text',
    blocks: [
      h('Changelog', 1),
      p('Track all server changes and updates here.'),
      h('Latest Update', 2),
      p('Date: '),
      check('Change 1', true),
      check('Change 2', false),
      h('Previous Updates', 2),
      p('Older updates here...'),
    ],
  },
  {
    key: 'faq',
    name: 'FAQ',
    description: 'Frequently asked questions',
    icon: 'help-circle',
    blocks: [
      h('Frequently Asked Questions', 1),
      p('Find answers to common questions below.'),
      h('How do I get started?', 3),
      p('Answer here...'),
      h('What are the rules?', 3),
      p('Answer here...'),
      h('How do I get a role?', 3),
      p('Answer here...'),
      h('Who are the moderators?', 3),
      p('Answer here...'),
    ],
  },
  {
    key: 'lore',
    name: 'Lore / World Building',
    description: 'RP world-building',
    icon: 'map',
    blocks: [
      h('World Lore', 1),
      h('History', 2),
      p('The ancient history of this world...'),
      h('Factions', 2),
      p('The major powers and groups...'),
      h('Locations', 2),
      p('Key places in the world...'),
      h('Characters', 2),
      p('Important NPCs and figures...'),
    ],
  },
  {
    key: 'raid-guide',
    name: 'Raid / Strategy Guide',
    description: 'Boss strategies, team comp, loot tables',
    icon: 'swords',
    blocks: [
      h('Raid Guide: Boss Name', 1),
      p('Difficulty: Hard | Min Level: 60 | Group Size: 8'),
      h('Team Composition', 2),
      table(['Role', 'Class', 'Notes'], [['Tank', '', ''], ['Healer', '', ''], ['DPS', '', '']]),
      h('Phase 1', 2),
      p('Strategy for phase 1...'),
      h('Phase 2', 2),
      p('Strategy for phase 2...'),
      h('Loot Table', 2),
      table(['Item', 'Drop Rate', 'Notes'], [['', '', ''], ['', '', '']]),
    ],
  },
  {
    key: 'blank',
    name: 'Blank Document',
    description: 'Start from scratch',
    icon: 'file-text',
    blocks: [],
  },
];
