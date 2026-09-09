import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { Tent, Calendar, Clock, Users, Sparkles, CheckCircle2 } from 'lucide-react';

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
            Organisation des commissions (Cambuse, Restauration, Logistique, Transport) validées par le PAYOR et diffusées par la COM.
          </p>
        </div>

        {publishedActivities.length === 0 ? (
          <div className="text-center py-12 bg-emerald-50/30 rounded-3xl border border-dashed border-emerald-200 text-slate-500 text-sm">
            Aucune activité ou programme publié pour l'instant. (Attente de rédaction par l'ORGANISATION).
          </div>
        ) : (
          <div className="space-y-8">
            {publishedActivities.map(act => (
              <div
                key={act.id}
                className="bg-emerald-50/40 rounded-3xl p-6 border-2 border-emerald-200/80 shadow-sm space-y-6"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-emerald-200/60">
                  <div>
                    <span className="text-xs font-black text-amber-800 bg-amber-200/80 px-3 py-1 rounded-full inline-block mb-1">
                      Date : {act.eventDate}
                    </span>
                    <h3 className="text-2xl font-black text-slate-900">{act.title}</h3>
                  </div>

                  {act.budget > 0 && (
                    <div className="bg-white px-4 py-2 rounded-2xl border border-emerald-300 shadow-sm">
                      <span className="text-[10px] uppercase font-bold text-slate-500 block">Budget Prévisionnel</span>
                      <span className="text-lg font-black text-forest-moss">
                        {act.budget.toLocaleString('fr-FR')} F CFA
                      </span>
                    </div>
                  )}
                </div>

                {/* Description & Program */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="text-xs font-bold text-forest-moss uppercase tracking-wider mb-2">
                      Description & Objectifs
                    </h4>
                    <p className="text-sm text-slate-700 leading-relaxed bg-white p-4 rounded-2xl border border-slate-200">
                      {act.description}
                    </p>
                  </div>

                  <div>
                    <h4 className="text-xs font-bold text-forest-moss uppercase tracking-wider mb-2">
                      Programme Déroulé
                    </h4>
                    <p className="text-sm text-slate-700 leading-relaxed bg-white p-4 rounded-2xl border border-slate-200 whitespace-pre-line">
                      {act.program}
                    </p>
                  </div>
                </div>

                {/* Committees */}
                <div>
                  <h4 className="text-xs font-bold text-forest-moss uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-amber-600" />
                    <span>Répartition des Comités Ad-Hoc</span>
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {act.committees.map((com, idx) => (
                      <div key={idx} className="bg-white p-4 rounded-2xl border border-emerald-200 shadow-sm">
                        <span className="text-xs font-black text-forest-moss uppercase block mb-1">
                          {com.name}
                        </span>
                        <p className="text-xs text-amber-900 font-bold mb-2">
                          Chef de Comité: {com.leaderNickname}
                        </p>
                        <div className="text-xs text-slate-600 space-y-1">
                          <span className="font-semibold text-[11px] text-slate-500 block">Membres affectés :</span>
                          <p className="font-medium">{com.memberNicknames.join(', ') || 'Tous les membres'}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
