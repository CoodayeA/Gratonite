import { useState, useRef, useEffect, useLayoutEffect } from 'react';

/** Searchable English name for every emoji in EMOJI_CATEGORIES */
const EMOJI_NAMES: Record<string, string> = {
  // ── Smileys ──────────────────────────────────────────────
  '\u{1F600}': 'grinning face',
  '\u{1F603}': 'grinning face big eyes',
  '\u{1F604}': 'grinning face smiling eyes',
  '\u{1F601}': 'beaming face smiling eyes',
  '\u{1F606}': 'grinning squinting face',
  '\u{1F605}': 'grinning face sweat',
  '\u{1F602}': 'face tears joy laughing',
  '\u{1F923}': 'rolling floor laughing rofl',
  '\u{1F60A}': 'smiling face blush',
  '\u{1F607}': 'smiling face halo angel',
  '\u{1F642}': 'slightly smiling face',
  '\u{1F643}': 'upside down face',
  '\u{1F609}': 'winking face wink',
  '\u{1F60C}': 'relieved face',
  '\u{1F60D}': 'heart eyes smiling face love',
  '\u{1F970}': 'smiling face hearts love',
  '\u{1F618}': 'face blowing kiss',
  '\u{1F617}': 'kissing face',
  '\u{1F619}': 'kissing face smiling eyes',
  '\u{1F61A}': 'kissing face closed eyes',
  '\u{1F60B}': 'face savoring food yummy delicious',
  '\u{1F61B}': 'face tongue out',
  '\u{1F61C}': 'winking face tongue',
  '\u{1F92A}': 'zany face crazy wild',
  '\u{1F61D}': 'squinting face tongue',
  '\u{1F911}': 'money mouth face rich dollar',
  '\u{1F917}': 'hugging face hug',
  '\u{1F92D}': 'face hand over mouth oops',
  '\u{1F92B}': 'shushing face quiet shh',
  '\u{1F914}': 'thinking face hmm',
  '\u{1F910}': 'zipper mouth face secret',
  '\u{1F928}': 'face raised eyebrow skeptic',
  '\u{1F610}': 'neutral face',
  '\u{1F611}': 'expressionless face',
  '\u{1F636}': 'face without mouth silent',
  '\u{1F60F}': 'smirking face smirk',
  '\u{1F612}': 'unamused face',
  '\u{1F644}': 'face rolling eyes',
  '\u{1F62C}': 'grimacing face',
  '\u{1F925}': 'lying face pinocchio',
  '\u{1F60E}': 'smiling face sunglasses cool',
  '\u{1F929}': 'star struck face excited',
  '\u{1F913}': 'nerd face glasses',
  '\u{1F9D0}': 'face monocle',
  '\u{1F615}': 'confused face',
  '\u{1F61F}': 'worried face',
  '\u{1F641}': 'slightly frowning face',
  '\u{2639}\u{FE0F}': 'frowning face sad',
  '\u{1F62E}': 'face open mouth surprised',
  '\u{1F62F}': 'hushed face',
  '\u{1F632}': 'astonished face wow',
  '\u{1F633}': 'flushed face embarrassed',
  '\u{1F97A}': 'pleading face puppy eyes',
  '\u{1F626}': 'frowning open mouth',
  '\u{1F627}': 'anguished face',
  '\u{1F628}': 'fearful face scared',
  '\u{1F630}': 'anxious face sweat',
  '\u{1F625}': 'sad relieved face',
  '\u{1F622}': 'crying face',
  '\u{1F62D}': 'loudly crying face sobbing',
  '\u{1F631}': 'face screaming fear',
  '\u{1F616}': 'confounded face',
  '\u{1F623}': 'persevering face',
  '\u{1F61E}': 'disappointed face',
  '\u{1F613}': 'downcast face sweat',
  '\u{1F629}': 'weary face tired',
  '\u{1F62A}': 'sleepy face',
  '\u{1F924}': 'drooling face',
  '\u{1F634}': 'sleeping face zzz',
  '\u{1F637}': 'face medical mask sick',
  '\u{1F912}': 'face thermometer fever sick',
  '\u{1F915}': 'face head bandage hurt injured',

  // ── Gestures ─────────────────────────────────────────────
  '\u{1F44D}': 'thumbs up like yes',
  '\u{1F44E}': 'thumbs down dislike no',
  '\u{1F44A}': 'oncoming fist bump punch',
  '\u{270A}': 'raised fist',
  '\u{1F91B}': 'left facing fist',
  '\u{1F91C}': 'right facing fist',
  '\u{1F44F}': 'clapping hands clap applause',
  '\u{1F64C}': 'raising hands celebration hooray',
  '\u{1F450}': 'open hands',
  '\u{1F932}': 'palms up together',
  '\u{1F91D}': 'handshake deal',
  '\u{1F64F}': 'folded hands pray please thank you',
  '\u{270D}\u{FE0F}': 'writing hand',
  '\u{1F485}': 'nail polish',
  '\u{1F933}': 'selfie',
  '\u{1F4AA}': 'flexed biceps strong muscle',
  '\u{1F448}': 'backhand index pointing left',
  '\u{1F449}': 'backhand index pointing right',
  '\u{261D}\u{FE0F}': 'index pointing up',
  '\u{1F446}': 'backhand index pointing up',
  '\u{1F447}': 'backhand index pointing down',
  '\u{270C}\u{FE0F}': 'victory hand peace sign',
  '\u{1F91E}': 'crossed fingers luck',
  '\u{1F596}': 'vulcan salute spock',
  '\u{1F918}': 'sign horns rock',
  '\u{1F919}': 'call me hand shaka',
  '\u{1F590}\u{FE0F}': 'hand splayed fingers',
  '\u{270B}': 'raised hand stop high five',
  '\u{1F44B}': 'waving hand wave hello bye',
  '\u{1F44C}': 'ok hand okay',

  // ── Hearts / Symbols ─────────────────────────────────────
  '\u{2764}\u{FE0F}': 'red heart love',
  '\u{1F9E1}': 'orange heart',
  '\u{1F49B}': 'yellow heart',
  '\u{1F49A}': 'green heart',
  '\u{1F499}': 'blue heart',
  '\u{1F49C}': 'purple heart',
  '\u{1F5A4}': 'black heart',
  '\u{1F90D}': 'white heart',
  '\u{1F90E}': 'brown heart',
  '\u{1F498}': 'heart arrow cupid',
  '\u{1F49D}': 'heart ribbon gift',
  '\u{1F496}': 'sparkling heart',
  '\u{1F497}': 'growing heart',
  '\u{1F493}': 'beating heart',
  '\u{1F49E}': 'revolving hearts',
  '\u{1F495}': 'two hearts',
  '\u{1F48C}': 'love letter',
  '\u{1F4AF}': 'hundred points perfect 100',
  '\u{2728}': 'sparkles',
  '\u{1F525}': 'fire hot flame lit',
  '\u{1F4A5}': 'collision boom explosion',
  '\u{1F31F}': 'glowing star',
  '\u{1F389}': 'party popper tada celebration',
  '\u{1F38A}': 'confetti ball',

  // ── Objects ──────────────────────────────────────────────
  '\u{1F3B5}': 'musical note music',
  '\u{1F3B6}': 'musical notes music',
  '\u{1F3A4}': 'microphone karaoke',
  '\u{1F3A7}': 'headphone headphones music',
  '\u{1F4F1}': 'mobile phone',
  '\u{1F4BB}': 'laptop computer',
  '\u{1F4A1}': 'light bulb idea',
  '\u{1F4DA}': 'books reading',
  '\u{1F4DD}': 'memo note writing',
  '\u{1F4E7}': 'email e-mail',
  '\u{1F4B0}': 'money bag rich',
  '\u{1F4B8}': 'money wings flying cash',
  '\u{2699}\u{FE0F}': 'gear settings cog',
  '\u{1F512}': 'lock locked',
  '\u{1F511}': 'key',
  '\u{1F528}': 'hammer tool',
  '\u{1F3AE}': 'video game controller',
  '\u{1F3AF}': 'bullseye target dart',
  '\u{1F3C6}': 'trophy winner cup',
  '\u{26BD}': 'soccer ball football',
  '\u{1F3C0}': 'basketball',
  '\u{1F3B2}': 'game die dice',
  '\u{1F37B}': 'clinking beer mugs cheers',
  '\u{2615}': 'hot beverage coffee tea',

  // ── Nature ───────────────────────────────────────────────
  '\u{1F436}': 'dog face puppy',
  '\u{1F431}': 'cat face kitty',
  '\u{1F42D}': 'mouse face',
  '\u{1F430}': 'rabbit face bunny',
  '\u{1F43B}': 'bear face',
  '\u{1F43C}': 'panda face',
  '\u{1F428}': 'koala',
  '\u{1F42F}': 'tiger face',
  '\u{1F981}': 'lion face',
  '\u{1F984}': 'unicorn',
  '\u{1F33A}': 'hibiscus flower',
  '\u{1F339}': 'rose flower',
  '\u{1F33B}': 'sunflower',
  '\u{1F33C}': 'blossom flower',
  '\u{1F332}': 'evergreen tree pine',
  '\u{1F333}': 'deciduous tree',
  '\u{1F334}': 'palm tree tropical',
  '\u{1F335}': 'cactus desert',
  '\u{1F340}': 'four leaf clover lucky',
  '\u{1F341}': 'maple leaf autumn fall',
  '\u{1F342}': 'fallen leaf autumn',
  '\u{1F343}': 'leaf fluttering wind',
  '\u{1F308}': 'rainbow',
  '\u{2B50}': 'star',
};

