/**
 * 114. Integration Marketplace — Connect GitHub, Jira, RSS to channel messages.
 */
import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Settings, ToggleLeft, ToggleRight, Github, Rss, Clipboard, Globe } from 'lucide-react';
import { api } from '../../lib/api';
import { useToast } from '../ui/ToastManager';

const ICONS: Record<string, React.ReactNode> = {
  github: <Github className="w-5 h-5" />,
  rss: <Rss className="w-5 h-5" />,
  jira: <Clipboard className="w-5 h-5" />,
  custom_webhook: <Globe className="w-5 h-5" />,
};

interface Integration { id: string; type: string; name: string; channelId: string; enabled: boolean; config: Record<string, unknown>; createdAt: string; }
interface CatalogItem { type: string; name: string; description: string; icon: string; configFields: string[]; }

export default function IntegrationMarketplace({ guildId, channels }: { guildId: string; channels: Array<{ id: string; name: string }> }) {
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [installed, setInstalled] = useState<Integration[]>([]);
  const [showInstall, setShowInstall] = useState<string | null>(null);
  const [channelId, setChannelId] = useState('');
  const { addToast } = useToast();

  const fetch_ = useCallback(async () => {
    try {
      const [c, i] = await Promise.all([api.integrations.catalog(guildId), api.integrations.list(guildId)]);
      setCatalog(c);
      setInstalled(i);
    } catch { addToast({ title: 'Failed to load integrations', variant: 'error' }); }
  }, [guildId]);

  useEffect(() => { fetch_(); }, [fetch_]);

  const install = async (type: string) => {
    if (!channelId) return;
    try {
      await api.integrations.install(guildId, { type, channelId });
      setShowInstall(null);
      fetch_();
    } catch { addToast({ title: 'Failed to install integration', variant: 'error' }); }
  };= async (integ: Integration) => {
    try {
      await api.integrations.update(guildId, integ.id, { enabled: !integ.enabled });
      fetch_();
    } catch { addToast({ title: 'Failed to update integration', variant: 'error' }); }
  };

  const remove = async (id: string) => {
    try { await api.integrations.delete(guildId, id); fetch_(); } catch { addToast({ title: 'Failed to remove integration', variant: 'error' }); }
  };

  return (
    <div className="p-4 bg-gray-900 rounded-lg space-y-4">
      <h3 className="text-white font-medium">Integrations</h3>

      {/* Installed */}
      {installed.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs text-gray-400 uppercase">Installed</h4>
          {installed.map(integ => (
            <div key={integ.id} className="flex items-center gap-3 p-3 bg-gray-800 rounded-lg">
              <span className="text-indigo-400">{ICONS[integ.type] || <Globe className="w-5 h-5" />}</span>
              <div className="flex-1">
                <p className="text-sm text-white">{integ.name}</p>
                <p className="text-xs text-gray-500">Channel: {channels.find(c => c.id === integ.channelId)?.name || 'Unknown'}</p>
              </div>
              <button onClick={() => toggleEnabled(integ)} className="text-gray-400 hover:text-white">
                {integ.enabled ? <ToggleRight className="w-5 h-5 text-green-400" /> : <ToggleLeft className="w-5 h-5" />}
              </button>
              <button onClick={() => remove(integ.id)} className="text-gray-400 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
      )}

      {/* Catalog */}
      <div className="space-y-2">
        <h4 className="text-xs text-gray-400 uppercase">Available</h4>
        <div className="grid grid-cols-2 gap-2">
          {catalog.map(item => (
            <div key={item.type} className="p-3 bg-gray-800 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-indigo-400">{ICONS[item.type] || <Globe className="w-5 h-5" />}</span>
                <span className="text-sm text-white font-medium">{item.name}</span>
              </div>
              <p className="text-xs text-gray-400 mb-2">{item.description}</p>
              {showInstall === item.type ? (
                <div className="space-y-1">
                  <select value={channelId} onChange={e => setChannelId(e.target.value)} className="w-full bg-gray-700 text-white text-xs rounded px-2 py-1 border border-gray-600">
                    <option value="">Select channel</option>
                    {channels.map(ch => <option key={ch.id} value={ch.id}>{ch.name}</option>)}
                  </select>
                  <button onClick={() => install(item.type)} className="w-full px-2 py-1 bg-green-600 hover:bg-green-500 text-white text-xs rounded">Install</button>
                </div>
              ) : (
                <button onClick={() => { setShowInstall(item.type); setChannelId(channels[0]?.id || ''); }} className="flex items-center gap-1 px-2 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs rounded">
                  <Plus className="w-3 h-3" /> Install
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
