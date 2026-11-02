import React, { useState, useMemo } from 'react';
import {
  Church,
  Sparkles,
  HeartHandshake,
  Copy,
  Check,
  Quote,
  BookOpen,
  Calendar,
  Clock,
  MapPin,
  FileText,
  Eye,
  Printer,
  X,
  Bookmark,
  ShieldCheck,
  Flame,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { PRAYER_ROUAMA } from '../../utils/versesData';
import { ReligiousEvent } from '../../types';

// Helper pour formater proprement une date YYYY-MM-DD en français
function formatFrenchEventDate(dateStr?: string): string {
  if (!dateStr) return 'Date à préciser';
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [y, m, d] = dateStr.split('-');
    const months = [
      'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
      'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
    ];
    const monthName = months[parseInt(m, 10) - 1] || m;
    return `${parseInt(d, 10)} ${monthName} ${y}`;
  }
  return dateStr;
}

// Vérifie si un événement spirituel est officiellement validé par le Payor ou publié
export function isSpiritualEventPublishedOrApproved(evt: ReligiousEvent): boolean {
  if (!evt) return false;

  // Exclusion stricte du texte permanent de la prière de Saint Augustin (qui dispose de sa section dédiée ci-dessous)
  const titleLower = (evt.title || '').toLowerCase();
  if (
    titleLower.includes('prière rouama') ||
    titleLower.includes('priere rouama') ||
    titleLower.includes('saint augustin')
  ) {
    return false;
  }

  const s = (evt.status || '').toUpperCase();
  return (
    s === 'PUBLISHED' ||
    s === 'APPROVED' ||
    s === 'APPROVED_PAYOR' ||
    s === 'VALIDATED' ||
    s === 'VALIDE' ||
    Boolean(evt.publishedToGbairai) ||
    Boolean(evt.publishedAt) ||
    Boolean(evt.payorSignature?.signedBy) ||
    Boolean(evt.payorSignature?.stampUrl) ||
    Boolean(evt.ackByCom)
  );
}

