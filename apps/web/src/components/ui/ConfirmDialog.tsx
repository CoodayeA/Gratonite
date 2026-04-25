import React, { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { AlertTriangle, X } from 'lucide-react';

export type ConfirmVariant = 'default' | 'danger';

export type ConfirmOptions = {
    title?: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: ConfirmVariant;
};

export type PromptOptions = {
    title?: string;
    message: string;
    placeholder?: string;
    defaultValue?: string;
    confirmLabel?: string;
    cancelLabel?: string;
};

type ConfirmContextType = {
    confirm: (opts: ConfirmOptions) => Promise<boolean>;
    prompt: (opts: PromptOptions) => Promise<string | null>;
};

const ConfirmContext = createContext<ConfirmContextType | undefined>(undefined);

export const useConfirm = () => {
    const ctx = useContext(ConfirmContext);
    if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider');
    return ctx;
};

type DialogState =
    | { kind: 'confirm'; opts: ConfirmOptions; resolve: (v: boolean) => void }
    | { kind: 'prompt'; opts: PromptOptions; resolve: (v: string | null) => void }
    | null;

export const ConfirmProvider = ({ children }: { children: ReactNode }) => {
    const [state, setState] = useState<DialogState>(null);
    const [inputValue, setInputValue] = useState('');
    const inputRef = useRef<HTMLInputElement | null>(null);
    const confirmBtnRef = useRef<HTMLButtonElement | null>(null);

    const confirm = useCallback((opts: ConfirmOptions) => {
        return new Promise<boolean>((resolve) => {
            setState({ kind: 'confirm', opts, resolve });
        });
    }, []);

    const prompt = useCallback((opts: PromptOptions) => {
        return new Promise<string | null>((resolve) => {
            setInputValue(opts.defaultValue ?? '');
            setState({ kind: 'prompt', opts, resolve });
        });
    }, []);

    const close = useCallback((result: boolean | string | null) => {
        setState((prev) => {
            if (!prev) return null;
            if (prev.kind === 'confirm') prev.resolve(result === true);
            else prev.resolve(result === false ? null : (result as string | null));
            return null;
        });
        setInputValue('');
    }, []);

    useEffect(() => {
        if (!state) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                close(state.kind === 'confirm' ? false : null);
            } else if (e.key === 'Enter' && state.kind === 'prompt') {
                e.preventDefault();
                close(inputValue);
            }
        };
        window.addEventListener('keydown', onKey);
        const t = setTimeout(() => {
            if (state.kind === 'prompt') inputRef.current?.focus();
            else confirmBtnRef.current?.focus();
        }, 0);
        return () => {
            window.removeEventListener('keydown', onKey);
            clearTimeout(t);
        };
    }, [state, inputValue, close]);

    const isDanger = state?.kind === 'confirm' && state.opts.variant === 'danger';
    const title = state?.opts.title ?? (state?.kind === 'confirm' ? 'Are you sure?' : 'Input required');
    const confirmLabel = state?.opts.confirmLabel ?? (isDanger ? 'Delete' : 'Confirm');
    const cancelLabel = state?.opts.cancelLabel ?? 'Cancel';

    return (
        <ConfirmContext.Provider value={{ confirm, prompt }}>
            {children}
            {state && (
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="confirm-dialog-title"
                    onClick={() => close(state.kind === 'confirm' ? false : null)}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(0,0,0,0.55)',
                        backdropFilter: 'blur(4px)',
                        zIndex: 10000,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 16,
                    }}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            background: 'var(--bg-elevated, #1f2126)',
                            border: '1px solid var(--border, rgba(255,255,255,0.08))',
                            borderRadius: 12,
                            width: '100%',
                            maxWidth: 420,
                            boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
                            overflow: 'hidden',
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid var(--border, rgba(255,255,255,0.06))' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                {isDanger && <AlertTriangle size={18} color="var(--error, #ef4444)" />}
                                <h3 id="confirm-dialog-title" style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--text, #fff)' }}>{title}</h3>
                            </div>
                            <button
                                onClick={() => close(state.kind === 'confirm' ? false : null)}
                                aria-label="Close dialog"
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted, #9ca3af)', padding: 4, display: 'flex' }}
                            >
                                <X size={16} />
                            </button>
                        </div>
                        <div style={{ padding: '16px', color: 'var(--text-secondary, #d1d5db)', fontSize: 14, lineHeight: 1.5 }}>
                            {state.opts.message}
                            {state.kind === 'prompt' && (
                                <input
                                    ref={inputRef}
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                    placeholder={state.opts.placeholder}
                                    style={{
                                        marginTop: 12,
                                        width: '100%',
                                        padding: '8px 10px',
                                        background: 'var(--bg, #0f1115)',
                                        border: '1px solid var(--border, rgba(255,255,255,0.12))',
                                        borderRadius: 6,
                                        color: 'var(--text, #fff)',
                                        fontSize: 14,
                                        outline: 'none',
                                        boxSizing: 'border-box',
                                    }}
                                />
                            )}
                        </div>
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', padding: '12px 16px', borderTop: '1px solid var(--border, rgba(255,255,255,0.06))', background: 'rgba(0,0,0,0.15)' }}>
                            <button
                                onClick={() => close(state.kind === 'confirm' ? false : null)}
                                style={{
                                    padding: '7px 14px',
                                    background: 'transparent',
                                    border: '1px solid var(--border, rgba(255,255,255,0.12))',
                                    color: 'var(--text-secondary, #d1d5db)',
                                    borderRadius: 6,
                                    cursor: 'pointer',
                                    fontSize: 13,
                                    fontWeight: 500,
                                }}
                            >
                                {cancelLabel}
                            </button>
                            <button
                                ref={confirmBtnRef}
                                onClick={() => close(state.kind === 'prompt' ? inputValue : true)}
                                style={{
                                    padding: '7px 14px',
                                    background: isDanger ? 'var(--error, #ef4444)' : 'var(--accent, #6366f1)',
                                    border: 'none',
                                    color: '#fff',
                                    borderRadius: 6,
                                    cursor: 'pointer',
                                    fontSize: 13,
                                    fontWeight: 600,
                                }}
                            >
                                {confirmLabel}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </ConfirmContext.Provider>
    );
};
