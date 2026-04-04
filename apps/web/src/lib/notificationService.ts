type DesktopNotifOptions = {
    title: string;
    body: string;
    channelId?: string;
    guildId?: string;
    channelName?: string;
    navigate?: (path: string) => void;
};

interface PendingGroup {
    channelId: string;
    channelName: string;
    count: number;
    latestBody: string;
    navigate?: (path: string) => void;
    guildId?: string;
    timer: ReturnType<typeof setTimeout>;
}

const pendingGroups = new Map<string, PendingGroup>();

function fireGroupedNotification(group: PendingGroup) {
    pendingGroups.delete(group.channelId);
    const title = group.count > 1
        ? `${group.count} messages in ${group.channelName}`
        : group.latestBody;
    const body = group.count > 1 ? group.latestBody : '';
    const notif = new Notification(title, { body, silent: false });
    notif.onclick = () => {
        notif.close();
        window.focus();
        if (group.navigate) {
            const path = group.guildId
                ? `/guild/${group.guildId}/channel/${group.channelId}`
                : `/dm/${group.channelId}`;
            group.navigate(path);
        }
    };
}

export function sendDesktopNotification(opts: DesktopNotifOptions): void {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    if (opts.channelId) {
        const key = opts.channelId;
        const existing = pendingGroups.get(key);
        if (existing) {
            clearTimeout(existing.timer);
            existing.count++;
            existing.latestBody = opts.body;
            existing.navigate = opts.navigate ?? existing.navigate;
            existing.timer = setTimeout(() => fireGroupedNotification(existing), 3000);
        } else {
            const group: PendingGroup = {
                channelId: opts.channelId,
                channelName: opts.channelName || opts.title,
                count: 1,
                latestBody: opts.body,
                navigate: opts.navigate,
                guildId: opts.guildId,
                timer: setTimeout(() => fireGroupedNotification(group), 3000),
            };
            pendingGroups.set(key, group);
        }
    } else {
        const notif = new Notification(opts.title, { body: opts.body });
        notif.onclick = () => { notif.close(); window.focus(); };
    }
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) return 'denied';
    if (Notification.permission === 'granted') return 'granted';
    if (Notification.permission === 'denied') return 'denied';
    return Notification.requestPermission();
}

export function getNotificationPermission(): NotificationPermission | 'unsupported' {
    if (!('Notification' in window)) return 'unsupported';
    return Notification.permission;
}
