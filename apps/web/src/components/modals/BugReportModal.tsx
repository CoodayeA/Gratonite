import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useLocation } from 'react-router-dom';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useUiStore } from '@/stores/ui.store';
import { useAuthStore } from '@/stores/auth.store';
import { api, ApiRequestError } from '@/lib/api';

const GITHUB_ISSUES_NEW_URL = 'https://github.com/AlexandeCo/gratonite/issues/new';

function buildIssueBody(params: {
  summary: string;
  steps: string;
  expected: string;
  actual: string;
  context: string;
}) {
  return [
    '## Summary',
    params.summary || '_No summary provided_',
    '',
    '## Steps To Reproduce',
    params.steps || '_Not provided_',
    '',
    '## Expected Result',
    params.expected || '_Not provided_',
    '',
    '## Actual Result',
    params.actual || '_Not provided_',
    '',
    '## Context',
    '```text',
    params.context,
    '```',
  ].join('\n');
}

export function BugReportModal() {
  const activeModal = useUiStore((s) => s.activeModal);
  const closeModal = useUiStore((s) => s.closeModal);
  const modalData = useUiStore((s) => s.modalData);
  const user = useAuthStore((s) => s.user);
  const location = useLocation();

  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [steps, setSteps] = useState('');
  const [expected, setExpected] = useState('');
  const [actual, setActual] = useState('');
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const [submitState, setSubmitState] = useState<'idle' | 'submitting' | 'submitted' | 'failed'>('idle');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittedId, setSubmittedId] = useState<string | null>(null);

  const isOpen = activeModal === 'bug-report';
  const isBugInboxAdmin = user?.username === 'ferdinand' || user?.username === 'coodaye';
  const routeContext = (modalData?.['route'] as string | undefined) ?? location.pathname;
  const channelContext = (modalData?.['channelLabel'] as string | undefined) ?? '';

  useEffect(() => {
    if (!isOpen) return;
    setTitle('');
    setSummary('');
    setSteps('');
    setExpected('');
    setActual('');
    setCopyState('idle');
    setSubmitState('idle');
    setSubmitError(null);
    setSubmittedId(null);
  }, [isOpen]);

  const contextText = useMemo(() => {
    const nav = typeof navigator !== 'undefined' ? navigator : null;
    const screenSize =
      typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : 'unknown';
    const currentUrl = typeof window !== 'undefined' ? window.location.href : routeContext;
    return [
      `Time (UTC): ${new Date().toISOString()}`,
      `Route: ${routeContext}`,
      `URL: ${currentUrl}`,
      `Channel: ${channelContext || 'n/a'}`,
      `User: ${user ? `${user.displayName} (${user.id})` : 'guest/unknown'}`,
      `Viewport: ${screenSize}`,
      `User Agent: ${nav?.userAgent ?? 'unknown'}`,
    ].join('\n');
  }, [routeContext, channelContext, user]);

  const currentUrl = typeof window !== 'undefined' ? window.location.href : routeContext;
  const viewport = typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : 'unknown';
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown';

  function handleClose() {
    closeModal();
  }

  async function copyReportToClipboard(body: string) {
    try {
      await navigator.clipboard.writeText(body);
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
  }

  async function openGithubIssueDraft() {
    const trimmedTitle = title.trim() || 'Bug report';
    const issueBody = buildIssueBody({
      summary: summary.trim(),
      steps: steps.trim(),
      expected: expected.trim(),
      actual: actual.trim(),
      context: contextText,
    });

    await copyReportToClipboard(`# ${trimmedTitle}\n\n${issueBody}`);

    const issueUrl =
      `${GITHUB_ISSUES_NEW_URL}?title=${encodeURIComponent(trimmedTitle)}&body=${encodeURIComponent(issueBody)}`;

    window.open(issueUrl, '_blank', 'noopener,noreferrer');
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitState('submitting');
    setSubmitError(null);

    try {
      const record = await api.bugReports.create({
        title: title.trim(),
        summary: summary.trim(),
        steps: steps.trim() || undefined,
        expected: expected.trim() || undefined,
        actual: actual.trim() || undefined,
        route: routeContext || undefined,
        pageUrl: currentUrl || undefined,
        channelLabel: channelContext || undefined,
        viewport,
        userAgent,
        clientTimestamp: new Date().toISOString(),
        metadata: {
          source: 'web_bug_report_modal',
        },
      });
      setSubmittedId(record.id);
      setSubmitState('submitted');
    } catch (error) {
      const message =
        error instanceof ApiRequestError
          ? error.message || `Request failed (${error.status})`
          : 'Could not submit bug report to the server.';
      setSubmitError(message);
      setSubmitState('failed');
    }
  }

  return (
    <Modal id="bug-report" title="Report Bug" size="lg" onClose={handleClose}>
      <form className="modal-form" onSubmit={handleSubmit}>
        <Input
          label="Title"
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Short bug title"
          maxLength={120}
          required
          autoFocus
        />

        <label className="input-label" htmlFor="bug-report-summary">What happened?</label>
        <textarea
          id="bug-report-summary"
          className="input-field bug-report-textarea"
          value={summary}
          onChange={(event) => setSummary(event.target.value)}
          placeholder="Describe the issue clearly"
          rows={3}
          required
        />

        <label className="input-label" htmlFor="bug-report-steps">Steps to reproduce</label>
        <textarea
          id="bug-report-steps"
          className="input-field bug-report-textarea"
          value={steps}
          onChange={(event) => setSteps(event.target.value)}
          placeholder={'1. Go to...\n2. Click...\n3. Observe...'}
          rows={4}
        />

        <div className="bug-report-grid">
          <div className="bug-report-grid-item">
            <label className="input-label" htmlFor="bug-report-expected">Expected</label>
            <textarea
              id="bug-report-expected"
              className="input-field bug-report-textarea bug-report-textarea-sm"
              value={expected}
              onChange={(event) => setExpected(event.target.value)}
              rows={2}
            />
          </div>
          <div className="bug-report-grid-item">
            <label className="input-label" htmlFor="bug-report-actual">Actual</label>
            <textarea
              id="bug-report-actual"
              className="input-field bug-report-textarea bug-report-textarea-sm"
              value={actual}
              onChange={(event) => setActual(event.target.value)}
              rows={2}
            />
          </div>
        </div>

        <div className="bug-report-context">
          <div className="bug-report-context-title">Auto-captured context</div>
          <pre className="bug-report-context-pre">{contextText}</pre>
        </div>

        {submitState === 'submitted' && (
          <div className="bug-report-status">
            Bug report submitted successfully{submittedId ? ` (ID: ${submittedId})` : ''}.
          </div>
        )}
        {submitState === 'failed' && submitError && (
          <div className="bug-report-status bug-report-status-error">{submitError}</div>
        )}

        {copyState === 'copied' && (
          <div className="bug-report-status">Report copied to clipboard and GitHub issue form opened.</div>
        )}
        {copyState === 'failed' && (
          <div className="bug-report-status bug-report-status-error">
            Could not copy to clipboard, but the GitHub issue form should still open with details.
          </div>
        )}

        <div className="modal-footer">
          <Button variant="ghost" type="button" onClick={handleClose}>
            Cancel
          </Button>
          {isBugInboxAdmin && (
            <Button
              variant="ghost"
              type="button"
              onClick={() => window.open('/ops/bugs', '_blank', 'noopener,noreferrer')}
            >
              Open Inbox
            </Button>
          )}
          <Button
            variant="ghost"
            type="button"
            onClick={openGithubIssueDraft}
            disabled={!title.trim() || !summary.trim()}
          >
            Open GitHub Draft
          </Button>
          <Button
            type="submit"
            disabled={!title.trim() || !summary.trim()}
            loading={submitState === 'submitting'}
          >
            Submit Report
          </Button>
        </div>
      </form>
    </Modal>
  );
}
