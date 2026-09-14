import React, { useState } from 'react';
import { Church, Sparkles, HeartHandshake, Copy, Check, Quote, BookOpen } from 'lucide-react';
import { PRAYER_ROUAMA } from '../../utils/versesData';

export const PriereRouamaTab: React.FC = () => {
  const [isCopied, setIsCopied] = useState(false);

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
    <div className="space-y-6 max-w-4xl mx-auto animate-fadeIn">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#355E3B] via-[#2A4B2F] to-[#1F3723] text-white p-6 sm:p-8 rounded-[2.5rem] shadow-lg border border-emerald-700/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-400/20 border border-amber-400/40 flex items-center justify-center text-amber-300 text-2xl shadow-inner shrink-0">
            ✝️
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="bg-amber-400/20 text-amber-300 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-amber-400/30 uppercase tracking-widest flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-300" />
                <span>Prière Officielle Permanente</span>
              </span>
              <span className="bg-emerald-500/20 text-emerald-200 text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-emerald-400/30">
                Fixe • Tous les Membres
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Prière ROUAMA (Saint Augustin)
            </h1>
            <p className="text-xs sm:text-sm text-emerald-100/90 font-medium mt-0.5">
              Fondement spirituel
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
              <span>Copier le texte</span>
            </>
          )}
        </button>
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
    </div>
  );
};
