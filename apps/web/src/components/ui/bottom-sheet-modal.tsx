"use client";

import React, { useEffect } from "react";
import { X } from "lucide-react";

export interface BottomSheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  maxWidth?: string; // e.g. "max-w-md", "max-w-lg", "max-w-xl", "max-w-2xl"
  customHeader?: React.ReactNode;
  hideHeader?: boolean;
  className?: string;
  bodyClassName?: string;
  closeOnBackdrop?: boolean;
}

/**
 * Mobile-First Native Bottom Sheet / Desktop Centered Modal
 * Features:
 * - Mobile bottom anchor (rounded top, drag handle, thumb-friendly)
 * - Desktop centered modal with subtle zoom
 * - Body scroll locking during presentation
 * - Escape key dismissal
 * - Isolated scroll container with overscroll containment
 */
export function BottomSheetModal({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  maxWidth = "max-w-lg",
  customHeader,
  hideHeader = false,
  className = "",
  bodyClassName = "",
  closeOnBackdrop = true,
}: BottomSheetModalProps) {
  // Lock body scroll while modal is open
  useEffect(() => {
    if (!isOpen) return;
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalStyle;
    };
  }, [isOpen]);

  // Close with Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-xs transition-opacity cursor-pointer"
        onClick={() => {
          if (closeOnBackdrop) onClose();
        }}
        aria-hidden="true"
      />

      {/* Sheet Container */}
      <div
        className={`relative z-10 w-full ${maxWidth} bg-card text-foreground rounded-t-[28px] sm:rounded-3xl shadow-2xl border border-border overflow-hidden max-h-[92vh] flex flex-col transform transition-transform duration-300 ease-out animate-in slide-in-from-bottom-6 sm:slide-in-from-bottom-0 sm:zoom-in-95 ${className}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Drag handle for mobile */}
        <div className="pt-3 pb-1 flex justify-center sm:hidden shrink-0">
          <div className="w-12 h-1.5 bg-muted-foreground/30 rounded-full" />
        </div>

        {/* Header */}
        {!hideHeader && (
          <>
            {customHeader ? (
              customHeader
            ) : (
              <div className="flex justify-between items-center px-5 sm:px-6 py-4 border-b border-border shrink-0 bg-muted/20">
                <div className="pr-2 min-w-0">
                  {typeof title === "string" ? (
                    <h3 className="text-base sm:text-lg font-bold text-foreground truncate">
                      {title}
                    </h3>
                  ) : (
                    title
                  )}
                  {subtitle && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {subtitle}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="min-h-[40px] min-w-[40px] -mr-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl flex items-center justify-center transition-colors cursor-pointer shrink-0"
                  aria-label="Cerrar modal"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            )}
          </>
        )}

        {/* Scrollable Body */}
        <div
          className={`flex-1 overflow-y-auto p-5 sm:p-6 overscroll-contain ${bodyClassName}`}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

export default BottomSheetModal;
