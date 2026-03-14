import React from 'react';
import PatternBackground from './PatternBackground';
import EmptyState from './EmptyState';

interface LoadErrorCardProps {
  title: string;
  message: string | null;
  onRetry: () => void;
}

export default function LoadErrorCard({ title, message, onRetry }: LoadErrorCardProps) {
  return (
    <PatternBackground>
      <EmptyState
        icon="alert-circle-outline"
        title={title}
        subtitle={message ?? 'Something went wrong'}
        actionLabel="Retry"
        onAction={onRetry}
      />
    </PatternBackground>
  );
}
