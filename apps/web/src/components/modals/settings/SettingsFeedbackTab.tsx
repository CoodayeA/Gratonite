import { useState, useId } from 'react';
import { Check } from 'lucide-react';
import { api } from '../../../lib/api';
import type { SettingsTabProps } from './types';

const SettingsFeedbackTab = ({ addToast }: SettingsTabProps) => {
  const [feedbackCategory, setFeedbackCategory] = useState('general');
  const [feedbackBody, setFeedbackBody] = useState('');
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const feedbackBodyId = useId();

  return (
    <>
      <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>Send Feedback</h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '32px', fontSize: '13px' }}>Help us improve Gratonite by sharing your thoughts, reporting bugs, or suggesting features.</p>

      {feedbackSubmitted ? (
        <div style={{ textAlign: 'center', padding: '48px 0' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(16,185,129,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <Check size={32} color="#10b981" />
          </div>
          <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>Feedback Sent!</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '24px' }}>Thank you for helping us improve Gratonite.</p>
          <button onClick={() => { setFeedbackSubmitted(false); setFeedbackBody(''); setFeedbackCategory('general'); }} style={{ padding: '10px 24px', borderRadius: '8px', border: '1px solid var(--stroke)', background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}>
            Send More Feedback
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>Category</div>
            <div className="grid-mobile-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
              {[
                { id: 'general', label: 'General' },
                { id: 'bug', label: 'Bug Report' },
                { id: 'feature', label: 'Feature Request' },
                { id: 'ux', label: 'UX Issue' },
              ].map(cat => (
                <button key={cat.id} onClick={() => setFeedbackCategory(cat.id)} disabled={saving} style={{
                  padding: '10px', borderRadius: '8px', cursor: saving ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 600,
                  background: feedbackCategory === cat.id ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                  color: feedbackCategory === cat.id ? '#000' : 'var(--text-secondary)',
                  border: `1px solid ${feedbackCategory === cat.id ? 'var(--accent-primary)' : 'var(--stroke)'}`,
                  opacity: saving ? 0.6 : 1,
                }}>{cat.label}</button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor={feedbackBodyId} style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>Your Feedback</label>
            <textarea
              id={feedbackBodyId}
              value={feedbackBody}
              onChange={e => setFeedbackBody(e.target.value)}
              placeholder="Describe your feedback, bug, or suggestion in detail..."
              maxLength={2000}
              disabled={saving}
              style={{ width: '100%', height: '140px', padding: '12px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '14px', resize: 'none', fontFamily: 'inherit', opacity: saving ? 0.6 : 1 }}
            />
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', textAlign: 'right' }}>{feedbackBody.length}/2000</div>
          </div>

          <button
            onClick={async () => {
              if (!feedbackBody.trim() || saving) return;
              setSaving(true);
              try {
                await api.bugReports.create({
                  title: feedbackCategory === 'bug' ? 'Bug Report' : feedbackCategory === 'feature' ? 'Feature Request' : feedbackCategory === 'ux' ? 'UX Issue' : 'General Feedback',
                  summary: feedbackBody.trim(),
                  route: window.location.pathname,
                  pageUrl: window.location.href,
                  viewport: `${window.innerWidth}x${window.innerHeight}`,
                  userAgent: navigator.userAgent,
                  clientTimestamp: new Date().toISOString(),
                  metadata: { category: feedbackCategory },
                });
                setFeedbackSubmitted(true);
                addToast({ title: 'Feedback Sent', description: 'Your feedback has been submitted. Thank you!', variant: 'success' });
              } catch {
                addToast({ title: 'Error', description: 'Failed to submit feedback. Please try again.', variant: 'error' });
              } finally {
                setSaving(false);
              }
            }}
            disabled={!feedbackBody.trim() || saving}
            style={{
              padding: '12px 24px', borderRadius: '8px', border: 'none', fontWeight: 700, fontSize: '14px', cursor: (feedbackBody.trim() && !saving) ? 'pointer' : 'not-allowed',
              background: (feedbackBody.trim() && !saving) ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
              color: (feedbackBody.trim() && !saving) ? '#000' : 'var(--text-muted)',
              alignSelf: 'flex-start',
            }}
          >
            {saving ? 'Submitting...' : 'Submit Feedback'}
          </button>
        </div>
      )}
    </>
  );
};

export default SettingsFeedbackTab;
