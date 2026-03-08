import { useState, useEffect } from 'react';
import { Send, Gift, Eye } from 'lucide-react';
import { api } from '../../lib/api';
import { useToast } from '../ui/ToastManager';

interface Template {
  id: string;
  name: string;
  category: string;
  bgColor: string;
  bgImage: string | null;
  fontFamily: string;
}

interface GreetingCardBuilderProps {
  recipientId: string;
  recipientName: string;
  onClose: () => void;
  onSent?: () => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  birthday: 'Birthday',
  congrats: 'Congrats',
  thanks: 'Thanks',
  welcome: 'Welcome',
  holiday: 'Holiday',
};

export default function GreetingCardBuilder({ recipientId, recipientName, onClose, onSent }: GreetingCardBuilderProps) {
  const { addToast } = useToast();
  const [templates, setTemplates] = useState<Record<string, Template[]>>({});
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [preview, setPreview] = useState(false);

  useEffect(() => {
    loadTemplates();
  }, []);

  async function loadTemplates() {
    try {
      const data = await api.get<Record<string, Template[]>>('/greeting-cards/templates');
      setTemplates(data);
    } catch {
      addToast({ title: 'Failed to load templates', variant: 'error' });
    }
  }

  async function handleSend() {
    if (!selectedTemplate || !message.trim()) return;
    setSending(true);
    try {
      await api.post('/greeting-cards', {
        templateId: selectedTemplate.id,
        recipientId,
        message: message.trim(),
      });
      addToast({ title: `Card sent to ${recipientName}!`, variant: 'success' });
      onSent?.();
      onClose();
    } catch {
      addToast({ title: 'Failed to send card', variant: 'error' });
    } finally {
      setSending(false);
    }
  }

  const categories = Object.keys(templates);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-4 border-b border-zinc-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Gift className="w-5 h-5 text-pink-400" />
            <h2 className="text-lg font-semibold text-zinc-100">Send a Card to {recipientName}</h2>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-200 text-sm">Close</button>
        </div>

        {!preview ? (
          <div className="p-4 space-y-4">
            <div>
              <h3 className="text-sm font-medium text-zinc-400 mb-2">Choose a Template</h3>
              {categories.map((cat) => (
                <div key={cat} className="mb-3">
                  <div className="text-xs text-zinc-500 mb-1">{CATEGORY_LABELS[cat] ?? cat}</div>
                  <div className="grid grid-cols-3 gap-2">
                    {templates[cat].map((t) => (
                      <button
                        key={t.id}
                        onClick={() => setSelectedTemplate(t)}
                        className={`rounded-lg p-3 text-center text-sm font-medium transition-all ${
                          selectedTemplate?.id === t.id
                            ? 'ring-2 ring-indigo-500 scale-105'
                            : 'hover:scale-105'
                        }`}
                        style={{ backgroundColor: t.bgColor, color: '#fff' }}
                      >
                        {t.name}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div>
              <h3 className="text-sm font-medium text-zinc-400 mb-2">Your Message</h3>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Write a heartfelt message..."
                className="w-full bg-zinc-800 text-zinc-100 rounded-lg p-3 text-sm resize-none h-24 outline-none focus:ring-1 focus:ring-indigo-500"
                maxLength={500}
              />
              <div className="text-xs text-zinc-500 text-right">{message.length}/500</div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setPreview(true)}
                disabled={!selectedTemplate || !message.trim()}
                className="flex-1 flex items-center justify-center gap-2 bg-zinc-700 text-zinc-200 rounded-lg px-4 py-2 text-sm hover:bg-zinc-600 disabled:opacity-40"
              >
                <Eye className="w-4 h-4" />
                Preview
              </button>
              <button
                onClick={handleSend}
                disabled={!selectedTemplate || !message.trim() || sending}
                className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 text-white rounded-lg px-4 py-2 text-sm hover:bg-indigo-500 disabled:opacity-40"
              >
                <Send className="w-4 h-4" />
                {sending ? 'Sending...' : 'Send'}
              </button>
            </div>
          </div>
        ) : (
          <div className="p-4 space-y-4">
            {selectedTemplate && (
              <div
                className="rounded-xl p-8 text-center space-y-4"
                style={{
                  backgroundColor: selectedTemplate.bgColor,
                  backgroundImage: selectedTemplate.bgImage ? `url(${selectedTemplate.bgImage})` : undefined,
                  backgroundSize: 'cover',
                  fontFamily: selectedTemplate.fontFamily,
                }}
              >
                <h2 className="text-2xl font-bold text-white drop-shadow">{selectedTemplate.name}</h2>
                <p className="text-white/90 text-lg drop-shadow">{message}</p>
              </div>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => setPreview(false)}
                className="flex-1 bg-zinc-700 text-zinc-200 rounded-lg px-4 py-2 text-sm hover:bg-zinc-600"
              >
                Back to Edit
              </button>
              <button
                onClick={handleSend}
                disabled={sending}
                className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 text-white rounded-lg px-4 py-2 text-sm hover:bg-indigo-500 disabled:opacity-40"
              >
                <Send className="w-4 h-4" />
                {sending ? 'Sending...' : 'Send'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
