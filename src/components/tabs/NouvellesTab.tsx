import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Newspaper,
  Bell,
  AlertTriangle,
  Megaphone,
  Eye,
  FolderOpen,
  Trash2,
  CheckCircle2,
  Copy,
  Check,
  Sparkles,
  HeartHandshake,
} from 'lucide-react';
import { TabType } from '../../types';
import { PRAYER_ROUAMA } from '../../utils/versesData';

interface NouvellesTabProps {
  onNavigateTab?: (tab: TabType, docId?: string) => void;
}

export const NouvellesTab: React.FC<NouvellesTabProps> = ({ onNavigateTab }) => {
  const {
    currentUser,
    newsItems,
    markNewsAsRead,
    deleteNewsItem,
    dismissNewsForMember,
    getMemberDuesStatus,
  } = useApp();

  const isMember = currentUser?.type === 'MEMBER' && currentUser.member;
  const currentMemberId = currentUser?.member?.id;
  const memberDuesStatus = currentMemberId ? getMemberDuesStatus(currentMemberId) : 'RETARD';

  // Copied prayer toast state
  const [copiedPrayer, setCopiedPrayer] = useState(false);
  // Notification toast for item deletion
  const [toastFeedback, setToastFeedback] = useState<string | null>(null);

  // Local storage cache for dismissed announcements
  const [localDismissedIds, setLocalDismissedIds] = useState<string[]>(() => {
    if (!currentMemberId) return [];
    try {
      const stored = localStorage.getItem(`erouama_dismissed_news_${currentMemberId}`);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Filter news items automatically and strictly for the member or admin
  const visibleNews = newsItems.filter(item => {
    // If dismissed by current member in Firestore or local cache, hide from personal feed
    if (currentMemberId) {
      if (item.dismissedBy && item.dismissedBy.includes(currentMemberId)) {
        return false;
      }
      if (localDismissedIds.includes(item.id)) {
        return false;
      }
    }

    // If user is a member, only show news targeted at TOUS or matching their exact dues status
    if (isMember) {
      if (item.targetAudience === 'TOUS') return true;
      if (item.targetAudience === memberDuesStatus) return true;
      return false;
    }

    // Admins see all news items
    return true;
  });

  // Action: Member deletes/removes the announcement from their personal feed
  const handleRemoveNews = (newsId: string, newsTitle: string) => {
    if (currentMemberId) {
      dismissNewsForMember(newsId);
      setLocalDismissedIds(prev => {
        const updated = Array.from(new Set([...prev, newsId]));
        try {
          localStorage.setItem(
            `erouama_dismissed_news_${currentMemberId}`,
            JSON.stringify(updated)
          );
        } catch (_) {}
        return updated;
      });
      setToastFeedback(`Le communiqué « ${newsTitle} » a été retiré de votre fil personnel.`);
    } else {
      // If admin, delete
      deleteNewsItem(newsId);
      setToastFeedback(`Communiqué supprimé.`);
    }

    setTimeout(() => {
      setToastFeedback(null);
    }, 4000);
  };

  // Copy prayer text to clipboard
  const handleCopyPrayer = () => {
    try {
      navigator.clipboard.writeText(
        `${PRAYER_ROUAMA.title}\n\n${PRAYER_ROUAMA.fullText}`
      );
      setCopiedPrayer(true);
      setTimeout(() => setCopiedPrayer(false), 3000);
    } catch (err) {
      console.warn('Clipboard write error:', err);
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Dynamic Toast Feedback */}
      {toastFeedback && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white border border-emerald-500/60 px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 animate-fadeIn">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-xs sm:text-sm font-semibold">{toastFeedback}</span>
        </div>
      )}

      {/* SECTION PERMANENTE FIXE : PRIÈRE ROUAMA (SAINT AUGUSTIN) */}
      <div className="relative overflow-hidden bg-gradient-to-br from-emerald-950 via-slate-900 to-forest-moss border-2 border-amber-400/40 rounded-[2.5rem] p-6 sm:p-8 text-white shadow-xl">
        {/* Subtle decorative background light */}
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-amber-400/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-4">
          {/* Header of Prayer Card */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-amber-400/20 border border-amber-300/40 flex items-center justify-center text-amber-300 text-xl shadow-inner shrink-0">
                ✝️
              </div>
              <div>
                <h3 className="text-xl sm:text-2xl font-black text-amber-300 tracking-wide flex items-center gap-2">
                  <span>PRIÈRE ROUAMA (Saint Augustin)</span>
                </h3>
                <p className="text-xs text-emerald-200/90 font-medium">
                  Méditation et fondement spirituel permanent de la communauté E-ROUAMA
                </p>
              </div>
            </div>

            {/* Permanent Badges (Not Deletable) */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="bg-amber-400/20 text-amber-300 text-[11px] font-black px-3 py-1 rounded-full border border-amber-400/40 shadow-sm flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-300" />
                <span>Prière Officielle</span>
              </span>
              <span className="bg-emerald-500/20 text-emerald-300 text-[11px] font-black px-3 py-1 rounded-full border border-emerald-500/40 shadow-sm">
                Permanente • Non supprimable
              </span>
            </div>
          </div>

          {/* Full Text of the Prayer */}
          <div className="bg-slate-950/70 border border-amber-400/20 rounded-2xl p-5 sm:p-6 text-slate-100 italic leading-relaxed space-y-3 shadow-inner">
            {PRAYER_ROUAMA.paragraphs.map((paragraph, idx) => (
              <p key={idx} className="text-xs sm:text-sm font-medium text-emerald-50">
                {paragraph}
              </p>
            ))}
          </div>

          {/* Action Bar of the Prayer */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-2 text-xs text-amber-200/80 font-medium">
              <HeartHandshake className="w-4 h-4 text-amber-300" />
              <span>Fraternité, Foi, Entraide & Charité</span>
            </div>

            <button
              type="button"
              onClick={handleCopyPrayer}
              className="bg-white/10 hover:bg-white/20 text-amber-200 hover:text-white font-bold px-3.5 py-1.5 rounded-xl text-xs flex items-center gap-1.5 border border-white/20 shadow transition-all active:scale-95 cursor-pointer"
            >
              {copiedPrayer ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-300 font-extrabold">Prière copiée !</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-amber-300" />
                  <span>Copier le texte de la prière</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* FIL DES COMMUNIQUÉS GBAÏRAÏ */}
      <div className="bg-white rounded-[3rem] p-6 sm:p-8 shadow-sm border border-[#E67E22]/10">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
          <div>
            <h2 className="text-2xl font-black text-[#E67E22] flex items-center gap-2">
              <Newspaper className="w-6 h-6 text-[#355E3B]" />
              <span>Fil des Nouvelles & Communiqués</span>
            </h2>
            <p className="text-xs text-slate-500 font-medium mt-1">
              Annonces officielles, relances fraternelles et alertes publiques du groupe E-ROUAMA.
            </p>
          </div>

          {/* Automatic Feed Badge */}
          <div className="inline-flex items-center gap-1.5 bg-orange-50 px-3.5 py-1.5 rounded-2xl border border-orange-200 text-xs font-black text-[#D35400] shadow-sm">
            <span>Fil de nouvelles personnalisé</span>
          </div>
        </div>

        {/* News Feed List */}
        <div className="mt-6 space-y-4">
          {visibleNews.length === 0 ? (
            <div className="text-center py-12 bg-orange-50/40 rounded-3xl border border-dashed border-orange-200 text-slate-500 text-sm">
              Aucun nouveau communiqué ou annonce active dans votre fil personnel.
            </div>
          ) : (
            visibleNews.map(item => {
              const isRead = currentMemberId ? item.readBy.includes(currentMemberId) : true;
              const isArchiveRelated =
                item.linkTab === 'ARCHIVES' ||
                item.title.toLowerCase().includes('document') ||
                item.title.toLowerCase().includes('bilan') ||
                item.content.toLowerCase().includes('archives') ||
                item.content.toLowerCase().includes('coffre-fort') ||
                Boolean(item.targetDocId);

              return (
                <div
                  key={item.id}
                  className={`p-6 rounded-3xl border transition-all ${
                    !isRead
                      ? 'bg-orange-50/80 border-[#E67E22] shadow-md ring-2 ring-orange-400/20'
                      : 'bg-white border-slate-200/80 hover:border-emerald-300 shadow-sm'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      {item.category === 'ALERTE' && (
                        <span className="inline-flex items-center gap-1 bg-rose-600 text-white text-xs font-black px-3 py-1 rounded-full shadow-sm">
                          <AlertTriangle className="w-3.5 h-3.5" /> ALERTE FINANCIÈRE
                        </span>
                      )}
                      {item.category === 'RELANCE' && (
                        <span className="inline-flex items-center gap-1 bg-[#E67E22] text-white text-xs font-black px-3 py-1 rounded-full shadow-sm">
                          <Bell className="w-3.5 h-3.5" /> RELANCE
                        </span>
                      )}
                      {item.category === 'ANNONCE' && (
                        <span className="inline-flex items-center gap-1 bg-[#355E3B] text-white text-xs font-black px-3 py-1 rounded-full shadow-sm">
                          <Megaphone className="w-3.5 h-3.5" /> ANNONCE OFFICIELLE
                        </span>
                      )}

                      <span className="text-[11px] font-bold bg-amber-50 text-[#D35400] px-2.5 py-0.5 rounded-full border border-amber-200">
                        {item.dispatchChannel === 'MAIL'
                          ? '✉️ Diffusé par Email'
                          : item.dispatchChannel === 'GENERAL'
                          ? '🌐 Diffusé App + Email'
                          : '📲 Diffusé dans App'}
                      </span>
                    </div>

                    {/* Action buttons: Date, Mark as Read, Supprimer */}
                    <div className="flex items-center gap-2 flex-wrap text-xs text-slate-500 font-medium">
                      <span className="text-[11px] text-slate-400 font-semibold">{item.date}</span>

                      {/* Action: Marquer comme lu */}
                      {isMember && !isRead && (
                        <button
                          type="button"
                          onClick={() => markNewsAsRead(item.id)}
                          className="bg-[#355E3B] hover:bg-[#2A4B2F] text-white font-extrabold px-3 py-1 rounded-full text-[11px] flex items-center gap-1 shadow transition-all active:scale-95 cursor-pointer"
                        >
                          <Eye className="w-3 h-3" />
                          <span>Marquer comme lu</span>
                        </button>
                      )}

                      {/* Action: Supprimer du fil personnel */}
                      <button
                        type="button"
                        onClick={() => handleRemoveNews(item.id, item.title)}
                        title="Supprimer ce communiqué de votre fil personnel"
                        className="bg-rose-50 hover:bg-rose-100 text-rose-700 hover:text-rose-800 border border-rose-200 font-bold px-3 py-1 rounded-full text-[11px] flex items-center gap-1 shadow-sm transition-all active:scale-95 cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3 text-rose-600" />
                        <span>Supprimer</span>
                      </button>
                    </div>
                  </div>

                  <h3 className="text-xl font-black text-slate-900 mb-2">{item.title}</h3>
                  <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                    {item.content}
                  </p>

                  {/* Interactive Button linking to Archives Coffre-Fort */}
                  {isArchiveRelated && (
                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => {
                          if (currentMemberId) markNewsAsRead(item.id);
                          if (onNavigateTab) {
                            onNavigateTab('ARCHIVES', item.targetDocId);
                          }
                        }}
                        className="bg-[#355E3B] hover:bg-[#2A4B2F] text-white font-black px-4 py-2.5 rounded-2xl text-xs flex items-center gap-2 shadow-md transition-all active:scale-95 cursor-pointer"
                      >
                        <FolderOpen className="w-4 h-4 text-amber-300" />
                        <span>📂 CONSULTER DANS LES ARCHIVES</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
