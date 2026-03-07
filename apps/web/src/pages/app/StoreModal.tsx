import { useState } from 'react';
import { X, CreditCard, Gem, Zap, Crown, Loader2, CheckCircle } from 'lucide-react';
import { api } from '../../lib/api';
import { useToast } from '../../components/ui/ToastManager';

type Product = {
  id: string;
  name: string;
  description: string;
  price: string;
  icon: React.ReactNode;
  color: string;
};

const products: Product[] = [
  {
    id: 'coins_1000',
    name: '1,000 Coins',
    description: 'Top up your wallet with 1,000 Gratonite Coins.',
    price: '$0.99',
    icon: <Gem size={28} />,
    color: '#22c55e',
  },
  {
    id: 'coins_5000',
    name: '5,000 Coins',
    description: 'Best value! Get 5,000 Coins at a discount.',
    price: '$3.99',
    icon: <Gem size={28} />,
    color: '#3b82f6',
  },
  {
    id: 'boost_month',
    name: 'Server Boost',
    description: 'Boost your favorite server for a month.',
    price: '$2.99/mo',
    icon: <Zap size={28} />,
    color: '#a855f7',
  },
  {
    id: 'premium_month',
    name: 'Gratonite Premium',
    description: 'Unlock premium features, themes, and more.',
    price: '$4.99/mo',
    icon: <Crown size={28} />,
    color: '#f59e0b',
  },
];

type StoreModalProps = {
  open: boolean;
  onClose: () => void;
};

const StoreModal = ({ open, onClose }: StoreModalProps) => {
  const { addToast } = useToast();
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [purchaseSuccess, setPurchaseSuccess] = useState<string | null>(null);

  if (!open) return null;

  const handleBuy = async (productId: string) => {
    setPurchasing(productId);
    setPurchaseSuccess(null);
    try {
      const res = await fetch('/api/v1/payments/create-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${(api as any)._token || ''}` },
        credentials: 'include',
        body: JSON.stringify({ product: productId }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.code === 'STRIPE_NOT_CONFIGURED') {
          addToast({ title: 'Payments coming soon', description: 'Payment processing is not yet configured on this server.', variant: 'info' });
        } else {
          addToast({ title: 'Purchase failed', description: data.message || 'Something went wrong.', variant: 'error' });
        }
        return;
      }

      // In production with Stripe Elements, we'd confirm the payment here.
      // For now, show success since the intent was created.
      setPurchaseSuccess(productId);
      addToast({ title: 'Payment initiated', description: 'Your payment is being processed. Complete it in the payment form.', variant: 'info' });
    } catch {
      addToast({ title: 'Network error', description: 'Could not reach the payment server.', variant: 'error' });
    } finally {
      setPurchasing(null);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
    }} onClick={onClose}>
      <div
        style={{
          background: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--stroke)', width: '600px', maxWidth: '90vw',
          maxHeight: '80vh', overflow: 'auto', padding: '0',
          boxShadow: '0 24px 48px rgba(0,0,0,0.4)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 24px', borderBottom: '1px solid var(--stroke)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <CreditCard size={22} style={{ color: 'var(--accent-primary)' }} />
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Store</h2>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: 'var(--text-muted)', padding: '4px', borderRadius: '4px',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Products grid */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px',
          padding: '24px',
        }}>
          {products.map(product => (
            <div
              key={product.id}
              style={{
                background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)',
                border: '1px solid var(--stroke)', padding: '20px',
                display: 'flex', flexDirection: 'column', gap: '12px',
                transition: 'border-color 0.15s',
              }}
            >
              <div style={{
                width: '48px', height: '48px', borderRadius: '12px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: `${product.color}20`, color: product.color,
              }}>
                {product.icon}
              </div>
              <div>
                <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>{product.name}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', lineHeight: 1.4 }}>{product.description}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto' }}>
                <span style={{ fontSize: '16px', fontWeight: 700, color: product.color }}>{product.price}</span>
                <button
                  onClick={() => handleBuy(product.id)}
                  disabled={purchasing === product.id}
                  style={{
                    background: purchaseSuccess === product.id ? '#22c55e' : product.color,
                    color: '#fff', border: 'none', borderRadius: '8px',
                    padding: '8px 16px', fontSize: '13px', fontWeight: 600,
                    cursor: purchasing === product.id ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', gap: '6px',
                    opacity: purchasing === product.id ? 0.7 : 1,
                    transition: 'opacity 0.15s',
                  }}
                >
                  {purchasing === product.id ? (
                    <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Processing</>
                  ) : purchaseSuccess === product.id ? (
                    <><CheckCircle size={14} /> Done</>
                  ) : (
                    'Buy'
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default StoreModal;
