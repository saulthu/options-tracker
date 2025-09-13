'use client';

import React, { useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ThemeButton } from '@/components/ui/theme-button';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'warning' | 'danger';
  isLoading?: boolean;
}

export default function ConfirmModal({ 
  isOpen, 
  onClose, 
  onConfirm,
  title, 
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'warning',
  isLoading = false
}: ConfirmModalProps) {
  const handleBackdropClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    // Only close if clicking on the backdrop itself, not on the card
    if (event.target === event.currentTarget) {
      onClose();
    }
  }, [onClose]);

  const handleConfirm = useCallback(() => {
    onConfirm();
  }, [onConfirm]);

  // Handle Escape key to close modal (only if not loading)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isLoading) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose, isLoading]);

  if (!isOpen) return null;

  const getIcon = () => {
    switch (type) {
      case 'danger':
        return <AlertTriangle className="h-6 w-6 text-red-400" />;
      case 'warning':
      default:
        return <AlertTriangle className="h-6 w-6 text-yellow-400" />;
    }
  };

  const getTitleColor = () => {
    switch (type) {
      case 'danger':
        return 'text-red-400';
      case 'warning':
      default:
        return 'text-yellow-400';
    }
  };

  const getConfirmButtonStyle = () => {
    switch (type) {
      case 'danger':
        return 'bg-red-500/20 hover:bg-red-500/30 border-red-500/30 hover:border-red-500/50 text-red-400 hover:text-red-300';
      case 'warning':
      default:
        return 'bg-yellow-500/20 hover:bg-yellow-500/30 border-yellow-500/30 hover:border-yellow-500/50 text-yellow-400 hover:text-yellow-300';
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
      onClick={handleBackdropClick}
    >
      <Card 
        className="bg-[#1a1a1a] border-[#2d2d2d] w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className={`flex items-center gap-2 ${getTitleColor()}`}>
            {getIcon()}
            {title}
          </CardTitle>
          <button
            onClick={onClose}
            className="text-[#666] hover:text-white transition-colors"
            disabled={isLoading}
          >
            <X className="h-5 w-5" />
          </button>
        </CardHeader>
        <CardContent>
          <div className="text-white whitespace-pre-line mb-6">
            {message}
          </div>
          <div className="flex justify-end gap-3">
            <ThemeButton 
              onClick={onClose}
              disabled={isLoading}
              className="bg-[#2d2d2d] hover:bg-[#3d3d3d] border-[#4d4d4d] hover:border-[#5d5d5d] text-white"
            >
              {cancelText}
            </ThemeButton>
            <ThemeButton 
              onClick={handleConfirm}
              disabled={isLoading}
              className={getConfirmButtonStyle()}
            >
              {isLoading ? 'Deleting...' : confirmText}
            </ThemeButton>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
