import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Clock, Globe, Edit2, X, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../../lib/api';

type ViewMode = 'month' | 'week' | 'day';

interface ScheduledMessage {
  id: string;
  channelId: string;
  channelName: string;
  guildId: string | null;
  guildName: string | null;
  content: string;
  scheduledAt: string;
}

const GUILD_COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#84cc16'];

function getGuildColor(guildId: string | null, guildMap: Map<string, number>): string {
  if (!guildId) return '#9ca3af';
  if (!guildMap.has(guildId)) guildMap.set(guildId, guildMap.size);
  return GUILD_COLORS[guildMap.get(guildId)! % GUILD_COLORS.length];
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

function isSameDay(d1: Date, d2: Date): boolean {
  return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

export default function ScheduleCalendar() {
  const [messages, setMessages] = useState<ScheduledMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [editingMessage, setEditingMessage] = useState<ScheduledMessage | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');
  const [dragTarget, setDragTarget] = useState<string | null>(null);

  const guildColorMapRef = useRef(new Map<string, number>());
  const guildColorMap = guildColorMapRef.current;
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const res = await api.scheduleCalendar.getCalendar();
        if (!cancelled) setMessages(Array.isArray(res) ? res : []);
      } catch {
        if (!cancelled) setMessages([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  const navigate = useCallback((dir: -1 | 1) => {
    setCurrentDate((prev) => {
      const d = new Date(prev);
      if (view === 'month') d.setMonth(d.getMonth() + dir);
      else if (view === 'week') d.setDate(d.getDate() + dir * 7);
      else d.setDate(d.getDate() + dir);
      return d;
    });
  }, [view]);

  const openEdit = useCallback((msg: ScheduledMessage) => {
    setEditingMessage(msg);
    setEditContent(msg.content);
    const dt = new Date(msg.scheduledAt);
    setEditDate(dt.toISOString().split('T')[0]);
    setEditTime(dt.toTimeString().slice(0, 5));
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editingMessage) return;
    const newScheduledAt = new Date(`${editDate}T${editTime}`).toISOString();
    try {
      await api.scheduleCalendar.reschedule(editingMessage.id, newScheduledAt);
      setMessages((prev) =>
        prev.map((m) => m.id === editingMessage.id ? { ...m, content: editContent, scheduledAt: newScheduledAt } : m)
      );
    } catch { /* keep previous */ }
    setEditingMessage(null);
  }, [editingMessage, editContent, editDate, editTime]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      const msg = messages.find((m) => m.id === id);
      if (msg?.guildId) await api.scheduledMessages.delete(msg.guildId, id);
      setMessages((prev) => prev.filter((m) => m.id !== id));
    } catch { /* ignore */ }
    setEditingMessage(null);
  }, []);

  const handleDrop = useCallback(async (msgId: string, targetDate: Date) => {
    const msg = messages.find((m) => m.id === msgId);
    if (!msg) return;
    const orig = new Date(msg.scheduledAt);
    targetDate.setHours(orig.getHours(), orig.getMinutes());
    const newScheduledAt = targetDate.toISOString();
    try {
      await api.scheduleCalendar.reschedule(msgId, newScheduledAt);
      setMessages((prev) =>
        prev.map((m) => m.id === msgId ? { ...m, scheduledAt: newScheduledAt } : m)
      );
    } catch { /* ignore */ }
    setDragTarget(null);
  }, [messages]);

  const headerLabel = useMemo(() => {
    if (view === 'month') return currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    if (view === 'week') {
      const start = new Date(currentDate);
      start.setDate(start.getDate() - start.getDay());
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    }
    return currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  }, [currentDate, view]);

  // Month view
  const renderMonth = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    const today = new Date();
    const cells: React.ReactNode[] = [];

    for (let i = 0; i < firstDay; i++) {
      cells.push(<div key={`empty-${i}`} style={{ minHeight: '80px' }} />);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const isToday = isSameDay(date, today);
      const dayMessages = messages.filter((m) => isSameDay(new Date(m.scheduledAt), date));

      cells.push(
        <div
          key={day}
          onDragOver={(e) => { e.preventDefault(); setDragTarget(`${year}-${month}-${day}`); }}
          onDragLeave={() => setDragTarget(null)}
          onDrop={(e) => {
            e.preventDefault();
            const msgId = e.dataTransfer.getData('text/plain');
            if (msgId) handleDrop(msgId, new Date(year, month, day));
          }}
          style={{
            minHeight: '80px',
            padding: '4px',
            borderRadius: '6px',
            background: dragTarget === `${year}-${month}-${day}` ? 'rgba(99,102,241,0.1)' : 'transparent',
            border: isToday ? '1px solid var(--accent-primary)' : '1px solid transparent',
            transition: 'background 0.15s',
          }}
        >
          <div style={{
            fontSize: '12px',
            fontWeight: isToday ? 700 : 400,
            color: isToday ? 'var(--accent-primary)' : 'var(--text-secondary)',
            marginBottom: '2px',
            textAlign: 'right',
            padding: '0 2px',
          }}>
            {day}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {dayMessages.slice(0, 3).map((msg) => (
              <div
                key={msg.id}
                draggable
                onDragStart={(e) => e.dataTransfer.setData('text/plain', msg.id)}
                onClick={() => openEdit(msg)}
                style={{
                  fontSize: '10px',
                  padding: '2px 4px',
                  borderRadius: '3px',
                  background: getGuildColor(msg.guildId, guildColorMap),
                  color: '#fff',
                  cursor: 'grab',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  fontWeight: 500,
                }}
                title={`${msg.channelName}: ${msg.content}`}
              >
                {formatTime(msg.scheduledAt)} {msg.content.slice(0, 20)}
              </div>
            ))}
            {dayMessages.length > 3 && (
              <span style={{ fontSize: '9px', color: 'var(--text-muted)', textAlign: 'center' }}>
                +{dayMessages.length - 3} more
              </span>
            )}
          </div>
        </div>
      );
    }

    return (
      <div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '1px', marginBottom: '4px' }}>
          {WEEKDAYS.map((d) => (
            <div key={d} style={{ textAlign: 'center', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', padding: '6px 0' }}>
              {d}
            </div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '1px', background: 'var(--stroke)', borderRadius: '8px', overflow: 'hidden' }}>
          {cells.map((cell, i) => (
            <div key={i} style={{ background: 'var(--bg-primary)' }}>{cell}</div>
          ))}
        </div>
      </div>
    );
  };

  // Week view
  const renderWeek = () => {
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(startOfWeek);
      d.setDate(d.getDate() + i);
      return d;
    });
    const today = new Date();

    return (
      <div style={{ display: 'grid', gridTemplateColumns: '50px repeat(7, 1fr)', gap: '1px', background: 'var(--stroke)', borderRadius: '8px', overflow: 'hidden', maxHeight: '500px', overflowY: 'auto' }}>
        {/* Header row */}
        <div style={{ background: 'var(--bg-primary)', padding: '6px' }} />
        {days.map((d, i) => (
          <div key={i} style={{
            background: 'var(--bg-primary)',
            padding: '6px',
            textAlign: 'center',
            fontSize: '11px',
            fontWeight: isSameDay(d, today) ? 700 : 400,
            color: isSameDay(d, today) ? 'var(--accent-primary)' : 'var(--text-secondary)',
          }}>
            {WEEKDAYS[i]}<br />{d.getDate()}
          </div>
        ))}
        {/* Time slots (simplified: 6am-10pm) */}
        {HOURS.filter((h) => h >= 6 && h <= 22).map((hour) => (
          <React.Fragment key={hour}>
            <div style={{ background: 'var(--bg-primary)', padding: '2px 4px', fontSize: '9px', color: 'var(--text-muted)', textAlign: 'right' }}>
              {hour % 12 || 12}{hour < 12 ? 'a' : 'p'}
            </div>
            {days.map((d, di) => {
              const slot = messages.filter((m) => {
                const dt = new Date(m.scheduledAt);
                return isSameDay(dt, d) && dt.getHours() === hour;
              });
              return (
                <div key={di} style={{ background: 'var(--bg-primary)', padding: '2px', minHeight: '28px' }}>
                  {slot.map((msg) => (
                    <div
                      key={msg.id}
                      onClick={() => openEdit(msg)}
                      style={{
                        fontSize: '9px',
                        padding: '2px 4px',
                        borderRadius: '3px',
                        background: getGuildColor(msg.guildId, guildColorMap),
                        color: '#fff',
                        cursor: 'pointer',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        marginBottom: '1px',
                      }}
                    >
                      {msg.content.slice(0, 15)}
                    </div>
                  ))}
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>
    );
  };

  // Day view
  const renderDay = () => {
    const today = new Date();
    const isToday = isSameDay(currentDate, today);
    const dayMessages = messages.filter((m) => isSameDay(new Date(m.scheduledAt), currentDate));

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: 'var(--stroke)', borderRadius: '8px', overflow: 'hidden', maxHeight: '500px', overflowY: 'auto' }}>
        {HOURS.map((hour) => {
          const hourMsgs = dayMessages.filter((m) => new Date(m.scheduledAt).getHours() === hour);
          const isNow = isToday && today.getHours() === hour;
          return (
            <div key={hour} style={{
              display: 'flex',
              background: 'var(--bg-primary)',
              minHeight: '40px',
              borderLeft: isNow ? '3px solid var(--accent-primary)' : '3px solid transparent',
            }}>
              <div style={{ width: '56px', padding: '4px 8px', fontSize: '11px', color: 'var(--text-muted)', textAlign: 'right', flexShrink: 0 }}>
                {hour % 12 || 12}:00 {hour < 12 ? 'AM' : 'PM'}
              </div>
              <div style={{ flex: 1, padding: '4px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {hourMsgs.map((msg) => (
                  <div
                    key={msg.id}
                    onClick={() => openEdit(msg)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '4px 8px',
                      borderRadius: '6px',
                      background: getGuildColor(msg.guildId, guildColorMap),
                      color: '#fff',
                      fontSize: '12px',
                      cursor: 'pointer',
                    }}
                  >
                    <span style={{ fontWeight: 600, flexShrink: 0 }}>{formatTime(msg.scheduledAt)}</span>
                    <span style={{ opacity: 0.9, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {msg.guildName && <span style={{ fontWeight: 600 }}>{msg.guildName}</span>}
                      {msg.channelName && <span> #{msg.channelName}</span>}
                      {' - '}{msg.content}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--stroke)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Calendar size={22} style={{ color: 'var(--accent-primary)' }} />
            <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)' }}>Schedule</h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--text-muted)' }}>
            <Globe size={12} />
            {tz}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px', display: 'flex' }}>
              <ChevronLeft size={18} />
            </button>
            <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', minWidth: '200px', textAlign: 'center' }}>
              {headerLabel}
            </span>
            <button onClick={() => navigate(1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px', display: 'flex' }}>
              <ChevronRight size={18} />
            </button>
            <button
              onClick={() => setCurrentDate(new Date())}
              style={{
                padding: '4px 10px',
                borderRadius: '6px',
                border: '1px solid var(--stroke)',
                background: 'none',
                color: 'var(--text-secondary)',
                fontSize: '12px',
                cursor: 'pointer',
                marginLeft: '8px',
              }}
            >
              Today
            </button>
          </div>

          <div style={{ display: 'flex', background: 'var(--bg-secondary)', borderRadius: '8px', padding: '2px' }}>
            {(['month', 'week', 'day'] as ViewMode[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                style={{
                  padding: '4px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  background: view === v ? 'var(--accent-primary)' : 'transparent',
                  color: view === v ? '#fff' : 'var(--text-secondary)',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                }}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Calendar */}
      <div style={{ flex: 1, overflow: 'auto', padding: '16px 24px' }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px' }}>
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
              style={{ width: 24, height: 24, border: '2px solid var(--stroke)', borderTopColor: 'var(--accent-primary)', borderRadius: '50%' }}
            />
          </div>
        ) : (
          <>
            {view === 'month' && renderMonth()}
            {view === 'week' && renderWeek()}
            {view === 'day' && renderDay()}
          </>
        )}
      </div>

      {/* Edit Modal */}
      <AnimatePresence>
        {editingMessage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setEditingMessage(null)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 100,
            }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                background: 'var(--bg-elevated)',
                borderRadius: '12px',
                padding: '20px',
                width: '100%',
                maxWidth: '420px',
                border: '1px solid var(--stroke)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Edit2 size={16} style={{ color: 'var(--accent-primary)' }} />
                  <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>Edit Scheduled Message</span>
                </div>
                <button onClick={() => setEditingMessage(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px' }}>
                  <X size={16} />
                </button>
              </div>

              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                {editingMessage.guildName && <span>{editingMessage.guildName} / </span>}
                #{editingMessage.channelName}
              </div>

              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                rows={4}
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '8px',
                  border: '1px solid var(--stroke)',
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                  resize: 'vertical',
                  outline: 'none',
                  fontFamily: 'inherit',
                  boxSizing: 'border-box',
                }}
              />

              <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                <input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '8px',
                    borderRadius: '8px',
                    border: '1px solid var(--stroke)',
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    fontSize: '13px',
                    outline: 'none',
                  }}
                />
                <input
                  type="time"
                  value={editTime}
                  onChange={(e) => setEditTime(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '8px',
                    borderRadius: '8px',
                    border: '1px solid var(--stroke)',
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    fontSize: '13px',
                    outline: 'none',
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                <button
                  onClick={() => handleDelete(editingMessage.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 14px',
                    borderRadius: '8px',
                    border: '1px solid rgba(239,68,68,0.3)',
                    background: 'none',
                    color: '#ef4444',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  <Trash2 size={14} />
                  Delete
                </button>
                <div style={{ flex: 1 }} />
                <button
                  onClick={() => setEditingMessage(null)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '8px',
                    border: '1px solid var(--stroke)',
                    background: 'none',
                    color: 'var(--text-secondary)',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '8px',
                    border: 'none',
                    background: 'var(--accent-primary)',
                    color: '#fff',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Save
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
