/// <reference types="vite/client" />

interface Window {
  Sentry?: {
    addBreadcrumb?: (breadcrumb: {
      category?: string;
      message?: string;
      level?: string;
      data?: Record<string, unknown>;
    }) => void;
  };
}
