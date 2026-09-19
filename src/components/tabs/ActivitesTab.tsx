import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { EventActivity } from '../../types';
import {
  Tent,
  Calendar,
  Clock,
  Users,
  Sparkles,
  MapPin,
  Palmtree,
  CheckCircle2,
  Eye,
  ChevronUp,
  Coins,
  FileText,
  ListOrdered,
  UserCheck,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const MONTH_NAMES = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

// Helper to calculate target Date for an activity
function getActivityTargetDate(act: EventActivity): { targetDate: Date | null; isMonthYearOnly: boolean; isIndeterminate: boolean } {
  // Case 0: Specific Anniversaire event
  if (act.fixedType === 'ANNIVERSAIRE') {
    const yearMatch = act.eventDate ? act.eventDate.match(/\b(202\d|203\d)\b/) : null;
    const year = act.eventYear && act.eventYear !== 'LATER'
      ? parseInt(act.eventYear, 10)
      : yearMatch
      ? parseInt(yearMatch[1], 10)
      : 2027;
    return {
      targetDate: new Date(year, 2, 21, 0, 0, 0),
      isMonthYearOnly: false,
      isIndeterminate: false,
    };
  }

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

  // Case 3: Attempt parsing formatted strings like "21 Mars 2027" or "Août 2027"
  if (act.eventDate) {
    for (let i = 0; i < MONTH_NAMES.length; i++) {
      const mName = MONTH_NAMES[i];
      if (act.eventDate.toLowerCase().includes(mName.toLowerCase())) {
        const yearMatch = act.eventDate.match(/\b(202\d|203\d)\b/);
        const year = yearMatch ? parseInt(yearMatch[1], 10) : 2027;
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

// 1. COMPOSANT DÉCOMPTE OFFICIEL GRAND FORMAT (HARMONISÉ POUR TOUS LES ÉVÉNEMENTS)
export const OfficialCountdownClock: React.FC<{
  targetDate: Date | null;
  isMonthYearOnly?: boolean;
  isIndeterminate?: boolean;
}> = ({ targetDate, isMonthYearOnly = false, isIndeterminate = false }) => {
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (isIndeterminate || !targetDate) {
    return (
      <div className="bg-emerald-950/85 backdrop-blur-md border-2 border-emerald-700/60 rounded-3xl p-4 sm:p-5 shadow-xl text-center w-full sm:w-auto min-w-[280px]">
        <p className="text-xs uppercase font-extrabold text-amber-300 tracking-widest mb-2.5 flex items-center justify-center gap-1.5">
          <Clock className="w-4 h-4 text-amber-400" />
          <span>Décompte Officiel</span>
        </p>
        <div className="bg-emerald-900/90 rounded-2xl py-3 px-4 border border-emerald-700 text-amber-200 text-xs font-bold shadow-inner">
          Date exacte à préciser par la Commission
        </div>
      </div>
    );
  }

  const diff = targetDate.getTime() - now.getTime();

  if (diff <= 0) {
    return (
      <div className="bg-emerald-950/85 backdrop-blur-md border-2 border-emerald-500/50 rounded-3xl p-4 sm:p-5 shadow-xl text-center w-full sm:w-auto min-w-[280px]">
        <p className="text-xs uppercase font-extrabold text-emerald-400 tracking-widest mb-2.5 flex items-center justify-center gap-1.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>Décompte Officiel</span>
        </p>
        <div className="bg-emerald-900/90 rounded-2xl py-3 px-4 border border-emerald-700 text-emerald-200 text-xs font-black shadow-inner">
          Événement en cours / Terminé
        </div>
      </div>
    );
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diff / 1000 / 60) % 60);
  const seconds = Math.floor((diff / 1000) % 60);

  return (
    <div className="bg-emerald-950/85 backdrop-blur-md border-2 border-amber-300/40 rounded-3xl p-4 sm:p-5 shadow-2xl text-center w-full sm:w-auto min-w-[280px]">
      <p className="text-xs uppercase font-extrabold text-amber-300 tracking-widest mb-3 flex items-center justify-center gap-1.5">
        <Clock className="w-4 h-4 text-amber-400" />
        <span>Décompte Officiel</span>
      </p>
      <div className="grid grid-cols-4 gap-2 sm:gap-2.5 text-amber-200">
        <div className="bg-emerald-900/90 rounded-2xl p-2.5 sm:p-3 border border-emerald-700 min-w-[55px] sm:min-w-[62px]">
          <span className="text-xl sm:text-2xl lg:text-3xl font-black block text-white tabular-nums">{days}</span>
          <span className="text-[9px] sm:text-[10px] uppercase font-bold text-amber-300">Jours</span>
        </div>
        <div className="bg-emerald-900/90 rounded-2xl p-2.5 sm:p-3 border border-emerald-700 min-w-[55px] sm:min-w-[62px]">
          <span className="text-xl sm:text-2xl lg:text-3xl font-black block text-white tabular-nums">{hours}</span>
          <span className="text-[9px] sm:text-[10px] uppercase font-bold text-amber-300">Heures</span>
        </div>
        <div className="bg-emerald-900/90 rounded-2xl p-2.5 sm:p-3 border border-emerald-700 min-w-[55px] sm:min-w-[62px]">
          <span className="text-xl sm:text-2xl lg:text-3xl font-black block text-white tabular-nums">{minutes}</span>
          <span className="text-[9px] sm:text-[10px] uppercase font-bold text-amber-300">Min</span>
        </div>
        <div className="bg-emerald-900/90 rounded-2xl p-2.5 sm:p-3 border border-emerald-700 min-w-[55px] sm:min-w-[62px]">
          <span className="text-xl sm:text-2xl lg:text-3xl font-black block text-white tabular-nums">{seconds}</span>
          <span className="text-[9px] sm:text-[10px] uppercase font-bold text-amber-300">Sec</span>
        </div>
      </div>
      {isMonthYearOnly && (
        <p className="text-[10px] text-amber-300/80 font-medium mt-2">
          * Estimé dès le 1er du mois
        </p>
      )}
    </div>
  );
};

// 2. CARTE D'ÉVÉNEMENT SIMPLIFIÉE AVEC DÉCOMPTE GRAND FORMAT ET DÉTAILS DÉROULANTS
interface EventActivityCardProps {
  activity: EventActivity;
}

export const EventActivityCard: React.FC<EventActivityCardProps> = ({ activity: act }) => {
  // Chaque carte gère de manière strictement indépendante son propre état d'affichage
  const [showDetails, setShowDetails] = useState<boolean>(false);

  const { targetDate, isMonthYearOnly, isIndeterminate } = getActivityTargetDate(act);

  // Vérification de la nomination des membres du Comité Ad-Hoc
  const hasAdHocMembers = act.adHocRoles && Object.values(act.adHocRoles).some(val => {
    if (Array.isArray(val)) return val.length > 0;
    return Boolean(val && val !== 'Non désigné');
  });

  const formatMembers = (val?: string[] | string) => {
    if (!val) return 'Non désigné';
    if (Array.isArray(val)) return val.length > 0 ? val.join(', ') : 'Non désigné';
    return val.trim() || 'Non désigné';
  };

  return (
    <div
      id={`event-card-${act.id}`}
      className="bg-white rounded-[2rem] sm:rounded-3xl p-5 sm:p-7 border-2 border-emerald-200/80 shadow-md hover:shadow-lg transition-all space-y-5"
    >
      {/* STRUCTURE SIMPLIFIÉE PAR DÉFAUT :
          - Badges & Date
          - Titre de l'événement
          - Décompte officiel grand format à droite ou en dessous
          - En bas du décompte : bouton élégant [ Voir Détails ] / [ Masquer Détails ]
      */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        {/* Partie Gauche : Métadonnées & Titre */}
        <div className="space-y-3.5 flex-1 min-w-0">
          {/* Ligne des Badges */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Type d'événement (Fixe vs Simple) */}
            {act.eventType === 'FIXE' ? (
              <span className="text-xs font-black text-amber-900 bg-amber-200/90 px-3.5 py-1.5 rounded-full inline-flex items-center gap-1.5 shadow-xs">
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
              <span className="text-xs font-black text-sky-900 bg-sky-100 border border-sky-300 px-3.5 py-1.5 rounded-full inline-flex items-center gap-1.5 shadow-xs">
                <Palmtree className="w-3.5 h-3.5 text-sky-700" />
                <span>Sorties & Loisirs (Simple)</span>
              </span>
            )}

            {/* Date de l'événement */}
            <span className="text-xs font-black text-slate-800 bg-slate-50 border border-slate-300 px-3.5 py-1.5 rounded-full inline-flex items-center gap-1.5 shadow-xs">
              <Calendar className="w-3.5 h-3.5 text-amber-600" />
              <span>Date : {act.eventDate}</span>
            </span>

            {/* Lieu si disponible */}
            {act.location && (
              <span className="text-xs font-black text-emerald-900 bg-emerald-100 border border-emerald-300 px-3.5 py-1.5 rounded-full inline-flex items-center gap-1.5 shadow-xs">
                <MapPin className="w-3.5 h-3.5 text-emerald-700" />
                <span>Lieu : {act.location}</span>
              </span>
            )}

            {/* Budget si renseigné */}
            {typeof act.budget === 'number' && act.budget > 0 && (
              <span className="text-xs font-bold text-slate-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-full inline-flex items-center gap-1">
                <Coins className="w-3.5 h-3.5 text-amber-600" />
                <span>Budget : {act.budget.toLocaleString('fr-FR')} F CFA</span>
              </span>
            )}
          </div>

          {/* Titre de l'événement */}
          <h3 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-tight">
            {act.title}
          </h3>
        </div>

        {/* Partie Droite : Décompte Grand Format + Bouton Détails */}
        <div className="flex flex-col items-center lg:items-end gap-3 shrink-0 self-stretch lg:self-auto">
          {/* Décompte officiel stylisé grand format */}
          <OfficialCountdownClock
            targetDate={targetDate}
            isMonthYearOnly={isMonthYearOnly}
            isIndeterminate={isIndeterminate}
          />

          {/* Bouton élégant sous le décompte : [ 👁️ Voir Détails ] / [ 🔼 Masquer Détails ] */}
          <button
            type="button"
            id={`btn-toggle-details-${act.id}`}
            onClick={() => setShowDetails(prev => !prev)}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl bg-[#355E3B] hover:bg-emerald-800 text-amber-200 text-xs font-black shadow-md border border-amber-300/40 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
            title={showDetails ? 'Replier les informations' : 'Afficher les détails de cet événement'}
          >
            {showDetails ? (
              <>
                <ChevronUp className="w-4 h-4 text-amber-300" />
                <span>Masquer Détails</span>
              </>
            ) : (
              <>
                <Eye className="w-4 h-4 text-amber-300" />
                <span>Voir Détails</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 3. SECTION RÉTRACTABLE "DÉTAILS" :
          Au clic sur [ Voir Détails ], déroule les 3 blocs :
          1. Description & Objectifs
          2. Programme Déroulé
          3. Attribution du Comité Ad-Hoc
      */}
      <AnimatePresence initial={false}>
        {showDetails && (
          <motion.div
            key="event-details-content"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="pt-6 mt-2 border-t-2 border-emerald-100 space-y-6">
              {/* Grille des Blocs 1 et 2 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* 1. Description & Objectifs */}
                <div className="bg-emerald-50/50 p-5 rounded-2xl border border-emerald-200/90 shadow-xs space-y-2.5">
                  <h4 className="text-xs font-black text-[#355E3B] uppercase tracking-wider flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-amber-600" />
                    <span>1. Description & Objectifs</span>
                  </h4>
                  <div className="text-sm text-slate-700 leading-relaxed bg-white p-4 rounded-xl border border-emerald-100">
                    {act.description ? (
                      <p>{act.description}</p>
                    ) : (
                      <p className="text-slate-400 italic">Aucune description détaillée enregistrée.</p>
                    )}
                  </div>
                </div>

                {/* 2. Programme Déroulé */}
                <div className="bg-emerald-50/50 p-5 rounded-2xl border border-emerald-200/90 shadow-xs space-y-2.5">
                  <h4 className="text-xs font-black text-[#355E3B] uppercase tracking-wider flex items-center gap-1.5">
                    <ListOrdered className="w-4 h-4 text-amber-600" />
                    <span>2. Programme Déroulé</span>
                  </h4>
                  <div className="text-sm text-slate-700 leading-relaxed bg-white p-4 rounded-xl border border-emerald-100 whitespace-pre-line">
                    {act.program ? (
                      <p>{act.program}</p>
                    ) : (
                      <p className="text-slate-400 italic">Aucun programme déroulé détaillé pour le moment.</p>
                    )}
                  </div>
                </div>
              </div>

              {/* 3. Attribution du Comité Ad-Hoc */}
              <div className="bg-emerald-50/50 p-5 rounded-2xl border border-emerald-200/90 shadow-xs space-y-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-xs font-black text-[#355E3B] uppercase tracking-wider flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-amber-600" />
                    <span>3. Attribution du Comité Ad-Hoc</span>
                  </h4>
                  {!hasAdHocMembers && (
                    <span className="text-[11px] font-bold text-slate-500 bg-white border border-slate-200 px-3 py-0.5 rounded-full shadow-2xs">
                      Nomination ultérieure
                    </span>
                  )}
                </div>

                {hasAdHocMembers && act.adHocRoles ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
                    <div className="bg-white p-3.5 rounded-2xl border border-emerald-200 shadow-xs">
                      <span className="text-[10px] uppercase font-bold text-amber-700 block">PCO</span>
                      <span className="font-extrabold text-slate-900 text-xs break-words">{formatMembers(act.adHocRoles.pco)}</span>
                    </div>
                    <div className="bg-white p-3.5 rounded-2xl border border-emerald-200 shadow-xs">
                      <span className="text-[10px] uppercase font-bold text-amber-700 block">PCO Adjoint</span>
                      <span className="font-extrabold text-slate-900 text-xs break-words">{formatMembers(act.adHocRoles.pcoAdjoint)}</span>
                    </div>
                    <div className="bg-white p-3.5 rounded-2xl border border-emerald-200 shadow-xs">
                      <span className="text-[10px] uppercase font-bold text-emerald-700 block">Restauration</span>
                      <span className="font-extrabold text-slate-900 text-xs break-words">{formatMembers(act.adHocRoles.restauration)}</span>
                    </div>
                    <div className="bg-white p-3.5 rounded-2xl border border-emerald-200 shadow-xs">
                      <span className="text-[10px] uppercase font-bold text-emerald-700 block">Cambuse</span>
                      <span className="font-extrabold text-slate-900 text-xs break-words">{formatMembers(act.adHocRoles.cambuse)}</span>
                    </div>
                    <div className="bg-white p-3.5 rounded-2xl border border-emerald-200 shadow-xs">
                      <span className="text-[10px] uppercase font-bold text-sky-700 block">Logistique</span>
                      <span className="font-extrabold text-slate-900 text-xs break-words">{formatMembers(act.adHocRoles.logistique)}</span>
                    </div>
                    <div className="bg-white p-3.5 rounded-2xl border border-emerald-200 shadow-xs">
                      <span className="text-[10px] uppercase font-bold text-sky-700 block">Transport</span>
                      <span className="font-extrabold text-slate-900 text-xs break-words">{formatMembers(act.adHocRoles.transport)}</span>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white p-4 rounded-2xl border border-emerald-200/80 text-xs text-slate-600 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <span className="italic leading-relaxed">
                      Comité Ad-hoc en cours de constitution par la Commission Organisation. L'affectation des postes sera précisée avant l'événement.
                    </span>
                    <span className="bg-emerald-100 text-emerald-800 text-[11px] font-bold px-3 py-1 rounded-full shrink-0 self-start sm:self-auto">
                      Optionnel à la création
                    </span>
                  </div>
                )}
              </div>

              {/* Bouton secondaire en bas pour replier facilement */}
              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={() => setShowDetails(false)}
                  className="inline-flex items-center gap-1.5 text-xs text-emerald-800 hover:text-emerald-950 font-bold px-3.5 py-1.5 rounded-xl hover:bg-emerald-100 transition-all cursor-pointer"
                >
                  <ChevronUp className="w-4 h-4 text-emerald-700" />
                  <span>Masquer Détails</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
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

  useEffect(() => {
    const updateYear = () => {
      setTargetYear(computeTargetYear(new Date()));
    };
    updateYear();
    const interval = setInterval(updateYear, 60000);
    return () => clearInterval(interval);
  }, []);

  const publishedActivities = activities.filter(a => a.status === 'PUBLISHED');

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* 1. MARCH 21ST FESTIVAL COUNTDOWN HERO BANNER (DÉCOMPTE OFFICIEL MODÈLE) */}
      <div className="bg-[#355E3B] rounded-[2.5rem] sm:rounded-[3rem] p-6 sm:p-10 text-white shadow-xl relative overflow-hidden border border-white/10">
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-[#E67E22]/20 rounded-full blur-2xl pointer-events-none" />

        <div className="flex flex-col md:flex-row items-center justify-between gap-8 relative z-10">
          <div className="space-y-3 text-center md:text-left">
            <div className="inline-flex items-center gap-2 bg-amber-400/20 text-amber-300 px-4 py-1.5 rounded-full text-xs font-black border border-amber-300/30">
              <Sparkles className="w-4 h-4" />
              <span>JOUR DE FÊTE</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-amber-200 tracking-tight">
              ANNIVERSAIRE ROUAMA (21 MARS {targetYear})
            </h2>
            <p className="text-xs sm:text-sm text-emerald-100 max-w-lg leading-relaxed">
              Célébration annuelle ROUAMA. Rassemblement, retrouvailles, partage et réjouissances fraternelles.
            </p>
          </div>

          {/* Décompte officiel grand format standardisé */}
          <OfficialCountdownClock
            targetDate={new Date(targetYear, 2, 21, 0, 0, 0)}
            isMonthYearOnly={false}
            isIndeterminate={false}
          />
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
          <div className="space-y-6">
            {publishedActivities.map(act => (
              <EventActivityCard key={act.id} activity={act} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
