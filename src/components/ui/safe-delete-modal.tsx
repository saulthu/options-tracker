'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ThemeButton } from '@/components/ui/theme-button';
import { AlertTriangle, X } from 'lucide-react';

interface SafeDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  accountName: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'warning' | 'danger';
  isLoading?: boolean;
}

export default function SafeDeleteModal({ 
  isOpen, 
  onClose, 
  onConfirm,
  title, 
  message,
  accountName,
  confirmText = 'Delete All',
  cancelText = 'Cancel',
  type = 'danger',
  isLoading = false
}: SafeDeleteModalProps) {
  const [typedName, setTypedName] = useState('');
  const [isValid, setIsValid] = useState(false);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setTypedName('');
      setIsValid(false);
    }
  }, [isOpen]);

  // Check if typed name matches account name exactly
  useEffect(() => {
    setIsValid(typedName.trim() === accountName.trim());
  }, [typedName, accountName]);

  const handleBackdropClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    // Only close if clicking on the backdrop itself, not on the card
    if (event.target === event.currentTarget) {
      onClose();
    }
  }, [onClose]);

  const handleConfirm = useCallback(() => {
    if (isValid && !isLoading) {
      onConfirm();
    }
  }, [isValid, isLoading, onConfirm]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && isValid && !isLoading) {
      handleConfirm();
    }
  }, [isValid, isLoading, handleConfirm]);

  // Handle Escape key to close modal (only if not loading)
  useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isLoading) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscapeKey);
      return () => document.removeEventListener('keydown', handleEscapeKey);
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
    const baseStyle = 'border transition-colors';
    if (isLoading) {
      return `${baseStyle} bg-[#2d2d2d] border-[#4d4d4d] text-[#666] cursor-not-allowed`;
    }
    if (!isValid) {
      return `${baseStyle} bg-[#2d2d2d] border-[#4d4d4d] text-[#666] cursor-not-allowed`;
    }
    switch (type) {
      case 'danger':
        return `${baseStyle} bg-red-500/20 hover:bg-red-500/30 border-red-500/30 hover:border-red-500/50 text-red-400 hover:text-red-300`;
      case 'warning':
      default:
        return `${baseStyle} bg-yellow-500/20 hover:bg-yellow-500/30 border-yellow-500/30 hover:border-yellow-500/50 text-yellow-400 hover:text-yellow-300`;
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
          
          {/* Account name confirmation input */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-[#b3b3b3] mb-2">
              To confirm deletion, type the account name exactly:
            </label>
            <div className="mb-2">
              <span className="text-sm text-[#666] bg-[#2d2d2d] px-2 py-1 rounded border border-[#4d4d4d] font-mono">
                {accountName}
              </span>
            </div>
            <input
              type="text"
              value={typedName}
              onChange={(e) => setTypedName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type account name here..."
              disabled={isLoading}
              className="w-full px-3 py-2 bg-[#2d2d2d] border border-[#4d4d4d] rounded-lg text-white placeholder-[#666] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              autoFocus
            />
            {typedName && !isValid && (
              <p className="text-red-400 text-sm mt-1">
                Account name does not match. Please type it exactly as shown.
              </p>
            )}
            {isValid && (
              <p className="text-green-400 text-sm mt-1">
                ✓ Account name matches
              </p>
            )}
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
              disabled={!isValid || isLoading}
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
