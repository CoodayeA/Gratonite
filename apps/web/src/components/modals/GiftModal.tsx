import { useState, useEffect } from 'react';
import { X, Gift, Zap, Crown, Coins, Send, CheckCircle, Package } from 'lucide-react';
import { api } from '../../lib/api';

interface GiftModalProps {
  recipientId: string;
  recipientName: string;
  onClose: () => void;
}

const GIFT_OPTIONS = [
  { type: 'server_boost', label: 'Server Boost', icon: Zap, cost: 500, color: '#f472b6', desc: 'Boost a server for 30 days' },
  { type: 'premium_month', label: 'Premium (1 month)', icon: Crown, cost: 1000, color: '#fbbf24', desc: 'Gift premium features for 1 month' },
  { type: 'premium_year', label: 'Premium (1 year)', icon: Crown, cost: 10000, color: '#fbbf24', desc: 'Gift premium features for 1 year' },
  { type: 'coins', label: 'Gift Coins', icon: Coins, cost: 0, color: '#34d399', desc: 'Send coins directly' },
] as const;

export default function GiftModal({ recipientId, recipientName, onClose }: GiftModalProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const [selectedType, setSelectedType] = useState<string>('premium_month');
  const [quantity, setQuantity] = useState(1);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const selected = GIFT_OPTIONS.find(o => o.type === selectedType)!;
  const totalCost = selectedType === 'coins' ? quantity : selected.cost * quantity;

  const handleSend = async () => {
    setSending(true);
    setError('');
    try {
      await api.gifts.create({
        recipientId,
        giftType: selectedType,
        quantity,
        message: message.trim() || undefined,
      });
      setSent(true);
    } catch (err: any) {
      setError(err?.message || 'Failed to send gift');
    }
    setSending(false);
  };

  if (sent) {
    return (
      <div className="modal-backdrop" style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }} onClick={onClose}>
        <div role="dialog" aria-modal="true" aria-label="Gift sent" onClick={e => e.stopPropagation()} style={{
          background: 'var(--bg-secondary)', borderRadius: '16px', padding: '40px',
          width: '420px', maxWidth: '95vw', textAlign: 'center',
        }}>
          <CheckCircle size={48} color="#22c55e" style={{ marginBottom: '16px' }} />
          <h2 style={{ margin: '0 0 8px', fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)' }}>
            Gift Sent!
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '24px' }}>
            Your gift to <strong>{recipientName}</strong> is on its way. They'll be notified to redeem it.
          </p>
          <button onClick={onClose} style={{
            padding: '10px 24px', borderRadius: '8px', border: 'none', cursor: 'pointer',
            background: 'var(--accent-primary)', color: '#fff', fontSize: '14px', fontWeight: 600,
          }}>
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-backdrop" style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Send a gift" onClick={e => e.stopPropagation()} style={{
        background: 'var(--bg-secondary)', borderRadius: '16px',
        width: '480px', maxWidth: '95vw', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderBottom: '1px solid var(--stroke)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Gift size={20} color="var(--accent-primary)" />
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>
              Send Gift to {recipientName}
            </h2>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
            padding: '4px', borderRadius: '4px',
          }}>
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 24px' }}>
          {/* Gift type selection */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px' }}>
            {GIFT_OPTIONS.map(opt => {
              const Icon = opt.icon;
              const isSelected = selectedType === opt.type;
              return (
                <button
                  key={opt.type}
                  onClick={() => { setSelectedType(opt.type); setQuantity(1); }}
                  style={{
                    padding: '12px', borderRadius: '10px', cursor: 'pointer',
                    background: isSelected ? `${opt.color}15` : 'var(--bg-elevated)',
                    border: `2px solid ${isSelected ? opt.color : 'var(--stroke)'}`,
                    textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '4px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Icon size={16} color={opt.color} />
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {opt.label}
                    </span>
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{opt.desc}</span>
                  {opt.cost > 0 && (
                    <span style={{ fontSize: '11px', color: opt.color, fontWeight: 600 }}>
                      {opt.cost.toLocaleString()} coins
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Quantity */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
              {selectedType === 'coins' ? 'AMOUNT' : 'QUANTITY'}
            </label>
            <input
              type="number"
              min={1}
              max={selectedType === 'coins' ? 99999 : 10}
              value={quantity}
              onChange={e => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
              style={{
                width: '100%', padding: '10px 12px', borderRadius: '8px',
                background: 'var(--bg-elevated)', border: '1px solid var(--stroke)',
                color: 'var(--text-primary)', fontSize: '14px', boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Message */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
              PERSONAL MESSAGE (OPTIONAL)
            </label>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              maxLength={500}
              placeholder="Add a message..."
              rows={3}
              style={{
                width: '100%', padding: '10px 12px', borderRadius: '8px',
                background: 'var(--bg-elevated)', border: '1px solid var(--stroke)',
                color: 'var(--text-primary)', fontSize: '14px', resize: 'vertical',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Total cost */}
          <div style={{
            padding: '12px 16px', borderRadius: '10px', background: 'var(--bg-elevated)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: '16px',
          }}>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Total Cost</span>
            <span style={{ fontSize: '16px', fontWeight: 700, color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Coins size={16} /> {totalCost.toLocaleString()} coins
            </span>
          </div>

          {error && (
            <p style={{ color: '#ef4444', fontSize: '13px', marginBottom: '12px' }}>{error}</p>
          )}

          {/* Send button */}
          <button
            onClick={handleSend}
            disabled={sending}
            style={{
              width: '100%', padding: '12px', borderRadius: '10px', border: 'none',
              cursor: sending ? 'not-allowed' : 'pointer',
              background: 'var(--accent-primary)', color: '#fff',
              fontSize: '15px', fontWeight: 600, display: 'flex', alignItems: 'center',
              justifyContent: 'center', gap: '8px', opacity: sending ? 0.6 : 1,
            }}
          >
            <Send size={16} /> {sending ? 'Sending...' : 'Send Gift'}
          </button>
        </div>
      </div>
    </div>
  );
}
