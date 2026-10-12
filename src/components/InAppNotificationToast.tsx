import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export interface ForegroundNotification {
  id: string;
  title: string;
  body: string;
  icon?: string;
  url?: string;
}

interface InAppNotificationToastProps {
  notification: ForegroundNotification | null;
  onClose: () => void;
  onNavigate?: (url: string) => void;
}

export const InAppNotificationToast: React.FC<InAppNotificationToastProps> = ({
  notification,
  onClose,
  onNavigate,
}) => {
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => {
        onClose();
      }, 7000);
      return () => clearTimeout(timer);
    }
  }, [notification, onClose]);

  if (!notification) return null;

  const handleClick = () => {
    if (notification.url && onNavigate) {
      onNavigate(notification.url);
    }
    onClose();
  };

  return (
    <div className="fixed top-4 left-4 right-4 sm:left-auto sm:right-6 sm:w-96 z-[99999] pointer-events-auto">
      <div
        onClick={handleClick}
        className="bg-slate-900/95 backdrop-blur-md text-white p-4 rounded-2xl shadow-2xl border border-amber-500/50 flex items-start gap-3.5 cursor-pointer hover:border-amber-400 transition-all hover:scale-[1.01] active:scale-[0.99]"
      >
        <div className="w-10 h-10 rounded-full bg-amber-500/20 border border-amber-400/40 flex items-center justify-center shrink-0 overflow-hidden">
          <img
            src={notification.icon || '/icon-192.png'}
            alt="E-ROUAMA"
            className="w-7 h-7 object-contain"
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-black text-amber-300 uppercase tracking-wider truncate flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
              {notification.title}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="text-slate-400 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors"
              title="Fermer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-xs text-slate-200 font-medium mt-1 leading-snug line-clamp-2">
            {notification.body}
          </p>
          <span className="text-[10px] text-amber-200/70 font-semibold mt-1 inline-block">
            Appuyez pour consulter 🔔
          </span>
        </div>
      </div>
    </div>
  );
};