export const PriereRouamaTab: React.FC = () => {
  const { religiousEvents } = useApp();
  const [isCopied, setIsCopied] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'ALL' | 'EVENTS' | 'PRAYER'>('ALL');
  const [viewingOfficialDoc, setViewingOfficialDoc] = useState<ReligiousEvent | null>(null);

  // Filtrage, dédoublonnage strict et tri des événements spirituels validés & publiés
  const validatedSpiritualEvents = useMemo(() => {
    const normalizeKey = (str?: string) => (str || '').toLowerCase().replace(/[^a-z0-9]/g, '');

    const filtered = (religiousEvents || []).filter(isSpiritualEventPublishedOrApproved);

    // Dédoublonnage strict par titre normalisé et date
    const uniqueEvents: ReligiousEvent[] = [];
    const seen = new Set<string>();

    filtered.forEach(evt => {
      const normTitle = normalizeKey(evt.title);
      const normDate = normalizeKey(evt.eventDate || '');
      const key = `${normTitle}_${normDate}`;

      if (!seen.has(key)) {
        seen.add(key);
        uniqueEvents.push(evt);
      }
    });

    return uniqueEvents.sort((a, b) => {
      const dateA = a.eventDate || a.publishedAt || a.createdAt || '';
      const dateB = b.eventDate || b.publishedAt || b.createdAt || '';
      return dateB.localeCompare(dateA);
    });
  }, [religiousEvents]);

  const handleCopyPrayer = () => {
    try {
      navigator.clipboard.writeText(
        `${PRAYER_ROUAMA.title}\n${PRAYER_ROUAMA.subtitle}\n\n${PRAYER_ROUAMA.fullText}\n\nFraternité E-ROUAMA • DINIYO ROUAMA`
      );
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 3000);
    } catch (e) {
      console.warn('Erreur copie presse-papier:', e);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-fadeIn pb-12">
      {/* Header Banner Officiel */}
      <div className="bg-gradient-to-r from-[#355E3B] via-[#2A4B2F] to-[#1F3723] text-white p-6 sm:p-8 rounded-[2.5rem] shadow-lg border border-emerald-700/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-400/20 border border-amber-400/40 flex items-center justify-center text-amber-300 text-2xl shadow-inner shrink-0">
            ✝️
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="bg-amber-400/20 text-amber-300 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-amber-400/30 uppercase tracking-widest flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-300" />
                <span>Espace Foi & Fraternité</span>
              </span>
              <span className="bg-emerald-500/20 text-emerald-200 text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-emerald-400/30">
                Fixe • Tous les Membres
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Prière ROUAMA & Agenda Spirituel
            </h1>
            <p className="text-xs sm:text-sm text-emerald-100/90 font-medium mt-0.5">
              Prière officielle permanente (Saint Augustin) et rendez-vous spirituels validés
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleCopyPrayer}
          className="bg-amber-400/20 hover:bg-amber-400/30 text-amber-200 hover:text-white border border-amber-300/40 font-bold px-4 py-2.5 rounded-2xl text-xs flex items-center gap-2 shadow transition-all active:scale-95 cursor-pointer shrink-0"
        >
          {isCopied ? (
            <>
              <Check className="w-4 h-4 text-emerald-400" />
              <span className="text-emerald-300 font-extrabold">Prière copiée !</span>
            </>
          ) : (
            <>
              <Copy className="w-4 h-4 text-amber-300" />
              <span>Copier la Prière</span>
            </>
          )}
        </button>
      </div>

      {/* Barre de navigation / Sélecteur de vue */}
      <div className="bg-white/80 backdrop-blur-sm p-1.5 rounded-2xl border border-amber-200/80 shadow-sm flex items-center gap-2 flex-wrap sm:flex-nowrap">
        <button
          type="button"
          onClick={() => setActiveSubTab('ALL')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeSubTab === 'ALL'
              ? 'bg-[#355E3B] text-white shadow-md'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <span>📑 Tout Afficher</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('EVENTS')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeSubTab === 'EVENTS'
              ? 'bg-[#355E3B] text-white shadow-md'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Flame className="w-3.5 h-3.5 text-amber-400" />
          <span>Événements Spirituels</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
            activeSubTab === 'EVENTS'
              ? 'bg-amber-400 text-slate-950'
              : 'bg-emerald-100 text-emerald-800'
          }`}>
            {validatedSpiritualEvents.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('PRAYER')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeSubTab === 'PRAYER'
              ? 'bg-[#355E3B] text-white shadow-md'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Church className="w-3.5 h-3.5 text-amber-400" />
          <span>Texte Saint Augustin</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 1 : ÉVÉNEMENTS SPIRITUELS VALIDÉS & PUBLIÉS                       */}
      {/* ========================================================================= */}
      {(activeSubTab === 'ALL' || activeSubTab === 'EVENTS') && (
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-3 px-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-100 text-[#355E3B] flex items-center justify-center font-bold">
                🕊️
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                  <span>Programme & Rendez-vous Spirituels</span>
                  <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2 py-0.5 rounded-full border border-emerald-300">
                    {validatedSpiritualEvents.length} validé{validatedSpiritualEvents.length > 1 ? 's' : ''}
                  </span>
                </h2>
                <p className="text-[11px] sm:text-xs text-slate-500 font-medium">
                  Messes, neuvaines, prières collectives et retraites officiellement validées
                </p>
              </div>
            </div>
          </div>

          {validatedSpiritualEvents.length === 0 ? (
            <div className="bg-white rounded-3xl p-8 border-2 border-dashed border-amber-200 text-center space-y-3">
              <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto">
                <Church className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">
                Aucun événement spirituel publié pour le moment
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Les prochaines retraites, messes et intentions validées par la Direction seront automatiquement affichées ici dès publication.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {validatedSpiritualEvents.map((evt) => {
                const formattedDate = formatFrenchEventDate(evt.eventDate);
                const hasTheme = Boolean(evt.theme && evt.theme.trim().length > 0);
                const isApprovedByPayor = Boolean(evt.payorSignature?.signedBy || evt.status === 'APPROVED' || evt.status === 'APPROVED_PAYOR');

                return (
                  <div
                    key={evt.id}
                    className="bg-white rounded-3xl p-5 sm:p-6 shadow-md border-2 border-emerald-600/20 hover:border-emerald-600/40 transition-all hover:shadow-lg space-y-4"
                  >
                    {/* Header carte */}
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="bg-slate-100 text-slate-700 font-black text-[10px] px-2.5 py-1 rounded-lg border border-slate-200 tracking-wider">
                          Réf: {evt.id}
                        </span>
                        <span className="bg-emerald-100 text-[#355E3B] text-[10px] font-black px-2.5 py-1 rounded-lg border border-emerald-300 flex items-center gap-1">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Officiel • Validé & Publié</span>
                        </span>
                      </div>

                      {evt.publishedAt && (
                        <span className="text-[10px] text-slate-400 font-medium">
                          Publié le {evt.publishedAt}
                        </span>
                      )}
                    </div>

                    {/* Titre & Thème */}
                    <div className="space-y-2">
                      <h3 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                        {evt.title}
                      </h3>

                      {hasTheme && (
                        <div className="bg-amber-50/80 border border-amber-200/90 rounded-2xl p-3 flex items-start gap-2.5">
                          <Bookmark className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                          <div>
                            <span className="text-[10px] font-black uppercase text-amber-800 tracking-wider block">
                              Thème Spirituel
                            </span>
                            <p className="text-xs sm:text-sm font-bold text-amber-950 italic">
                              « {evt.theme} »
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Grille des Détails (Date, Heure, Lieu) */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                      <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3 flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-emerald-100 text-[#355E3B] flex items-center justify-center shrink-0">
                          <Calendar className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                            Date
                          </p>
                          <p className="text-xs font-bold text-slate-800">
                            {formattedDate}
                          </p>
                        </div>
                      </div>

                      <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3 flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-amber-100 text-[#D35400] flex items-center justify-center shrink-0">
                          <Clock className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                            Heure
                          </p>
                          <p className="text-xs font-bold text-slate-800">
                            {evt.eventTime ? evt.eventTime : '17:00'}
                          </p>
                        </div>
                      </div>

                      <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3 flex items-center gap-3 sm:col-span-1">
                        <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                          <MapPin className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                            Lieu
                          </p>
                          <p className="text-xs font-bold text-slate-800 truncate" title={evt.location}>
                            {evt.location || 'Sanctuaire ROUAMA'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Pied de carte avec visa Payor et Bouton de consultation */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
                      <div className="flex items-center gap-2">
                        {isApprovedByPayor ? (
                          <div className="flex items-center gap-1.5 text-xs text-emerald-800 font-bold bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                            <span>Visé & Approuvé par le Payor</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
                            <span>Événement officiel diffusé</span>
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => setViewingOfficialDoc(evt)}
                        className="bg-[#355E3B] hover:bg-[#2A4B2F] text-white font-extrabold px-4 py-2 rounded-xl text-xs flex items-center gap-2 transition-all active:scale-95 shadow cursor-pointer ml-auto"
                      >
                        <Eye className="w-3.5 h-3.5 text-amber-300" />
                        <span>Consulter la Fiche</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* ========================================================================= */}
      {/* SECTION 2 : PRIÈRE ROUAMA PERMANENTE (SAINT AUGUSTIN)                     */}
      {/* ========================================================================= */}
      {(activeSubTab === 'ALL' || activeSubTab === 'PRAYER') && (
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-3 px-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-amber-100 text-[#D35400] flex items-center justify-center font-bold">
                📜
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                  Prière Permanente ROUAMA (Saint Augustin)
                </h2>
                <p className="text-[11px] sm:text-xs text-slate-500 font-medium">
                  Fondement spirituel immuable de l'association
                </p>
              </div>
            </div>
          </div>

          {/* Main Prayer Parchment Card */}
          <div className="relative overflow-hidden bg-white rounded-[3rem] p-8 sm:p-12 shadow-xl border-2 border-amber-400/30">
            {/* Decorative corner flourishes & ambient glow */}
            <div className="absolute -top-16 -right-16 w-64 h-64 bg-amber-400/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-16 -left-16 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 space-y-8">
              {/* Saint Augustin Citation Frame */}
              <div className="text-center space-y-2 border-b border-amber-200/60 pb-6">
                <div className="inline-flex items-center justify-center p-3 rounded-full bg-amber-50 text-[#D35400] mb-2 border border-amber-200">
                  <Church className="w-6 h-6 text-[#355E3B]" />
                </div>
                <h2 className="text-xl sm:text-2xl font-serif font-black text-slate-900 tracking-wide">
                  {PRAYER_ROUAMA.title}
                </h2>
                <p className="text-xs sm:text-sm font-semibold text-[#D35400] italic">
                  {PRAYER_ROUAMA.subtitle}
                </p>
              </div>

              {/* Core Prayer Text */}
              <div className="bg-[#FAF7F0] border border-amber-300/60 rounded-3xl p-6 sm:p-10 shadow-inner space-y-6">
                <div className="flex items-center gap-2 text-amber-700/80 font-serif">
                  <Quote className="w-8 h-8 text-amber-500/40 rotate-180" />
                </div>

                {PRAYER_ROUAMA.paragraphs.map((paragraph, index) => (
                  <p
                    key={index}
                    className="text-base sm:text-lg font-serif italic text-slate-800 leading-relaxed text-justify sm:text-center px-2 sm:px-6"
                  >
                    {paragraph}
                  </p>
                ))}

                <div className="flex justify-end text-amber-700/80 font-serif">
                  <Quote className="w-8 h-8 text-amber-500/40" />
                </div>
              </div>

              {/* Motto and Values */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-100">
                <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-200/70 flex items-center gap-3">
                  <div className="p-2 bg-[#355E3B] text-white rounded-xl shrink-0">
                    <HeartHandshake className="w-5 h-5 text-amber-300" />
                  </div>
                  <div>
                    <p className="text-[11px] font-black text-[#355E3B] uppercase tracking-wider">
                      Devise Fraternelle
                    </p>
                    <p className="text-xs font-semibold text-slate-700 italic">
                      « Chez nous la mesure de l'amour c'est d'aimer sans mesure »
                    </p>
                  </div>
                </div>

                <div className="bg-amber-50 rounded-2xl p-4 border border-amber-200/70 flex items-center gap-3">
                  <div className="p-2 bg-[#E67E22] text-white rounded-xl shrink-0">
                    <BookOpen className="w-5 h-5 text-amber-100" />
                  </div>
                  <div>
                    <p className="text-[11px] font-black text-[#D35400] uppercase tracking-wider">
                      Piliers de Foi
                    </p>
                    <p className="text-xs font-semibold text-slate-700">
                      Fraternité • Foi • Entraide • Charité
                    </p>
                  </div>
                </div>
              </div>

              {/* Permanent Notice */}
              <div className="text-center pt-2">
                <p className="text-[11px] text-slate-400 font-medium">
                  ℹ️ Cette prière est permanente et accessible à tous les membres à tout moment depuis ce volet dédié.
                </p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ========================================================================= */}
      {/* MODAL FICHE OFFICIELLE D'ÉVÉNEMENT SPIRITUEL (MISE AUX NORMES E-ROUAMA)   */}
      {/* ========================================================================= */}
      {viewingOfficialDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border-2 border-emerald-600/40 overflow-hidden flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-[#355E3B] to-[#2A4B2F] text-white p-4 sm:p-5 flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-400/20 text-amber-300 flex items-center justify-center font-bold">
                  🕊️
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-white">
                    Fiche Officielle • Événement Spirituel
                  </h3>
                  <p className="text-[11px] text-emerald-200">
                    Réf : {viewingOfficialDoc.id}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer text-xs flex items-center gap-1.5"
                  title="Imprimer ou enregistrer en PDF"
                >
                  <Printer className="w-4 h-4 text-amber-300" />
                  <span className="hidden sm:inline">Imprimer</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewingOfficialDoc(null)}
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-colors cursor-pointer"
                  title="Fermer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Document Body (Imprimable & Conforme aux normes) */}
            <div className="p-6 sm:p-8 overflow-y-auto space-y-6 text-slate-800 text-xs">
              {/* En-tête officiel (FAMILLE ROUAMA - sans mention républicaine) */}
              <div className="text-center border-b-2 border-slate-900 pb-4 space-y-1">
                <p className="font-serif font-black tracking-widest text-slate-950 uppercase text-sm sm:text-base">
                  FAMILLE ROUAMA
                </p>
                <p className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                  DÉPARTEMENT SPIRITUALITÉ & VIE FRATERNELLE
                </p>
                <p className="text-[10px] italic text-[#355E3B] font-semibold">
                  « Chez nous la mesure de l'amour c'est d'aimer sans mesure »
                </p>
              </div>

              {/* Titre officiel de la fiche */}
              <div className="text-center py-2 bg-slate-50 border border-slate-200 rounded-xl">
                <h4 className="text-sm sm:text-base font-black text-slate-900 uppercase tracking-wider">
                  FICHE D'ÉVÉNEMENT SPIRITUEL
                </h4>
                <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                  N° Réf : {viewingOfficialDoc.id}
                </p>
              </div>

              {/* Paramètres de l'événement */}
              <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 space-y-3 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">
                      Intitulé de l'activité
                    </span>
                    <strong className="text-sm font-black text-slate-900">
                      {viewingOfficialDoc.title}
                    </strong>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">
                      Date & Heure
                    </span>
                    <span className="text-slate-800 font-bold">
                      {formatFrenchEventDate(viewingOfficialDoc.eventDate)} à {viewingOfficialDoc.eventTime || '17:00'}
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">
                      Lieu du rassemblement
                    </span>
                    <span className="text-slate-800 font-bold">
                      {viewingOfficialDoc.location || 'Sanctuaire ROUAMA'}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">
                      Statut administratif
                    </span>
                    <span className="inline-block bg-emerald-100 text-[#355E3B] font-black text-[10px] px-2.5 py-0.5 rounded-full border border-emerald-300">
                      OFFICIEL • VALIDÉ & PUBLIÉ
                    </span>
                  </div>
                </div>

                {viewingOfficialDoc.theme && (
                  <div className="pt-2 border-t border-slate-200">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">
                      Thème Spirituel & Méditation
                    </span>
                    <p className="text-slate-900 font-serif italic font-bold text-xs sm:text-sm mt-0.5">
                      « {viewingOfficialDoc.theme} »
                    </p>
                  </div>
                )}
              </div>

              {/* Bloc de validation finale (Payor uniquement - conformité stricte) */}
              <div className="pt-4 border-t border-slate-200 flex justify-end">
                <div className="w-full sm:w-64 p-4 bg-emerald-50/80 rounded-2xl border-2 border-emerald-600/30 text-center space-y-2">
                  <div className="text-[10px] uppercase font-black tracking-wider text-[#355E3B]">
                    APPROBATION : LE PAYOR / DIRECTION
                  </div>

                  <div className="h-16 flex items-center justify-center">
                    <img
                      src="/SS.png"
                      alt="Signature & Cachet Payor"
                      className="max-h-14 max-w-full object-contain filter drop-shadow-sm"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  </div>

                  <div className="pt-1 border-t border-emerald-200/80">
                    <div className="font-black text-slate-900 text-xs uppercase tracking-tight">
                      {viewingOfficialDoc.payorSignature?.signedBy || 'WOYA SYLAS (LE PAYOR)'}
                    </div>
                    <div className="text-[9px] font-bold text-emerald-800 tracking-wider uppercase mt-0.5">
                      Visa & Accord délivrés
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 border-t border-slate-200 p-4 flex items-center justify-between gap-3 shrink-0">
              <span className="text-[10px] text-slate-500 font-medium">
                Document officiel FAMILLE ROUAMA
              </span>
              <button
                type="button"
                onClick={() => setViewingOfficialDoc(null)}
                className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold px-4 py-2 rounded-xl text-xs transition-colors cursor-pointer"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