const EMOJI_CATEGORIES: { name: string; emojis: string[] }[] = [
  {
    name: 'Smileys',
    emojis: [
      '\u{1F600}', '\u{1F603}', '\u{1F604}', '\u{1F601}', '\u{1F606}', '\u{1F605}', '\u{1F602}', '\u{1F923}',
      '\u{1F60A}', '\u{1F607}', '\u{1F642}', '\u{1F643}', '\u{1F609}', '\u{1F60C}', '\u{1F60D}', '\u{1F970}',
      '\u{1F618}', '\u{1F617}', '\u{1F619}', '\u{1F61A}', '\u{1F60B}', '\u{1F61B}', '\u{1F61C}', '\u{1F92A}',
      '\u{1F61D}', '\u{1F911}', '\u{1F917}', '\u{1F92D}', '\u{1F92B}', '\u{1F914}', '\u{1F910}', '\u{1F928}',
      '\u{1F610}', '\u{1F611}', '\u{1F636}', '\u{1F60F}', '\u{1F612}', '\u{1F644}', '\u{1F62C}', '\u{1F925}',
      '\u{1F60E}', '\u{1F929}', '\u{1F913}', '\u{1F9D0}', '\u{1F615}', '\u{1F61F}', '\u{1F641}', '\u{2639}\u{FE0F}',
      '\u{1F62E}', '\u{1F62F}', '\u{1F632}', '\u{1F633}', '\u{1F97A}', '\u{1F626}', '\u{1F627}', '\u{1F628}',
      '\u{1F630}', '\u{1F625}', '\u{1F622}', '\u{1F62D}', '\u{1F631}', '\u{1F616}', '\u{1F623}', '\u{1F61E}',
      '\u{1F613}', '\u{1F629}', '\u{1F62A}', '\u{1F924}', '\u{1F634}', '\u{1F637}', '\u{1F912}', '\u{1F915}',
    ],
  },
  {
    name: 'Gestures',
    emojis: [
      '\u{1F44D}', '\u{1F44E}', '\u{1F44A}', '\u{270A}', '\u{1F91B}', '\u{1F91C}', '\u{1F44F}', '\u{1F64C}',
      '\u{1F450}', '\u{1F932}', '\u{1F91D}', '\u{1F64F}', '\u{270D}\u{FE0F}', '\u{1F485}', '\u{1F933}', '\u{1F4AA}',
      '\u{1F448}', '\u{1F449}', '\u{261D}\u{FE0F}', '\u{1F446}', '\u{1F447}', '\u{270C}\u{FE0F}', '\u{1F91E}', '\u{1F596}',
      '\u{1F918}', '\u{1F919}', '\u{1F590}\u{FE0F}', '\u{270B}', '\u{1F44B}', '\u{1F44C}',
    ],
  },
  {
    name: 'Hearts',
    emojis: [
      '\u{2764}\u{FE0F}', '\u{1F9E1}', '\u{1F49B}', '\u{1F49A}', '\u{1F499}', '\u{1F49C}', '\u{1F5A4}', '\u{1F90D}',
      '\u{1F90E}', '\u{1F498}', '\u{1F49D}', '\u{1F496}', '\u{1F497}', '\u{1F493}', '\u{1F49E}', '\u{1F495}',
      '\u{1F48C}', '\u{1F4AF}', '\u{2728}', '\u{1F525}', '\u{1F4A5}', '\u{1F31F}', '\u{1F389}', '\u{1F38A}',
    ],
  },
  {
    name: 'Objects',
    emojis: [
      '\u{1F3B5}', '\u{1F3B6}', '\u{1F3A4}', '\u{1F3A7}', '\u{1F4F1}', '\u{1F4BB}', '\u{1F4A1}', '\u{1F4DA}',
      '\u{1F4DD}', '\u{1F4E7}', '\u{1F4B0}', '\u{1F4B8}', '\u{2699}\u{FE0F}', '\u{1F512}', '\u{1F511}', '\u{1F528}',
      '\u{1F3AE}', '\u{1F3AF}', '\u{1F3C6}', '\u{26BD}', '\u{1F3C0}', '\u{1F3B2}', '\u{1F37B}', '\u{2615}',
    ],
  },
  {
    name: 'Nature',
    emojis: [
      '\u{1F436}', '\u{1F431}', '\u{1F42D}', '\u{1F430}', '\u{1F43B}', '\u{1F43C}', '\u{1F428}', '\u{1F42F}',
      '\u{1F981}', '\u{1F984}', '\u{1F33A}', '\u{1F339}', '\u{1F33B}', '\u{1F33C}', '\u{1F332}', '\u{1F333}',
      '\u{1F334}', '\u{1F335}', '\u{1F340}', '\u{1F341}', '\u{1F342}', '\u{1F343}', '\u{1F308}', '\u{2B50}',
    ],
  },
];

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
  x?: number;
  y?: number;
}

