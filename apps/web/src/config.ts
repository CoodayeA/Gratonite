type DownloadLinks = {
  macSilicon?: string;
  macIntel?: string;
  winX64?: string;
  linuxAppImage?: string;
  linuxDeb?: string;
  linuxRpm?: string;
};

export const appConfig = {
  apiUrl: import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api/v1',
  tunnelStatus: import.meta.env.VITE_TUNNEL_STATUS ?? 'tunnel:local',
  downloads: {
    macSilicon: import.meta.env['VITE_DOWNLOAD_MAC_SILICON'],
    macIntel: import.meta.env['VITE_DOWNLOAD_MAC_INTEL'],
    winX64: import.meta.env['VITE_DOWNLOAD_WIN_X64'],
    linuxAppImage: import.meta.env['VITE_DOWNLOAD_LINUX_APPIMAGE'],
    linuxDeb: import.meta.env['VITE_DOWNLOAD_LINUX_DEB'],
    linuxRpm: import.meta.env['VITE_DOWNLOAD_LINUX_RPM'],
  } as DownloadLinks,
};
