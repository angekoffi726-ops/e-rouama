import React from 'react';
import { useApp } from '../../context/AppContext';
import { Newspaper, Bell, AlertTriangle, Megaphone, Eye, FolderOpen } from 'lucide-react';
import { TabType } from '../../types';

interface NouvellesTabProps {
  onNavigateTab?: (tab: TabType, docId?: string) => void;
}

export const NouvellesTab: React.FC<NouvellesTabProps> = ({ onNavigateTab }) => {
  const { currentUser, newsItems, markNewsAsRead, getMemberDuesStatus } = useApp();

  const isMember = currentUser?.type === 'MEMBER' && currentUser.member;
  const currentMemberId = currentUser?.member?.id;
  const memberDuesStatus = currentMemberId ? getMemberDuesStatus(currentMemberId) : 'RETARD';

  // Filter news items automatically and strictly for the member or admin
  const visibleNews = newsItems.filter(item => {
    // If user is a member, only show news targeted at TOUS or matching their exact dues status
    if (isMember) {
      if (item.targetAudience === 'TOUS') return true;
      if (item.targetAudience === memberDuesStatus) return true;
      return false;
    }

    // Admins see all news items
    return true;
  });

  return (
    <div className="space-y-8 animate-fadeIn">
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
              Aucune annonce ou nouvelle publiée pour votre profil actuellement.
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
                        {item.dispatchChannel === 'MAIL' ? '✉️ Diffusé par Email' : item.dispatchChannel === 'GENERAL' ? '🌐 Diffusé App + Email' : '📲 Diffusé dans App'}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-500 font-medium">
                      <span>{item.date}</span>
                      {isMember && !isRead && (
                        <button
                          onClick={() => markNewsAsRead(item.id)}
                          className="bg-[#355E3B] hover:bg-[#2A4B2F] text-white font-extrabold px-3 py-1 rounded-full text-[11px] flex items-center gap-1 shadow transition-all active:scale-95 cursor-pointer"
                        >
                          <Eye className="w-3 h-3" />
                          <span>Marquer comme lu</span>
                        </button>
                      )}
                    </div>
                  </div>

                  <h3 className="text-xl font-black text-slate-900 mb-2">{item.title}</h3>
                  <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">{item.content}</p>

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
