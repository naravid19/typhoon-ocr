"use client";

import { useState, useCallback, useEffect, useRef } from "react";

/**
 * Notification permission status type
 */
type NotificationPermission = "granted" | "denied" | "default";

/**
 * Options for showing a notification
 */
export interface NotificationOptions {
  body?: string;
  icon?: string;
  tag?: string;
  requireInteraction?: boolean;
  silent?: boolean;
}

/**
 * Hook return type
 */
interface UseNotificationReturn {
  /** Whether browser notifications are supported */
  isSupported: boolean;
  /** Current permission status */
  permission: NotificationPermission;
  /** Whether permission is granted */
  hasPermission: boolean;
  /** Request notification permission from user */
  requestPermission: () => Promise<boolean>;
  /** Show a browser notification */
  showNotification: (title: string, options?: NotificationOptions) => void;
  /** Play notification sound */
  playSound: () => void;
  /** Show both notification and play sound */
  notify: (title: string, options?: NotificationOptions) => void;
}

/**
 * Custom hook for managing browser notifications and sound alerts.
 *
 * @example
 * ```tsx
 * const { notify, requestPermission, hasPermission } = useNotification();
 *
 * // Request permission first
 * await requestPermission();
 *
 * // Then notify user
 * notify("✅ OCR สำเร็จ!", { body: "ประมวลผลเสร็จสิ้น 5 หน้า" });
 * ```
 */
export function useNotification(): UseNotificationReturn {
  // Use lazy initialization to avoid setState in effect
  const [permission, setPermission] = useState<NotificationPermission>("default");
  
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Check if Notification API is supported
  const isSupported = typeof window !== "undefined" && "Notification" in window;

  // Initialize audio only and set initial permission
  useEffect(() => {
    // Set initial permission after hydration to prevent mismatch
    if (isSupported) {
      setPermission(Notification.permission);
    }

    // Preload audio (disabled since /notification.mp3 is missing)
    if (typeof window !== "undefined") {
      // audioRef.current = new Audio("/notification.mp3");
      // if (audioRef.current) audioRef.current.volume = 0.5;
    }

    return () => {
      if (audioRef.current) {
        audioRef.current = null;
      }
    };
  }, []);

  /**
   * Request notification permission from user
   */
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isSupported) {
      console.warn("Notifications are not supported in this browser");
      return false;
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      return result === "granted";
    } catch (error) {
      console.error("Failed to request notification permission:", error);
      return false;
    }
  }, [isSupported]);

  /**
   * Show a browser notification
   */
  const showNotification = useCallback(
    (title: string, options?: NotificationOptions) => {
      if (!isSupported || permission !== "granted") {
        console.warn("Cannot show notification: permission not granted");
        return;
      }

      try {
        const notification = new Notification(title, {
          icon: options?.icon || "/favicon.ico",
          body: options?.body,
          tag: options?.tag || "typhoon-ocr",
          requireInteraction: options?.requireInteraction || false,
        });

        // Auto-close after 5 seconds
        setTimeout(() => notification.close(), 5000);

        // Handle click - focus the window
        notification.onclick = () => {
          window.focus();
          notification.close();
        };
      } catch (error) {
        console.error("Failed to show notification:", error);
      }
    },
    [isSupported, permission],
  );

  /**
   * Play notification sound
   */
  const playSound = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch((error) => {
        // Autoplay might be blocked by browser
        console.warn("Could not play notification sound:", error);
      });
    }
  }, []);

  /**
   * Show notification and play sound together
   */
  const notify = useCallback(
    (title: string, options?: NotificationOptions) => {
      showNotification(title, options);
      if (!options?.silent) {
        playSound();
      }
    },
    [showNotification, playSound],
  );

  return {
    isSupported,
    permission,
    hasPermission: permission === "granted",
    requestPermission,
    showNotification,
    playSound,
    notify,
  };
}
