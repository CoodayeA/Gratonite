type Locale = 'en' | 'es' | 'fr';

const translations: Record<Locale, Record<string, string>> = {
  en: {
    'nav.home': 'Home',
    'nav.friends': 'Friends',
    'nav.discover': 'Discover',
    'nav.settings': 'Settings',
    'nav.search': 'Search',
    'chat.send': 'Send',
    'chat.reply': 'Reply',
    'chat.edit': 'Edit',
    'chat.delete': 'Delete',
    'chat.pin': 'Pin',
    'chat.typing': 'typing...',
    'chat.schedule': 'Schedule Message',
    'guild.join': 'Join Server',
    'guild.leave': 'Leave Server',
    'guild.settings': 'Server Settings',
    'guild.members': 'Members',
    'guild.channels': 'Channels',
    'status.online': 'Online',
    'status.idle': 'Idle',
    'status.dnd': 'Do Not Disturb',
    'status.offline': 'Offline',
    'settings.account': 'Account',
    'settings.privacy': 'Privacy',
    'settings.appearance': 'Appearance',
    'settings.notifications': 'Notifications',
  },
  es: {
    'nav.home': 'Inicio',
    'nav.friends': 'Amigos',
    'nav.discover': 'Descubrir',
    'nav.settings': 'Ajustes',
    'nav.search': 'Buscar',
    'chat.send': 'Enviar',
    'chat.reply': 'Responder',
    'chat.edit': 'Editar',
    'chat.delete': 'Eliminar',
    'chat.pin': 'Fijar',
    'chat.typing': 'escribiendo...',
    'chat.schedule': 'Programar mensaje',
    'guild.join': 'Unirse al servidor',
    'guild.leave': 'Salir del servidor',
    'guild.settings': 'Ajustes del servidor',
    'guild.members': 'Miembros',
    'guild.channels': 'Canales',
    'status.online': 'En linea',
    'status.idle': 'Ausente',
    'status.dnd': 'No molestar',
    'status.offline': 'Desconectado',
    'settings.account': 'Cuenta',
    'settings.privacy': 'Privacidad',
    'settings.appearance': 'Apariencia',
    'settings.notifications': 'Notificaciones',
  },
  fr: {
    'nav.home': 'Accueil',
    'nav.friends': 'Amis',
    'nav.discover': 'Decouvrir',
    'nav.settings': 'Parametres',
    'nav.search': 'Rechercher',
    'chat.send': 'Envoyer',
    'chat.reply': 'Repondre',
    'chat.edit': 'Modifier',
    'chat.delete': 'Supprimer',
    'chat.pin': 'Epingler',
    'chat.typing': 'ecrit...',
    'chat.schedule': 'Planifier le message',
    'guild.join': 'Rejoindre le serveur',
    'guild.leave': 'Quitter le serveur',
    'guild.settings': 'Parametres du serveur',
    'guild.members': 'Membres',
    'guild.channels': 'Salons',
    'status.online': 'En ligne',
    'status.idle': 'Inactif',
    'status.dnd': 'Ne pas deranger',
    'status.offline': 'Hors ligne',
    'settings.account': 'Compte',
    'settings.privacy': 'Confidentialite',
    'settings.appearance': 'Apparence',
    'settings.notifications': 'Notifications',
  },
};

let currentLocale: Locale = 'en';

export function setLocale(locale: Locale): void {
  currentLocale = locale;
  localStorage.setItem('gratonite:locale', locale);
  window.dispatchEvent(new CustomEvent('gratonite:locale-changed'));
}

export function getLocale(): Locale {
  return currentLocale;
}

export function t(key: string): string {
  return translations[currentLocale]?.[key] ?? translations.en[key] ?? key;
}

export function initI18n(): void {
  const saved = localStorage.getItem('gratonite:locale') as Locale | null;
  if (saved && translations[saved]) {
    currentLocale = saved;
  }
}

export const AVAILABLE_LOCALES: Array<{ code: Locale; name: string }> = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Espanol' },
  { code: 'fr', name: 'Francais' },
];
