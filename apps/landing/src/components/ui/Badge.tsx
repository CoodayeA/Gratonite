interface BadgeProps {
  children: React.ReactNode;
  color?: "purple" | "gold" | "yellow" | "blue" | "charcoal";
  rotate?: boolean;
  className?: string;
}

const colorStyles = {
  purple: "bg-purple text-white",
  gold: "bg-gold text-black",
  yellow: "bg-yellow text-black",
  blue: "bg-blue-light text-black",
  charcoal: "bg-charcoal text-white",
};

export function Badge({
  children,
  color = "purple",
  rotate = false,
  className = "",
}: BadgeProps) {
  return (
    <span
      className={`inline-block px-4 py-1.5 text-base font-bold rounded-md neo-border-2 neo-shadow-sm ${
        colorStyles[color]
      } ${rotate ? "tilt-2" : ""} ${className}`}
    >
      {children}
    </span>
  );
}
