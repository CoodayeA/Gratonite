import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, X } from 'lucide-react';
import { useActivationContext } from '../../hooks/useActivationContext';

export function FirstRunChecklist() {
  const { tasks, completionPercent, markTaskComplete, dismissChecklist, isDismissed } = useActivationContext();
  // Start collapsed by default — quiet header + progress bar only until user expands.
  // Persisted state in localStorage still wins on subsequent loads.
  const [isCollapsed, setIsCollapsed] = useState(true);

  // Load collapsed state from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('checklist-collapsed');
    if (saved) {
      setIsCollapsed(JSON.parse(saved));
    }
  }, []);

  // Save collapsed state to localStorage
  const handleToggleCollapse = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    localStorage.setItem('checklist-collapsed', JSON.stringify(newState));
  };

  if (isDismissed) return null;

  const completedCount = tasks.filter(t => t.completed).length;
  const totalTasks = tasks.length;

  return (
    <div
      className="first-run-checklist"
      role="region"
      aria-label="Onboarding checklist"
    >
      {/* Header with title and progress badge */}
      <div className="checklist-header">
        <div className="header-content">
          <h3 className="header-title">First 10 Minutes</h3>
          <p className="header-subtitle">Get started with Gratonite</p>
        </div>
        <div className="header-controls">
          <div className="progress-badge">
            <span className="badge-number">{completedCount}</span>
            <span className="badge-separator">/</span>
            <span className="badge-total">{totalTasks}</span>
          </div>
          <button
            onClick={handleToggleCollapse}
            className="collapse-button"
            aria-label={isCollapsed ? 'Expand checklist' : 'Collapse checklist'}
            aria-expanded={!isCollapsed}
          >
            {isCollapsed ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
          </button>
          <button
            onClick={dismissChecklist}
            className="close-button"
            aria-label="Dismiss checklist"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="progress-bar-container">
        <div className="progress-bar-track">
          <div
            className="progress-bar-fill"
            style={{ width: `${completionPercent}%` }}
            role="progressbar"
            aria-valuenow={completionPercent}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>
      </div>

      {/* Task list - collapsible */}
      {!isCollapsed && (
        <ul className="checklist-tasks">
          {tasks.map((task, index) => {
            const isCompleted = task.completed;
            const isCurrent = index === 0 && !isCompleted;

            return (
              <li
                key={task.id}
                className={`checklist-task ${isCompleted ? 'completed' : isCurrent ? 'current' : 'pending'}`}
              >
                <button
                  onClick={() => markTaskComplete(task.id)}
                  className="checklist-task-checkbox"
                  aria-label={`Mark "${task.label}" as complete`}
                  aria-pressed={isCompleted}
                >
                  <div className="checkbox-icon">
                    {isCompleted ? (
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L5.5 10.94l6.72-6.72a.75.75 0 011.06 0z" fill="currentColor" />
                      </svg>
                    ) : isCurrent ? (
                      <div className="diamond-icon">◆</div>
                    ) : (
                      <div className="circle-icon">○</div>
                    )}
                  </div>
                </button>
                <div className="checklist-task-content">
                  <p className="task-label">{task.label}</p>
                  <p className="task-description">{task.description}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
