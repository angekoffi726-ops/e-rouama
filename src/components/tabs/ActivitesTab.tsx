import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { EventActivity } from '../../types';
import { Tent, Calendar, Clock, Users, Sparkles, MapPin, Palmtree, Cake, UserCheck, CheckCircle2 } from 'lucide-react';

const MONTH_NAMES = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

// Helper to calculate target Date for an activity
function getActivityTargetDate(act: EventActivity): { targetDate: Date | null; isMonthYearOnly: boolean; isIndeterminate: boolean } {
  // Case 1: Structured fractional fields are present
  if (act.eventYear && act.eventYear !== 'LATER' && act.eventMonth && act.eventMonth !== 'LATER') {
    const year = parseInt(act.eventYear, 10);
    const monthIndex = parseInt(act.eventMonth, 10) - 1;
    const isDayPending = !act.eventDay || act.eventDay === 'LATER' || act.isDayPending;
    const day = isDayPending ? 1 : parseInt(act.eventDay, 10);
    return {
      targetDate: new Date(year, monthIndex, day, 0, 0, 0),
      isMonthYearOnly: isDayPending,
      isIndeterminate: false,
    };
  }

  // Case 2: Attempt parsing standard YYYY-MM-DD
  if (act.eventDate && /^\d{4}-\d{2}-\d{2}$/.test(act.eventDate)) {
    const [y, m, d] = act.eventDate.split('-').map(Number);
    return {
      targetDate: new Date(y, m - 1, d, 0, 0, 0),
      isMonthYearOnly: false,
      isIndeterminate: false,
    };
  }

  // Case 3: Attempt parsing formatted strings like "21 Mars 2027" or "Décembre 2026"
  if (act.eventDate) {
    for (let i = 0; i < MONTH_NAMES.length; i++) {
      const mName = MONTH_NAMES[i];
      if (act.eventDate.toLowerCase().includes(mName.toLowerCase())) {
        const yearMatch = act.eventDate.match(/\b(202\d|203\d)\b/);
        const year = yearMatch ? parseInt(yearMatch[1], 10) : 2026;
        const dayMatch = act.eventDate.match(/\b(\d{1,2})\s+[A-Za-zÀ-ÿ]/);
        const day = dayMatch ? parseInt(dayMatch[1], 10) : 1;
        const isMonthOnly = !dayMatch;
        return {
          targetDate: new Date(year, i, day, 0, 0, 0),
          isMonthYearOnly: isMonthOnly,
          isIndeterminate: false,
        };
      }
    }
  }

  return { targetDate: null, isMonthYearOnly: false, isIndeterminate: true };
}

// Activity Countdown Display
const ActivityCountdown: React.FC<{ activity: EventActivity }> = ({ activity }) => {
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const { targetDate, isMonthYearOnly, isIndeterminate } = getActivityTargetDate(activity);

  if (isIndeterminate || !targetDate) {
    // Only show "Date à préciser" when date cannot be determined at all
    return (
      <span className="bg-slate-100 text-slate-600 border border-slate-300 px-3 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1">
        <Clock className="w-3.5 h-3.5 text-slate-400" />
        <span>Date à préciser</span>
      </span>
    );
  }

  const diff = targetDate.getTime() - now.getTime();

  if (diff <= 0) {
    return (
      <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 px-3 py-1 rounded-full text-xs font-black inline-flex items-center gap-1.5">
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
        <span>Événement en cours / Terminé</span>
      </span>
    );
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diff / 1000 / 60) % 60);

  return (
    <div className="bg-emerald-900/90 text-white px-3.5 py-1.5 rounded-2xl border border-emerald-700/80 shadow-sm flex items-center gap-2">
      <Clock className="w-4 h-4 text-amber-300 shrink-0" />
      <div className="text-xs font-black flex items-center gap-1.5">
        <span className="text-amber-300 uppercase text-[10px] tracking-wider">J-{days}</span>
        <span className="text-slate-200 text-[11px]">({hours}h {minutes}m)</span>
        {isMonthYearOnly && (
          <span className="text-[10px] text-amber-200/90 font-medium pl-1 border-l border-emerald-700">
            (dès le 1er du mois)
          </span>
        )}
      </div>
    </div>
  );
};

