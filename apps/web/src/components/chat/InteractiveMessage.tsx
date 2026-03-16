import { useState, useCallback, useRef, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown, ChevronUp, Check } from 'lucide-react';
import { api } from '../../lib/api';

/* ── Types ──────────────────────────────────────────────── */

interface ButtonComponent {
  type: 'button';
  id: string;
  label: string;
  emoji?: string;
  style: 'primary' | 'secondary' | 'success' | 'danger';
  disabled?: boolean;
}

interface SelectOption {
  label: string;
  value: string;
  description?: string;
  emoji?: string;
}

interface SelectComponent {
  type: 'select';
  id: string;
  placeholder?: string;
  options: SelectOption[];
  disabled?: boolean;
}

interface TextInputComponent {
  type: 'text_input';
  id: string;
  placeholder?: string;
  label?: string;
  maxLength?: number;
  disabled?: boolean;
}

interface ImageCarouselComponent {
  type: 'image_carousel';
  id: string;
  images: Array<{ url: string; alt?: string }>;
}

interface AccordionComponent {
  type: 'accordion';
  id: string;
  title: string;
  content: string;
}

interface ProgressBarComponent {
  type: 'progress_bar';
  id: string;
  label: string;
  value: number; // 0-100
  color?: string;
}

type MessageComponent =
  | ButtonComponent
  | SelectComponent
  | TextInputComponent
  | ImageCarouselComponent
  | AccordionComponent
  | ProgressBarComponent;

interface InteractiveMessageProps {
  components: MessageComponent[];
  messageId: string;
  channelId: string;
}

/* ── Helpers ────────────────────────────────────────────── */

const BUTTON_STYLES: Record<string, React.CSSProperties> = {
  primary: { background: 'var(--accent-primary)', color: '#fff', border: 'none' },
  secondary: { background: 'var(--bg-elevated)', color: 'var(--text-primary)', border: '1px solid var(--stroke)' },
  success: { background: '#43b581', color: '#fff', border: 'none' },
  danger: { background: '#ed4245', color: '#fff', border: 'none' },
};

async function interact(channelId: string, messageId: string, componentId: string, data: unknown) {
  try {
    await api.messageComponents.interact(channelId, messageId, componentId, data);
  } catch {
    // Interaction failed
  }
}

/* ── Sub-components ─────────────────────────────────────── */

function ButtonRow({ component, channelId, messageId }: {
  component: ButtonComponent;
  channelId: string;
  messageId: string;
}) {
  const [loading, setLoading] = useState(false);

  const handleClick = useCallback(async () => {
    if (component.disabled || loading) return;
    setLoading(true);
    await interact(channelId, messageId, component.id, { action: 'click' });
    setLoading(false);
  }, [channelId, messageId, component, loading]);

  return (
    <button
      onClick={handleClick}
      disabled={component.disabled || loading}
      style={{
        ...BUTTON_STYLES[component.style],
        padding: '6px 16px',
        borderRadius: 6,
        fontSize: 13,
        fontWeight: 600,
        cursor: component.disabled ? 'not-allowed' : 'pointer',
        opacity: component.disabled ? 0.5 : loading ? 0.7 : 1,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        transition: 'opacity 0.15s',
      }}
    >
      {component.emoji && <span>{component.emoji}</span>}
      {component.label}
    </button>
  );
}

