import React from 'react';
import { CheckCircle2, Circle, X } from 'lucide-react';
import { useActivationContext } from '../../hooks/useActivationContext';

export function FirstRunChecklist() {
  const { tasks, completionPercent, markTaskComplete, dismissChecklist, isDismissed } = useActivationContext();

  if (isDismissed) return null;

  return (
    <div
      className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-indigo-200 rounded-lg p-4 mb-4"
      role="region"
      aria-label="Onboarding checklist"
    >
      <div className="flex justify-between items-center mb-3">
        <div>
          <h3 className="font-semibold text-gray-900">Welcome to Gratonite!</h3>
          <p className="text-sm text-gray-600">{completionPercent}% complete</p>
        </div>
        <button
          onClick={dismissChecklist}
          className="text-gray-400 hover:text-gray-600 p-1"
          aria-label="Dismiss checklist"
        >
          <X size={18} />
        </button>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-indigo-100 rounded-full h-2 mb-3">
        <div
          className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
          style={{ width: `${completionPercent}%` }}
        />
      </div>

      {/* Task list */}
      <ul className="space-y-2">
        {tasks.map(task => (
          <li key={task.id} className="flex items-start gap-3">
            <button
              onClick={() => markTaskComplete(task.id)}
              className="flex-shrink-0 mt-0.5 hover:opacity-80 transition"
              aria-label={`Mark "${task.label}" as complete`}
            >
              {task.completed ? (
                <CheckCircle2 size={18} className="text-green-600" />
              ) : (
                <Circle size={18} className="text-gray-400" />
              )}
            </button>
            <div className="flex-1">
              <p className={`text-sm font-medium ${task.completed ? 'line-through text-gray-500' : 'text-gray-700'}`}>
                {task.label}
              </p>
              <p className="text-xs text-gray-500">{task.description}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
