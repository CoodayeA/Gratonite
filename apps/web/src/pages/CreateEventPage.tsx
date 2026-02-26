import React, { useState, useMemo, type FormEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { api } from '@/lib/api';
import { getErrorMessage } from '@/lib/utils';
import { useGuildChannels } from '@/hooks/useGuildChannels';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type EntityType = 'stage_instance' | 'voice' | 'external';

interface EventFormData {
  entityType: EntityType;
  channelId: string;
  name: string;
  description: string;
  scheduledStartDate: string;
  scheduledStartTime: string;
  scheduledEndDate: string;
  scheduledEndTime: string;
  bannerUrl: string;
  location: string;
}

const INITIAL_FORM: EventFormData = {
  entityType: 'voice',
  channelId: '',
  name: '',
  description: '',
  scheduledStartDate: '',
  scheduledStartTime: '',
  scheduledEndDate: '',
  scheduledEndTime: '',
  bannerUrl: '',
  location: '',
};

const EVENT_TYPES: { id: EntityType; label: string; icon: string; description: string }[] = [
  {
    id: 'voice',
    label: 'Voice Channel',
    icon: '\u{1F50A}',
    description: 'Host in a voice channel. Members can join and listen live.',
  },
  {
    id: 'stage_instance',
    label: 'Stage',
    icon: '\u{1F3A4}',
    description: 'Broadcast to an audience with speaker and listener roles.',
  },
  {
    id: 'external',
    label: 'External',
    icon: '\u{1F310}',
    description: 'Takes place outside the portal. Add a location or link.',
  },
];

const STEP_LABELS = ['Type', 'Details', 'Review'];

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const s = {
  page: {
    display: 'flex',
    justifyContent: 'center',
    padding: '32px 16px',
    overflowY: 'auto',
    height: '100%',
  } as React.CSSProperties,

  container: {
    width: '100%',
    maxWidth: 560,
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  } as React.CSSProperties,

  title: {
    fontFamily: 'var(--font-display)',
    fontSize: 22,
  } as React.CSSProperties,

  stepIndicator: {
    display: 'flex',
    gap: 4,
  } as React.CSSProperties,

  stepDot: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 10px',
    borderRadius: 'var(--radius-md)',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'var(--stroke)',
    background: 'transparent',
    color: 'var(--text-faint)',
    fontSize: 12,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  } as React.CSSProperties,

  stepDotActive: {
    borderColor: 'color-mix(in srgb, var(--accent) 55%, transparent)',
    color: 'var(--text)',
    background: 'color-mix(in srgb, var(--accent) 8%, transparent)',
  } as React.CSSProperties,

  stepDotDone: {
    color: 'var(--text-muted)',
    borderColor: 'color-mix(in srgb, var(--accent) 25%, transparent)',
  } as React.CSSProperties,

  stepNum: {
    display: 'grid',
    placeItems: 'center',
    width: 20,
    height: 20,
    borderRadius: '50%',
    background: 'color-mix(in srgb, var(--accent) 15%, transparent)',
    fontSize: 11,
    fontWeight: 700,
    flexShrink: 0,
  } as React.CSSProperties,

  stepNumActive: {
    background: 'var(--accent)',
    color: '#fff',
  } as React.CSSProperties,

  stepNumDone: {
    background: 'color-mix(in srgb, var(--accent) 30%, transparent)',
  } as React.CSSProperties,

  stepLabel: {
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  } as React.CSSProperties,

  stepContent: {
    display: 'grid',
    gap: 12,
  } as React.CSSProperties,

  stepHeading: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--text)',
  } as React.CSSProperties,

  stepCount: {
    fontSize: 12,
    fontWeight: 500,
    color: 'var(--text-muted)',
  } as React.CSSProperties,

  typeGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 8,
  } as React.CSSProperties,

  typeCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
    padding: '14px 8px',
    borderRadius: 'var(--radius-md)',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'var(--stroke)',
    background: 'transparent',
    color: 'var(--text-muted)',
    fontSize: 12,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    textAlign: 'center',
  } as React.CSSProperties,

  typeCardActive: {
    borderColor: 'color-mix(in srgb, var(--accent) 55%, transparent)',
    background: 'color-mix(in srgb, var(--accent) 10%, transparent)',
    color: 'var(--text)',
    boxShadow: '0 0 0 1px color-mix(in srgb, var(--accent) 20%, transparent) inset',
  } as React.CSSProperties,

  typeIcon: {
    fontSize: 24,
    lineHeight: 1,
  } as React.CSSProperties,

  typeTitle: {
    fontWeight: 600,
    fontSize: 13,
    color: 'var(--text)',
  } as React.CSSProperties,

  typeDesc: {
    fontSize: 11,
    lineHeight: 1.35,
    color: 'var(--text-muted)',
  } as React.CSSProperties,

  channelSection: {
    display: 'grid',
    gap: 4,
  } as React.CSSProperties,

  channelLoading: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 13,
    color: 'var(--text-muted)',
    padding: '8px 0',
  } as React.CSSProperties,

  channelEmpty: {
    fontSize: 13,
    color: 'var(--text-faint)',
    padding: '8px 0',
  } as React.CSSProperties,

  inputLabel: {
    fontSize: 12,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    color: 'var(--text-muted)',
  } as React.CSSProperties,

  inputField: {
    width: '100%',
    padding: '10px 14px',
    background: 'var(--bg-input)',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'var(--stroke)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text)',
    fontFamily: 'inherit',
    fontSize: 14,
    outline: 'none',
  } as React.CSSProperties,

  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  } as React.CSSProperties,

  textarea: {
    width: '100%',
    padding: '10px 14px',
    background: 'var(--bg-input)',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'var(--stroke)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text)',
    fontFamily: 'var(--font-sans)',
    fontSize: 14,
    outline: 'none',
    resize: 'vertical',
    minHeight: 60,
  } as React.CSSProperties,

  datetimeRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 8,
  } as React.CSSProperties,

  previewBanner: {
    borderRadius: 'var(--radius-md)',
    overflow: 'hidden',
    maxHeight: 160,
  } as React.CSSProperties,

  previewBannerImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  } as React.CSSProperties,

  previewCard: {
    display: 'grid',
    gap: 0,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'var(--stroke)',
    borderRadius: 'var(--radius-md)',
    background: 'var(--bg-float)',
    overflow: 'hidden',
  } as React.CSSProperties,

  previewRow: {
    display: 'flex',
    gap: 12,
    padding: '10px 14px',
    borderBottom: '1px solid color-mix(in srgb, var(--stroke) 50%, transparent)',
  } as React.CSSProperties,

  previewRowLast: {
    borderBottom: 'none',
  } as React.CSSProperties,

  previewLabel: {
    flexShrink: 0,
    width: 90,
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  } as React.CSSProperties,

  previewValue: {
    fontSize: 13,
    color: 'var(--text)',
    wordBreak: 'break-word',
  } as React.CSSProperties,

  previewDesc: {
    whiteSpace: 'pre-wrap',
  } as React.CSSProperties,

  rsvpNote: {
    fontSize: 12,
    color: 'var(--text-muted)',
    background: 'color-mix(in srgb, var(--accent) 6%, transparent)',
    border: '1px solid color-mix(in srgb, var(--accent) 18%, transparent)',
    borderRadius: 'var(--radius-md)',
    padding: '10px 14px',
  } as React.CSSProperties,

  footer: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
  } as React.CSSProperties,

  authError: {
    padding: '10px 14px',
    background: 'var(--danger-bg)',
    border: '1px solid rgba(255, 107, 107, 0.25)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--danger)',
    fontSize: 13,
  } as React.CSSProperties,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toIso(date: string, time: string): string {
  if (!date || !time) return '';
  return new Date(`${date}T${time}`).toISOString();
}

