interface CardProps {
  children: React.ReactNode;
  accent?: "purple" | "gold" | "yellow" | "blue" | "none";
  className?: string;
  hover?: boolean;
}

const accentStyles = {
  purple: "border-t-[6px] border-t-purple",
  gold: "border-t-[6px] border-t-gold",
  yellow: "border-t-[6px] border-t-yellow",
  blue: "border-t-[6px] border-t-blue-light",
  none: "",
};

export function Card({
  children,
  accent = "none",
  className = "",
  hover = true,
}: CardProps) {
  return (
    <div
      className={`bg-surface neo-border rounded-xl p-6 neo-shadow ${
        hover ? "neo-shadow-hover" : ""
      } ${accentStyles[accent]} ${className}`}
    >
      {children}
    </div>
  );
}
