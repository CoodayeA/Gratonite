import { useState } from 'react';
import { Plus, Heart } from 'lucide-react';

interface WallPost {
  id: string;
  content: string;
  imageUrl?: string;
  authorId: string;
  authorName: string;
  authorAvatar: string | null;
  likes: number;
  liked: boolean;
  createdAt: string;
}

export default function CommunityWall({ guildId }: { guildId: string }) {
  const [posts, setPosts] = useState<WallPost[]>([]);
  const [newPost, setNewPost] = useState('');
  const [showForm, setShowForm] = useState(false);

  const addPost = () => {
    if (!newPost.trim()) return;
    const post: WallPost = {
      id: crypto.randomUUID(),
      content: newPost,
      authorId: 'me',
      authorName: 'You',
      authorAvatar: null,
      likes: 0,
      liked: false,
      createdAt: new Date().toISOString(),
    };
    setPosts(prev => [post, ...prev]);
    setNewPost('');
    setShowForm(false);
  };

  return (
    <div style={{ padding: 24, maxWidth: 800, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Community Wall</h2>
        <button onClick={() => setShowForm(!showForm)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: 'var(--accent-primary)', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
          <Plus size={16} /> Post
        </button>
      </div>

      {showForm && (
        <div style={{ background: 'var(--bg-elevated)', borderRadius: 8, padding: 16, marginBottom: 16, border: '1px solid var(--border-primary)' }}>
          <textarea
            value={newPost}
            onChange={e => setNewPost(e.target.value)}
            placeholder="Share something with the community..."
            style={{ width: '100%', minHeight: 80, padding: 12, borderRadius: 6, border: '1px solid var(--border-primary)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: 14, resize: 'vertical', boxSizing: 'border-box' }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
            <button onClick={() => setShowForm(false)} style={{ padding: '8px 16px', background: 'none', border: '1px solid var(--border-primary)', color: 'var(--text-muted)', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>Cancel</button>
            <button onClick={addPost} style={{ padding: '8px 16px', background: 'var(--accent-primary)', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>Post</button>
          </div>
        </div>
      )}

      {posts.length === 0 && (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
          <p style={{ fontSize: 16, marginBottom: 8 }}>No posts yet</p>
          <p style={{ fontSize: 13 }}>Be the first to share something!</p>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 16 }}>
        {posts.map(post => (
          <div key={post.id} style={{ background: 'var(--bg-elevated)', borderRadius: 8, padding: 16, border: '1px solid var(--border-primary)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: 'white', fontWeight: 600, flexShrink: 0 }}>
                {post.authorName[0]}
              </div>
              <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{post.authorName}</span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>{new Date(post.createdAt).toLocaleDateString()}</span>
            </div>
            <p style={{ fontSize: 14, color: 'var(--text-primary)', margin: 0, lineHeight: 1.5 }}>{post.content}</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 12 }}>
              <button
                onClick={() => setPosts(prev => prev.map(p => p.id === post.id ? { ...p, liked: !p.liked, likes: p.liked ? p.likes - 1 : p.likes + 1 } : p))}
                style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', color: post.liked ? 'var(--error)' : 'var(--text-muted)', cursor: 'pointer', fontSize: 12, padding: 0 }}
              >
                <Heart size={14} fill={post.liked ? 'currentColor' : 'none'} /> {post.likes}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
