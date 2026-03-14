import { ThemeDefinition } from '../types';

import defaultTheme from './default';
import glassTheme from './glass';
import neobrutalismTheme from './neobrutalism';
import synthwaveTheme from './synthwave';
import y2kTheme from './y2k';
import memphisTheme from './memphis';
import artdecoTheme from './artdeco';
import terminalTheme from './terminal';
import auroraTheme from './aurora';
import vaporwaveTheme from './vaporwave';
import nordTheme from './nord';
import solarizedTheme from './solarized';
import bubblegumTheme from './bubblegum';
import obsidianTheme from './obsidian';
import sakuraTheme from './sakura';
import midnightTheme from './midnight';
import forestTheme from './forest';
import cyberpunkTheme from './cyberpunk';
import pastelTheme from './pastel';
import monochromeTheme from './monochrome';
import oceanTheme from './ocean';
import fireTheme from './fire';
import desertTheme from './desert';
import lavenderTheme from './lavender';
import coffeeTheme from './coffee';
import matrixTheme from './matrix';
import roseGoldTheme from './rose_gold';
import emeraldTheme from './emerald';
import draculaTheme from './dracula';
import monokaiTheme from './monokai';
import catppuccinTheme from './catppuccin';
import gruvboxTheme from './gruvbox';
import tokyoNightTheme from './tokyo_night';
import everforestTheme from './everforest';
import arcticTheme from './arctic';
import neonTheme from './neon';
import midnightBlueTheme from './midnight_blue';
import highContrastTheme from './high_contrast';

/** All built-in theme presets as an array */
export const themePresets: ThemeDefinition[] = [
  defaultTheme,
  glassTheme,
  neobrutalismTheme,
  synthwaveTheme,
  y2kTheme,
  memphisTheme,
  artdecoTheme,
  terminalTheme,
  auroraTheme,
  vaporwaveTheme,
  nordTheme,
  solarizedTheme,
  bubblegumTheme,
  obsidianTheme,
  sakuraTheme,
  midnightTheme,
  forestTheme,
  cyberpunkTheme,
  pastelTheme,
  monochromeTheme,
  oceanTheme,
  fireTheme,
  desertTheme,
  lavenderTheme,
  coffeeTheme,
  matrixTheme,
  roseGoldTheme,
  emeraldTheme,
  draculaTheme,
  monokaiTheme,
  catppuccinTheme,
  gruvboxTheme,
  tokyoNightTheme,
  everforestTheme,
  arcticTheme,
  neonTheme,
  midnightBlueTheme,
  highContrastTheme,
];

/** All built-in theme presets as a record keyed by theme id */
export const themePresetsMap: Record<string, ThemeDefinition> = Object.fromEntries(
  themePresets.map((t) => [t.id, t])
);

export {
  defaultTheme,
  glassTheme,
  neobrutalismTheme,
  synthwaveTheme,
  y2kTheme,
  memphisTheme,
  artdecoTheme,
  terminalTheme,
  auroraTheme,
  vaporwaveTheme,
  nordTheme,
  solarizedTheme,
  bubblegumTheme,
  obsidianTheme,
  sakuraTheme,
  midnightTheme,
  forestTheme,
  cyberpunkTheme,
  pastelTheme,
  monochromeTheme,
  oceanTheme,
  fireTheme,
  desertTheme,
  lavenderTheme,
  coffeeTheme,
  matrixTheme,
  roseGoldTheme,
  emeraldTheme,
  draculaTheme,
  monokaiTheme,
  catppuccinTheme,
  gruvboxTheme,
  tokyoNightTheme,
  everforestTheme,
  arcticTheme,
  neonTheme,
  midnightBlueTheme,
  highContrastTheme,
};
