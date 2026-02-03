import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}

export const GlassCard = ({ children, className, hover = true }: CardProps) => {
  return (
    <div
      className={cn(
        "glass rounded-2xl p-6",
        hover && "glass-hover",
        className
      )}
    >
      {children}
    </div>
  );
};
