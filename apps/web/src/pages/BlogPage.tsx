import { Link } from 'react-router-dom';
import appIcon from '@/assets/branding/gratonitepics-appicon-256.png';

const guides = [
  {
    id: 'getting-started',
    title: 'Getting Started on Gratonite',
    summary: 'Create an account, log in, join an invite, and find your way into your first portal quickly.',
    steps: [
      'Open the landing page and choose Create Account or Log In.',
      'If someone shared an invite link, open it directly and accept the invite.',
      'After login, start from the portal list/grid and select the portal you want to enter.',
      'Pick a text channel to chat or a voice channel to join instantly.',
    ],
  },
  {
    id: 'portals-and-channels',
    title: 'Portals, Channels, and Navigation',
    summary: 'How to move through portals, text channels, and voice channels without getting lost.',
    steps: [
      'Portals are your communities (similar to servers). Each portal contains channels.',
      'Text channels hold message history, images, and files.',
      'Voice channels are live hangout rooms with silent auto-join.',
      'Use Server Settings to manage portal profile, emojis, channel permissions, and roles/groups.',
    ],
  },
  {
    id: 'direct-messages',
    title: 'Direct Messages and Group Messaging',
    summary: 'Send DMs, upload images, use mentions, and watch typing indicators in realtime.',
    steps: [
      'Open the DMs area and select a conversation from the left panel.',
      'Type a message and use Enter or the Send button to deliver it.',
      'Use the upload button to attach an image before sending.',
      'Type @ to mention a user and select them from the autocomplete list.',
    ],
  },
  {
    id: 'voice-video',
    title: 'Voice, Video, and Screen Share',
    summary: 'Join voice rooms instantly, then turn camera and screen share on only when you choose.',
    steps: [
      'Click a voice channel to join silently (no loud incoming call UI).',
      'Your camera stays off by default until you press Camera.',
      'Use Screen Share to broadcast a screen or application into the call view.',
      'Open the Soundboard panel in supported voice channels for quick audio reactions.',
    ],
  },
  {
    id: 'notifications-and-status',
    title: 'Notifications, Sounds, and Status',
    summary: 'Control sound alerts and set your presence state for better focus and availability.',
    steps: [
      'Go to Settings > Notifications to adjust sound toggles and volumes.',
      'Set your status from the user menu: Online, Away, Do Not Disturb, or Offline.',
      'Mentions trigger notifications in channels, DMs, and group chats.',
      'Unread activity also updates the browser tab title for quick awareness.',
    ],
  },
  {
    id: 'reporting-bugs',
    title: 'How to Report Bugs During Beta',
    summary: 'Use the built-in bug report flow so issues land in the internal bug inbox with context.',
    steps: [
      'Click Report bug in the app top bar.',
      'Describe what happened, expected behavior, and steps to reproduce.',
      'Submit Report to send it to the internal bug inbox.',
      'Use Open GitHub Draft if you also want a public issue draft pre-filled.',
    ],
  },
];

export function BlogPage() {
  return (
    <main className="landing-page blog-page">
      <div className="landing-grid" aria-hidden="true" />
      <div className="landing-glow landing-glow-a" />
      <div className="landing-glow landing-glow-b" />

      <header className="landing-nav">
        <div className="landing-brand">
          <img src={appIcon} alt="" className="landing-brand-logo" />
          <div className="landing-brand-text">
            <span className="landing-brand-name">Gratonite</span>
            <span className="landing-brand-sub">Blog & Guides</span>
          </div>
        </div>
        <div className="landing-nav-actions">
          <Link to="/" className="landing-nav-link">Home</Link>
          <Link to="/" className="landing-nav-link">Open App</Link>
          <Link to="/login" className="landing-nav-link">Log In</Link>
          <Link to="/register" className="landing-nav-cta">Create Account</Link>
        </div>
      </header>

      <section className="landing-section blog-hero">
        <div className="landing-section-header">
          <p className="landing-kicker">Guides</p>
          <h1 className="blog-title">Product walkthroughs for the web beta</h1>
          <p>
            This blog is the user-facing guide surface for Gratonite. It explains how to navigate the app,
            join portals, use messaging and voice, configure notifications, and report issues during beta.
          </p>
        </div>
        <div className="blog-card-grid">
          {guides.map((guide) => (
            <a key={guide.id} href={`#${guide.id}`} className="blog-guide-card">
              <div className="blog-guide-card-head">
                <span className="blog-guide-chip">Guide</span>
                <span className="blog-guide-link">Open</span>
              </div>
              <h3>{guide.title}</h3>
              <p>{guide.summary}</p>
            </a>
          ))}
        </div>
      </section>

      <section className="landing-section blog-guides-section">
        <div className="blog-guide-list">
          {guides.map((guide) => (
            <article key={guide.id} id={guide.id} className="blog-guide-article">
              <div className="blog-guide-article-head">
                <p className="landing-kicker">Guide</p>
                <h2>{guide.title}</h2>
                <p>{guide.summary}</p>
              </div>
              <ol className="blog-guide-steps">
                {guide.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-section landing-section-cta">
        <div className="landing-final-cta">
          <div>
            <p className="landing-kicker">Need more help?</p>
            <h2>Use the built-in bug report button while testing</h2>
            <p>
              The fastest way to report issues is the in-app Report bug modal, which captures route and device context automatically.
            </p>
          </div>
          <div className="landing-final-actions">
            <Link to="/" className="landing-btn-primary">Open App</Link>
            <Link to="/" className="landing-btn-secondary">Back to Home</Link>
          </div>
        </div>
      </section>
    </main>
  );
}

