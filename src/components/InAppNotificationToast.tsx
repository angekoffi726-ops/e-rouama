import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export interface ForegroundNotification {
  id: string;
  title: string;
  body: string;
  icon?: string;
  url?: string;
  scope?: 'MEMBER' | 'DEPARTMENT';
  senderLabel?: string;
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
      }, 9000);
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

  const isDepartment =
    notification.scope === 'DEPARTMENT' ||
    Boolean(notification.url && notification.url.toLowerCase().includes('#admin'));

  return (
    <div className="fixed top-4 left-4 right-4 sm:left-auto sm:right-6 sm:w-96 z-[99999] pointer-events-auto">
      <div
        onClick={handleClick}
        className={`bg-slate-900/95 backdrop-blur-md text-white p-4 rounded-2xl shadow-2xl border flex items-start gap-3.5 cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99] ${
          isDepartment
            ? 'border-emerald-400/70 hover:border-emerald-300'
            : 'border-amber-500/60 hover:border-amber-400'
        }`}
      >
        <div
          className={`w-10 h-10 rounded-full border flex items-center justify-center shrink-0 overflow-hidden ${
            isDepartment
              ? 'bg-emerald-500/20 border-emerald-400/50'
              : 'bg-amber-500/20 border-amber-400/40'
          }`}
        >
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
              <span
                className={`w-2 h-2 rounded-full animate-pulse ${
                  isDepartment ? 'bg-emerald-400' : 'bg-amber-400'
                }`}
              ></span>
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
          <div className="mt-1 flex items-center gap-1.5 flex-wrap">
            <span
              className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wide border ${
                isDepartment
                  ? 'bg-emerald-900/70 text-emerald-300 border-emerald-500/40'
                  : 'bg-amber-900/70 text-amber-200 border-amber-500/40'
              }`}
            >
              {isDepartment ? '🛡️ Espace Département' : '👤 Espace Membre'}
            </span>
            {notification.senderLabel && (
              <span className="text-[10px] text-slate-400 font-semibold truncate max-w-[160px]">
                • {notification.senderLabel}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-200 font-medium mt-1 leading-snug line-clamp-2">
            {notification.body}
          </p>
          <span className="text-[10px] text-amber-200/80 font-semibold mt-1 inline-block">
            Appuyez pour ouvrir directement 🔔
          </span>
        </div>
      </div>
    </div>
  );
};
