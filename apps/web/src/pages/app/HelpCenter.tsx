import { useState } from 'react';
import {
  HelpCircle,
  Search,
  ChevronDown,
  ChevronRight,
  Book,
  Shield,
  Server,
  Bot,
  CreditCard,
  Sparkles,
} from 'lucide-react';
import { ARTICLES, type Category } from '../../data/helpArticles';

const CATEGORIES: Category[] = [
  'All',
  'Getting Started',
  'Account & Security',
  'Servers & Channels',
  'Bots & Integrations',
  'Billing & Premium',
  'Cosmetics & Shop',
  'Creator Tools',
  'Marketplace & Auctions',
];

const CATEGORY_ICONS: Record<Exclude<Category, 'All'>, typeof Book> = {
  'Getting Started': Sparkles,
  'Account & Security': Shield,
  'Servers & Channels': Server,
  'Bots & Integrations': Bot,
  'Billing & Premium': CreditCard,
  'Cosmetics & Shop': Sparkles,
  'Creator Tools': Sparkles,
  'Marketplace & Auctions': Sparkles,
};

const CATEGORY_COLORS: Record<Exclude<Category, 'All'>, string> = {
  'Getting Started': 'var(--accent-primary)',
  'Account & Security': 'var(--warning)',
  'Servers & Channels': 'var(--success)',
  'Bots & Integrations': '#a78bfa',
  'Billing & Premium': '#f472b6',
  'Cosmetics & Shop': '#fb7185',
  'Creator Tools': '#14b8a6',
  'Marketplace & Auctions': '#f59e0b',
};

export default function HelpCenter() {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<Category>('All');
  const [expandedArticle, setExpandedArticle] = useState<string | null>(null);

  const filtered = ARTICLES.filter((a) => {
    const matchesCategory =
      activeCategory === 'All' || a.category === activeCategory;
    const query = search.toLowerCase();
    const matchesSearch =
      !query ||
      a.title.toLowerCase().includes(query) ||
      a.description.toLowerCase().includes(query) ||
      a.body.some((line) => line.toLowerCase().includes(query));
    return matchesCategory && matchesSearch;
  });

  const toggleArticle = (id: string) => {
    setExpandedArticle((prev) => (prev === id ? null : id));
  };

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        overflow: 'auto',
        background: 'var(--bg-primary)',
        fontFamily: 'var(--font-sans)',
      }}
    >
      <div
        style={{
          maxWidth: 960,
          margin: '0 auto',
          padding: '40px 24px 60px',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginBottom: 8,
          }}
        >
          <HelpCircle
            size={32}
            style={{ color: 'var(--accent-primary)', flexShrink: 0 }}
          />
          <h1
            style={{
              margin: 0,
              fontSize: 28,
              fontWeight: 700,
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-display)',
            }}
          >
            Help Center
          </h1>
        </div>
        <p
          style={{
            margin: '0 0 28px 44px',
            fontSize: 14,
            color: 'var(--text-secondary)',
          }}
        >
          Find answers to common questions
        </p>

        {/* Search */}
        <div
          style={{
            position: 'relative',
            marginBottom: 24,
          }}
        >
          <Search
            size={18}
            style={{
              position: 'absolute',
              left: 14,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted)',
              pointerEvents: 'none',
            }}
          />
          <input
            type="text"
            placeholder="Search help articles..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '12px 16px 12px 42px',
              fontSize: 15,
              color: 'var(--text-primary)',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--stroke)',
              borderRadius: 'var(--radius-md)',
              outline: 'none',
              fontFamily: 'var(--font-sans)',
            }}
          />
        </div>

        {/* Category tabs */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
            marginBottom: 28,
          }}
        >
          {CATEGORIES.map((cat) => {
            const isActive = activeCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                style={{
                  padding: '8px 16px',
                  fontSize: 13,
                  fontWeight: 600,
                  fontFamily: 'var(--font-sans)',
                  color: isActive
                    ? 'var(--bg-primary)'
                    : 'var(--text-secondary)',
                  background: isActive
                    ? 'var(--accent-primary)'
                    : 'var(--bg-tertiary)',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  transition: 'background 0.15s, color 0.15s',
                }}
              >
                {cat}
              </button>
            );
          })}
        </div>

        {/* Articles grid */}
        {filtered.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '48px 0',
              color: 'var(--text-muted)',
              fontSize: 15,
            }}
          >
            No articles found matching your search.
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))',
              gap: 16,
            }}
          >
            {filtered.map((article) => {
              const isExpanded = expandedArticle === article.id;
              const CatIcon = CATEGORY_ICONS[article.category];
              const catColor = CATEGORY_COLORS[article.category];

              return (
                <div
                  key={article.id}
                  style={{
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--stroke)',
                    borderRadius: 'var(--radius-lg)',
                    overflow: 'hidden',
                    boxShadow: 'var(--shadow-panel)',
                    transition: 'border-color 0.15s',
                  }}
                >
                  {/* Card header */}
                  <div style={{ padding: '18px 20px 14px' }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        marginBottom: 8,
                      }}
                    >
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                          padding: '3px 10px',
                          fontSize: 11,
                          fontWeight: 600,
                          color: catColor,
                          background: `color-mix(in srgb, ${catColor} 12%, transparent)`,
                          borderRadius: 'var(--radius-sm)',
                          fontFamily: 'var(--font-sans)',
                        }}
                      >
                        <CatIcon size={12} />
                        {article.category}
                      </span>
                    </div>
                    <h3
                      style={{
                        margin: '0 0 6px',
                        fontSize: 16,
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                        fontFamily: 'var(--font-display)',
                      }}
                    >
                      {article.title}
                    </h3>
                    <p
                      style={{
                        margin: 0,
                        fontSize: 13,
                        color: 'var(--text-secondary)',
                        lineHeight: 1.5,
                      }}
                    >
                      {article.description}
                    </p>
                  </div>

                  {/* Expand toggle */}
                  <button
                    onClick={() => toggleArticle(article.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      width: '100%',
                      padding: '10px 20px',
                      fontSize: 13,
                      fontWeight: 600,
                      fontFamily: 'var(--font-sans)',
                      color: 'var(--accent-primary)',
                      background: 'var(--bg-tertiary)',
                      border: 'none',
                      borderTop: '1px solid var(--stroke)',
                      cursor: 'pointer',
                      transition: 'background 0.15s',
                    }}
                  >
                    {isExpanded ? (
                      <ChevronDown size={16} />
                    ) : (
                      <ChevronRight size={16} />
                    )}
                    {isExpanded ? 'Collapse' : 'Read More'}
                  </button>

                  {/* Expanded content */}
                  {isExpanded && (
                    <div
                      style={{
                        padding: '16px 20px 20px',
                        borderTop: '1px solid var(--stroke)',
                        background: 'var(--bg-elevated)',
                      }}
                    >
                      <ol
                        style={{
                          margin: 0,
                          paddingLeft: 20,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 10,
                        }}
                      >
                        {article.body.map((step, i) => (
                          <li
                            key={i}
                            style={{
                              fontSize: 13,
                              lineHeight: 1.6,
                              color: 'var(--text-primary)',
                            }}
                          >
                            {step}
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