function formatDateTime(iso: string): string {
  if (!iso) return '\u2014';
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CreateEventPage() {
  const { guildId } = useParams<{ guildId: string }>();
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [form, setForm] = useState<EventFormData>(INITIAL_FORM);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [rsvpDone, setRsvpDone] = useState(false);
  const [hoveredTypeCard, setHoveredTypeCard] = useState<string | null>(null);

  const { data: channels, isLoading: channelsLoading } = useGuildChannels(guildId);

  const voiceChannels = useMemo(
    () => (channels ?? []).filter((c) => c.type === 'GUILD_VOICE' || c.type === 'GUILD_STAGE_VOICE'),
    [channels],
  );

  function patch(updates: Partial<EventFormData>) {
    setForm((prev) => ({ ...prev, ...updates }));
  }

  function canAdvance(): boolean {
    if (step === 0) {
      if (form.entityType === 'external') return true;
      return !!form.channelId;
    }
    if (step === 1) {
      return !!form.name.trim() && !!form.scheduledStartDate && !!form.scheduledStartTime;
    }
    return true;
  }

  function handleBack() {
    if (step === 0) {
      navigate(-1);
    } else {
      setStep((prev) => prev - 1);
    }
  }

  function handleNext() {
    if (!canAdvance()) return;
    setError('');
    setStep((prev) => prev + 1);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!guildId) return;
    setError('');
    setLoading(true);

    try {
      const startIso = toIso(form.scheduledStartDate, form.scheduledStartTime);
      const endIso = form.scheduledEndDate && form.scheduledEndTime
        ? toIso(form.scheduledEndDate, form.scheduledEndTime)
        : undefined;

      const entityTypeMap: Record<EntityType, 'STAGE' | 'VOICE' | 'EXTERNAL'> = {
        stage_instance: 'STAGE',
        voice: 'VOICE',
        external: 'EXTERNAL',
      };

      const payload: Parameters<typeof api.events.create>[1] = {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        startTime: startIso,
        endTime: endIso,
        entityType: entityTypeMap[form.entityType],
        channelId: form.entityType !== 'external' ? form.channelId : undefined,
        location: form.entityType === 'external' && form.location.trim()
          ? form.location.trim()
          : undefined,
      };

      const event = await api.events.create(guildId, payload);

      if (event?.id) {
        try {
          await api.events.markInterested(guildId, event.id);
          setRsvpDone(true);
        } catch {
          // Non-critical
        }
      }

      navigate(`/guild/${guildId}`);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  function handleStepClick(target: number) {
    if (target < step) {
      setStep(target);
    } else if (target === step + 1 && canAdvance()) {
      setStep(target);
    }
  }

  function renderStepIndicator() {
    return (
      <div style={s.stepIndicator}>
        {STEP_LABELS.map((label, i) => {
          const isActive = i === step;
          const isDone = i < step;
          return (
            <button
              key={label}
              type="button"
              style={{
                ...s.stepDot,
                ...(isActive ? s.stepDotActive : {}),
                ...(isDone ? s.stepDotDone : {}),
              }}
              onClick={() => handleStepClick(i)}
            >
              <span
                style={{
                  ...s.stepNum,
                  ...(isActive ? s.stepNumActive : {}),
                  ...(isDone ? s.stepNumDone : {}),
                }}
              >
                {isDone ? '\u2713' : i + 1}
              </span>
              <span style={s.stepLabel}>{label}</span>
            </button>
          );
        })}
      </div>
    );
  }

  function renderStep0() {
    return (
      <div style={s.stepContent}>
        <div style={s.stepHeading}>
          Choose Event Type
          <span style={s.stepCount}>Step 1 of 3</span>
        </div>

        <div style={s.typeGrid}>
          {EVENT_TYPES.map((t) => (
            <button
              key={t.id}
              type="button"
              style={{
                ...s.typeCard,
                ...(form.entityType === t.id ? s.typeCardActive : {}),
              }}
              onClick={() => patch({ entityType: t.id, channelId: '' })}
            >
              <span style={s.typeIcon}>{t.icon}</span>
              <span style={s.typeTitle}>{t.label}</span>
              <span style={s.typeDesc}>{t.description}</span>
            </button>
          ))}
        </div>

        {form.entityType !== 'external' && (
          <div style={s.channelSection}>
            <label style={s.inputLabel} htmlFor="event-channel-select">
              {form.entityType === 'stage_instance' ? 'Stage Channel' : 'Voice Channel'}
            </label>
            {channelsLoading ? (
              <div style={s.channelLoading}>
                <LoadingSpinner size={16} /> Loading channels...
              </div>
            ) : voiceChannels.length === 0 ? (
              <div style={s.channelEmpty}>
                No voice channels available in this portal.
              </div>
            ) : (
              <select
                id="event-channel-select"
                style={{ ...s.inputField, appearance: 'none', cursor: 'pointer' } as React.CSSProperties}
                value={form.channelId}
                onChange={(e) => patch({ channelId: e.target.value })}
              >
                <option value="">Select a channel</option>
                {voiceChannels.map((ch) => (
                  <option key={ch.id} value={ch.id}>
                    {ch.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}
      </div>
    );
  }

  function renderStep1() {
    const today = new Date().toISOString().slice(0, 10);

    return (
      <div style={s.stepContent}>
        <div style={s.stepHeading}>
          Event Details
          <span style={s.stepCount}>Step 2 of 3</span>
        </div>

        <Input
          label="Event Title"
          type="text"
          value={form.name}
          onChange={(e) => patch({ name: e.target.value })}
          required
          maxLength={100}
          placeholder="Friday Game Night"
          autoFocus
        />

        <div style={s.inputGroup}>
          <label style={s.inputLabel} htmlFor="event-description">
            Description (optional)
          </label>
          <textarea
            id="event-description"
            style={s.textarea}
            value={form.description}
            onChange={(e) => patch({ description: e.target.value })}
            maxLength={1000}
            rows={3}
            placeholder="Tell members what this event is about..."
          />
        </div>

        <div style={s.datetimeRow}>
          <Input
            label="Start Date"
            type="date"
            value={form.scheduledStartDate}
            onChange={(e) => patch({ scheduledStartDate: e.target.value })}
            required
            min={today}
          />
          <Input
            label="Start Time"
            type="time"
            value={form.scheduledStartTime}
            onChange={(e) => patch({ scheduledStartTime: e.target.value })}
            required
          />
        </div>

        <div style={s.datetimeRow}>
          <Input
            label="End Date (optional)"
            type="date"
            value={form.scheduledEndDate}
            onChange={(e) => patch({ scheduledEndDate: e.target.value })}
            min={form.scheduledStartDate || today}
          />
          <Input
            label="End Time (optional)"
            type="time"
            value={form.scheduledEndTime}
            onChange={(e) => patch({ scheduledEndTime: e.target.value })}
          />
        </div>

        {form.entityType === 'external' && (
          <Input
            label="Location"
            type="text"
            value={form.location}
            onChange={(e) => patch({ location: e.target.value })}
            maxLength={100}
            placeholder="e.g. https://zoom.us/... or 123 Main St"
          />
        )}

        <Input
          label="Banner Image URL (optional)"
          type="url"
          value={form.bannerUrl}
          onChange={(e) => patch({ bannerUrl: e.target.value })}
          placeholder="https://example.com/banner.jpg"
        />
      </div>
    );
  }

  function renderStep2() {
    const startIso = toIso(form.scheduledStartDate, form.scheduledStartTime);
    const endIso =
      form.scheduledEndDate && form.scheduledEndTime
        ? toIso(form.scheduledEndDate, form.scheduledEndTime)
        : '';

    const typeLabel = EVENT_TYPES.find((t) => t.id === form.entityType)?.label ?? form.entityType;
    const channelName = voiceChannels.find((c) => c.id === form.channelId)?.name;

    const rows: { label: string; value: string; isDesc?: boolean }[] = [
      { label: 'Title', value: form.name || '\u2014' },
    ];
    if (form.description) rows.push({ label: 'Description', value: form.description, isDesc: true });
    rows.push({ label: 'Type', value: typeLabel });
    if (channelName) rows.push({ label: 'Channel', value: `#${channelName}` });
    if (form.entityType === 'external' && form.location) rows.push({ label: 'Location', value: form.location });
    rows.push({ label: 'Starts', value: formatDateTime(startIso) });
    if (endIso) rows.push({ label: 'Ends', value: formatDateTime(endIso) });

    return (
      <div style={s.stepContent}>
        <div style={s.stepHeading}>
          Review &amp; Create
          <span style={s.stepCount}>Step 3 of 3</span>
        </div>

        {form.bannerUrl && (
          <div style={s.previewBanner}>
            <img src={form.bannerUrl} alt="Event banner" style={s.previewBannerImg} />
          </div>
        )}

        <div style={s.previewCard}>
          {rows.map((row, i) => (
            <div
              key={row.label}
              style={{
                ...s.previewRow,
                ...(i === rows.length - 1 ? s.previewRowLast : {}),
              }}
            >
              <span style={s.previewLabel}>{row.label}</span>
              <span style={{ ...s.previewValue, ...(row.isDesc ? s.previewDesc : {}) }}>
                {row.value}
              </span>
            </div>
          ))}
        </div>

        <div style={s.rsvpNote}>
          You will be automatically marked as interested when you create this event.
        </div>
      </div>
    );
  }

  return (
    <div style={s.page}>
      <div style={s.container}>
        <h1 style={s.title}>Create Event</h1>

        {renderStepIndicator()}

        {error && <div style={s.authError}>{error}</div>}

        <form onSubmit={step === 2 ? handleSubmit : (e) => { e.preventDefault(); handleNext(); }}>
          {step === 0 && renderStep0()}
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}

          <div style={s.footer}>
            <Button variant="ghost" type="button" onClick={handleBack}>
              {step === 0 ? 'Cancel' : 'Back'}
            </Button>

            {step < 2 ? (
              <Button type="submit" disabled={!canAdvance()}>
                Next
              </Button>
            ) : (
              <Button type="submit" loading={loading} disabled={!canAdvance()}>
                Create Event
              </Button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
