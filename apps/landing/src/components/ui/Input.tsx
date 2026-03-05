interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  className?: string;
}

export function Input({
  placeholder = "",
  type = "text",
  className = "",
  ...props
}: InputProps) {
  return (
    <input
      type={type}
      placeholder={placeholder}
      {...props}
      className={`w-full px-4 py-3 text-base bg-surface neo-border rounded-lg font-medium placeholder:text-gray-warm focus:outline-none focus:ring-2 focus:ring-purple focus:ring-offset-2 transition-all ${className}`}
    />
  );
}
