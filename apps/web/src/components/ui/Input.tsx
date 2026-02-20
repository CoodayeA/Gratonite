import React, { forwardRef, useState } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, type, className = '', ...props }, ref) => {
    const [showPassword, setShowPassword] = useState(false);
    const isPassword = type === 'password';

    return (
      <div className={`input-group ${error ? 'input-error' : ''} ${className}`}>
        {label && <label className="input-label">{label}</label>}
        <div className="input-wrapper">
          <input
            ref={ref}
            type={isPassword && showPassword ? 'text' : type}
            className="input-field"
            {...props}
          />
          {isPassword && (
            <button
              type="button"
              className="input-toggle"
              onClick={() => setShowPassword(!showPassword)}
              tabIndex={-1}
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          )}
        </div>
        {error && <span className="input-error-text">{error}</span>}
        {hint && !error && <span className="input-hint">{hint}</span>}
      </div>
    );
  },
);

Input.displayName = 'Input';
