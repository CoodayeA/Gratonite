/**
 * 115. Bot Framework — SDK docs page for building bots.
 */
import { useState, useEffect } from 'react';
import { Bot, Code, Zap, BookOpen, Copy, Check } from 'lucide-react';
import { api } from '../../lib/api';

export default function BotFrameworkDocs() {
  const [docs, setDocs] = useState<any>(null);
  const [templates, setTemplates] = useState<any[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api.botFramework.docs().then(setDocs).catch(() => {});
    api.botFramework.templates().then(setTemplates).catch(() => {});
  }, []);

  const copyExample = () => {
    if (!docs?.sdkExample) return;
    navigator.clipboard.writeText(docs.sdkExample);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!docs) return <p className="text-gray-500 p-4">Loading...</p>;

  return (
    <div className="p-4 bg-gray-900 rounded-lg space-y-6 max-h-[600px] overflow-y-auto">
      <div className="flex items-center gap-3">
        <Bot className="w-8 h-8 text-indigo-400" />
        <div>
          <h2 className="text-white font-semibold text-lg">Bot Framework</h2>
          <p className="text-xs text-gray-400">v{docs.version} - Build powerful bots for Gratonite</p>
        </div>
      </div>

      {/* Quick Start */}
      <div>
        <h3 className="text-sm text-white font-medium mb-2 flex items-center gap-1"><Zap className="w-4 h-4 text-yellow-400" /> Quick Start</h3>
        <ol className="list-decimal list-inside space-y-1">
          {docs.quickStart?.map((step: string, i: number) => (
            <li key={i} className="text-sm text-gray-300">{step}</li>
          ))}
        </ol>
      </div>

      {/* Auth */}
      <div className="p-3 bg-gray-800 rounded-lg">
        <p className="text-xs text-gray-400">Authentication</p>
        <code className="text-sm text-green-400">{docs.authentication}</code>
      </div>

      {/* Endpoints */}
      <div>
        <h3 className="text-sm text-white font-medium mb-2 flex items-center gap-1"><Code className="w-4 h-4 text-blue-400" /> Endpoints</h3>
        <div className="space-y-1">
          {docs.endpoints?.map((ep: any, i: number) => (
            <div key={i} className="flex items-center gap-2 p-2 bg-gray-800 rounded text-sm">
              <span className={`px-1.5 py-0.5 rounded text-xs font-mono ${ep.method === 'GET' ? 'bg-green-900 text-green-300' : ep.method === 'POST' ? 'bg-blue-900 text-blue-300' : 'bg-yellow-900 text-yellow-300'}`}>
                {ep.method}
              </span>
              <code className="text-gray-300 font-mono text-xs">{ep.path}</code>
              <span className="text-gray-500 text-xs ml-auto">{ep.description}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Events */}
      <div>
        <h3 className="text-sm text-white font-medium mb-2">WebSocket Events</h3>
        <div className="grid grid-cols-2 gap-1">
          {docs.events?.map((ev: any, i: number) => (
            <div key={i} className="p-2 bg-gray-800 rounded">
              <code className="text-xs text-indigo-300">{ev.name}</code>
              <p className="text-xs text-gray-500 mt-0.5">{ev.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* SDK Example */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm text-white font-medium">Example Bot</h3>
          <button onClick={copyExample} className="text-gray-400 hover:text-white">
            {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
        <pre className="p-3 bg-gray-950 rounded-lg text-xs text-green-300 font-mono overflow-x-auto whitespace-pre-wrap">{docs.sdkExample}</pre>
      </div>

      {/* Templates */}
      <div>
        <h3 className="text-sm text-white font-medium mb-2 flex items-center gap-1"><BookOpen className="w-4 h-4" /> Starter Templates</h3>
        <div className="grid grid-cols-2 gap-2">
          {templates.map(t => (
            <div key={t.id} className="p-3 bg-gray-800 rounded-lg">
              <p className="text-sm text-white font-medium">{t.name}</p>
              <p className="text-xs text-gray-400 mt-1">{t.description}</p>
              <span className="inline-block mt-1 px-1.5 py-0.5 bg-gray-700 text-xs text-gray-300 rounded">{t.language}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Rate Limits */}
      <div>
        <h3 className="text-sm text-white font-medium mb-2">Rate Limits</h3>
        <div className="space-y-1">
          {docs.rateLimits && Object.entries(docs.rateLimits).map(([key, val]) => (
            <div key={key} className="flex justify-between text-sm">
              <span className="text-gray-400">{key}</span>
              <span className="text-gray-300">{String(val)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