function SelectDropdown({ component, channelId, messageId }: {
  component: SelectComponent;
  channelId: string;
  messageId: string;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedLabel = useMemo(
    () => component.options.find(o => o.value === selected)?.label ?? component.placeholder ?? 'Select...',
    [component, selected],
  );

  const handleSelect = useCallback(async (value: string) => {
    setSelected(value);
    setOpen(false);
    await interact(channelId, messageId, component.id, { value });
  }, [channelId, messageId, component.id]);

  return (
    <div ref={containerRef} style={{ position: 'relative', minWidth: 200 }}>
      <button
        onClick={() => !component.disabled && setOpen(v => !v)}
        disabled={component.disabled}
        style={{
          width: '100%',
          padding: '8px 12px',
          borderRadius: 6,
          border: '1px solid var(--stroke)',
          background: 'var(--bg-elevated)',
          color: selected ? 'var(--text-primary)' : 'var(--text-muted)',
          fontSize: 13,
          cursor: component.disabled ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          textAlign: 'left',
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selectedLabel}
        </span>
        <ChevronDown size={14} style={{ flexShrink: 0, color: 'var(--text-muted)' }} />
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            marginTop: 4,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--stroke)',
            borderRadius: 6,
            padding: 4,
            boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
            zIndex: 20,
            maxHeight: 200,
            overflowY: 'auto',
          }}
        >
          {component.options.map(opt => (
            <button
              key={opt.value}
              onClick={() => handleSelect(opt.value)}
              style={{
                width: '100%',
                padding: '6px 10px',
                border: 'none',
                borderRadius: 4,
                background: selected === opt.value ? 'var(--bg-secondary)' : 'transparent',
                color: 'var(--text-primary)',
                fontSize: 13,
                cursor: 'pointer',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-secondary)')}
              onMouseLeave={e => (e.currentTarget.style.background = selected === opt.value ? 'var(--bg-secondary)' : 'transparent')}
            >
              {opt.emoji && <span>{opt.emoji}</span>}
              <div style={{ flex: 1 }}>
                <div>{opt.label}</div>
                {opt.description && (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{opt.description}</div>
                )}
              </div>
              {selected === opt.value && <Check size={14} style={{ color: 'var(--accent-primary)' }} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function TextInput({ component, channelId, messageId }: {
  component: TextInputComponent;
  channelId: string;
  messageId: string;
}) {
  const [value, setValue] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = useCallback(async () => {
    if (!value.trim() || submitted) return;
    setSubmitted(true);
    await interact(channelId, messageId, component.id, { value: value.trim() });
  }, [channelId, messageId, component.id, value, submitted]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {component.label && (
        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
          {component.label}
        </label>
      )}
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          value={value}
          onChange={e => setValue(e.target.value)}
          placeholder={component.placeholder}
          maxLength={component.maxLength}
          disabled={component.disabled || submitted}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          style={{
            flex: 1,
            padding: '6px 10px',
            borderRadius: 6,
            border: '1px solid var(--stroke)',
            background: 'var(--bg-primary)',
            color: 'var(--text-primary)',
            fontSize: 13,
            outline: 'none',
          }}
        />
        <button
          onClick={handleSubmit}
          disabled={!value.trim() || submitted}
          style={{
            padding: '6px 14px',
            borderRadius: 6,
            border: 'none',
            background: submitted ? '#43b581' : 'var(--accent-primary)',
            color: '#fff',
            fontSize: 13,
            fontWeight: 600,
            cursor: submitted ? 'default' : 'pointer',
          }}
        >
          {submitted ? 'Sent' : 'Submit'}
        </button>
      </div>
    </div>
  );
}

function ImageCarousel({ component }: { component: ImageCarouselComponent }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollTo = useCallback((idx: number) => {
    setCurrentIndex(idx);
    scrollRef.current?.children[idx]?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div
        ref={scrollRef}
        style={{
          display: 'flex',
          gap: 8,
          overflowX: 'auto',
          scrollSnapType: 'x mandatory',
          borderRadius: 8,
          scrollbarWidth: 'none',
        }}
        onScroll={() => {
          const el = scrollRef.current;
          if (!el || !el.children.length) return;
          const childW = (el.children[0] as HTMLElement).offsetWidth + 8;
          setCurrentIndex(Math.round(el.scrollLeft / childW));
        }}
      >
        {component.images.map((img, i) => (
          <img
            key={i}
            src={img.url}
            alt={img.alt ?? ''}
            style={{
              width: 280,
              height: 180,
              objectFit: 'cover',
              borderRadius: 8,
              flexShrink: 0,
              scrollSnapAlign: 'center',
            }}
          />
        ))}
      </div>
      {component.images.length > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 4 }}>
          {component.images.map((_, i) => (
            <button
              key={i}
              onClick={() => scrollTo(i)}
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                border: 'none',
                background: i === currentIndex ? 'var(--accent-primary)' : 'var(--text-muted)',
                opacity: i === currentIndex ? 1 : 0.4,
                cursor: 'pointer',
                padding: 0,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Accordion({ component }: { component: AccordionComponent }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      style={{
        borderRadius: 8,
        border: '1px solid var(--stroke)',
        overflow: 'hidden',
      }}
    >
      <button
        onClick={() => setExpanded(v => !v)}
        style={{
          width: '100%',
          padding: '10px 12px',
          border: 'none',
          background: 'var(--bg-elevated)',
          color: 'var(--text-primary)',
          fontSize: 14,
          fontWeight: 600,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          textAlign: 'left',
        }}
      >
        {component.title}
        {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      {expanded && (
        <motion.div
          initial={{ height: 0 }}
          animate={{ height: 'auto' }}
          style={{ overflow: 'hidden' }}
        >
          <div
            style={{
              padding: '10px 12px',
              background: 'var(--bg-secondary)',
              color: 'var(--text-secondary)',
              fontSize: 13,
              lineHeight: 1.5,
              whiteSpace: 'pre-wrap',
            }}
          >
            {component.content}
          </div>
        </motion.div>
      )}
    </div>
  );
}

function ProgressBar({ component }: { component: ProgressBarComponent }) {
  const pct = Math.max(0, Math.min(100, component.value));
  const color = component.color ?? 'var(--accent-primary)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
          {component.label}
        </span>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{pct}%</span>
      </div>
      <div
        style={{
          height: 8,
          borderRadius: 4,
          background: 'var(--bg-elevated)',
          overflow: 'hidden',
        }}
      >
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          style={{
            height: '100%',
            borderRadius: 4,
            background: color,
          }}
        />
      </div>
    </div>
  );
}

/* ── Main component ─────────────────────────────────────── */

export function InteractiveMessage({ components, messageId, channelId }: InteractiveMessageProps) {
  // Group buttons into rows
  const rows = useMemo(() => {
    const result: MessageComponent[][] = [];
    let currentButtonRow: ButtonComponent[] = [];

    for (const comp of components) {
      if (comp.type === 'button') {
        currentButtonRow.push(comp);
        if (currentButtonRow.length >= 5) {
          result.push([...currentButtonRow]);
          currentButtonRow = [];
        }
      } else {
        if (currentButtonRow.length > 0) {
          result.push([...currentButtonRow]);
          currentButtonRow = [];
        }
        result.push([comp]);
      }
    }
    if (currentButtonRow.length > 0) {
      result.push(currentButtonRow);
    }

    return result;
  }, [components]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6, maxWidth: 480 }}>
      {rows.map((row, ri) => {
        const firstType = row[0].type;

        if (firstType === 'button') {
          return (
            <div key={ri} style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {row.map(comp => (
                <ButtonRow
                  key={comp.id}
                  component={comp as ButtonComponent}
                  channelId={channelId}
                  messageId={messageId}
                />
              ))}
            </div>
          );
        }

        const comp = row[0];
        switch (comp.type) {
          case 'select':
            return <SelectDropdown key={comp.id} component={comp} channelId={channelId} messageId={messageId} />;
          case 'text_input':
            return <TextInput key={comp.id} component={comp} channelId={channelId} messageId={messageId} />;
          case 'image_carousel':
            return <ImageCarousel key={comp.id} component={comp} />;
          case 'accordion':
            return <Accordion key={comp.id} component={comp} />;
          case 'progress_bar':
            return <ProgressBar key={comp.id} component={comp} />;
          default:
            return null;
        }
      })}
    </div>
  );
}
