import { X, Search, Globe } from 'lucide-react';
import type { Dispatch, RefObject, SetStateAction } from 'react';
import {
    GUILD_SETTINGS_MOBILE_TABS,
    GUILD_SETTINGS_TAB_GROUPS,
    GUILD_SETTINGS_TABS,
    type GuildSettingsTabId,
} from './tabRegistry';

type Props = {
    serverName: string;
    activeTab: GuildSettingsTabId;
    hoveredBtn: string | null;
    setHoveredBtn: Dispatch<SetStateAction<string | null>>;
    setActiveTab: Dispatch<SetStateAction<GuildSettingsTabId>>;
    settingsSearch: string;
    setSettingsSearch: Dispatch<SetStateAction<string>>;
    settingsSearchRef: RefObject<HTMLInputElement>;
    matchingTabs: Set<GuildSettingsTabId> | null;
    onClose: () => void;
};

const tabLabelMap = Object.fromEntries(
    GUILD_SETTINGS_TABS.map(entry => [entry.tab, entry.label]),
) as Record<GuildSettingsTabId, string>;

function compactTabLabel(tab: GuildSettingsTabId): string {
    switch (tab) {
        case 'branding': return 'Brand';
        case 'bots': return 'Bots';
        case 'welcome': return 'Welcome';
        case 'discovery': return 'Discovery';
        case 'boosts': return 'Boosts';
        case 'currency': return 'Currency';
        default: return tabLabelMap[tab];
    }
}

function GuildSettingsNavigation({
    serverName,
    activeTab,
    hoveredBtn,
    setHoveredBtn,
    setActiveTab,
    settingsSearch,
    setSettingsSearch,
    settingsSearchRef,
    matchingTabs,
    onClose,
}: Props) {
    const tabStyle = (tab: GuildSettingsTabId): React.CSSProperties => ({
        padding: '8px 12px',
        borderRadius: '6px',
        cursor: 'pointer',
        fontSize: '14px',
        fontWeight: 500,
        marginBottom: '2px',
        background: activeTab === tab ? 'var(--active-overlay)' : hoveredBtn === `tab-${tab}` ? 'var(--hover-overlay)' : 'transparent',
        color: activeTab === tab ? 'var(--text-primary)' : 'var(--text-secondary)',
    });

    const visibleMobileTabs = matchingTabs
        ? GUILD_SETTINGS_MOBILE_TABS.filter(tab => matchingTabs.has(tab))
        : GUILD_SETTINGS_MOBILE_TABS;

    return (
        <>
            <div className="settings-sidebar" style={{ width: '220px', background: 'var(--bg-elevated)', padding: '16px 16px 32px', borderRight: '1px solid var(--stroke)', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' }}>
                <div style={{ padding: '16px 8px 0', fontWeight: 600, color: 'var(--text-primary)', fontSize: '15px' }}>
                    {serverName}
                </div>

                <div style={{ position: 'relative' }}>
                    <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                    <input
                        ref={settingsSearchRef}
                        type="text"
                        placeholder="Search settings..."
                        value={settingsSearch}
                        onChange={e => setSettingsSearch(e.target.value)}
                        style={{ width: '100%', padding: '8px 10px 8px 30px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                    />
                </div>
                {matchingTabs && matchingTabs.size === 0 && (
                    <div style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '16px 8px' }}>
                        No settings match "{settingsSearch}".
                    </div>
                )}

                {GUILD_SETTINGS_TAB_GROUPS
                    .filter(group => !matchingTabs || group.tabs.some(tab => matchingTabs.has(tab)))
                    .map(group => (
                        <div key={group.id}>
                            <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.05em', padding: '0 12px', marginBottom: '8px' }}>
                                {group.label}
                            </div>
                            {group.tabs
                                .filter(tab => !matchingTabs || matchingTabs.has(tab))
                                .map(tab => (
                                    <div
                                        key={tab}
                                        onClick={() => { setActiveTab(tab); setSettingsSearch(''); }}
                                        onMouseEnter={() => setHoveredBtn(`tab-${tab}`)}
                                        onMouseLeave={() => setHoveredBtn(null)}
                                        style={tabStyle(tab)}
                                    >
                                        {tab === 'federation' ? <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Globe size={13} />{tabLabelMap[tab]}</span> : tabLabelMap[tab]}
                                    </div>
                                ))}
                        </div>
                    ))}
            </div>

            <div className="settings-tabs-mobile">
                <button onClick={onClose} style={{ marginRight: 'auto', padding: '6px 14px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', borderRadius: '16px', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 600 }}>
                    <X size={14} /> Close
                </button>
                <div style={{ position: 'relative', minWidth: '180px', flex: '1 1 220px' }}>
                    <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                    <input
                        type="text"
                        placeholder="Jump to settings..."
                        value={settingsSearch}
                        onChange={e => setSettingsSearch(e.target.value)}
                        style={{ width: '100%', padding: '8px 10px 8px 30px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', borderRadius: '999px', color: 'var(--text-primary)', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }}
                    />
                </div>
                {visibleMobileTabs.map(tab => (
                    <button key={tab} className={activeTab === tab ? 'active' : ''} onClick={() => { setActiveTab(tab); setSettingsSearch(''); }}>
                        {compactTabLabel(tab)}
                    </button>
                ))}
            </div>
        </>
    );
}

export default GuildSettingsNavigation;
