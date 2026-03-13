import { useState, useEffect } from 'react';
import { X, ArrowRightLeft, Check, XCircle, Send } from 'lucide-react';
import { api } from '../../lib/api';

interface OwnedCard {
  id: string;
  name: string;
  image: string;
  rarity: string;
  series: string;
  count: number;
}

interface Trade {
  id: string;
  fromUserId: string;
  toUserId: string;
  status: string;
  createdAt: string;
}

const RARITY_COLORS: Record<string, string> = {
  common: '#94a3b8',
  uncommon: '#22c55e',
  rare: '#3b82f6',
  epic: '#a855f7',
  legendary: '#f59e0b',
};

interface Props {
  open: boolean;
  onClose: () => void;
  ownedCards: OwnedCard[];
  currentUserId: string;
  onTradeComplete?: () => void;
}

export default function TradeModal({ open, onClose, ownedCards, currentUserId, onTradeComplete }: Props) {
  const [tab, setTab] = useState<'new' | 'pending'>('new');
  const [recipientId, setRecipientId] = useState('');
  const [selectedOfferIds, setSelectedOfferIds] = useState<string[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loadingTrades, setLoadingTrades] = useState(false);
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (open && tab === 'pending') {
      loadTrades();
    }
  }, [open, tab]);

  const loadTrades = async () => {
    setLoadingTrades(true);
    try {
      const data = await api.collectibleCards.getTrades();
      setTrades(Array.isArray(data) ? data : []);
    } catch {
      // ignore
    }
    setLoadingTrades(false);
  };

  const toggleOffer = (cardId: string) => {
    setSelectedOfferIds(prev =>
      prev.includes(cardId) ? prev.filter(id => id !== cardId) : [...prev, cardId],
    );
  };

  const handleSend = async () => {
    if (!recipientId.trim() || selectedOfferIds.length === 0 || sending) return;
    setSending(true);
    try {
      await api.collectibleCards.proposeTrade({
        toUserId: recipientId.trim(),
        offerCardIds: selectedOfferIds,
      });
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setSelectedOfferIds([]);
        setRecipientId('');
        onTradeComplete?.();
      }, 1500);
    } catch {
      // ignore
    }
    setSending(false);
  };

  const handleAccept = async (tradeId: string) => {
    try {
      await api.collectibleCards.acceptTrade(tradeId);
      setTrades(prev => prev.filter(t => t.id !== tradeId));
      onTradeComplete?.();
    } catch {
      // ignore
    }
  };

  const handleDecline = async (tradeId: string) => {
    try {
      await api.collectibleCards.declineTrade(tradeId);
      setTrades(prev => prev.filter(t => t.id !== tradeId));
    } catch {
      // ignore
    }
  };

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
      }}
    >
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--bg-secondary)', borderRadius: '16px',
        width: '420px', maxWidth: '95vw', maxHeight: '80vh',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px', borderBottom: '1px solid var(--stroke)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ArrowRightLeft size={18} color="var(--accent-primary)" />
            <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
              Card Trading
            </h2>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-muted)', padding: '4px',
          }}>
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--stroke)' }}>
          {(['new', 'pending'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                flex: 1, padding: '10px', background: 'none', border: 'none',
                borderBottom: tab === t ? '2px solid var(--accent-primary)' : '2px solid transparent',
                color: tab === t ? 'var(--text-primary)' : 'var(--text-muted)',
                fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                textTransform: 'capitalize',
              }}
            >
              {t === 'new' ? 'New Trade' : 'Pending Trades'}
            </button>
          ))}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px' }}>
          {tab === 'new' ? (
            <>
              {success ? (
                <div style={{ textAlign: 'center', padding: '40px 0' }}>
                  <Check size={40} color="#22c55e" />
                  <p style={{ fontSize: '14px', color: 'var(--text-primary)', marginTop: '12px' }}>
                    Trade offer sent!
                  </p>
                </div>
              ) : (
                <>
                  {/* Recipient */}
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                    Recipient User ID
                  </label>
                  <input
                    value={recipientId}
                    onChange={e => setRecipientId(e.target.value)}
                    placeholder="Paste user ID..."
                    style={{
                      width: '100%', padding: '8px 10px', borderRadius: '8px',
                      background: 'var(--bg-elevated)', border: '1px solid var(--stroke)',
                      color: 'var(--text-primary)', fontSize: '13px', outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />

                  {/* Card selection */}
                  <label style={{
                    fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)',
                    display: 'block', marginTop: '14px', marginBottom: '6px',
                  }}>
                    Select cards to offer ({selectedOfferIds.length} selected)
                  </label>

                  {ownedCards.length === 0 ? (
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>
                      You don't own any cards to trade.
                    </p>
                  ) : (
                    <div style={{
                      display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(70px, 1fr))',
                      gap: '6px', maxHeight: '240px', overflow: 'auto',
                    }}>
                      {ownedCards.filter(c => c.count > 0).map(card => {
                        const isSelected = selectedOfferIds.includes(card.id);
                        return (
                          <div
                            key={card.id}
                            onClick={() => toggleOffer(card.id)}
                            style={{
                              borderRadius: '8px', overflow: 'hidden', cursor: 'pointer',
                              border: `2px solid ${isSelected ? RARITY_COLORS[card.rarity] || 'var(--accent-primary)' : 'rgba(255,255,255,0.06)'}`,
                              opacity: isSelected ? 1 : 0.6,
                              transition: 'opacity 0.15s, border-color 0.15s',
                              position: 'relative',
                            }}
                          >
                            <div style={{
                              width: '100%', aspectRatio: '3/4',
                              background: `url(${card.image}) center/cover no-repeat`,
                            }} />
                            <div style={{
                              fontSize: '10px', fontWeight: 600, padding: '3px 4px',
                              color: 'var(--text-primary)', whiteSpace: 'nowrap',
                              overflow: 'hidden', textOverflow: 'ellipsis',
                              background: 'var(--bg-elevated)',
                            }}>
                              {card.name}
                            </div>
                            {isSelected && (
                              <div style={{
                                position: 'absolute', top: 2, right: 2,
                                width: '16px', height: '16px', borderRadius: '50%',
                                background: 'var(--accent-primary)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                              }}>
                                <Check size={10} color="#fff" />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Send button */}
                  <button
                    onClick={handleSend}
                    disabled={sending || !recipientId.trim() || selectedOfferIds.length === 0}
                    style={{
                      width: '100%', marginTop: '14px', padding: '10px',
                      borderRadius: '8px', border: 'none',
                      background: 'var(--accent-primary)', color: '#fff',
                      fontSize: '13px', fontWeight: 600,
                      cursor: sending ? 'wait' : 'pointer',
                      opacity: sending || !recipientId.trim() || selectedOfferIds.length === 0 ? 0.5 : 1,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                    }}
                  >
                    <Send size={14} />
                    {sending ? 'Sending...' : 'Send Trade Offer'}
                  </button>
                </>
              )}
            </>
          ) : (
            /* Pending trades tab */
            <>
              {loadingTrades ? (
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>
                  Loading trades...
                </p>
              ) : trades.length === 0 ? (
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', padding: '30px 0' }}>
                  No pending trades.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {trades.map(trade => {
                    const isIncoming = trade.toUserId === currentUserId;
                    return (
                      <div key={trade.id} style={{
                        padding: '12px', borderRadius: '10px',
                        background: 'var(--bg-elevated)', border: '1px solid var(--stroke)',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div>
                            <span style={{
                              fontSize: '11px', fontWeight: 600,
                              padding: '2px 6px', borderRadius: '4px',
                              background: isIncoming ? 'rgba(59,130,246,0.15)' : 'rgba(168,85,247,0.15)',
                              color: isIncoming ? '#3b82f6' : '#a855f7',
                            }}>
                              {isIncoming ? 'Incoming' : 'Sent'}
                            </span>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '8px' }}>
                              {isIncoming ? `From: ${trade.fromUserId.slice(0, 8)}...` : `To: ${trade.toUserId.slice(0, 8)}...`}
                            </span>
                          </div>
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                            {new Date(trade.createdAt).toLocaleDateString()}
                          </span>
                        </div>

                        {isIncoming && (
                          <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
                            <button
                              onClick={() => handleAccept(trade.id)}
                              style={{
                                flex: 1, padding: '6px', borderRadius: '6px',
                                border: 'none', cursor: 'pointer',
                                background: 'rgba(34,197,94,0.15)', color: '#22c55e',
                                fontSize: '12px', fontWeight: 600,
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
                              }}
                            >
                              <Check size={12} /> Accept
                            </button>
                            <button
                              onClick={() => handleDecline(trade.id)}
                              style={{
                                flex: 1, padding: '6px', borderRadius: '6px',
                                border: 'none', cursor: 'pointer',
                                background: 'rgba(239,68,68,0.15)', color: '#ef4444',
                                fontSize: '12px', fontWeight: 600,
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
                              }}
                            >
                              <XCircle size={12} /> Decline
                            </button>
                          </div>
                        )}

                        {!isIncoming && (
                          <div style={{ marginTop: '8px' }}>
                            <button
                              onClick={() => handleDecline(trade.id)}
                              style={{
                                width: '100%', padding: '6px', borderRadius: '6px',
                                border: 'none', cursor: 'pointer',
                                background: 'rgba(239,68,68,0.1)', color: '#ef4444',
                                fontSize: '12px', fontWeight: 600,
                              }}
                            >
                              Cancel Trade
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
