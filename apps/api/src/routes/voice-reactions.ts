import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';

export const voiceReactionsRouter = Router();

interface VoiceReactionPreset {
  id: string;
  name: string;
  emoji: string;
  soundKey: string;
}

const PRESETS: VoiceReactionPreset[] = [
  { id: 'applause', name: 'Applause', emoji: '\u{1F44F}', soundKey: 'applause' },
  { id: 'laugh', name: 'Laugh', emoji: '\u{1F602}', soundKey: 'laugh' },
  { id: 'airhorn', name: 'Airhorn', emoji: '\u{1F4E2}', soundKey: 'airhorn' },
  { id: 'drum_roll', name: 'Drum Roll', emoji: '\u{1F941}', soundKey: 'drum_roll' },
  { id: 'sad_trombone', name: 'Sad Trombone', emoji: '\u{1F3BA}', soundKey: 'sad_trombone' },
  { id: 'tada', name: 'Tada', emoji: '\u{1F389}', soundKey: 'tada' },
  { id: 'crickets', name: 'Crickets', emoji: '\u{1F997}', soundKey: 'crickets' },
  { id: 'wow', name: 'Wow', emoji: '\u{1F62E}', soundKey: 'wow' },
  { id: 'boo', name: 'Boo', emoji: '\u{1F47B}', soundKey: 'boo' },
  { id: 'rimshot', name: 'Rimshot', emoji: '\u{1F3B6}', soundKey: 'rimshot' },
];

// GET /voice-reactions/presets — returns list of preset voice reactions
voiceReactionsRouter.get(
  '/presets',
  requireAuth,
  async (_req: Request, res: Response): Promise<void> => {
    res.json(PRESETS);
  },
);
