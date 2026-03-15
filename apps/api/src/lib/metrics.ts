export const registry = {
  metrics: async () => '# metrics not available\n',
  contentType: 'text/plain; version=0.0.4',
};

export const httpRequestDuration = {
  observe: (_labels: Record<string, string>, _value: number) => {},
};

export const messagesSentTotal = {
  inc: (_value?: number) => {},
};

export const activeWebSocketConnections = {
  set: (_value: number) => {},
  inc: (_value?: number) => {},
  dec: (_value?: number) => {},
};

export const webhookDispatchTotal = {
  inc: (_labels?: Record<string, string>) => {},
};