export const ActivitesTab: React.FC = () => {
  const { activities } = useApp();

  // Compute target festival year dynamically:
  // Before or on March 21st of current year -> current year (e.g. 2026)
  // After March 21st of current year -> next year (e.g. 2027)
  const computeTargetYear = (now: Date) => {
    const currentYear = now.getFullYear();
    const march21EndOfDay = new Date(currentYear, 2, 21, 23, 59, 59, 999);
    return now.getTime() > march21EndOfDay.getTime() ? currentYear + 1 : currentYear;
  };

  const [targetYear, setTargetYear] = useState<number>(() => computeTargetYear(new Date()));

  // Countdown timer to next March 21st (Anniversaire ROUAMA)
  const [timeLeft, setTimeLeft] = useState<{ days: number; hours: number; minutes: number; seconds: number }>({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });

  useEffect(() => {
    const calculateCountdown = () => {
      const now = new Date();
      const currentYear = now.getFullYear();
      const march21EndOfDay = new Date(currentYear, 2, 21, 23, 59, 59, 999);

      const computedYear = now.getTime() > march21EndOfDay.getTime() ? currentYear + 1 : currentYear;
      setTargetYear(computedYear);

      const targetDate = new Date(computedYear, 2, 21, 0, 0, 0);
      const diff = targetDate.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
      } else {
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
        const minutes = Math.floor((diff / 1000 / 60) % 60);
        const seconds = Math.floor((diff / 1000) % 60);
        setTimeLeft({ days, hours, minutes, seconds });
      }
    };

    calculateCountdown();
    const interval = setInterval(calculateCountdown, 1000);
    return () => clearInterval(interval);
  }, []);

  const publishedActivities = activities.filter(a => a.status === 'PUBLISHED');

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* 1. MARCH 21ST FESTIVAL COUNTDOWN HERO BANNER */}
      <div className="bg-[#355E3B] rounded-[3rem] p-6 sm:p-10 text-white shadow-xl relative overflow-hidden border border-white/10">
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-[#E67E22]/20 rounded-full blur-2xl pointer-events-none" />

        <div className="flex flex-col md:flex-row items-center justify-between gap-8 relative z-10">
          <div className="space-y-3 text-center md:text-left">
            <div className="inline-flex items-center gap-2 bg-amber-400/20 text-amber-300 px-4 py-1.5 rounded-full text-xs font-black border border-amber-300/30">
              <Sparkles className="w-4 h-4" />
              <span>JOUR DE FETE</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-amber-200 tracking-tight">
              ANNIVERSAIRE ROUAMA (21 MARS {targetYear})
            </h2>
            <p className="text-xs sm:text-sm text-emerald-100 max-w-lg leading-relaxed">
              Célébration annuelle ROUAMA. Rassemblement, retrouvailles, partage et réjouissances.
            </p>
          </div>

          {/* Countdown Clock */}
          <div className="bg-emerald-950/80 backdrop-blur-md border-2 border-amber-300/40 rounded-3xl p-5 shadow-2xl text-center">
            <p className="text-xs uppercase font-extrabold text-amber-300 tracking-widest mb-3 flex items-center justify-center gap-1.5">
              <Clock className="w-4 h-4" />
              <span>Décompte Officiel</span>
            </p>
            <div className="grid grid-cols-4 gap-3 text-amber-200">
              <div className="bg-emerald-900/90 rounded-2xl p-3 border border-emerald-700 min-w-[60px]">
                <span className="text-2xl sm:text-3xl font-black block text-white">{timeLeft.days}</span>
                <span className="text-[10px] uppercase font-bold text-amber-300">Jours</span>
              </div>
              <div className="bg-emerald-900/90 rounded-2xl p-3 border border-emerald-700 min-w-[60px]">
                <span className="text-2xl sm:text-3xl font-black block text-white">{timeLeft.hours}</span>
                <span className="text-[10px] uppercase font-bold text-amber-300">Heures</span>
              </div>
              <div className="bg-emerald-900/90 rounded-2xl p-3 border border-emerald-700 min-w-[60px]">
                <span className="text-2xl sm:text-3xl font-black block text-white">{timeLeft.minutes}</span>
                <span className="text-[10px] uppercase font-bold text-amber-300">Min</span>
              </div>
              <div className="bg-emerald-900/90 rounded-2xl p-3 border border-emerald-700 min-w-[60px]">
                <span className="text-2xl sm:text-3xl font-black block text-white">{timeLeft.seconds}</span>
                <span className="text-[10px] uppercase font-bold text-amber-300">Sec</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. AD-HOC COMMITTEES & PUBLISHED PROGRAMS */}
      <div className="bg-white rounded-[2.5rem] p-6 sm:p-8 shadow-xl border border-emerald-900/10 space-y-6">
        <div>
          <h2 className="text-2xl font-black text-forest-moss flex items-center gap-2">
            <Tent className="w-6 h-6 text-amber-600" />
            <span>Comités Ad-Hoc & Programmes d'Événements</span>
          </h2>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Organisation autonome gérée par la Commission Organisation et diffusée pour l'ensemble des membres.
          </p>
        </div>

        {publishedActivities.length === 0 ? (
          <div className="text-center py-12 bg-emerald-50/30 rounded-3xl border border-dashed border-emerald-200 text-slate-500 text-sm">
            Aucune activité ou programme publié pour l'instant. (Attente de rédaction par la Commission Organisation).
          </div>
        ) : (
          <div className="space-y-8">
            {publishedActivities.map(act => {
              // Check if any committee roles have been designated
              const hasAdHocMembers = act.adHocRoles && Object.values(act.adHocRoles).some(val => {
                if (Array.isArray(val)) return val.length > 0;
                return Boolean(val && val !== 'Non désigné');
              });

              return (
                <div
                  key={act.id}
                  className="bg-emerald-50/40 rounded-3xl p-6 border-2 border-emerald-200/80 shadow-sm space-y-6"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-emerald-200/60">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Type d'événement (Fixe vs Simple) */}
                        {act.eventType === 'FIXE' ? (
                          <span className="text-xs font-black text-amber-900 bg-amber-200 px-3 py-1 rounded-full inline-flex items-center gap-1.5 shadow-sm">
                            <Sparkles className="w-3.5 h-3.5 text-amber-700" />
                            <span>
                              {act.fixedType === 'SOIREE_ROUAMA'
                                ? 'Soirée Rouama (Fixe)'
                                : act.fixedType === 'ANNIVERSAIRE'
                                ? 'Anniversaire 21 Mars (Fixe)'
                                : 'Événement Fixe'}
                            </span>
                          </span>
                        ) : (
                          <span className="text-xs font-black text-sky-900 bg-sky-200 px-3 py-1 rounded-full inline-flex items-center gap-1.5 shadow-sm">
                            <Palmtree className="w-3.5 h-3.5 text-sky-700" />
                            <span>Sorties & Loisirs (Simple)</span>
                          </span>
                        )}

                        {/* Date de l'événement */}
                        <span className="text-xs font-black text-slate-800 bg-white border border-slate-300 px-3 py-1 rounded-full inline-flex items-center gap-1.5 shadow-sm">
                          <Calendar className="w-3.5 h-3.5 text-amber-600" />
                          <span>Date : {act.eventDate}</span>
                        </span>

                        {act.location && (
                          <span className="text-xs font-black text-emerald-900 bg-emerald-200/90 px-3 py-1 rounded-full inline-flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-emerald-700" />
                            <span>Lieu : {act.location}</span>
                          </span>
                        )}
                      </div>

                      <h3 className="text-2xl font-black text-slate-900">{act.title}</h3>
                    </div>

                    {/* Décompte SHOW automatique */}
                    <div className="shrink-0 self-start sm:self-center">
                      <ActivityCountdown activity={act} />
                    </div>
                  </div>

                  {/* Description & Program */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="text-xs font-bold text-forest-moss uppercase tracking-wider mb-2">
                        Description & Objectifs
                      </h4>
                      <p className="text-sm text-slate-700 leading-relaxed bg-white p-4 rounded-2xl border border-slate-200">
                        {act.description || 'Aucune description fournie.'}
                      </p>
                    </div>

                    <div>
                      <h4 className="text-xs font-bold text-forest-moss uppercase tracking-wider mb-2">
                        Programme Déroulé
                      </h4>
                      <p className="text-sm text-slate-700 leading-relaxed bg-white p-4 rounded-2xl border border-slate-200 whitespace-pre-line">
                        {act.program || 'Aucun programme détaillé.'}
                      </p>
                    </div>
                  </div>

                  {/* Committees / Ad-Hoc */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-xs font-bold text-forest-moss uppercase tracking-wider flex items-center gap-1.5">
                        <Users className="w-4 h-4 text-amber-600" />
                        <span>Attribution du Comité Ad-Hoc</span>
                      </h4>
                      {!hasAdHocMembers && (
                        <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full">
                          Nomination ultérieure
                        </span>
                      )}
                    </div>

                    {hasAdHocMembers && act.adHocRoles ? (
                      (() => {
                        const formatMembers = (val?: string[] | string) => {
                          if (!val) return 'Non désigné';
                          if (Array.isArray(val)) return val.length > 0 ? val.join(', ') : 'Non désigné';
                          return val.trim() || 'Non désigné';
                        };

                        return (
                          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
                            <div className="bg-white p-3 rounded-2xl border border-emerald-200 shadow-sm">
                              <span className="text-[10px] uppercase font-bold text-amber-700 block">PCO</span>
                              <span className="font-extrabold text-slate-900 text-xs break-words">{formatMembers(act.adHocRoles.pco)}</span>
                            </div>
                            <div className="bg-white p-3 rounded-2xl border border-emerald-200 shadow-sm">
                              <span className="text-[10px] uppercase font-bold text-amber-700 block">PCO Adjoint</span>
                              <span className="font-extrabold text-slate-900 text-xs break-words">{formatMembers(act.adHocRoles.pcoAdjoint)}</span>
                            </div>
                            <div className="bg-white p-3 rounded-2xl border border-emerald-200 shadow-sm">
                              <span className="text-[10px] uppercase font-bold text-emerald-700 block">Restauration</span>
                              <span className="font-extrabold text-slate-900 text-xs break-words">{formatMembers(act.adHocRoles.restauration)}</span>
                            </div>
                            <div className="bg-white p-3 rounded-2xl border border-emerald-200 shadow-sm">
                              <span className="text-[10px] uppercase font-bold text-emerald-700 block">Cambuse</span>
                              <span className="font-extrabold text-slate-900 text-xs break-words">{formatMembers(act.adHocRoles.cambuse)}</span>
                            </div>
                            <div className="bg-white p-3 rounded-2xl border border-emerald-200 shadow-sm">
                              <span className="text-[10px] uppercase font-bold text-sky-700 block">Logistique</span>
                              <span className="font-extrabold text-slate-900 text-xs break-words">{formatMembers(act.adHocRoles.logistique)}</span>
                            </div>
                            <div className="bg-white p-3 rounded-2xl border border-emerald-200 shadow-sm">
                              <span className="text-[10px] uppercase font-bold text-sky-700 block">Transport</span>
                              <span className="font-extrabold text-slate-900 text-xs break-words">{formatMembers(act.adHocRoles.transport)}</span>
                            </div>
                          </div>
                        );
                      })()
                    ) : (
                      <div className="bg-white/80 p-4 rounded-2xl border border-emerald-200/80 text-xs text-slate-600 flex items-center justify-between">
                        <span className="italic">
                          Comité Ad-hoc en cours de constitution par la Commission Organisation. L'affectation des postes sera précisée avant l'événement.
                        </span>
                        <span className="bg-emerald-100 text-emerald-800 text-[11px] font-bold px-2.5 py-1 rounded-full shrink-0 ml-3">
                          Optionnel à la création
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
