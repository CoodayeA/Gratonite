import Link from "next/link";

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps {
  children: React.ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  href?: string;
  className?: string;
  onClick?: () => void;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-purple text-white neo-border neo-shadow neo-shadow-hover hover:bg-purple-light focus-visible:ring-2 focus-visible:ring-purple focus-visible:ring-offset-2",
  secondary:
    "bg-yellow text-black neo-border neo-shadow neo-shadow-hover hover:bg-gold focus-visible:ring-2 focus-visible:ring-purple focus-visible:ring-offset-2",
  outline:
    "bg-surface text-foreground neo-border neo-shadow-sm neo-shadow-hover hover:bg-gray-warm/30 focus-visible:ring-2 focus-visible:ring-purple focus-visible:ring-offset-2",
  ghost: "bg-transparent text-foreground hover:bg-gray-warm/30 focus-visible:ring-2 focus-visible:ring-purple focus-visible:ring-offset-2",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "px-4 py-2 text-sm font-semibold",
  md: "px-6 py-3 text-base font-bold",
  lg: "px-8 py-4 text-lg font-bold",
};

export function Button({
  children,
  variant = "primary",
  size = "md",
  href,
  className = "",
  onClick,
  type = "button",
  disabled = false,
}: ButtonProps) {
  const styles = `inline-flex items-center justify-center gap-2 rounded-lg cursor-pointer transition-all duration-200 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none ${variantStyles[variant]} ${sizeStyles[size]} ${className}`;

  if (href) {
    return (
      <Link href={href} className={styles}>
        {children}
      </Link>
    );
  }

  return (
    <button type={type} onClick={onClick} disabled={disabled} className={styles}>
      {children}
    </button>
  );
}
