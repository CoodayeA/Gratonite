import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Check, X, ArrowLeftRight } from 'lucide-react';
import { getAccessToken, setAccessToken } from '../../lib/api';

/* ── Types ──────────────────────────────────────────────── */

interface StoredAccount {
  id: string;
  username: string;
  displayName: string;
  avatarHash: string | null;
  accessToken: string;
  refreshToken: string;
}

const STORAGE_KEY = 'gratonite_accounts';

function getAccounts(): StoredAccount[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveAccounts(accounts: StoredAccount[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
}

function getInitials(name: string): string {
  return name.charAt(0).toUpperCase();
}

function avatarUrl(id: string, hash: string): string {
  return `/avatars/${id}/${hash}.webp`;
}

/* ── Component ──────────────────────────────────────────── */

export function AccountSwitcher() {
  const [accounts, setAccounts] = useState<StoredAccount[]>(getAccounts);
  const [expanded, setExpanded] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentToken = getAccessToken();
  const activeAccount = useMemo(
    () => accounts.find(a => a.accessToken === currentToken) ?? accounts[0] ?? null,
    [accounts, currentToken],
  );

  // Close on outside click
  useEffect(() => {
    if (!expanded) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setExpanded(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [expanded]);

  const switchAccount = useCallback((account: StoredAccount) => {
    if (!account.accessToken) return;
    // Save current account state before switching
    if (activeAccount && currentToken) {
      const updated = accounts.map(a =>
        a.id === activeAccount.id ? { ...a, accessToken: currentToken } : a,
      );
      saveAccounts(updated);
    }
    setAccessToken(account.accessToken);
    localStorage.setItem('refresh_token', account.refreshToken);
    setExpanded(false);
    window.location.reload();
  }, [accounts, activeAccount, currentToken]);

  const addAccount = useCallback(() => {
    const loginUrl = `${window.location.origin}/login?addAccount=true`;
    const popup = window.open(loginUrl, 'gratonite_add_account', 'width=450,height=650');
    const handler = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      if (e.data?.type !== 'ACCOUNT_ADDED') return;
      const { id, username, displayName, avatarHash, accessToken, refreshToken } = e.data;
      const newAcc: StoredAccount = { id, username, displayName, avatarHash, accessToken, refreshToken };
      const updated = [...getAccounts().filter(a => a.id !== id), newAcc];
      saveAccounts(updated);
      setAccounts(updated);
      popup?.close();
    };
    window.addEventListener('message', handler);
    setTimeout(() => window.removeEventListener('message', handler), 300_000);
  }, []);

  const removeAccount = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const updated = getAccounts().filter(a => a.id !== id);
    saveAccounts(updated);
    setAccounts(updated);
  }, []);

  if (!activeAccount) return null;

  const totalUnreads = 0; // placeholder for cross-account unread counts

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      {/* Current account avatar trigger */}
      <button
        onClick={() => setExpanded(v => !v)}
        style={{
          position: 'relative',
          width: 40,
          height: 40,
          borderRadius: '50%',
          border: '2px solid var(--stroke)',
          background: activeAccount.avatarHash
            ? `url(${avatarUrl(activeAccount.id, activeAccount.avatarHash)}) center/cover`
            : 'var(--accent-primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontWeight: 700,
          fontSize: 16,
          cursor: 'pointer',
          padding: 0,
          overflow: 'visible',
        }}
      >
        {!activeAccount.avatarHash && getInitials(activeAccount.displayName || activeAccount.username)}
        {/* Switch icon overlay */}
        <div
          style={{
            position: 'absolute',
            bottom: -3,
            right: -3,
            width: 18,
            height: 18,
            borderRadius: '50%',
            background: 'var(--bg-elevated)',
            border: '2px solid var(--bg-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ArrowLeftRight size={10} style={{ color: 'var(--text-secondary)' }} />
        </div>
        {/* Unread badge */}
        {totalUnreads > 0 && (
          <div
            style={{
              position: 'absolute',
              top: -4,
              right: -4,
              minWidth: 16,
              height: 16,
              borderRadius: 8,
              background: '#ed4245',
              color: '#fff',
              fontSize: 10,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 4px',
              border: '2px solid var(--bg-primary)',
            }}
          >
            {totalUnreads}
          </div>
        )}
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            style={{
              position: 'absolute',
              bottom: '100%',
              left: 0,
              marginBottom: 8,
              width: 260,
              background: 'var(--bg-elevated)',
              border: '1px solid var(--stroke)',
              borderRadius: 10,
              boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
              zIndex: 100,
              overflow: 'hidden',
            }}
          >
            <div style={{ padding: '10px 12px 6px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em', color: 'var(--text-secondary)' }}>
              Accounts
            </div>

            <div style={{ padding: '0 4px' }}>
              {accounts.map(acc => {
                const isActive = acc.id === activeAccount.id;
                const isHovered = hoveredId === acc.id;
                return (
                  <button
                    key={acc.id}
                    onClick={() => !isActive && switchAccount(acc)}
                    onMouseEnter={() => setHoveredId(acc.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      width: '100%',
                      padding: 8,
                      border: 'none',
                      borderRadius: 6,
                      background: isActive || isHovered ? 'var(--bg-primary)' : 'transparent',
                      cursor: isActive ? 'default' : 'pointer',
                      textAlign: 'left',
                      position: 'relative',
                    }}
                  >
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: '50%',
                        flexShrink: 0,
                        background: acc.avatarHash
                          ? `url(${avatarUrl(acc.id, acc.avatarHash)}) center/cover`
                          : 'var(--accent-primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#fff',
                        fontWeight: 700,
                        fontSize: 13,
                      }}
                    >
                      {!acc.avatarHash && getInitials(acc.displayName || acc.username)}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {acc.displayName || acc.username}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>@{acc.username}</div>
                    </div>

                    {isActive && <Check size={16} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />}

                    {!isActive && isHovered && (
                      <div
                        onClick={e => removeAccount(e, acc.id)}
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          cursor: 'pointer',
                          background: 'rgba(237,66,69,0.15)',
                        }}
                      >
                        <X size={14} style={{ color: '#ed4245' }} />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            <div style={{ height: 1, background: 'var(--stroke)', margin: '4px 8px' }} />

            {/* Add Account */}
            <button
              onClick={addAccount}
              className="hover-bg-primary"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                width: '100%',
                padding: '8px 12px',
                border: 'none',
                background: 'transparent',
                color: 'var(--text-secondary)',
                fontSize: 13,
                cursor: 'pointer',
                borderRadius: 0,
              }}
            >
              <div style={{ width: 32, height: 32, borderRadius: '50%', border: '1px dashed var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Plus size={16} style={{ color: 'var(--text-secondary)' }} />
              </div>
              Add Account
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
