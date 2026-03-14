/**
 * ChannelActivityIndicator — Item 88: Hot/warm/cold icons based on recent activity
 * Shows a colored dot next to channel names indicating activity level.
 */

interface Props {
  messageCount24h?: number;
  lastMessageAt?: string | null;
  size?: number;
}

export const ChannelActivityIndicator = ({ messageCount24h = 0, lastMessageAt, size = 8 }: Props) => {
  // Determine heat level
  let color = 'transparent'; // cold — no indicator
  let title = 'Quiet';

  if (messageCount24h > 50) {
    color = '#ef4444'; // hot — red
    title = `Hot (${messageCount24h} messages today)`;
  } else if (messageCount24h > 10) {
    color = '#f59e0b'; // warm — amber
    title = `Active (${messageCount24h} messages today)`;
  } else if (messageCount24h > 0) {
    color = '#10b981'; // mild — green
    title = `Some activity (${messageCount24h} messages today)`;
  } else if (lastMessageAt) {
    const hoursAgo = (Date.now() - new Date(lastMessageAt).getTime()) / (1000 * 60 * 60);
    if (hoursAgo < 1) {
      color = '#10b981';
      title = 'Recently active';
    }
  }

  if (color === 'transparent') return null;

  return (
    <span
      title={title}
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        borderRadius: '50%',
        backgroundColor: color,
        flexShrink: 0,
      }}
    />
  );
};

export default ChannelActivityIndicator;