export function EmojiPicker({ onSelect, onClose, x, y }: EmojiPickerProps) {
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const hasPosition = x !== undefined && y !== undefined;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  // Clamp to viewport when positioned via x/y
  useLayoutEffect(() => {
    if (!hasPosition || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
      ref.current.style.left = `${Math.max(8, window.innerWidth - rect.width - 8)}px`;
    }
    if (rect.bottom > window.innerHeight) {
      ref.current.style.top = `${Math.max(8, window.innerHeight - rect.height - 8)}px`;
    }
  }, [x, y, hasPosition]);

  const allEmojis = EMOJI_CATEGORIES.flatMap((c) => c.emojis);
  const filtered = search
    ? allEmojis.filter(e => EMOJI_NAMES[e]?.toLowerCase().includes(search.toLowerCase()))
    : null;

  const pickerStyle = hasPosition
    ? {
      position: 'fixed' as const,
      left: x,
      top: y,
      right: 'auto',
      bottom: 'auto',
    }
    : undefined;

  return (
    <div
      className="emoji-picker"
      ref={ref}
      style={pickerStyle}
    >
      <div className="emoji-picker-header">
        <input
          className="emoji-picker-search"
          placeholder="Search emoji..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
        />
      </div>
      <div className="emoji-picker-grid">
        {filtered ? (
          filtered.map((emoji, i) => (
            <button key={i} className="emoji-picker-item" onClick={() => onSelect(emoji)}>
              {emoji}
            </button>
          ))
        ) : (
          EMOJI_CATEGORIES.map((cat) => (
            <div key={cat.name}>
              <div className="emoji-picker-category">{cat.name}</div>
              <div className="emoji-picker-items">
                {cat.emojis.map((emoji, i) => (
                  <button key={i} className="emoji-picker-item" onClick={() => onSelect(emoji)}>
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
