import { useState, useMemo, type FormEvent } from 'react';
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

  // Fetch channels for the voice/stage selection
  const { data: channels, isLoading: channelsLoading } = useGuildChannels(guildId);

  const voiceChannels = useMemo(
    () => (channels ?? []).filter((c) => c.type === 'GUILD_VOICE' || c.type === 'GUILD_STAGE_VOICE'),
    [channels],
  );

  // ── Field updater ──────────────────────────────────────────────────────────
  function patch(updates: Partial<EventFormData>) {
    setForm((prev) => ({ ...prev, ...updates }));
  }

  // ── Validation per step ────────────────────────────────────────────────────
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

  // ── Navigation ─────────────────────────────────────────────────────────────
  function handleBack() {
    if (step === 0) {
      navigate(-1);
    } else {
      setStep((s) => s - 1);
    }
  }

  function handleNext() {
    if (!canAdvance()) return;
    setError('');
    setStep((s) => s + 1);
  }

  // ── Submit ─────────────────────────────────────────────────────────────────
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

      const payload: Parameters<typeof api.events.create>[1] = {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        scheduledStartTime: startIso,
        scheduledEndTime: endIso,
        entityType: form.entityType,
        channelId: form.entityType !== 'external' ? form.channelId : undefined,
        entityMetadata: form.entityType === 'external' && form.location.trim()
          ? { location: form.location.trim() }
          : undefined,
      };

      const event = await api.events.create(guildId, payload);

      // Auto-RSVP the creator
      if (event?.id) {
        try {
          await api.events.rsvp(guildId, event.id);
          setRsvpDone(true);
        } catch {
          // Non-critical — creator still created the event
        }
      }

      navigate(`/guild/${guildId}`);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  // ── Step indicator click ───────────────────────────────────────────────────
  function handleStepClick(target: number) {
    // Only allow going backwards, or forward if current step is valid
    if (target < step) {
      setStep(target);
    } else if (target === step + 1 && canAdvance()) {
      setStep(target);
    }
  }

  // ── Render step indicator ──────────────────────────────────────────────────
  function renderStepIndicator() {
    return (
      <div className="create-event-step-indicator">
        {STEP_LABELS.map((label, i) => (
          <button
            key={label}
            type="button"
            className={`create-event-step-dot ${i === step ? 'active' : ''} ${i < step ? 'done' : ''}`}
            onClick={() => handleStepClick(i)}
          >
            <span className="create-event-step-num">{i < step ? '\u2713' : i + 1}</span>
            <span className="create-event-step-label">{label}</span>
          </button>
        ))}
      </div>
    );
  }

  // ── Step 1: Event type & channel ───────────────────────────────────────────
  function renderStep0() {
    return (
      <div className="create-event-step-content">
        <div className="create-event-step-heading">
          Choose Event Type
          <span className="create-event-step-count">Step 1 of 3</span>
        </div>

        <div className="create-event-type-grid">
          {EVENT_TYPES.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`create-event-type-card ${form.entityType === t.id ? 'create-event-type-card-active' : ''}`}
              onClick={() => patch({ entityType: t.id, channelId: '' })}
            >
              <span className="create-event-type-icon">{t.icon}</span>
              <span className="create-event-type-title">{t.label}</span>
              <span className="create-event-type-desc">{t.description}</span>
            </button>
          ))}
        </div>

        {form.entityType !== 'external' && (
          <div className="create-event-channel-section">
            <label className="input-label" htmlFor="event-channel-select">
              {form.entityType === 'stage_instance' ? 'Stage Channel' : 'Voice Channel'}
            </label>
            {channelsLoading ? (
              <div className="create-event-channel-loading">
                <LoadingSpinner size={16} /> Loading channels...
              </div>
            ) : voiceChannels.length === 0 ? (
              <div className="create-event-channel-empty">
                No voice channels available in this portal.
              </div>
            ) : (
              <select
                id="event-channel-select"
                className="input-field"
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

  // ── Step 2: Event details ──────────────────────────────────────────────────
  function renderStep1() {
    // Default start date to today for convenience
    const today = new Date().toISOString().slice(0, 10);

    return (
      <div className="create-event-step-content">
        <div className="create-event-step-heading">
          Event Details
          <span className="create-event-step-count">Step 2 of 3</span>
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

        <div className="input-group">
          <label className="input-label" htmlFor="event-description">
            Description (optional)
          </label>
          <textarea
            id="event-description"
            className="input-field create-event-textarea"
            value={form.description}
            onChange={(e) => patch({ description: e.target.value })}
            maxLength={1000}
            rows={3}
            placeholder="Tell members what this event is about..."
          />
        </div>

        <div className="create-event-datetime-row">
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

        <div className="create-event-datetime-row">
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

  // ── Step 3: Preview & confirm ──────────────────────────────────────────────
  function renderStep2() {
    const startIso = toIso(form.scheduledStartDate, form.scheduledStartTime);
    const endIso =
      form.scheduledEndDate && form.scheduledEndTime
        ? toIso(form.scheduledEndDate, form.scheduledEndTime)
        : '';

    const typeLabel = EVENT_TYPES.find((t) => t.id === form.entityType)?.label ?? form.entityType;
    const channelName = voiceChannels.find((c) => c.id === form.channelId)?.name;

    return (
      <div className="create-event-step-content">
        <div className="create-event-step-heading">
          Review &amp; Create
          <span className="create-event-step-count">Step 3 of 3</span>
        </div>

        {form.bannerUrl && (
          <div className="create-event-preview-banner">
            <img src={form.bannerUrl} alt="Event banner" />
          </div>
        )}

        <div className="create-event-preview-card">
          <div className="create-event-preview-row">
            <span className="create-event-preview-label">Title</span>
            <span className="create-event-preview-value">{form.name || '\u2014'}</span>
          </div>

          {form.description && (
            <div className="create-event-preview-row">
              <span className="create-event-preview-label">Description</span>
              <span className="create-event-preview-value create-event-preview-desc">
                {form.description}
              </span>
            </div>
          )}

          <div className="create-event-preview-row">
            <span className="create-event-preview-label">Type</span>
            <span className="create-event-preview-value">{typeLabel}</span>
          </div>

          {channelName && (
            <div className="create-event-preview-row">
              <span className="create-event-preview-label">Channel</span>
              <span className="create-event-preview-value">#{channelName}</span>
            </div>
          )}

          {form.entityType === 'external' && form.location && (
            <div className="create-event-preview-row">
              <span className="create-event-preview-label">Location</span>
              <span className="create-event-preview-value">{form.location}</span>
            </div>
          )}

          <div className="create-event-preview-row">
            <span className="create-event-preview-label">Starts</span>
            <span className="create-event-preview-value">{formatDateTime(startIso)}</span>
          </div>

          {endIso && (
            <div className="create-event-preview-row">
              <span className="create-event-preview-label">Ends</span>
              <span className="create-event-preview-value">{formatDateTime(endIso)}</span>
            </div>
          )}
        </div>

        <div className="create-event-rsvp-note">
          You will be automatically marked as interested when you create this event.
        </div>
      </div>
    );
  }

  // ── Main render ────────────────────────────────────────────────────────────
  return (
    <div className="create-event-page">
      <div className="create-event-container">
        <h1 className="create-event-title">Create Event</h1>

        {renderStepIndicator()}

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={step === 2 ? handleSubmit : (e) => { e.preventDefault(); handleNext(); }}>
          {step === 0 && renderStep0()}
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}

          <div className="create-event-footer">
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
