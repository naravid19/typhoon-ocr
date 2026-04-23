"use client";

import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { ToastContainer, useToast } from "@/components/Toast";
import { useNotification, NotificationOptions } from "@/hooks/useNotification";

interface NotificationContextType {
  // Toast methods
  toast: {
    success: (title: string, description?: string, duration?: number) => void;
    error: (title: string, description?: string, duration?: number) => void;
    warning: (title: string, description?: string, duration?: number) => void;
    info: (title: string, description?: string, duration?: number) => void;
  };
  // Browser notification methods
  notify: (title: string, options?: NotificationOptions) => void;
  requestPermission: () => Promise<boolean>;
  hasPermission: boolean;
  // Sound settings
  isSoundEnabled: boolean;
  setSoundEnabled: (enabled: boolean) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { toasts, removeToast, toast } = useToast();
  const { notify: browserNotify, requestPermission, hasPermission } = useNotification();
  const [isSoundEnabled, setIsSoundEnabled] = useState(true);

  // Wrapper for browser notification that checks sound setting
  const notify = useCallback((title: string, options?: NotificationOptions) => {
    browserNotify(title, { ...options, silent: !isSoundEnabled });
  }, [browserNotify, isSoundEnabled]);

  const value = {
    toast,
    notify,
    requestPermission,
    hasPermission,
    isSoundEnabled,
    setSoundEnabled: setIsSoundEnabled
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </NotificationContext.Provider>
  );
}

export function useNotificationContext() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error("useNotificationContext must be used within a NotificationProvider");
  }
  return context;
}
