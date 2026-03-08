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
  MessageCircle,
  Lock,
} from 'lucide-react';
import { ARTICLES, type Category } from '../../data/helpArticles';

const CATEGORIES: Category[] = [
  'All',
  'Getting Started',
  'Account & Security',
  'Servers & Channels',
  'Messaging & Chat',
  'Bots & Integrations',
  'Billing & Premium',
  'Cosmetics & Shop',
  'Creator Tools',
  'Marketplace & Auctions',
  'Privacy & Safety',
];

const CATEGORY_ICONS: Record<Exclude<Category, 'All'>, typeof Book> = {
  'Getting Started': Sparkles,
  'Account & Security': Shield,
  'Servers & Channels': Server,
  'Messaging & Chat': MessageCircle,
  'Bots & Integrations': Bot,
  'Billing & Premium': CreditCard,
  'Cosmetics & Shop': Sparkles,
  'Creator Tools': Sparkles,
  'Marketplace & Auctions': Sparkles,
  'Privacy & Safety': Lock,
};

const CATEGORY_COLORS: Record<Exclude<Category, 'All'>, string> = {
  'Getting Started': 'var(--accent-primary)',
  'Account & Security': 'var(--warning)',
  'Servers & Channels': 'var(--success)',
  'Messaging & Chat': '#60a5fa',
  'Bots & Integrations': '#a78bfa',
  'Billing & Premium': '#f472b6',
  'Cosmetics & Shop': '#fb7185',
  'Creator Tools': '#14b8a6',
  'Marketplace & Auctions': '#f59e0b',
  'Privacy & Safety': '#f87171',
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

  // Group filtered articles by category for the "All" view
  const groupedByCategory = CATEGORIES.filter(c => c !== 'All').reduce((acc, cat) => {
    const articles = filtered.filter(a => a.category === cat);
    if (articles.length > 0) acc.push({ category: cat, articles });
    return acc;
  }, [] as Array<{ category: Exclude<Category, 'All'>; articles: typeof ARTICLES }>);

  const articleCounts = CATEGORIES.filter(c => c !== 'All').reduce((acc, cat) => {
    acc[cat] = ARTICLES.filter(a => a.category === cat).length;
    return acc;
  }, {} as Record<string, number>);

  const renderArticleCard = (article: typeof ARTICLES[0]) => {
    const isExpanded = expandedArticle === article.id;
    const catColor = CATEGORY_COLORS[article.category];

    return (
      <div
        key={article.id}
        style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--stroke)',
          borderRadius: 'var(--radius-lg)',
          borderLeft: `3px solid ${catColor}`,
          overflow: 'hidden',
          transition: 'border-color 0.15s',
        }}
      >
        {/* Card header */}
        <button
          onClick={() => toggleArticle(article.id)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            width: '100%',
            padding: '16px 20px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            textAlign: 'left',
            fontFamily: 'var(--font-sans)',
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3
              style={{
                margin: '0 0 4px',
                fontSize: 15,
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
                lineHeight: 1.4,
              }}
            >
              {article.description}
            </p>
          </div>
          {isExpanded ? (
            <ChevronDown size={18} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          ) : (
            <ChevronRight size={18} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          )}
        </button>

        {/* Expanded content */}
        {isExpanded && (
          <div
            style={{
              padding: '0 20px 20px',
              borderTop: '1px solid var(--stroke)',
              paddingTop: 16,
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
          maxWidth: 1100,
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

        {/* Main layout: Sidebar + Content */}
        <div style={{ display: 'flex', gap: 24 }}>
          {/* Sidebar navigation */}
          <nav
            style={{
              width: 240,
              flexShrink: 0,
              position: 'sticky',
              top: 24,
              alignSelf: 'flex-start',
            }}
          >
            <div
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--stroke)',
                borderRadius: 'var(--radius-lg)',
                overflow: 'hidden',
              }}
            >
              {/* "All" button */}
              <button
                onClick={() => setActiveCategory('All')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                  padding: '12px 16px',
                  fontSize: 13,
                  fontWeight: activeCategory === 'All' ? 700 : 500,
                  fontFamily: 'var(--font-sans)',
                  color: activeCategory === 'All' ? 'var(--accent-primary)' : 'var(--text-primary)',
                  background: activeCategory === 'All' ? 'color-mix(in srgb, var(--accent-primary) 8%, transparent)' : 'transparent',
                  border: 'none',
                  borderBottom: '1px solid var(--stroke)',
                  cursor: 'pointer',
                  transition: 'background 0.15s',
                  textAlign: 'left',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Book size={15} />
                  All Articles
                </span>
                <span style={{
                  fontSize: 11,
                  background: activeCategory === 'All' ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                  color: activeCategory === 'All' ? '#fff' : 'var(--text-secondary)',
                  padding: '2px 8px',
                  borderRadius: 10,
                  fontWeight: 600,
                }}>{ARTICLES.length}</span>
              </button>

              {/* Category buttons */}
              {CATEGORIES.filter(c => c !== 'All').map(cat => {
                const CatIcon = CATEGORY_ICONS[cat as Exclude<Category, 'All'>];
                const catColor = CATEGORY_COLORS[cat as Exclude<Category, 'All'>];
                const isActive = activeCategory === cat;
                const count = articleCounts[cat] || 0;

                return (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      width: '100%',
                      padding: '10px 16px',
                      fontSize: 13,
                      fontWeight: isActive ? 600 : 400,
                      fontFamily: 'var(--font-sans)',
                      color: isActive ? catColor : 'var(--text-secondary)',
                      background: isActive ? `color-mix(in srgb, ${catColor} 8%, transparent)` : 'transparent',
                      border: 'none',
                      borderBottom: '1px solid var(--stroke)',
                      cursor: 'pointer',
                      transition: 'background 0.15s, color 0.15s',
                      textAlign: 'left',
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <CatIcon size={14} style={{ color: isActive ? catColor : 'var(--text-muted)' }} />
                      {cat}
                    </span>
                    <span style={{
                      fontSize: 11,
                      background: isActive ? catColor : 'var(--bg-tertiary)',
                      color: isActive ? '#fff' : 'var(--text-muted)',
                      padding: '2px 7px',
                      borderRadius: 10,
                      fontWeight: 600,
                    }}>{count}</span>
                  </button>
                );
              })}
            </div>
          </nav>

          {/* Main content */}
          <div style={{ flex: 1, minWidth: 0 }}>
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
            ) : activeCategory !== 'All' ? (
              /* Single category view */
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {filtered.map(renderArticleCard)}
              </div>
            ) : (
              /* All categories view — grouped by category with collapsible headers */
              <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
                {groupedByCategory.map(({ category, articles }) => {
                  const CatIcon = CATEGORY_ICONS[category];
                  const catColor = CATEGORY_COLORS[category];

                  return (
                    <section key={category}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          marginBottom: 12,
                          paddingBottom: 8,
                          borderBottom: `2px solid ${catColor}22`,
                        }}
                      >
                        <CatIcon size={16} style={{ color: catColor }} />
                        <h2
                          style={{
                            margin: 0,
                            fontSize: 16,
                            fontWeight: 700,
                            color: 'var(--text-primary)',
                            fontFamily: 'var(--font-display)',
                          }}
                        >
                          {category}
                        </h2>
                        <span
                          style={{
                            fontSize: 11,
                            background: `color-mix(in srgb, ${catColor} 12%, transparent)`,
                            color: catColor,
                            padding: '2px 8px',
                            borderRadius: 10,
                            fontWeight: 600,
                          }}
                        >
                          {articles.length}
                        </span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {articles.map(renderArticleCard)}
                      </div>
                    </section>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
