import { useState, useEffect, useRef } from 'react';
import { Plus, X, ChevronLeft, ChevronRight, Eye } from 'lucide-react';
import { api, API_BASE } from '../lib/api';
import { useToast } from './ui/ToastManager';

interface Story {
  id: string;
  content: string;
  type: 'text' | 'image';
  imageUrl?: string;
  backgroundColor?: string;
  createdAt: string;
  viewCount: number;
  viewed: boolean;
}

interface StoryGroup {
  userId: string;
  username: string;
  displayName: string;
  avatarHash: string | null;
  stories: Story[];
  hasUnviewed: boolean;
}

const STORY_COLORS = [
  'linear-gradient(135deg, #667eea, #764ba2)',
  'linear-gradient(135deg, #f093fb, #f5576c)',
  'linear-gradient(135deg, #4facfe, #00f2fe)',
  'linear-gradient(135deg, #43e97b, #38f9d7)',
  'linear-gradient(135deg, #fa709a, #fee140)',
  'linear-gradient(135deg, #a18cd1, #fbc2eb)',
];

function StoryViewer({ group, onClose }: { group: StoryGroup; onClose: () => void }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const story = group.stories[currentIndex];
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Mark as viewed
    if (story && !story.viewed) {
      api.stories.view(story.id).catch(() => {});
    }
    // Auto advance after 5s
    timerRef.current = setTimeout(() => {
      if (currentIndex < group.stories.length - 1) {
        setCurrentIndex(prev => prev + 1);
      } else {
        onClose();
      }
    }, 5000);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [currentIndex, story, group.stories.length, onClose]);

  if (!story) return null;

  const goNext = () => {
    if (currentIndex < group.stories.length - 1) setCurrentIndex(prev => prev + 1);
    else onClose();
  };
  const goPrev = () => {
    if (currentIndex > 0) setCurrentIndex(prev => prev - 1);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.9)', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        width: 'min(400px, 90vw)', height: 'min(700px, 85vh)',
        borderRadius: '16px', overflow: 'hidden', position: 'relative',
        background: story.backgroundColor || STORY_COLORS[currentIndex % STORY_COLORS.length],
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Progress bars */}
        <div style={{ display: 'flex', gap: '3px', padding: '12px 12px 0' }}>
          {group.stories.map((_, i) => (
            <div key={i} style={{
              flex: 1, height: '3px', borderRadius: '2px',
              background: i <= currentIndex ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.3)',
              transition: 'background 0.3s',
            }} />
          ))}
        </div>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: '12px 16px',
        }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '50%',
            background: 'rgba(255,255,255,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden',
          }}>
            {group.avatarHash ? (
              <img src={`${API_BASE}/files/${group.avatarHash}`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <span style={{ color: '#fff', fontWeight: 700, fontSize: '16px' }}>
                {group.displayName.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ color: '#fff', fontWeight: 600, fontSize: '14px' }}>{group.displayName}</div>
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '11px' }}>
              {new Date(story.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'rgba(255,255,255,0.6)', fontSize: '12px' }}>
            <Eye size={14} /> {story.viewCount}
          </div>
          <button onClick={onClose} style={{
            background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff',
            width: '32px', height: '32px', borderRadius: '50%',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '24px', textAlign: 'center',
        }}>
          {story.type === 'image' && story.imageUrl ? (
            <img src={story.imageUrl} alt="" style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: '12px', objectFit: 'contain' }} />
          ) : (
            <p style={{
              color: '#fff', fontSize: 'clamp(18px, 4vw, 28px)',
              fontWeight: 600, lineHeight: 1.4, wordBreak: 'break-word',
            }}>
              {story.content}
            </p>
          )}
        </div>

        {/* Navigation areas */}
        <div onClick={goPrev} style={{ position: 'absolute', left: 0, top: '60px', bottom: '60px', width: '30%', cursor: currentIndex > 0 ? 'pointer' : 'default' }} />
        <div onClick={goNext} style={{ position: 'absolute', right: 0, top: '60px', bottom: '60px', width: '30%', cursor: 'pointer' }} />
      </div>
    </div>
  );
}

