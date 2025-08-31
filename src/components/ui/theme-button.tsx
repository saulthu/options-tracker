"use client";

import { Button } from "@/components/ui/button";
import { LucideIcon } from "lucide-react";
import { ReactNode, ButtonHTMLAttributes } from "react";

interface ThemeButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: LucideIcon;
  children: ReactNode;
  size?: "default" | "sm" | "lg" | "icon";
}

export function ThemeButton({ 
  icon: Icon, 
  children, 
  size = "default",
  className = "",
  ...props 
}: ThemeButtonProps) {
  // Base theme classes that match the card styling
  const baseClasses = "bg-[#2d2d2d] border border-[#888888] text-white hover:bg-[#404040] hover:border-[#aaaaaa] disabled:opacity-50";

  return (
    <Button
      size={size}
      className={`${baseClasses} ${className}`}
      {...props}
    >
      {Icon && <Icon className="w-4 h-4 mr-2" />}
      {children}
    </Button>
  );
}

// Special button for cancel actions (no icon)
export function CancelButton({ 
  children = "Cancel", 
  className = "",
  ...props 
}: Omit<ThemeButtonProps, 'icon'> & { children?: ReactNode }) {
  return (
    <ThemeButton
      className={className}
      {...props}
    >
      {children}
    </ThemeButton>
  );
}

// Special button for destructive actions (no icon)
export function DestructiveButton({ 
  children, 
  className = "",
  ...props 
}: Omit<ThemeButtonProps, 'icon'> & { children?: ReactNode }) {
  return (
    <ThemeButton
      className={className}
      {...props}
    >
      {children}
    </ThemeButton>
  );
}
