'use client';

import React, { useEffect } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl';
}

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = 'md',
}: ModalProps) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const widthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 overflow-y-auto">
      {/* Backdrop overlay click */}
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />

      {/* Windows 2000 Classic Window Dialog */}
      <div
        className={`relative win-raised w-full ${widthClasses[maxWidth]} z-10 my-8 text-right p-1 text-black`}
        dir="rtl"
        role="dialog"
        aria-modal="true"
      >
        {/* Titlebar */}
        <div className="win-titlebar mb-1">
          <div className="flex items-center gap-1.5 font-bold text-xs">
            <span className="text-sm">🗔</span>
            <span>{title}</span>
          </div>
          <div className="flex items-center gap-1">
            <button type="button" className="win-box-btn" title="تصغير">_</button>
            <button type="button" className="win-box-btn" title="تكبير">□</button>
            <button
              type="button"
              onClick={onClose}
              className="win-box-btn font-bold text-red-800"
              title="إغلاق (Esc)"
            >
              ×
            </button>
          </div>
        </div>

        {/* Dialog Body */}
        <div className="p-3 bg-[#ECE9D8]">
          {children}
        </div>
      </div>
    </div>
  );
}

