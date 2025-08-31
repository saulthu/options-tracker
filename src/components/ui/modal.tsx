"use client";

import { ReactNode, useEffect, useRef } from "react";
import { X } from "lucide-react";
import { ThemeButton } from "./theme-button";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl";
  showCloseButton?: boolean;
}

const maxWidthClasses = {
  sm: "max-w-sm",
  md: "max-w-md", 
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-2xl"
};

export default function Modal({ 
  isOpen, 
  onClose, 
  title, 
  description, 
  children, 
  maxWidth = "md",
  showCloseButton = false
}: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  // Handle click outside and ESC key to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div ref={modalRef} className={`bg-[#1a1a1a] border border-[#2d2d2d] text-white w-full ${maxWidthClasses[maxWidth]} max-h-[90vh] overflow-y-auto rounded-lg shadow-2xl`}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-4 border-b border-[#2d2d2d]">
          <div>
            <h2 className="text-xl font-semibold text-white">{title}</h2>
            {description && (
              <p className="text-[#b3b3b3] text-sm mt-1">{description}</p>
            )}
          </div>
          {showCloseButton && (
            <ThemeButton
              icon={X}
              size="sm"
              onClick={onClose}
              className="text-[#b3b3b3] hover:text-white hover:bg-[#2d2d2d] -mr-2"
            >
              Close
            </ThemeButton>
          )}
        </div>
        
        {/* Content */}
        <div className="p-6 pt-4">
          {children}
        </div>
      </div>
    </div>
  );
}
