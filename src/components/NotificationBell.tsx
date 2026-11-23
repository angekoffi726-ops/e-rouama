import React, { useState, useRef, useEffect } from 'react';
import { Bell, CheckCheck, Clock, Sparkles, ArrowRight } from 'lucide-react';
import { RealtimeNotificationItem } from '../utils/pushNotificationService';

interface NotificationBellProps {
  notifications: RealtimeNotificationItem[];
  readIds: Set<string>;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onSelectNotification: (notif: RealtimeNotificationItem) => void;
  variant?: 'MEMBER' | 'ADMIN';
}

const formatRelativeTime = (ts: number, createdAt?: string): string => {
  if (!ts && createdAt) {
    const parsed = Date.parse(createdAt);
    if (!isNaN(parsed)) ts = parsed;
  }
  if (!ts) return '';
  const diffSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (diffSec < 60) return "À l'instant";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `Il y a ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `Il y a ${diffH}h`;
  try {
    return new Date(ts).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
};

export const NotificationBell: React.FC<NotificationBellProps> = ({
  notifications,
  readIds,
  onMarkRead,
  onMarkAllRead,
  onSelectNotification,
  variant = 'MEMBER',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter(n => !readIds.has(n.id)).length;

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const isAdmin = variant === 'ADMIN';

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        title="Centre de notifications en temps réel"
        className={`relative flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-black transition-all shadow-sm active:scale-95 cursor-pointer border ${
          isAdmin
            ? 'bg-slate-900 hover:bg-slate-800 text-amber-300 border-amber-400/40'
            : 'bg-white/15 hover:bg-white/25 text-white border-white/25'
        }`}
      >
        <Bell className={`w-4 h-4 ${unreadCount > 0 ? 'animate-bounce text-amber-300' : ''}`} />
        <span className="hidden md:inline">Alertes</span>
        {unreadCount > 0 && (
          <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-rose-600 text-white text-[10px] font-black flex items-center justify-center border border-white/40 shadow-md animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="fixed sm:absolute left-3 right-3 sm:left-auto sm:right-0 top-16 sm:top-full sm:mt-2 sm:w-96 bg-slate-900 text-white rounded-3xl shadow-2xl border border-amber-500/40 z-[9999] overflow-hidden backdrop-blur-xl">
          {/* Header */}
          <div className="px-4 py-3.5 bg-slate-950/90 border-b border-slate-800 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-amber-300">
                  Notifications Temps Réel
                </h3>
                <p className="text-[10px] text-slate-400">
                  {unreadCount > 0
                    ? `${unreadCount} alerte${unreadCount > 1 ? 's' : ''} non lue${unreadCount > 1 ? 's' : ''}`
                    : 'Tout est à jour'}
                </p>
              </div>
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onMarkAllRead();
                }}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/35 text-emerald-300 text-[10px] font-black border border-emerald-500/30 transition-colors cursor-pointer"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Tout marquer lu</span>
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-[65vh] sm:max-h-96 overflow-y-auto divide-y divide-slate-800/80">
            {notifications.length === 0 ? (
              <div className="px-5 py-10 text-center space-y-2">
                <Bell className="w-8 h-8 text-slate-600 mx-auto" />
                <p className="text-xs font-bold text-slate-400">Aucune notification pour le moment</p>
                <p className="text-[10px] text-slate-500">
                  Les annonces, navettes et validations apparaîtront ici en direct.
                </p>
              </div>
            ) : (
              notifications.map((notif) => {
                const isUnread = !readIds.has(notif.id);
                return (
                  <button
                    key={notif.id}
                    type="button"
                    onClick={() => {
                      onMarkRead(notif.id);
                      setIsOpen(false);
                      onSelectNotification(notif);
                    }}
                    className={`w-full text-left px-4 py-3.5 transition-colors flex items-start gap-3 cursor-pointer ${
                      isUnread
                        ? 'bg-amber-500/10 hover:bg-amber-500/20'
                        : 'hover:bg-slate-800/70 opacity-85'
                    }`}
                  >
                    <div className="mt-1 shrink-0">
                      {isUnread ? (
                        <span className="block w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-rose-400/40 animate-pulse" />
                      ) : (
                        <span className="block w-2 h-2 rounded-full bg-slate-600" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-black text-amber-300 truncate">
                          {notif.title}
                        </span>
                        <span className="text-[10px] text-slate-400 shrink-0 flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" />
                          {formatRelativeTime(notif.timestamp, notif.createdAt)}
                        </span>
                      </div>

                      <p className="text-xs text-slate-200 font-medium leading-snug line-clamp-2">
                        {notif.body}
                      </p>

                      <div className="flex items-center justify-between gap-2 pt-0.5">
                        <div className="flex items-center gap-1.5 min-w-0 max-w-[75%]">
                          <span
                            className={`inline-block px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wide border shrink-0 ${
                              notif.scope === 'DEPARTMENT'
                                ? 'bg-emerald-900/60 text-emerald-300 border-emerald-600/40'
                                : 'bg-amber-900/60 text-amber-300 border-amber-600/40'
                            }`}
                          >
                            {notif.scope === 'DEPARTMENT' ? '🛡️ Département' : '👤 Membre'}
                          </span>
                          {(notif.senderName || notif.senderRole) && (
                            <span className="inline-block px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 text-[9px] font-bold uppercase tracking-wide border border-slate-700 truncate">
                              {notif.senderName || notif.senderRole}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-amber-300/80 font-bold flex items-center gap-0.5 ml-auto shrink-0">
                          <span>Ouvrir</span>
                          <ArrowRight className="w-3 h-3" />
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