function StoryCreator({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [content, setContent] = useState('');
  const [selectedColor, setSelectedColor] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { addToast } = useToast();

  const handleCreate = async () => {
    if (!content.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await api.stories.create({
        content: content.trim(),
        type: 'text',
        backgroundColor: STORY_COLORS[selectedColor],
      });
      addToast({ title: 'Story posted', variant: 'success' });
      onCreated();
      onClose();
    } catch {
      addToast({ title: 'Failed to post story', variant: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.8)', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        width: 'min(400px, 90vw)', background: 'var(--bg-elevated)',
        borderRadius: '16px', padding: '24px', display: 'flex',
        flexDirection: 'column', gap: '16px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Create Story</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <X size={18} />
          </button>
        </div>

        {/* Preview */}
        <div style={{
          width: '100%', height: '200px', borderRadius: '12px',
          background: STORY_COLORS[selectedColor],
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '20px',
        }}>
          <p style={{ color: '#fff', fontSize: '18px', fontWeight: 600, textAlign: 'center', wordBreak: 'break-word' }}>
            {content || 'Your story preview'}
          </p>
        </div>

        {/* Color picker */}
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
          {STORY_COLORS.map((color, i) => (
            <button
              key={i}
              onClick={() => setSelectedColor(i)}
              style={{
                width: '32px', height: '32px', borderRadius: '50%',
                background: color, border: selectedColor === i ? '3px solid #fff' : '2px solid transparent',
                cursor: 'pointer', boxShadow: selectedColor === i ? '0 0 0 2px var(--accent-primary)' : 'none',
              }}
            />
          ))}
        </div>

        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="What's on your mind?"
          maxLength={500}
          style={{
            width: '100%', minHeight: '80px', padding: '12px',
            background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)',
            borderRadius: '8px', color: 'var(--text-primary)',
            fontSize: '14px', resize: 'vertical', outline: 'none',
            fontFamily: 'inherit', boxSizing: 'border-box',
          }}
        />

        <button
          onClick={handleCreate}
          disabled={!content.trim() || isSubmitting}
          style={{
            width: '100%', padding: '12px', borderRadius: '8px',
            background: content.trim() ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
            color: content.trim() ? '#000' : 'var(--text-muted)',
            border: 'none', fontWeight: 600, fontSize: '14px',
            cursor: content.trim() ? 'pointer' : 'default',
            opacity: isSubmitting ? 0.6 : 1,
          }}
        >
          {isSubmitting ? 'Posting...' : 'Share Story'}
        </button>
      </div>
    </div>
  );
}

export function StoriesBar() {
  const [storyGroups, setStoryGroups] = useState<StoryGroup[]>([]);
  const [viewingGroup, setViewingGroup] = useState<StoryGroup | null>(null);
  const [showCreator, setShowCreator] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadStories = () => {
    api.stories.feed().then(setStoryGroups).catch(() => {});
  };

  useEffect(() => { loadStories(); }, []);

  const scrollLeft = () => scrollRef.current?.scrollBy({ left: -200, behavior: 'smooth' });
  const scrollRight = () => scrollRef.current?.scrollBy({ left: 200, behavior: 'smooth' });

  if (storyGroups.length === 0 && !showCreator) {
    // Show just the create button when no stories
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: '12px',
        padding: '12px 16px', borderBottom: '1px solid var(--stroke)',
      }}>
        <button
          onClick={() => setShowCreator(true)}
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
            background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)',
          }}
        >
          <div style={{
            width: '56px', height: '56px', borderRadius: '50%',
            border: '2px dashed var(--stroke)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Plus size={20} />
          </div>
          <span style={{ fontSize: '11px', fontWeight: 500 }}>Your Story</span>
        </button>

        {showCreator && <StoryCreator onClose={() => setShowCreator(false)} onCreated={loadStories} />}
      </div>
    );
  }

  return (
    <>
      <div style={{
        position: 'relative',
        borderBottom: '1px solid var(--stroke)',
        padding: '12px 0',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', position: 'relative' }}>
          <button onClick={scrollLeft} style={{
            background: 'var(--bg-tertiary)', border: 'none', color: 'var(--text-muted)',
            width: '24px', height: '24px', borderRadius: '50%', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            marginLeft: '8px',
          }}>
            <ChevronLeft size={14} />
          </button>

          <div
            ref={scrollRef}
            style={{
              display: 'flex', gap: '12px', overflowX: 'auto', flex: 1,
              scrollbarWidth: 'none', padding: '0 8px',
            }}
          >
            {/* Create Story Button */}
            <button
              onClick={() => setShowCreator(true)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
                background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)',
                flexShrink: 0,
              }}
            >
              <div style={{
                width: '56px', height: '56px', borderRadius: '50%',
                border: '2px dashed var(--accent-primary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Plus size={20} color="var(--accent-primary)" />
              </div>
              <span style={{ fontSize: '11px', fontWeight: 500, maxWidth: '64px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Your Story</span>
            </button>

            {/* Story bubbles */}
            {storyGroups.map(group => (
              <button
                key={group.userId}
                onClick={() => setViewingGroup(group)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
                  background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0,
                }}
              >
                <div style={{
                  width: '60px', height: '60px', borderRadius: '50%',
                  padding: '3px',
                  background: group.hasUnviewed
                    ? 'linear-gradient(135deg, var(--accent-primary), #f59e0b)'
                    : 'var(--stroke)',
                }}>
                  <div style={{
                    width: '100%', height: '100%', borderRadius: '50%',
                    border: '2px solid var(--bg-primary)',
                    overflow: 'hidden', background: 'var(--bg-tertiary)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {group.avatarHash ? (
                      <img src={`${API_BASE}/files/${group.avatarHash}`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <span style={{ fontWeight: 700, fontSize: '18px', color: 'var(--text-primary)' }}>
                        {group.displayName.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                </div>
                <span style={{
                  fontSize: '11px', fontWeight: group.hasUnviewed ? 600 : 400,
                  color: group.hasUnviewed ? 'var(--text-primary)' : 'var(--text-muted)',
                  maxWidth: '64px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {group.displayName}
                </span>
              </button>
            ))}
          </div>

          <button onClick={scrollRight} style={{
            background: 'var(--bg-tertiary)', border: 'none', color: 'var(--text-muted)',
            width: '24px', height: '24px', borderRadius: '50%', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            marginRight: '8px',
          }}>
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {viewingGroup && (
        <StoryViewer group={viewingGroup} onClose={() => { setViewingGroup(null); loadStories(); }} />
      )}
      {showCreator && (
        <StoryCreator onClose={() => setShowCreator(false)} onCreated={loadStories} />
      )}
    </>
  );
}
