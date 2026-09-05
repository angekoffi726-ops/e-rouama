import React, { useRef, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { TabType } from '../Navigation';
import {
  Camera,
  Upload,
  CreditCard,
  Newspaper,
  Calendar,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  TrendingUp,
  Award,
  Bell
} from 'lucide-react';

interface DashboardTabProps {
  onNavigateTab: (tab: TabType) => void;
}

export const DashboardTab: React.FC<DashboardTabProps> = ({ onNavigateTab }) => {
  const { currentUser, updateMemberAvatar, getMemberDuesDetail, newsItems, activities, verseOfTheDay } = useApp();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  if (!currentUser) return null;

  const isMember = currentUser.type === 'MEMBER' && currentUser.member;
  const currentMember = currentUser.member;
  const memberId = currentMember?.id || '';

  const nickname = isMember
    ? currentMember.nickname
    : currentUser.adminRole || 'ADMIN';

  // Fallback default avatar for Capelo/Wilfried if no explicit custom upload is set
  const userAvatar = isMember
    ? (currentMember?.avatar ||
       (currentMember?.nickname.toUpperCase() === 'CAPELO' || currentMember?.firstName.toUpperCase() === 'WILFRIED'
         ? '/PP-CAPELO.jpeg'
         : undefined))
    : undefined;

  // Dues status detail for members
  const duesDetail = isMember ? getMemberDuesDetail(memberId) : null;

  // Latest news
  const latestNews = newsItems && newsItems.length > 0 ? newsItems[0] : null;

  // Next activity
  const nextActivity = activities && activities.length > 0
    ? activities.find(a => a.status === 'PUBLISHED') || activities[0]
    : null;

  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Veuillez sélectionner un fichier image valide.');
      return;
    }

    // Limit size to 5MB before base64
    if (file.size > 5 * 1024 * 1024) {
      alert('Veuillez choisir une image de moins de 5 Mo.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result && memberId) {
        updateMemberAvatar(memberId, result);
        setUploadSuccess(true);
        setTimeout(() => setUploadSuccess(false), 3000);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-6 sm:space-y-8 animate-fadeIn">
      {/* Hidden file input for avatar upload */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleAvatarFileChange}
        accept="image/*"
        className="hidden"
      />

      {/* 1. HERO WELCOME CARD & DYNAMIC PROFILE PICTURE */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[#E67E22] via-[#D35400] to-[#B84A00] rounded-3xl p-6 sm:p-8 sm:py-10 text-white shadow-xl border border-amber-500/30">
        {/* Subtle decorative background shapes with green & gold glow */}
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-1/3 -mb-10 w-48 h-48 bg-amber-300/20 rounded-full blur-2xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col md:flex-row items-center md:items-start gap-6 sm:gap-8">
          {/* Avatar Container */}
          <div className="relative group shrink-0">
            <div className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-full overflow-hidden border-4 border-white/80 shadow-2xl bg-amber-950/40 flex items-center justify-center">
              {userAvatar ? (
                <img
                  src={userAvatar}
                  alt={nickname}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
              ) : (
                <div className="w-full h-full bg-[#355E3B] flex items-center justify-center text-white text-4xl font-black">
                  {nickname.charAt(0).toUpperCase()}
                </div>
              )}

              {/* Upload Overlay Button */}
              {isMember && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-xs font-bold gap-1 cursor-pointer"
                  title="Changer ma photo de profil"
                >
                  <Camera className="w-6 h-6 text-amber-200" />
                  <span>Modifier</span>
                </button>
              )}
            </div>

            {/* Dedicated Action Button below/on avatar */}
            {isMember && (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="mt-3 w-full px-3 py-1.5 bg-[#355E3B] hover:bg-[#2A4B2F] text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all border border-emerald-400/30"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>{userAvatar ? 'Changer ma PP' : 'Ajouter une PP'}</span>
              </button>
            )}

            {uploadSuccess && (
              <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap bg-emerald-600 text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-lg border border-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-amber-300" />
                <span>Photo mise à jour !</span>
              </div>
            )}
          </div>

          {/* Welcome Text Content */}
          <div className="flex-1 text-center md:text-left space-y-2.5">
            <div className="inline-flex items-center gap-2 bg-[#933300] px-3.5 py-1 rounded-full text-xs font-black text-amber-100 shadow-sm border border-amber-300/30">
              <Sparkles className="w-3.5 h-3.5 text-amber-200" />
              <span>Tableau de bord fraternel</span>
            </div>

            <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-white leading-tight">
              YOOOO DINIYO, <span className="text-amber-200 underline decoration-white/60 underline-offset-4">{nickname}</span> !
            </h1>

            <p className="text-xs sm:text-sm text-amber-50 max-w-xl font-medium leading-relaxed">
              ANITCHE HEIN ! Content de te voir sur notre plateforme E-ROUAMA.
            </p>

            {/* Quick Badges */}
            <div className="pt-2 flex flex-wrap items-center justify-center md:justify-start gap-2 text-[11px] font-bold">
              <span className="bg-[#933300]/80 text-amber-100 px-3 py-1 rounded-xl border border-amber-300/30">
                Membre Rouama Officiel
              </span>
              {duesDetail && (
                <span className={`px-3 py-1 rounded-xl border font-black ${
                  duesDetail.status === 'A_JOUR'
                    ? 'bg-emerald-950/80 text-emerald-200 border-emerald-400/50'
                    : duesDetail.status === 'EN_AVANCE'
                    ? 'bg-[#933300]/90 text-amber-200 border-amber-300/40'
                    : 'bg-rose-950/80 text-rose-200 border-rose-400/50'
                }`}>
                  {duesDetail.status === 'A_JOUR' && '🟢 Cotisation : À jour'}
                  {duesDetail.status === 'EN_AVANCE' && '🚀 Cotisation : En avance'}
                  {duesDetail.status === 'RETARD' && `⚠️ Cotisation : ${duesDetail.unpaidMonths} mois en retard`}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 1.5. VERSET / PENSÉE DU JOUR (SPIRITUALITÉ BANNER) */}
      {verseOfTheDay && (
        <div className="bg-slate-900 border border-amber-500/40 rounded-3xl p-5 sm:p-6 text-white shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-2xl shrink-0 mt-0.5">
              ✨
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-black text-amber-400 uppercase tracking-wider">
                  Verset / Pensée du Jour • Spiritualité Rouama
                </span>
                {verseOfTheDay.reference && (
                  <span className="bg-amber-500/20 text-amber-300 text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-amber-500/30">
                    {verseOfTheDay.reference}
                  </span>
                )}
              </div>
              <p className="text-sm sm:text-base font-semibold text-slate-100 italic leading-relaxed">
                {verseOfTheDay.verse}
              </p>
            </div>
          </div>
          <span className="text-[10px] text-slate-400 font-medium shrink-0 self-end sm:self-auto bg-slate-950 px-2.5 py-1 rounded-xl border border-slate-800">
            {verseOfTheDay.date}
          </span>
        </div>
      )}

      {/* 2. THREE KEY CARDS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

        {/* CARTE 1: MON STATUT FINANCIER EXPRESS */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-emerald-900/10 flex flex-col justify-between space-y-4 hover:shadow-md transition-shadow">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="p-2.5 bg-emerald-100 text-[#355E3B] rounded-2xl">
                  <CreditCard className="w-5 h-5" />
                </div>
                <h2 className="font-extrabold text-slate-900 text-sm sm:text-base">
                  Mon Statut Financier Express
                </h2>
              </div>
            </div>

            <p className="text-xs text-slate-500 font-medium">
              Aperçu en direct de vos cotisations et engagements mensuels.
            </p>

            {/* Status Display Box */}
            {isMember && duesDetail ? (
              <div className={`p-4 rounded-2xl border ${
                duesDetail.status === 'A_JOUR'
                  ? 'bg-emerald-50/80 border-emerald-200'
                  : duesDetail.status === 'EN_AVANCE'
                  ? 'bg-orange-50/80 border-orange-200'
                  : 'bg-rose-50/80 border-rose-200'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-600">Statut Cotisation :</span>
                  {duesDetail.status === 'A_JOUR' && (
                    <span className="inline-flex items-center gap-1 text-xs font-black text-emerald-700 bg-emerald-200/60 px-2.5 py-1 rounded-full">
                      <CheckCircle2 className="w-3.5 h-3.5" /> À JOUR
                    </span>
                  )}
                  {duesDetail.status === 'EN_AVANCE' && (
                    <span className="inline-flex items-center gap-1 text-xs font-black text-[#D35400] bg-orange-200/60 px-2.5 py-1 rounded-full">
                      <TrendingUp className="w-3.5 h-3.5" /> EN AVANCE
                    </span>
                  )}
                  {duesDetail.status === 'RETARD' && (
                    <span className="inline-flex items-center gap-1 text-xs font-black text-rose-700 bg-rose-200/60 px-2.5 py-1 rounded-full">
                      <AlertTriangle className="w-3.5 h-3.5" /> RETARD ({duesDetail.unpaidMonths} mois)
                    </span>
                  )}
                </div>

                <div className="mt-3 pt-3 border-t border-slate-200/60 flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-medium">Cumul versé (2026) :</span>
                  <span className="font-extrabold text-slate-900">{duesDetail.totalPaid.toLocaleString('fr-FR')} F CFA</span>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs font-bold text-slate-600">
                Compte Administrateur
              </div>
            )}
          </div>

          <button
            onClick={() => onNavigateTab('FINANCES')}
            className="w-full py-3.5 px-4 bg-[#355E3B] hover:bg-[#2A4B2F] text-white rounded-2xl font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/10 active:scale-95 transition-all mt-auto"
          >
            <span>Aller aux Cotisations</span>
            <ArrowRight className="w-4 h-4 text-amber-300" />
          </button>
        </div>

        {/* CARTE 2: FLASH INFO FRATERNITÉ */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-emerald-900/10 flex flex-col justify-between space-y-4 hover:shadow-md transition-shadow">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="p-2.5 bg-emerald-100 text-[#355E3B] rounded-2xl">
                  <Newspaper className="w-5 h-5" />
                </div>
                <h2 className="font-extrabold text-slate-900 text-sm sm:text-base">
                  Flash Info Fraternité
                </h2>
              </div>
            </div>

            <p className="text-xs text-slate-500 font-medium">
              Le dernier communiqué officiel ou message du groupe.
            </p>

            {/* News Item Box */}
            {latestNews ? (
              <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-200/60 space-y-2">
                <div className="flex items-center justify-between text-[10px] font-bold">
                  <span className="bg-[#355E3B] text-white px-2 py-0.5 rounded-md uppercase font-black">
                    {latestNews.category}
                  </span>
                  <span className="text-slate-400">{latestNews.date}</span>
                </div>
                <h3 className="font-bold text-slate-900 text-xs line-clamp-1">
                  {latestNews.title}
                </h3>
                <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                  {latestNews.content}
                </p>
              </div>
            ) : (
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-600 space-y-1">
                <p className="font-bold text-slate-800">Bienvenue sur l'Espace Fraternel !</p>
                <p className="text-[11px] text-slate-500">Aucun message urgent publié pour le moment.</p>
              </div>
            )}
          </div>

          <button
            onClick={() => onNavigateTab('NOUVELLES')}
            className="w-full py-3 px-4 bg-emerald-50 hover:bg-emerald-100 text-[#355E3B] border border-emerald-200 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 active:scale-95 transition-all mt-auto"
          >
            <span>Consulter les Nouvelles</span>
            <ArrowRight className="w-4 h-4 text-[#355E3B]" />
          </button>
        </div>

        {/* CARTE 3: PROCHAIN ÉVÉNEMENT */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-emerald-900/10 flex flex-col justify-between space-y-4 hover:shadow-md transition-shadow">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="p-2.5 bg-emerald-100 text-[#355E3B] rounded-2xl">
                  <Calendar className="w-5 h-5" />
                </div>
                <h2 className="font-extrabold text-slate-900 text-sm sm:text-base">
                  Prochain Événement
                </h2>
              </div>
            </div>

            <p className="text-xs text-slate-500 font-medium">
              Grand rendez-vous & activités à venir dans la fraternité.
            </p>

            {/* Next Activity Box */}
            {nextActivity ? (
              <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-200/60 space-y-2">
                <div className="flex items-center justify-between text-[10px] font-bold text-emerald-900">
                  <span className="bg-[#355E3B] text-white px-2 py-0.5 rounded-md font-black">
                    {nextActivity.eventDate}
                  </span>
                  <span className="text-slate-500">Budget : {nextActivity.budget.toLocaleString('fr-FR')} F CFA</span>
                </div>
                <h3 className="font-bold text-slate-900 text-xs">
                  {nextActivity.title}
                </h3>
                <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                  {nextActivity.description}
                </p>
              </div>
            ) : (
              <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-200/60 space-y-1.5">
                <div className="flex items-center gap-1.5 text-emerald-950 font-bold text-xs">
                  <Award className="w-4 h-4 text-[#E67E22] shrink-0" />
                  <span>Anniversaire Officiel Rouama</span>
                </div>
                <p className="text-xs font-extrabold text-[#D35400]">🗓️ Samedi 21 Mars 2026</p>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Célébration collective de la Fraternité Diniyo Rouama. Cotisation spéciale fixée à 10 000 F CFA.
                </p>
              </div>
            )}
          </div>

          <button
            onClick={() => onNavigateTab('ACTIVITES')}
            className="w-full py-3 px-4 bg-emerald-50 hover:bg-emerald-100 text-[#355E3B] border border-emerald-200 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 active:scale-95 transition-all mt-auto"
          >
            <span>Voir le Programme des Activités</span>
            <ArrowRight className="w-4 h-4 text-[#355E3B]" />
          </button>
        </div>

      </div>
    </div>
  );
};
