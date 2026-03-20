/**
 * 107. Code Playground — Embedded sandboxed code editor using iframe sandbox only.
 * All code execution happens inside a sandboxed iframe for security.
 */
import { useState, useCallback } from 'react';
import { Play, RotateCcw, Copy, Check } from 'lucide-react';
import { copyToClipboard } from '../../utils/clipboard';

const LANGUAGES = [
  { id: 'html', label: 'HTML/CSS/JS', template: '<!DOCTYPE html>\n<html>\n<head><style>body{color:#fff;background:#1a1a2e;font-family:sans-serif;padding:20px}</style></head>\n<body>\n<h1>Hello Gratonite!</h1>\n<p id="output"></p>\n<script>\nconst el = document.getElementById("output");\nel.textContent = "Code running in sandbox!";\n</script>\n</body>\n</html>' },
  { id: 'javascript', label: 'JavaScript', template: '// JavaScript runs in a sandboxed iframe\nconst el = document.getElementById("output");\n\nfunction fibonacci(n) {\n  if (n <= 1) return n;\n  return fibonacci(n - 1) + fibonacci(n - 2);\n}\n\nconst results = [];\nfor (let i = 0; i < 10; i++) {\n  results.push("fib(" + i + ") = " + fibonacci(i));\n}\nel.textContent = results.join("\\n");' },
];

export default function CodePlayground() {
  const [language, setLanguage] = useState(LANGUAGES[0]);
  const [code, setCode] = useState(LANGUAGES[0].template);
  const [copied, setCopied] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');

  const runCode = useCallback(() => {
    let html: string;
    if (language.id === 'html') {
      html = code;
    } else {
      // Wrap JS in a minimal HTML doc with an output element, executed in sandbox
      html = [
        '<!DOCTYPE html><html><head>',
        '<style>body{color:#0f0;background:#111;font-family:monospace;padding:10px;font-size:14px}#output{white-space:pre-wrap}</style>',
        '</head><body><pre id="output"></pre>',
        '<script>',
        code,
        '<\/script></body></html>',
      ].join('');
    }
    setPreviewHtml(html);
    setShowPreview(true);
  }, [code, language]);

  const copyCode = () => {
    copyToClipboard(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col bg-gray-900 rounded-lg overflow-hidden h-[500px]">
      {/* Toolbar */}
      <div className="flex items-center gap-2 p-2 bg-gray-800 border-b border-gray-700">
        <select
          value={language.id}
          onChange={e => {
            const lang = LANGUAGES.find(l => l.id === e.target.value)!;
            setLanguage(lang);
            setCode(lang.template);
            setShowPreview(false);
          }}
          className="bg-gray-700 text-white text-sm rounded px-2 py-1 border border-gray-600"
        >
          {LANGUAGES.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
        </select>
        <button onClick={runCode} className="flex items-center gap-1 px-3 py-1 bg-green-600 hover:bg-green-500 text-white rounded text-sm">
          <Play className="w-3.5 h-3.5" /> Run
        </button>
        <button onClick={() => { setCode(language.template); setShowPreview(false); }} className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded">
          <RotateCcw className="w-4 h-4" />
        </button>
        <button onClick={copyCode} className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded">
          {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>

      <div className="flex-1 flex min-h-0">
        {/* Editor */}
        <div className="flex-1 min-w-0">
          <textarea
            value={code}
            onChange={e => setCode(e.target.value)}
            className="w-full h-full bg-gray-950 text-green-300 font-mono text-sm p-3 resize-none focus:outline-none"
            spellCheck={false}
            placeholder="Write your code here..."
          />
        </div>

        {/* Sandboxed Preview — all code runs inside iframe sandbox, never on main page */}
        <div className="w-1/2 border-l border-gray-700 flex flex-col min-w-0">
          <div className="px-3 py-1.5 bg-gray-800 text-xs text-gray-400 font-medium border-b border-gray-700">
            Preview (sandboxed)
          </div>
          <div className="flex-1 overflow-auto bg-gray-950">
            {showPreview ? (
              <iframe
                srcDoc={previewHtml}
                sandbox="allow-scripts"
                className="w-full h-full"
                title="Code Preview"
              />
            ) : (
              <p className="p-3 text-sm text-gray-500">Click Run to execute code</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
