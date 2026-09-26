import React, { useRef, useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { TabType } from '../Navigation';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { compressProfileImage } from '../../utils/imageCompressor';
import { EditMemberModal } from '../common/EditMemberModal';
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
  Bell,
  Loader2,
  KeyRound,
  X,
  Lock,
  Edit3
} from 'lucide-react';

interface DashboardTabProps {
  onNavigateTab: (tab: TabType) => void;
}

export const DashboardTab: React.FC<DashboardTabProps> = ({ onNavigateTab }) => {
  const { currentUser, updateMemberProfile, updateMemberAvatar, getMemberDuesDetail, newsItems, activities, verseOfTheDay } = useApp();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // État pour la modification du code PIN par le membre
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [isEditProfileModalOpen, setIsEditProfileModalOpen] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [isSavingPin, setIsSavingPin] = useState(false);
  const [pinSuccess, setPinSuccess] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);

  if (!currentUser) return null;

  const currentMember = currentUser.member || (currentUser.id ? (currentUser as unknown as any) : undefined);
  const isMember = currentUser.type === 'MEMBER' || !!currentMember;
  const memberId = currentMember?.id || currentUser.id || '';

  const nickname = currentMember?.nickname || currentUser?.nickname || (currentUser.adminRole ? currentUser.adminRole : 'MEMBRE');

  // Fallback default avatar for Capelo/Wilfried if no explicit custom upload is set
  const userAvatar = currentMember?.photoUrl || currentMember?.avatar ||
    (currentMember && (nickname.toUpperCase() === 'CAPELO' || ((currentMember?.firstName || '') as string).toUpperCase() === 'WILFRIED')
      ? '/PP-CAPELO.jpeg'
      : undefined);

  // 2. CHARGEMENT AUTOMATIQUE AU RECHARGEMENT (useEffect) :
  // Récupère le document du membre dans Firestore via son ID à chaque chargement
  useEffect(() => {
    let isMounted = true;
    if (isMember && memberId) {
      const fetchMemberPhoto = async () => {
        try {
          const docSnap = await getDoc(doc(db, 'members', memberId));
          if (docSnap.exists() && isMounted) {
            const data = docSnap.data();
            const photo = data.photoUrl || data.avatar;
            if (photo && (currentMember?.photoUrl !== photo || currentMember?.avatar !== photo)) {
              updateMemberAvatar(memberId, photo);
            }
          }
        } catch (err) {
          console.warn('Erreur chargement automatique photo profil depuis Firestore:', err);
        }
      };
      fetchMemberPhoto();
    }
    return () => {
      isMounted = false;
    };
  }, [isMember, memberId]);

  // Dues status detail for members
  const duesDetail = isMember ? getMemberDuesDetail(memberId) : null;

  // Latest news
  const latestNews = newsItems && newsItems.length > 0 ? newsItems[0] : null;

  // Next activity
  const nextActivity = activities && activities.length > 0
    ? activities.find(a => a.status === 'PUBLISHED') || activities[0]
    : null;

  // 1. SAUVEGARDE DE LA PHOTO DANS FIRESTORE
  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Veuillez sélectionner un fichier image valide.');
      return;
    }

    setIsUploading(true);
    setUploadSuccess(false);

    try {
      // Compression optimisée (400x400 max, 0.82 quality => ~30-50 KB pour Firestore)
      const compressedBase64 = await compressProfileImage(file, 400, 0.82);
      if (!compressedBase64) {
        throw new Error("Échec de la lecture de l'image.");
      }

      // Exécute immédiatement la mise à jour Firestore dans le document du membre
      try {
        await setDoc(doc(db, 'members', memberId), {
          photoUrl: compressedBase64,
          avatar: compressedBase64,
          updatedAt: new Date().toISOString(),
        }, { merge: true });
      } catch (firestoreErr) {
        console.warn('setDoc tentative avatar:', firestoreErr);
      }

      // Mets également à jour le state local de l'utilisateur connecté via AppContext
      await updateMemberAvatar(memberId, compressedBase64);

      // 3. FEEDBACK UTILISATEUR : Affiche un message de succès
      setUploadSuccess(true);
      setTimeout(() => setUploadSuccess(false), 4000);
    } catch (err) {
      console.error('Erreur mise à jour photo membre:', err);
      alert("Une erreur est survenue lors de l'enregistrement de la photo.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleUpdateMemberPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberId) return;

    const trimmed = newPin.trim();
    if (trimmed.length !== 4 || !/^\d{4}$/.test(trimmed)) {
      setPinError('Le code PIN doit comporter exactement 4 chiffres.');
      return;
    }

    setIsSavingPin(true);
    setPinError(null);

    try {
      await updateMemberProfile(memberId, {
        pin: trimmed,
        isRegistered: true,
      });

      setPinSuccess(true);
      setTimeout(() => {
        setIsPinModalOpen(false);
        setPinSuccess(false);
        setNewPin('');
      }, 1800);
    } catch (err) {
      console.error('Erreur mise à jour code PIN membre:', err);
      setPinError("Une erreur est survenue lors de la sauvegarde du PIN.");
    } finally {
      setIsSavingPin(false);
    }
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

              {/* Upload Indicator Spinner */}
              {isUploading && (
                <div className="absolute inset-0 bg-black/75 flex flex-col items-center justify-center text-white text-[10px] font-bold gap-1 z-20">
                  <Loader2 className="w-6 h-6 text-amber-300 animate-spin" />
                  <span>Enregistrement...</span>
                </div>
              )}

              {/* Upload Overlay Button */}
              {isMember && !isUploading && (
                <button
                  onClick={() => setIsEditProfileModalOpen(true)}
                  className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-xs font-bold gap-1 cursor-pointer"
                  title="Modifier mon profil et ma photo"
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
                disabled={isUploading}
                className="mt-3 w-full px-3 py-1.5 bg-[#355E3B] hover:bg-[#2A4B2F] text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all border border-emerald-400/30 disabled:opacity-60"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-300" />
                    <span>Envoi...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-3.5 h-3.5" />
                    <span>{userAvatar ? 'Changer ma PP' : 'Ajouter une PP'}</span>
                  </>
                )}
              </button>
            )}

            {/* FEEDBACK DE SUCCÈS CONFORME AU CAHIER DES CHARGES */}
            {uploadSuccess && (
              <div className="absolute -bottom-9 left-1/2 -translate-x-1/2 whitespace-nowrap bg-emerald-600 text-white text-[11px] font-extrabold px-3 py-1.5 rounded-full shadow-2xl border border-emerald-300 flex items-center gap-1.5 z-30 animate-in fade-in zoom-in">
                <CheckCircle2 className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                <span>Photo de profil enregistrée !</span>
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

              {isMember && (
                <>
                  <button
                    onClick={() => setIsEditProfileModalOpen(true)}
                    className="bg-emerald-950/70 hover:bg-emerald-900 text-emerald-200 border border-emerald-400/40 px-3 py-1 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-95"
                    title="Modifier mes informations et ma photo de profil"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-emerald-300" />
                    <span>Modifier mon Profil</span>
                  </button>

                  <button
                    onClick={() => {
                      setIsPinModalOpen(true);
                      setNewPin('');
                      setPinError(null);
                      setPinSuccess(false);
                    }}
                    className="bg-amber-950/70 hover:bg-amber-900 text-amber-200 border border-amber-400/40 px-3 py-1 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-95"
                    title="Modifier mon code PIN de connexion"
                  >
                    <KeyRound className="w-3.5 h-3.5 text-amber-300" />
                    <span>Changer mon PIN</span>
                  </button>
                </>
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
                  <span className="font-extrabold text-slate-900">{(duesDetail.totalPaid ?? 0).toLocaleString('fr-FR')} F CFA</span>
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
                  <span className="text-slate-500">
                    Budget : {typeof nextActivity.budget === 'number' && !isNaN(nextActivity.budget)
                      ? `${nextActivity.budget.toLocaleString('fr-FR')} F CFA`
                      : 'Prévu'}
                  </span>
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

      {/* MODAL DE MODIFICATION DU PIN PAR LE MEMBRE */}
      {isPinModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-amber-500/30 rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-black text-white">
                  Modifier mon code PIN
                </h3>
              </div>
              <button
                onClick={() => setIsPinModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Définis un code secret personnel à 4 chiffres pour sécuriser l'accès à ton espace <strong className="text-amber-300">E-ROUAMA</strong>.
            </p>

            <form onSubmit={handleUpdateMemberPin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5 text-center">
                  Nouveau Code PIN (4 chiffres)
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="••••"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-center text-2xl font-mono font-black text-amber-300 tracking-[0.5em] focus:outline-none focus:border-amber-400"
                  autoFocus
                />
              </div>

              {pinError && (
                <div className="p-2.5 bg-rose-950/60 border border-rose-800 text-rose-300 rounded-xl text-xs font-medium text-center">
                  {pinError}
                </div>
              )}

              {pinSuccess && (
                <div className="p-2.5 bg-emerald-950/60 border border-emerald-800 text-emerald-300 rounded-xl text-xs font-medium flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Code PIN mis à jour avec succès !</span>
                </div>
              )}

              <div className="flex gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => setIsPinModalOpen(false)}
                  disabled={isSavingPin}
                  className="flex-1 py-2.5 rounded-xl border border-slate-700 bg-slate-800 text-slate-300 text-xs font-bold hover:bg-slate-700 transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSavingPin || newPin.length !== 4}
                  className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 shadow-md"
                >
                  {isSavingPin ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Enregistrement...</span>
                    </>
                  ) : (
                    <span>Enregistrer</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* MODAL MODIFIER LE MEMBRE / MON PROFIL AVEC FEEDBACK VISUEL DE LA PHOTO */}
      <EditMemberModal
        isOpen={isEditProfileModalOpen}
        onClose={() => setIsEditProfileModalOpen(false)}
        member={currentMember || null}
        isAdminMode={false}
      />
    </div>
  );
};
