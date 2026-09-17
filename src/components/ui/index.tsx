import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: any[]) {
  return twMerge(clsx(inputs));
}

export function Card({
  className,
  title,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { title?: string }) {
  return (
    <div
      className={cn('win-raised text-black', className)}
      {...props}
    >
      {title && (
        <div className="win-titlebar mb-2">
          <span>{title}</span>
          <div className="flex items-center gap-1">
            <span className="win-box-btn">_</span>
            <span className="win-box-btn">□</span>
            <span className="win-box-btn">×</span>
          </div>
        </div>
      )}
      <div className="p-3">{children}</div>
    </div>
  );
}

export function Button({
  className,
  variant = 'primary',
  size = 'md',
  disabled,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}) {
  const sizes = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-xs',
    lg: 'px-4 py-1.5 text-sm',
  };

  const variantStyles = {
    primary: 'font-bold text-black border-t-white border-l-white border-b-[#808080] border-r-[#808080]',
    secondary: 'text-black',
    danger: 'text-red-900 font-bold',
    outline: 'text-black',
    ghost: 'bg-transparent border-transparent shadow-none hover:bg-[#D4D0C8]',
  };

  return (
    <button
      className={cn('win-btn', variantStyles[variant], sizes[size], className)}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}

export function Badge({
  variant = 'default',
  children,
  className,
}: {
  variant?: 'active' | 'pending' | 'draft' | 'rejected' | 'approved' | 'danger' | 'default';
  children: React.ReactNode;
  className?: string;
}) {
  const styles = {
    default: 'bg-[#ECE9D8] text-black border border-[#808080]',
    active: 'bg-[#D4F4D2] text-[#0A5C0A] border border-[#2B8A3E]',
    approved: 'bg-[#D2E4F4] text-[#0B4A82] border border-[#1971C2]',
    pending: 'bg-[#FFF3C4] text-[#8C5800] border border-[#F59F00]',
    draft: 'bg-[#ECE9D8] text-[#495057] border border-[#868E96]',
    rejected: 'bg-[#FFE3E3] text-[#C92A2A] border border-[#E03131]',
    danger: 'bg-[#FFE3E3] text-[#C92A2A] border border-[#E03131]',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center px-1.5 py-0.5 text-[11px] font-medium',
        styles[variant],
        className
      )}
    >
      {children}
    </span>
  );
}

export function Alert({
  variant = 'info',
  title,
  children,
  className,
}: {
  variant?: 'info' | 'warning' | 'error' | 'success';
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const styles = {
    info: 'bg-[#FFFFE1] border-2 border-[#808080] text-black',
    warning: 'bg-[#FFF8E7] border-2 border-[#D4A017] text-black',
    error: 'bg-[#FFF0F0] border-2 border-[#CC0000] text-[#900000]',
    success: 'bg-[#F0FFF0] border-2 border-[#008800] text-[#006600]',
  };

  return (
    <div className={cn('p-2.5 text-xs shadow-sm', styles[variant], className)}>
      {title && <div className="font-bold mb-1 flex items-center gap-1.5">{title}</div>}
      <div>{children}</div>
    </div>
  );
}

export { Modal } from './Modal';


