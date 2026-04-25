import React, { useId, type InputHTMLAttributes } from 'react';

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
};

export function TextField({
  label,
  hint,
  id,
  className = '',
  'aria-describedby': ariaDescribedBy,
  ...props
}: TextFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const describedBy = [ariaDescribedBy, hintId].filter(Boolean).join(' ') || undefined;

  return (
    <label className={`gt-field ${className}`.trim()} htmlFor={inputId}>
      <span className="gt-field__label">{label}</span>
      <input {...props} id={inputId} className="gt-field__input" aria-describedby={describedBy} />
      {hint && <span id={hintId} className="gt-field__hint">{hint}</span>}
    </label>
  );
}
