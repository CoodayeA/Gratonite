/**
 * builtinTemplates.ts — 10 built-in document templates (gaming/social focused).
 */
import type { Block } from '@gratonite/types/api';
import { createBlock, generateBlockId, plainText } from '../utils/blockHelpers';
import { generatePositions } from '../utils/fractionalIndex';

export interface BuiltinTemplate {
  key: string;
  name: string;
  description: string;
  icon: string;
  blocks: Block[];
}

function makeBlocks(specs: Array<{ type: any; content: any }>): Block[] {
  const positions = generatePositions(specs.length);
  return specs.map((s, i) => ({
    id: generateBlockId(),
    type: s.type,
    content: s.content,
    position: positions[i],
  }));
}

export const BUILTIN_TEMPLATES: BuiltinTemplate[] = [
  {
    key: 'resources',
    name: 'Resources',
    description: 'Links, guides, and helpful resources',
    icon: '\u{1F4DA}',
    blocks: makeBlocks([
      { type: 'heading', content: { richText: plainText('Resources'), level: 1 } },
      { type: 'text', content: { richText: plainText('A curated collection of useful links and guides for this server.') } },
      { type: 'divider', content: {} },
      { type: 'heading', content: { richText: plainText('Getting Started'), level: 2 } },
      { type: 'bulleted_list', content: { richText: plainText('Link or resource here') } },
      { type: 'bulleted_list', content: { richText: plainText('Another resource') } },
      { type: 'heading', content: { richText: plainText('Guides & Tutorials'), level: 2 } },
      { type: 'bulleted_list', content: { richText: plainText('Guide link here') } },
      { type: 'heading', content: { richText: plainText('Tools & Downloads'), level: 2 } },
      { type: 'bulleted_list', content: { richText: plainText('Tool link here') } },
    ]),
  },
  {
    key: 'wiki',
    name: 'Wiki',
    description: 'Knowledge base with table of contents',
    icon: '\u{1F4D6}',
    blocks: makeBlocks([
      { type: 'heading', content: { richText: plainText('Wiki'), level: 1 } },
      { type: 'table_of_contents', content: { maxDepth: 3 } },
      { type: 'divider', content: {} },
      { type: 'heading', content: { richText: plainText('Overview'), level: 2 } },
      { type: 'text', content: { richText: plainText('Describe the topic here...') } },
      { type: 'heading', content: { richText: plainText('Details'), level: 2 } },
      { type: 'text', content: { richText: plainText('More detailed information...') } },
      { type: 'heading', content: { richText: plainText('FAQ'), level: 2 } },
      { type: 'toggle', content: { richText: plainText('Question 1?'), children: [] } },
      { type: 'toggle', content: { richText: plainText('Question 2?'), children: [] } },
    ]),
  },
  {
    key: 'rules-info',
    name: 'Rules & Info',
    description: 'Server rules and important info',
    icon: '\u{1F4DC}',
    blocks: makeBlocks([
      { type: 'heading', content: { richText: plainText('Server Rules'), level: 1 } },
      { type: 'callout', content: { richText: plainText('Please read and follow these rules to keep our community safe and fun!'), emoji: '\u{26A0}\u{FE0F}' } },
      { type: 'divider', content: {} },
      { type: 'numbered_list', content: { richText: plainText('Be respectful to all members') } },
      { type: 'numbered_list', content: { richText: plainText('No spam or self-promotion') } },
      { type: 'numbered_list', content: { richText: plainText('No NSFW content') } },
      { type: 'numbered_list', content: { richText: plainText('No harassment or hate speech') } },
      { type: 'numbered_list', content: { richText: plainText('Follow Discord TOS') } },
      { type: 'divider', content: {} },
      { type: 'callout', content: { richText: plainText('Breaking rules may result in warnings, mutes, or bans.'), emoji: '\u{1F6A8}' } },
    ]),
  },
  {
    key: 'roster',
    name: 'Roster / Team Sheet',
    description: 'Team members, roles, availability',
    icon: '\u{1F3AE}',
    blocks: makeBlocks([
      { type: 'heading', content: { richText: plainText('Team Roster'), level: 1 } },
      { type: 'text', content: { richText: plainText('Current team composition and availability.') } },
      { type: 'divider', content: {} },
      { type: 'table', content: { headers: ['Player', 'Role', 'Main', 'Available'], rows: [['', '', '', ''], ['', '', '', ''], ['', '', '', '']] } },
      { type: 'divider', content: {} },
      { type: 'heading', content: { richText: plainText('Substitutes'), level: 2 } },
      { type: 'table', content: { headers: ['Player', 'Role', 'Notes'], rows: [['', '', ''], ['', '', '']] } },
    ]),
  },
  {
    key: 'event-guide',
    name: 'Event Guide',
    description: 'Plan and document events',
    icon: '\u{1F389}',
    blocks: makeBlocks([
      { type: 'heading', content: { richText: plainText('Event Name'), level: 1 } },
      { type: 'callout', content: { richText: plainText('Date: TBD | Time: TBD | Location: TBD'), emoji: '\u{1F4C5}' } },
      { type: 'divider', content: {} },
      { type: 'heading', content: { richText: plainText('Description'), level: 2 } },
      { type: 'text', content: { richText: plainText('What is this event about?') } },
      { type: 'heading', content: { richText: plainText('Schedule'), level: 2 } },
      { type: 'numbered_list', content: { richText: plainText('Phase 1: ...') } },
      { type: 'numbered_list', content: { richText: plainText('Phase 2: ...') } },
      { type: 'heading', content: { richText: plainText('Rules'), level: 2 } },
      { type: 'bulleted_list', content: { richText: plainText('Rule here') } },
      { type: 'heading', content: { richText: plainText('Prizes'), level: 2 } },
      { type: 'text', content: { richText: plainText('What do winners get?') } },
    ]),
  },
  {
    key: 'changelog',
    name: 'Changelog / Updates',
    description: 'Track server changes',
    icon: '\u{1F4DD}',
    blocks: makeBlocks([
      { type: 'heading', content: { richText: plainText('Changelog'), level: 1 } },
      { type: 'text', content: { richText: plainText('Track all server changes and updates here.') } },
      { type: 'divider', content: {} },
      { type: 'heading', content: { richText: plainText('Latest Update'), level: 2 } },
      { type: 'text', content: { richText: plainText('Date: ') } },
      { type: 'checklist', content: { richText: plainText('Change 1'), checked: true } },
      { type: 'checklist', content: { richText: plainText('Change 2'), checked: false } },
      { type: 'divider', content: {} },
      { type: 'heading', content: { richText: plainText('Previous Updates'), level: 2 } },
      { type: 'toggle', content: { richText: plainText('Update v1.0'), children: [] } },
    ]),
  },
  {
    key: 'faq',
    name: 'FAQ',
    description: 'Toggle-based Q&A',
    icon: '\u{2753}',
    blocks: makeBlocks([
      { type: 'heading', content: { richText: plainText('Frequently Asked Questions'), level: 1 } },
      { type: 'text', content: { richText: plainText('Find answers to common questions below.') } },
      { type: 'divider', content: {} },
      { type: 'toggle', content: { richText: plainText('How do I get started?'), children: [] } },
      { type: 'toggle', content: { richText: plainText('What are the rules?'), children: [] } },
      { type: 'toggle', content: { richText: plainText('How do I get a role?'), children: [] } },
      { type: 'toggle', content: { richText: plainText('Who are the moderators?'), children: [] } },
      { type: 'toggle', content: { richText: plainText('How do I report an issue?'), children: [] } },
    ]),
  },
  {
    key: 'lore',
    name: 'Lore / World Building',
    description: 'RP world-building',
    icon: '\u{1F5FA}\u{FE0F}',
    blocks: makeBlocks([
      { type: 'heading', content: { richText: plainText('World Lore'), level: 1 } },
      { type: 'table_of_contents', content: { maxDepth: 3 } },
      { type: 'divider', content: {} },
      { type: 'heading', content: { richText: plainText('History'), level: 2 } },
      { type: 'text', content: { richText: plainText('The ancient history of this world...') } },
      { type: 'heading', content: { richText: plainText('Factions'), level: 2 } },
      { type: 'text', content: { richText: plainText('The major powers and groups...') } },
      { type: 'heading', content: { richText: plainText('Locations'), level: 2 } },
      { type: 'text', content: { richText: plainText('Key places in the world...') } },
      { type: 'heading', content: { richText: plainText('Characters'), level: 2 } },
      { type: 'text', content: { richText: plainText('Important NPCs and figures...') } },
    ]),
  },
  {
    key: 'raid-guide',
    name: 'Raid / Strategy Guide',
    description: 'Boss strategies, team comp, loot tables',
    icon: '\u{2694}\u{FE0F}',
    blocks: makeBlocks([
      { type: 'heading', content: { richText: plainText('Raid Guide: Boss Name'), level: 1 } },
      { type: 'callout', content: { richText: plainText('Difficulty: Hard | Min Level: 60 | Group Size: 8'), emoji: '\u{2694}\u{FE0F}' } },
      { type: 'divider', content: {} },
      { type: 'heading', content: { richText: plainText('Team Composition'), level: 2 } },
      { type: 'table', content: { headers: ['Role', 'Class', 'Notes'], rows: [['Tank', '', ''], ['Healer', '', ''], ['DPS', '', '']] } },
      { type: 'heading', content: { richText: plainText('Phase 1'), level: 2 } },
      { type: 'text', content: { richText: plainText('Strategy for phase 1...') } },
      { type: 'heading', content: { richText: plainText('Phase 2'), level: 2 } },
      { type: 'text', content: { richText: plainText('Strategy for phase 2...') } },
      { type: 'heading', content: { richText: plainText('Loot Table'), level: 2 } },
      { type: 'table', content: { headers: ['Item', 'Drop Rate', 'Notes'], rows: [['', '', ''], ['', '', '']] } },
    ]),
  },
  {
    key: 'blank',
    name: 'Blank Document',
    description: 'Start from scratch',
    icon: '\u{1F4C4}',
    blocks: makeBlocks([
      { type: 'text', content: { richText: [{ text: '' }] } },
    ]),
  },
];
