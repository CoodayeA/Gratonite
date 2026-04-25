import React from 'react';

export function ChecklistSkeleton() {
  return (
    <div
      className="first-run-checklist-skeleton"
      role="region"
      aria-label="Loading onboarding checklist"
    >
      <div className="checklist-skeleton-header">
        <div className="skeleton-title" />
        <div className="skeleton-progress" />
      </div>

      {/* Skeleton progress bar */}
      <div className="skeleton-progress-bar">
        <div className="skeleton-progress-fill" />
      </div>

      {/* Skeleton task items */}
      <ul className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <li
            key={i}
            className="skeleton-task-item"
            style={{ animationDelay: `${i * 100}ms` }}
          >
            <div className="skeleton-icon" />
            <div className="skeleton-task-content">
              <div className="skeleton-text skeleton-text-lg" />
              <div className="skeleton-text skeleton-text-sm" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
