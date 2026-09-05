import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { FundType, FUND_LABELS } from '../../types';
import {
  CreditCard,
  CheckCircle2,
  XCircle,
  Clock,
  Upload,
  FileText,
  Paperclip,
  X,
  ExternalLink,
  Smartphone,
  Coins,
  TrendingUp,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  Sparkles,
  Calendar,
  HeartHandshake,
  Cake,
  Palmtree,
  Sprout,
  Info,
} from 'lucide-react';

export const FinancesTab: React.FC = () => {
  const {
    currentUser,
    members,
    declarations,
    activities,
    projects,
    financialEvents,
    getActiveFinancialEvent,
    getActiveAgrProject,
    declarePayment,
    getMemberDuesDetail,
    getMemberDuesStatus,
    getMemberRubricProgress,
  } = useApp();

  // Identify logged in member
  const isMember = currentUser?.type === 'MEMBER' && currentUser.member;

  // Connected member profile
  const connectedMember = isMember
    ? currentUser.member!
    : members[0];

  const currentMemberId = connectedMember ? connectedMember.id : 'm1';

  // Sub-navigation within Finances
  const [activeSubTab, setActiveSubTab] = useState<'MENSUELLES' | 'TRANCHES' | 'HISTORIQUE'>('MENSUELLES');

  // Dues status detail for connected member (Statutory monthly dues - 500 F/month)
  const duesDetail = getMemberDuesDetail(currentMemberId);
  const duesStatus = getMemberDuesStatus(currentMemberId);

  // Published activities & projects for category auto-fill
  const publishedActivities = activities.filter(a => a.status === 'PUBLISHED');
  const publishedProjects = projects.filter(p => p.status === 'PUBLISHED');

  // Wave Payment URL
  const WAVE_PAYMENT_URL = 'https://pay.wave.com/m/M_ci_GgJcnMC4q7hK/c/ci/';

  // --------------------------------------------------------------------------
  // STATE: 1. COTISATIONS MENSUELLES (500 FCFA / MOIS FIXE)
  // --------------------------------------------------------------------------
  const [monthlyMonthsCount, setMonthlyMonthsCount] = useState<number>(
    duesDetail.unpaidMonths > 0 ? duesDetail.unpaidMonths : 1
  );
  const [monthlyTxnRef, setMonthlyTxnRef] = useState<string>('');
  const [monthlyReceiptFile, setMonthlyReceiptFile] = useState<File | null>(null);
  const [monthlyReceiptPreview, setMonthlyReceiptPreview] = useState<string | null>(null);
  const [monthlyMsg, setMonthlyMsg] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  const monthlyAmount = monthlyMonthsCount * 500;
  const isMonthlyWaveActive = monthlyAmount >= 500;
  const isMonthlySubmitActive = monthlyReceiptFile !== null && monthlyAmount >= 500;

  const handleMonthlyFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setMonthlyReceiptFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setMonthlyReceiptPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleMonthlySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setMonthlyMsg(null);

    if (monthlyAmount < 500 || monthlyAmount % 500 !== 0) {
      setMonthlyMsg({
        type: 'error',
        text: 'La cotisation mensuelle est fixée à 500 F CFA par mois. Le montant doit être de 500 F CFA ou un multiple.',
      });
      return;
    }

    if (!monthlyReceiptFile && !monthlyTxnRef.trim()) {
      setMonthlyMsg({
        type: 'error',
        text: 'Veuillez joindre la capture du reçu de paiement Wave ou indiquer le numéro de transaction.',
      });
      return;
    }

    const refText = monthlyTxnRef.trim()
      ? monthlyTxnRef.trim()
      : `REÇU-${monthlyReceiptFile?.name || 'WAVE'}`;

    const res = declarePayment(
      'COTISATION',
      monthlyAmount,
      refText,
      undefined,
      'TOTAL'
    );

    if (res.success) {
      setMonthlyMsg({
        type: 'success',
        text: `Votre cotisation mensuelle de ${monthlyAmount.toLocaleString('fr-FR')} F CFA (${monthlyMonthsCount} mois) a été transmise avec succès au Trésorier pour validation !`,
      });
      setMonthlyTxnRef('');
      setMonthlyReceiptFile(null);
      setMonthlyReceiptPreview(null);
    } else {
      setMonthlyMsg({
        type: 'error',
        text: res.message || 'Erreur lors de la déclaration.',
      });
    }
  };

  // --------------------------------------------------------------------------
  // STATE: 2. AUTRES RUBRIQUES (ANNIVERSAIRES, SORTIES, CAS SOCIAUX - TRANCHES ≥ 1 000 FCFA)
  // --------------------------------------------------------------------------
  const [selectedTrancheFund, setSelectedTrancheFund] = useState<FundType>('ANNIVERSAIRE');
  const [socialPrecision, setSocialPrecision] = useState<string>('Mariage');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [paymentMode, setPaymentMode] = useState<'TOTAL' | 'TRANCHE'>('TRANCHE');
  const [trancheAmountInput, setTrancheAmountInput] = useState<string>('2000');
  const [trancheTxnRef, setTrancheTxnRef] = useState<string>('');
  const [trancheReceiptFile, setTrancheReceiptFile] = useState<File | null>(null);
  const [trancheReceiptPreview, setTrancheReceiptPreview] = useState<string | null>(null);
  const [trancheMsg, setTrancheMsg] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  // Rubric progresses for connected member
  const annivProgress = getMemberRubricProgress(currentMemberId, 'ANNIVERSAIRE');
  const loisirsProgress = getMemberRubricProgress(currentMemberId, 'LOISIRS');
  const socialProgress = getMemberRubricProgress(currentMemberId, 'CAS_SOCIAUX', socialPrecision);
  const agrProgress = getMemberRubricProgress(currentMemberId, 'AGR');

  // Currently active rubric progress in tranche form
  const activeTrancheProgress = getMemberRubricProgress(
    currentMemberId,
    selectedTrancheFund,
    selectedTrancheFund === 'CAS_SOCIAUX' ? socialPrecision : undefined
  );

  // Tranche Rule: Minimum 1 000 FCFA per installment (or remaining due if < 1000 and > 0)
  const minTrancheAllowed =
    activeTrancheProgress.remainingDue > 0 && activeTrancheProgress.remainingDue < 1000
      ? activeTrancheProgress.remainingDue
      : 1000;

  const numericTrancheAmount = Number(trancheAmountInput) || 0;
  const isTrancheAmountValid = numericTrancheAmount >= minTrancheAllowed;
  const isTrancheWaveActive = trancheAmountInput.trim() !== '' && isTrancheAmountValid;
  const isTrancheSubmitActive =
    trancheReceiptFile !== null && trancheAmountInput.trim() !== '' && isTrancheAmountValid;

  const handleTrancheFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setTrancheReceiptFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setTrancheReceiptPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSelectRubricCard = (fund: FundType, precision?: string) => {
    setSelectedTrancheFund(fund);
    if (precision) setSocialPrecision(precision);
    const p = getMemberRubricProgress(currentMemberId, fund, precision);

    if (p.remainingDue <= 0) {
      setTrancheAmountInput('1000');
      setPaymentMode('TRANCHE');
    } else {
      setPaymentMode('TRANCHE');
      setTrancheAmountInput(Math.min(2000, p.remainingDue).toString());
    }

    const formEl = document.getElementById('tranche-form-section');
    if (formEl) formEl.scrollIntoView({ behavior: 'smooth' });
  };

  const handleTrancheFundChange = (fund: FundType) => {
    setSelectedTrancheFund(fund);
    const p = getMemberRubricProgress(
      currentMemberId,
      fund,
      fund === 'CAS_SOCIAUX' ? socialPrecision : undefined
    );
    if (paymentMode === 'TOTAL') {
      setTrancheAmountInput(p.remainingDue > 0 ? p.remainingDue.toString() : '1000');
    } else {
      setTrancheAmountInput('2000');
    }
  };

  const handlePaymentModeChange = (mode: 'TOTAL' | 'TRANCHE') => {
    setPaymentMode(mode);
    if (mode === 'TOTAL') {
      const rem = activeTrancheProgress.remainingDue;
      setTrancheAmountInput(rem > 0 ? rem.toString() : '1000');
    } else {
      setTrancheAmountInput('2000');
    }
  };

  const handleTrancheSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTrancheMsg(null);

    const amt = Number(trancheAmountInput) || 0;

    if (amt < minTrancheAllowed) {
      setTrancheMsg({
        type: 'error',
        text: `Pour cette rubrique, le montant minimum autorisé par tranche est de ${minTrancheAllowed.toLocaleString('fr-FR')} F CFA.`,
      });
      return;
    }

    if (!trancheTxnRef.trim() && !trancheReceiptFile) {
      setTrancheMsg({
        type: 'error',
        text: 'Veuillez joindre une photo du reçu de paiement ou indiquer la référence de transaction.',
      });
      return;
    }

    const refText = trancheTxnRef.trim()
      ? trancheTxnRef.trim()
      : `REÇU-${trancheReceiptFile?.name || 'WAVE'}`;

    const res = declarePayment(
      selectedTrancheFund,
      amt,
      refText,
      undefined,
      paymentMode,
      selectedTrancheFund === 'CAS_SOCIAUX' ? socialPrecision : undefined
    );

    if (res.success) {
      setTrancheMsg({
        type: 'success',
        text: `Votre versement (${paymentMode === 'TOTAL' ? 'Paiement Totalité' : 'Acompte par tranche'}) de ${amt.toLocaleString('fr-FR')} F CFA a été transmis avec succès au Trésorier !`,
      });
      setTrancheTxnRef('');
      setTrancheReceiptFile(null);
      setTrancheReceiptPreview(null);
      setTrancheAmountInput('');
    } else {
      setTrancheMsg({
        type: 'error',
        text: res.message || 'Erreur lors de la déclaration.',
      });
    }
  };

  // --------------------------------------------------------------------------
  // STATE: 3. HISTORIQUE DE MES VERSEMENTS
  // --------------------------------------------------------------------------
  const [historyFilter, setHistoryFilter] = useState<'TOUS' | 'COTISATION' | 'TRANCHES'>('TOUS');
  const personalDeclarations = declarations.filter(d => d.memberId === currentMemberId);
  const filteredDeclarations = personalDeclarations.filter(d => {
    if (historyFilter === 'COTISATION') return d.fund === 'COTISATION';
    if (historyFilter === 'TRANCHES') return d.fund !== 'COTISATION';
    return true;
  });

  // Active events and project lookups for dynamic rubric enablement
  const activeLoisirs = getActiveFinancialEvent
    ? getActiveFinancialEvent('LOISIRS')
    : financialEvents?.find(e => e.fund === 'LOISIRS' && e.status === 'PUBLISHED');

  const activeSocial = getActiveFinancialEvent
    ? getActiveFinancialEvent('CAS_SOCIAUX')
    : financialEvents?.find(e => e.fund === 'CAS_SOCIAUX' && e.status === 'PUBLISHED');

  const activeAgr = getActiveAgrProject
    ? getActiveAgrProject()
    : projects?.find(p => p.status === 'PUBLISHED');

  // Rubric Cards Definition for Mode 2 (Tranches)
  const trancheCards = [
    {
      fund: 'ANNIVERSAIRE' as FundType,
      title: 'Anniversaire (21 Mars)',
      subtitle: 'Célébration Fraternelle (Date Fixe)',
      eventDate: '21 Mars 2027',
      paymentDeadline: '21 Mars 2027',
      isActive: true,
      emptyNotice: '',
      progress: annivProgress,
      accentColor: 'from-amber-500/10 to-amber-600/5',
      borderColor: 'border-amber-400/40',
      badgeBg: 'bg-amber-100 text-amber-900 border-amber-300',
      icon: <Cake className="w-6 h-6 text-amber-500" />,
      example: 'Ex: Versez 2 000 F aujourd\'hui sur les 10 000 F, reste à payer 8 000 F.',
    },
    {
      fund: 'LOISIRS' as FundType,
      title: activeLoisirs ? activeLoisirs.title : 'Sorties & Loisirs',
      subtitle: activeLoisirs ? 'Activités récréatives et cohésion' : 'Aucune sortie programmée pour le moment',
      eventDate: activeLoisirs?.eventDate || '',
      paymentDeadline: activeLoisirs?.paymentDeadline || '',
      isActive: !!activeLoisirs,
      emptyNotice: 'Aucune sortie programmée pour le moment',
      progress: loisirsProgress,
      accentColor: 'from-blue-500/10 to-blue-600/5',
      borderColor: activeLoisirs ? 'border-blue-400/40' : 'border-slate-300',
      badgeBg: 'bg-blue-100 text-blue-900 border-blue-300',
      icon: <Palmtree className="w-6 h-6 text-blue-500" />,
      example: 'Ex: Versez 2 500 F sur les 5 000 F, reste à payer 2 500 F.',
    },
    {
      fund: 'CAS_SOCIAUX' as FundType,
      precision: activeSocial ? undefined : socialPrecision,
      title: activeSocial ? activeSocial.title : `Cas Sociaux (${socialPrecision})`,
      subtitle: activeSocial ? 'Solidarité & Entraide Fraternelle' : 'Aucun cas social en cours',
      eventDate: activeSocial?.eventDate || '',
      paymentDeadline: activeSocial?.paymentDeadline || '',
      isActive: !!activeSocial,
      emptyNotice: 'Aucun cas social en cours',
      progress: socialProgress,
      accentColor: 'from-rose-500/10 to-rose-600/5',
      borderColor: activeSocial ? 'border-rose-400/40' : 'border-slate-300',
      badgeBg: 'bg-rose-100 text-rose-900 border-rose-300',
      icon: <HeartHandshake className="w-6 h-6 text-rose-500" />,
      example: 'Mariage (30 000 F), Décès (5 000 F), Naissance (2 000 F).',
    },
    {
      fund: 'AGR' as FundType,
      title: activeAgr ? activeAgr.title : 'Projets AGR (Activités Rémunératrices)',
      subtitle: activeAgr ? (activeAgr.category || 'Investissement communautaire') : 'Aucun projet AGR lancé',
      eventDate: activeAgr?.eventDate || '',
      paymentDeadline: activeAgr?.paymentDeadline || '',
      isActive: !!activeAgr,
      emptyNotice: 'Aucun projet AGR lancé',
      progress: agrProgress,
      accentColor: 'from-purple-500/10 to-purple-600/5',
      borderColor: activeAgr ? 'border-purple-400/40' : 'border-slate-300',
      badgeBg: 'bg-purple-100 text-purple-900 border-purple-300',
      icon: <Sprout className="w-6 h-6 text-purple-500" />,
      example: 'Versement libre par tranche de min. 1 000 F CFA.',
    },
  ];

  return (
    <div className="space-y-8 animate-fadeIn text-slate-900 pb-12">
      {/* HEADER BANNER */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 text-white rounded-[2.5rem] p-6 sm:p-8 shadow-2xl relative overflow-hidden border border-slate-700">
        <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 bg-[#E67E22] text-white px-3.5 py-1 rounded-full text-xs font-black tracking-wide shadow">
              <Coins className="w-4 h-4" />
              <span>ESPACE FINANCES MEMBRE</span>
            </span>
            <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-3 py-1 rounded-full text-xs font-bold">
              14 Membres E-ROUAMA
            </span>
          </div>

          <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
            Paiements, Cotisations & Suivi des Acomptes
          </h1>

          <p className="text-xs sm:text-sm text-slate-300 font-medium max-w-2xl">
            Effectuez vos paiements en toute transparence. Distinguez vos <strong>Cotisations Mensuelles statutaires (500 FCFA/mois)</strong> de vos <strong>projets réglables par tranches libres (min. 1 000 FCFA)</strong>.
          </p>
        </div>
      </div>

      {/* MEMBER CARD OVERVIEW */}
      <div className="bg-white border border-gray-200 rounded-[2.5rem] p-6 sm:p-8 shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-[#355E3B] text-white flex items-center justify-center font-black text-xl shadow-md border-2 border-amber-300">
            {connectedMember?.nickname?.substring(0, 2).toUpperCase() || 'M'}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-gray-900">
                {connectedMember?.fullRosterName || connectedMember?.firstName}
              </h2>
              <span className="text-xs bg-gray-100 text-gray-700 px-2.5 py-0.5 rounded-full font-bold">
                @{connectedMember?.nickname}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5 font-medium">
              {connectedMember?.phone || 'Téléphone non renseigné'} • Compte Membre Enregistré
            </p>
          </div>
        </div>

        {/* Status Indicators */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-2xl text-center min-w-[130px]">
            <p className="text-[10px] font-extrabold uppercase text-slate-500">Mois Statutaires</p>
            <span
              className={`inline-block mt-1 text-xs font-black px-3 py-1 rounded-full ${
                duesStatus === 'A_JOUR'
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : duesStatus === 'EN_AVANCE'
                  ? 'bg-blue-100 text-blue-800 border border-blue-300'
                  : 'bg-rose-100 text-rose-800 border border-rose-300'
              }`}
            >
              {duesStatus === 'A_JOUR'
                ? 'À JOUR (500 F/m)'
                : duesStatus === 'EN_AVANCE'
                ? 'EN AVANCE'
                : `RETARD (${duesDetail?.unpaidMonths} mois)`}
            </span>
          </div>

          <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-2xl text-center min-w-[140px]">
            <p className="text-[10px] font-extrabold uppercase text-slate-500">Total Validé (Toutes Caisses)</p>
            <p className="text-lg font-black text-emerald-600 mt-0.5 font-mono">
              {declarations
                .filter(d => d.memberId === currentMemberId && d.status === 'APPROVED')
                .reduce((s, d) => s + d.amount, 0)
                .toLocaleString('fr-FR')}{' '}
              F CFA
            </p>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* NAVIGATION PRINCIPALE PAR ONGLET DE PAIEMENT */}
      {/* ========================================================= */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-2.5 shadow-xl">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {/* Tab 1: Cotisations Mensuelles */}
          <button
            type="button"
            onClick={() => setActiveSubTab('MENSUELLES')}
            className={`py-3.5 px-4 rounded-2xl font-black text-xs sm:text-sm transition-all flex items-center justify-center gap-2.5 ${
              activeSubTab === 'MENSUELLES'
                ? 'bg-[#355E3B] text-white shadow-lg border border-emerald-400'
                : 'bg-slate-950 text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Calendar className="w-4 h-4 text-amber-300 shrink-0" />
            <div className="text-left">
              <span className="block font-black">1. COTISATIONS MENSUELLES</span>
              <span className="block text-[10px] opacity-80 font-normal">Montant fixe : 500 F CFA / mois</span>
            </div>
          </button>

          {/* Tab 2: Acomptes & Tranches */}
          <button
            type="button"
            onClick={() => setActiveSubTab('TRANCHES')}
            className={`py-3.5 px-4 rounded-2xl font-black text-xs sm:text-sm transition-all flex items-center justify-center gap-2.5 ${
              activeSubTab === 'TRANCHES'
                ? 'bg-[#E67E22] text-white shadow-lg border border-amber-300'
                : 'bg-slate-950 text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Coins className="w-4 h-4 text-amber-300 shrink-0" />
            <div className="text-left">
              <span className="block font-black">2. ACOMPTES & TRANCHES</span>
              <span className="block text-[10px] opacity-80 font-normal">Anniv, Loisirs, Cas Sociaux (min. 1 000 F)</span>
            </div>
          </button>

          {/* Tab 3: Historique */}
          <button
            type="button"
            onClick={() => setActiveSubTab('HISTORIQUE')}
            className={`py-3.5 px-4 rounded-2xl font-black text-xs sm:text-sm transition-all flex items-center justify-center gap-2.5 ${
              activeSubTab === 'HISTORIQUE'
                ? 'bg-sky-700 text-white shadow-lg border border-sky-400'
                : 'bg-slate-950 text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <FileText className="w-4 h-4 text-sky-300 shrink-0" />
            <div className="text-left">
              <span className="block font-black">3. HISTORIQUE PERSONNEL</span>
              <span className="block text-[10px] opacity-80 font-normal">Mes reçus et états de validation</span>
            </div>
          </button>
        </div>
      </div>

      {/* =================================================================== */}
      {/* VUE 1 : COTISATIONS MENSUELLES (500 FCFA / MOIS FIXE - INCHANGÉ) */}
      {/* =================================================================== */}
      {activeSubTab === 'MENSUELLES' && (
        <div className="space-y-6">
          {/* Regulatory Information Banner */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-3xl p-5 sm:p-6 flex items-start gap-4">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow">
              <Calendar className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-black text-emerald-950">
                Règle Fondamentale : Cotisation Mensuelle à 500 FCFA par mois
              </h3>
              <p className="text-xs sm:text-sm text-emerald-800 leading-relaxed font-medium">
                La cotisation mensuelle statutaire reste <strong>strictement fixée à 500 FCFA par mois</strong>.
                Elle ne suit pas le système de versement par tranches libres : vous réglez le <strong>montant exact exigé</strong> pour un ou plusieurs mois complets (500 F, 1 000 F, 1 500 F, 3 000 F, 6 000 F...).
              </p>
            </div>
          </div>

          {/* Connected Member Dues Status Card */}
          <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-md grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase text-slate-400">Statut de vos mensualités</span>
              <div className="flex items-center gap-2">
                <span
                  className={`text-sm font-black px-3 py-1 rounded-full ${
                    duesStatus === 'A_JOUR'
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : duesStatus === 'EN_AVANCE'
                      ? 'bg-blue-100 text-blue-800 border border-blue-300'
                      : 'bg-rose-100 text-rose-800 border border-rose-300'
                  }`}
                >
                  {duesStatus === 'A_JOUR' && '✓ À JOUR'}
                  {duesStatus === 'EN_AVANCE' && '⭐ EN AVANCE'}
                  {duesStatus === 'RETARD' && `⚠️ EN RETARD (${duesDetail.unpaidMonths} mois)`}
                </span>
              </div>
              <p className="text-xs text-gray-500 font-medium">
                {duesStatus === 'RETARD'
                  ? `Vous avez ${duesDetail.unpaidMonths} mois impayés à solder.`
                  : duesStatus === 'EN_AVANCE'
                  ? 'Félicitations, vous avez cotisé pour les mois à venir !'
                  : 'Toutes vos cotisations échues sont à jour.'}
              </p>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase text-slate-400">Total déjà réglé en 500 F/mois</span>
              <p className="text-2xl font-black text-emerald-600 font-mono">
                {duesDetail.totalPaid.toLocaleString('fr-FR')} F CFA
              </p>
              <p className="text-xs text-gray-500 font-medium">
                Soit <strong>{Math.floor(duesDetail.totalPaid / 500)} mois</strong> validés par la Trésorerie
              </p>
            </div>

            <div className="space-y-1 bg-amber-50/60 p-3.5 rounded-2xl border border-amber-200">
              <span className="text-[10px] font-black uppercase text-amber-800">Montant d'arriéré à régulariser</span>
              <p className="text-2xl font-black text-amber-700 font-mono">
                {(duesDetail.unpaidMonths * 500).toLocaleString('fr-FR')} F CFA
              </p>
              <p className="text-xs text-amber-900 font-medium">
                Calcul exact : {duesDetail.unpaidMonths} mois × 500 F CFA
              </p>
            </div>
          </div>

          {/* Wave Payment Link for Monthly */}
          <div className="bg-gradient-to-r from-cyan-600 via-sky-600 to-blue-700 text-white rounded-3xl p-6 shadow-xl border border-sky-400/40 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-1.5 text-center md:text-left">
              <div className="inline-flex items-center gap-2 bg-white/20 px-3 py-1 rounded-full text-xs font-black">
                <Smartphone className="w-4 h-4 text-cyan-200" />
                <span>WAVE DIRECT • COTISATIONS MENSUELLES (500 F/MOIS)</span>
              </div>
              <h3 className="text-xl font-black text-white">
                Payer {monthlyAmount.toLocaleString('fr-FR')} F CFA ({monthlyMonthsCount} mois) via Wave
              </h3>
              <p className="text-xs text-cyan-100 max-w-lg">
                Cliquez pour ouvrir Wave et transférer le montant exact pour vos mensualités.
              </p>
            </div>

            <a
              href={WAVE_PAYMENT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-white hover:bg-cyan-50 text-sky-950 font-black py-3.5 px-6 rounded-2xl shadow-lg transition-all flex items-center gap-2 text-sm sm:text-base hover:scale-105 active:scale-95 shrink-0"
            >
              <span className="text-lg">🌊</span>
              <span>PAYER VIA WAVE ({monthlyAmount.toLocaleString('fr-FR')} F)</span>
              <ExternalLink className="w-4 h-4 text-sky-700" />
            </a>
          </div>

          {/* Form: Monthly Dues Declaration */}
          <div className="bg-white border border-gray-200 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
            <div className="border-b border-gray-100 pb-4">
              <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
                <Upload className="w-5 h-5 text-emerald-600" />
                <span>Déclaration de Cotisation Mensuelle (500 FCFA / mois)</span>
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                Indiquez le nombre de mois réglés et transmettez votre reçu de versement Wave au Trésorier.
              </p>
            </div>

            {monthlyMsg && (
              <div
                className={`p-4 rounded-2xl border text-sm font-bold ${
                  monthlyMsg.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border-rose-200'
                }`}
              >
                {monthlyMsg.text}
              </div>
            )}

            <form onSubmit={handleMonthlySubmit} className="space-y-6">
              {/* Preset Month Options */}
              <div>
                <label className="block text-xs font-extrabold text-gray-700 uppercase mb-2">
                  1. Choisissez le nombre de mois à cotiser
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
                  {[
                    { count: 1, label: '1 mois', amount: 500 },
                    { count: 2, label: '2 mois', amount: 1000 },
                    { count: 3, label: '3 mois', amount: 1500 },
                    { count: 6, label: '6 mois', amount: 3000 },
                    { count: 12, label: '1 an (12 m)', amount: 6000 },
                  ].map(item => (
                    <button
                      type="button"
                      key={item.count}
                      onClick={() => setMonthlyMonthsCount(item.count)}
                      className={`p-3 rounded-2xl text-center border transition-all ${
                        monthlyMonthsCount === item.count
                          ? 'bg-[#355E3B] text-white border-emerald-600 shadow-md ring-2 ring-emerald-300'
                          : 'bg-gray-50 hover:bg-gray-100 text-gray-800 border-gray-200'
                      }`}
                    >
                      <span className="text-xs font-black block">{item.label}</span>
                      <span className="text-[11px] font-mono font-bold mt-0.5 block">
                        {item.amount.toLocaleString('fr-FR')} F
                      </span>
                    </button>
                  ))}

                  {duesDetail.unpaidMonths > 0 && (
                    <button
                      type="button"
                      onClick={() => setMonthlyMonthsCount(duesDetail.unpaidMonths)}
                      className={`p-3 rounded-2xl text-center border transition-all ${
                        monthlyMonthsCount === duesDetail.unpaidMonths
                          ? 'bg-rose-600 text-white border-rose-700 shadow-md ring-2 ring-rose-300'
                          : 'bg-rose-50 hover:bg-rose-100 text-rose-900 border-rose-200'
                      }`}
                    >
                      <span className="text-xs font-black block">Tout mon retard</span>
                      <span className="text-[11px] font-mono font-bold mt-0.5 block">
                        {(duesDetail.unpaidMonths * 500).toLocaleString('fr-FR')} F
                      </span>
                    </button>
                  )}
                </div>
              </div>

              {/* Amount Display & Reference */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                  <span className="text-xs font-extrabold text-slate-700 uppercase block">
                    2. Montant total calculé
                  </span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black text-emerald-600 font-mono">
                      {monthlyAmount.toLocaleString('fr-FR')}
                    </span>
                    <span className="text-sm font-extrabold text-slate-500">F CFA</span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Formule statutaire : <strong>{monthlyMonthsCount} mois × 500 FCFA</strong>
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-gray-700 uppercase mb-2">
                    3. Référence de la transaction Wave (Optionnel)
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: MP260904.1022.B12345"
                    value={monthlyTxnRef}
                    onChange={e => setMonthlyTxnRef(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-300 rounded-2xl px-4 py-3 text-sm font-bold text-gray-900 focus:outline-none focus:border-emerald-500 font-mono"
                  />
                  <p className="text-[11px] text-gray-400 mt-1">
                    Le numéro de confirmation reçu par SMS ou sur l'application Wave.
                  </p>
                </div>
              </div>

              {/* Receipt File Upload */}
              <div>
                <label className="block text-xs font-extrabold text-gray-700 uppercase mb-2">
                  4. Photo / Capture d'écran du Reçu Wave (Preuve Requise)
                </label>
                <div
                  className={`border-2 border-dashed rounded-2xl p-4 text-center transition-all ${
                    monthlyReceiptFile
                      ? 'border-emerald-500 bg-emerald-50/30'
                      : 'border-slate-300 bg-slate-50 hover:border-emerald-500'
                  }`}
                >
                  {monthlyReceiptPreview ? (
                    <div className="relative inline-block">
                      <img
                        src={monthlyReceiptPreview}
                        alt="Reçu"
                        className="max-h-48 rounded-xl border border-gray-300 shadow-md object-contain mx-auto"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setMonthlyReceiptFile(null);
                          setMonthlyReceiptPreview(null);
                        }}
                        className="absolute -top-2 -right-2 bg-rose-600 text-white rounded-full p-1 shadow-md hover:bg-rose-700"
                      >
                        <X className="w-4 h-4" />
                      </button>
                      <p className="text-xs font-bold text-emerald-700 mt-2 flex items-center justify-center gap-1">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        Reçu attaché : {monthlyReceiptFile?.name}
                      </p>
                    </div>
                  ) : (
                    <label className="cursor-pointer flex flex-col items-center justify-center space-y-2 py-3">
                      <Paperclip className="w-8 h-8 text-emerald-600" />
                      <span className="text-xs font-bold text-gray-800">
                        Cliquez pour sélectionner la capture du reçu Wave
                      </span>
                      <span className="text-[10px] text-gray-400">PNG, JPG, PDF acceptés</span>
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        onChange={handleMonthlyFileChange}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={!isMonthlySubmitActive}
                className={`w-full font-black py-4 px-6 rounded-2xl shadow-lg transition-all text-sm sm:text-base flex items-center justify-center gap-2 ${
                  isMonthlySubmitActive
                    ? 'bg-[#355E3B] hover:bg-[#2A4B2F] text-white active:scale-95 cursor-pointer'
                    : 'bg-gray-200 text-gray-400 border border-gray-300 cursor-not-allowed pointer-events-none'
                }`}
              >
                <CheckCircle2 className="w-5 h-5" />
                <span>
                  DÉCLARER MA COTISATION MENSUELLE ({monthlyAmount.toLocaleString('fr-FR')} F CFA - {monthlyMonthsCount} MOIS)
                </span>
              </button>

              {!isMonthlySubmitActive && (
                <p className="text-center text-xs text-amber-700 bg-amber-50 p-2.5 rounded-xl border border-amber-200 font-bold">
                  🔒 Veuillez attacher votre capture d'écran du reçu Wave pour activer la déclaration.
                </p>
              )}
            </form>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* VUE 2 : AUTRES RUBRIQUES (ANNIVERSAIRES, SORTIES, CAS SOCIAUX - TRANCHES) */}
      {/* =================================================================== */}
      {activeSubTab === 'TRANCHES' && (
        <div className="space-y-6">
          {/* Pedagogic Example Banner */}
          <div className="bg-amber-50 border border-amber-200 rounded-3xl p-5 sm:p-6 space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#E67E22] text-white flex items-center justify-center shrink-0 shadow">
                <Coins className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-amber-950">
                  Système de Paiement par Tranches (Acomptes) : Minimum 1 000 FCFA par versement
                </h3>
                <p className="text-xs sm:text-sm text-amber-900 leading-relaxed font-medium mt-1">
                  Pour les rubriques <strong>Anniversaire, Sorties & Loisirs, Cas Sociaux et Projets AGR</strong>, vous pouvez régler en une seule fois <strong>OU par acomptes progressifs</strong> selon vos disponibilités.
                </p>
              </div>
            </div>

            {/* Example Box requested by user */}
            <div className="bg-white p-4 rounded-2xl border border-amber-300 text-xs text-slate-800 space-y-1.5 shadow-sm">
              <p className="font-black text-amber-900 flex items-center gap-1.5">
                <Info className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Exemple concret pour l'Anniversaire (10 000 FCFA) :</span>
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 font-mono text-center">
                <div className="bg-slate-50 p-2 rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-500 block uppercase">Montant Total</span>
                  <strong className="text-gray-900 text-sm">10 000 F CFA</strong>
                </div>
                <div className="bg-emerald-50 p-2 rounded-xl border border-emerald-200">
                  <span className="text-[10px] text-emerald-600 block uppercase">Si vous payez 2 000 F</span>
                  <strong className="text-emerald-700 text-sm">Avancé : 2 000 F CFA</strong>
                </div>
                <div className="bg-amber-50 p-2 rounded-xl border border-amber-300">
                  <span className="text-[10px] text-amber-700 block uppercase">Mise à jour en direct</span>
                  <strong className="text-amber-800 text-sm">Reste dû : 8 000 F CFA</strong>
                </div>
              </div>
            </div>
          </div>

          {/* Real-time Cards Grid for Tranche Rubrics */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-emerald-600" />
                <span>Suivi Détaillé de Mes Cotisations par Rubrique</span>
              </h3>
              <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
                Acomptes ≥ 1 000 FCFA
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {trancheCards.map((card, idx) => {
                const { progress, isActive } = card;

                // INACTIVE / GRAYED-OUT CARD STATE
                if (!isActive) {
                  return (
                    <div
                      key={idx}
                      className="bg-slate-50/80 rounded-3xl p-5 border-2 border-dashed border-slate-300 flex flex-col justify-between space-y-4 opacity-75 select-none transition-all"
                    >
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="p-2 rounded-xl bg-slate-200/70 border border-slate-300 text-slate-400">
                            {card.icon}
                          </div>
                          <span className="text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider bg-slate-200 text-slate-600 border border-slate-300">
                            ⚪ Non ouvert
                          </span>
                        </div>

                        <div>
                          <h4 className="font-black text-slate-700 text-base leading-tight">
                            {card.title}
                          </h4>
                          <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                            {card.subtitle}
                          </p>
                        </div>

                        {/* Explicit Empty Notice Box */}
                        <div className="p-3.5 rounded-2xl bg-slate-100 border border-slate-200 text-center space-y-1">
                          <p className="text-xs font-black text-slate-600 flex items-center justify-center gap-1.5">
                            <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>{card.emptyNotice}</span>
                          </p>
                          <p className="text-[10px] text-slate-400 italic">
                            Rubrique grisée. Les versements s'activeront dès publication officielle par les responsables.
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled
                        className="w-full py-2.5 px-3 rounded-2xl font-black text-xs bg-slate-200 text-slate-400 border border-slate-300 cursor-not-allowed"
                      >
                        <span>Cotisation non ouverte</span>
                      </button>
                    </div>
                  );
                }

                // ACTIVE CARD STATE
                const percentage =
                  progress.totalRequired > 0
                    ? Math.min(100, Math.round((progress.totalAdvanced / progress.totalRequired) * 100))
                    : 100;

                const isSettled = progress.status === 'SOLDE';
                const isPartial = progress.status === 'EN_COURS';

                return (
                  <div
                    key={idx}
                    className={`bg-white rounded-3xl p-5 border-2 ${card.borderColor} shadow-lg hover:shadow-xl transition-all flex flex-col justify-between space-y-4`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
                          {card.icon}
                        </div>
                        <span
                          className={`text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider flex items-center gap-1 ${
                            isSettled
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : isPartial
                              ? 'bg-blue-100 text-blue-800 border border-blue-300'
                              : 'bg-amber-100 text-amber-800 border border-amber-300'
                          }`}
                        >
                          {isSettled && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
                          {isPartial && <Clock className="w-3 h-3 text-blue-600" />}
                          {isSettled ? 'Soldé' : isPartial ? 'En cours' : '🟢 Ouvert'}
                        </span>
                      </div>

                      <h4 className="font-black text-gray-900 text-base leading-tight">
                        {card.title}
                      </h4>
                      <p className="text-[11px] text-gray-500 font-medium mt-0.5 truncate">
                        {card.subtitle}
                      </p>

                      {/* Event & Deadline Dates */}
                      {(card.eventDate || card.paymentDeadline) && (
                        <div className="mt-2.5 pt-2 border-t border-gray-100 grid grid-cols-2 gap-1 text-[10px]">
                          {card.eventDate && (
                            <div className="bg-slate-50 p-1.5 rounded-lg">
                              <span className="text-slate-400 block font-bold uppercase text-[9px]">📅 Réalisation</span>
                              <span className="font-extrabold text-slate-700 truncate block">{card.eventDate}</span>
                            </div>
                          )}
                          {card.paymentDeadline && (
                            <div className="bg-rose-50/70 p-1.5 rounded-lg border border-rose-100">
                              <span className="text-rose-400 block font-bold uppercase text-[9px]">⏳ Limite Paiement</span>
                              <span className="font-black text-rose-700 truncate block">{card.paymentDeadline}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* 3 Indicators: Total | Avancé | Reste */}
                      <div className="mt-3 pt-2.5 border-t border-gray-100 space-y-2 text-xs">
                        <div className="flex items-center justify-between text-gray-600">
                          <span className="font-bold">Montant Total dû :</span>
                          <span className="font-black text-gray-900 font-mono">
                            {progress.totalRequired.toLocaleString('fr-FR')} F
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-emerald-700">
                          <span className="font-bold">Montant Avancé :</span>
                          <span className="font-black font-mono text-emerald-600">
                            {progress.totalAdvanced.toLocaleString('fr-FR')} F
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-amber-800 bg-amber-50/80 p-2 rounded-xl border border-amber-200">
                          <span className="font-extrabold text-[11px]">Reste à Régler :</span>
                          <span className="font-black font-mono text-sm text-amber-700">
                            {progress.remainingDue.toLocaleString('fr-FR')} F CFA
                          </span>
                        </div>

                        {progress.pendingAmount > 0 && (
                          <div className="text-[10px] text-blue-600 font-bold flex items-center gap-1 bg-blue-50 px-2 py-1 rounded-lg">
                            <Clock className="w-3 h-3 animate-spin" />
                            <span>{progress.pendingAmount.toLocaleString('fr-FR')} F en validation</span>
                          </div>
                        )}
                      </div>

                      {/* Progress Bar */}
                      <div className="mt-3 space-y-1">
                        <div className="flex justify-between text-[10px] font-bold text-gray-500">
                          <span>Progression</span>
                          <span>{percentage}%</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-2 rounded-full transition-all duration-500 ${
                              isSettled ? 'bg-emerald-500' : isPartial ? 'bg-blue-500' : 'bg-amber-400'
                            }`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleSelectRubricCard(card.fund, card.precision)}
                      className="w-full py-2.5 px-3 rounded-2xl font-black text-xs transition-all flex items-center justify-center gap-1.5 bg-[#E67E22] hover:bg-[#D35400] text-white shadow hover:scale-[1.02] active:scale-95 cursor-pointer"
                    >
                      <span>Verser un acompte</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Wave Payment Link for Tranches */}
          <div className="bg-gradient-to-r from-cyan-600 via-sky-600 to-blue-700 text-white rounded-3xl p-6 shadow-xl border border-sky-400/40 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-1.5 text-center md:text-left">
              <div className="inline-flex items-center gap-2 bg-white/20 px-3 py-1 rounded-full text-xs font-black">
                <Smartphone className="w-4 h-4 text-cyan-200" />
                <span>WAVE DIRECT • VERSEMENT PAR TRANCHE (ACOMPTE)</span>
              </div>
              <h3 className="text-xl font-black text-white">
                Réglez votre acompte ({numericTrancheAmount.toLocaleString('fr-FR')} F CFA) via Wave
              </h3>
              <p className="text-xs text-cyan-100 max-w-lg">
                Le bouton Wave s'active dès la saisie d'un versement conforme (minimum {minTrancheAllowed.toLocaleString('fr-FR')} F CFA).
              </p>
            </div>

            {isTrancheWaveActive ? (
              <a
                href={WAVE_PAYMENT_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-white hover:bg-cyan-50 text-sky-950 font-black py-3.5 px-6 rounded-2xl shadow-lg transition-all flex items-center gap-2 text-sm sm:text-base hover:scale-105 active:scale-95 shrink-0"
              >
                <span className="text-lg">🌊</span>
                <span>EFFECTUER MON DÉPÔT WAVE ({numericTrancheAmount.toLocaleString('fr-FR')} F)</span>
                <ExternalLink className="w-4 h-4 text-sky-700" />
              </a>
            ) : (
              <button
                type="button"
                disabled
                className="bg-white/40 text-sky-950/40 cursor-not-allowed font-black py-3.5 px-6 rounded-2xl text-sm sm:text-base flex items-center gap-2 opacity-70 shrink-0"
              >
                <span className="text-lg opacity-40">🌊</span>
                <span>EFFECTUER MON DÉPÔT WAVE</span>
                <ExternalLink className="w-4 h-4 text-sky-950/30" />
              </button>
            )}
          </div>

          {/* Form: Tranche Payment Declaration */}
          <div id="tranche-form-section" className="bg-white border border-gray-200 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
            <div className="border-b border-gray-100 pb-4">
              <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
                <Upload className="w-5 h-5 text-[#E67E22]" />
                <span>Déclaration d'un Versement par Tranche (Acompte)</span>
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                Choisissez votre rubrique, indiquez le montant versé et transmettez votre justificatif au Trésorier.
              </p>
            </div>

            {trancheMsg && (
              <div
                className={`p-4 rounded-2xl border text-sm font-bold ${
                  trancheMsg.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border-rose-200'
                }`}
              >
                {trancheMsg.text}
              </div>
            )}

            <form onSubmit={handleTrancheSubmit} className="space-y-6">
              {/* Step 1: Rubric Selection (excludes COTISATION) */}
              <div>
                <label className="block text-xs font-extrabold text-gray-700 uppercase mb-2">
                  1. Choisissez la Rubrique ou l'Événement
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    {
                      key: 'ANNIVERSAIRE' as FundType,
                      label: '🎂 Anniversaire (21 Mars)',
                      isActive: true,
                    },
                    {
                      key: 'LOISIRS' as FundType,
                      label: activeLoisirs ? `🏖️ ${activeLoisirs.title}` : '🏖️ Sorties & Loisirs',
                      isActive: !!activeLoisirs,
                    },
                    {
                      key: 'CAS_SOCIAUX' as FundType,
                      label: activeSocial ? `🤝 ${activeSocial.title}` : '🤝 Cas Sociaux',
                      isActive: !!activeSocial,
                    },
                    {
                      key: 'AGR' as FundType,
                      label: activeAgr ? `🌱 ${activeAgr.title}` : '🌱 Projets AGR',
                      isActive: !!activeAgr,
                    },
                  ].map(item => {
                    const isItemActive = item.isActive;
                    const p = getMemberRubricProgress(
                      currentMemberId,
                      item.key,
                      item.key === 'CAS_SOCIAUX' ? (activeSocial ? undefined : socialPrecision) : undefined
                    );

                    return (
                      <button
                        type="button"
                        key={item.key}
                        disabled={!isItemActive}
                        onClick={() => isItemActive && handleTrancheFundChange(item.key)}
                        className={`p-3.5 rounded-2xl text-left border transition-all ${
                          !isItemActive
                            ? 'bg-slate-100 border-slate-200 text-slate-400 border-dashed cursor-not-allowed opacity-60'
                            : selectedTrancheFund === item.key
                            ? 'bg-[#E67E22] text-white border-amber-500 shadow-md ring-2 ring-amber-300 cursor-pointer'
                            : 'bg-gray-50 hover:bg-gray-100 text-gray-800 border-gray-200 cursor-pointer'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-1">
                          <span className="text-xs font-black block truncate">{item.label}</span>
                          {!isItemActive && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-500 shrink-0">
                              Fermé
                            </span>
                          )}
                        </div>
                        <div className="mt-2 pt-2 border-t border-current/20 text-[10px] font-mono">
                          {!isItemActive ? (
                            <span className="text-slate-400 italic">Non ouvert</span>
                          ) : (
                            <>
                              <span>Reste dû : </span>
                              <strong className={selectedTrancheFund === item.key ? 'text-amber-200' : 'text-amber-700'}>
                                {p.remainingDue.toLocaleString('fr-FR')} F
                              </strong>
                            </>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Active Context Banner if LOISIRS */}
              {selectedTrancheFund === 'LOISIRS' && activeLoisirs && (
                <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-2xl flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <span className="text-xs font-black text-blue-950 block">
                      🏖️ Sortie / Loisir programmée : {activeLoisirs.title}
                    </span>
                    <p className="text-[11px] text-blue-700">{activeLoisirs.description}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-blue-500 font-bold block uppercase">Objectif par membre</span>
                    <span className="text-xs font-black text-blue-900 bg-white px-3 py-1 rounded-xl border border-blue-200 font-mono">
                      {activeLoisirs.requiredAmountPerMember.toLocaleString('fr-FR')} F CFA
                    </span>
                  </div>
                </div>
              )}

              {/* Social Precision if CAS_SOCIAUX */}
              {selectedTrancheFund === 'CAS_SOCIAUX' && (
                <div className="p-4 bg-rose-50/70 border border-rose-200 rounded-2xl space-y-2">
                  {activeSocial ? (
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <span className="text-xs font-black text-rose-950 block">
                          🤝 Événement Social actif : {activeSocial.title}
                        </span>
                        <p className="text-[11px] text-rose-700">{activeSocial.description}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-rose-500 font-bold block uppercase">Contribution requise</span>
                        <span className="text-xs font-black text-rose-900 bg-white px-3 py-1 rounded-xl border border-rose-200 font-mono">
                          {activeSocial.requiredAmountPerMember.toLocaleString('fr-FR')} F CFA
                        </span>
                      </div>
                    </div>
                  ) : (
                    <>
                      <label className="block text-xs font-bold text-rose-900">
                        Précisez l'événement social concerné :
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {[
                          { key: 'Mariage', label: "Mariage d'un membre", tariff: 'Total: 30 000 F CFA' },
                          { key: 'Naissance', label: 'Naissance d’un enfant', tariff: 'Total: 2 000 F CFA' },
                          { key: 'Décès', label: 'Décès (Parent / Famille)', tariff: 'Total: 5 000 F CFA' },
                        ].map(item => (
                          <button
                            type="button"
                            key={item.key}
                            onClick={() => {
                              setSocialPrecision(item.key);
                              const p = getMemberRubricProgress(currentMemberId, 'CAS_SOCIAUX', item.key);
                              if (paymentMode === 'TOTAL') {
                                setTrancheAmountInput(p.remainingDue > 0 ? p.remainingDue.toString() : '1000');
                              }
                            }}
                            className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all ${
                              socialPrecision === item.key
                                ? 'bg-rose-600 text-white shadow'
                                : 'bg-white text-rose-800 border border-rose-200 hover:bg-rose-100'
                            }`}
                          >
                            <span>{item.label}</span>
                            <span className="ml-1 text-[10px] opacity-80 font-mono">({item.tariff})</span>
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Active Context Banner if AGR */}
              {selectedTrancheFund === 'AGR' && activeAgr && (
                <div className="p-4 bg-purple-50/70 border border-purple-200 rounded-2xl flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <span className="text-xs font-black text-purple-950 block">
                      🌱 Projet AGR actif : {activeAgr.title}
                    </span>
                    <p className="text-[11px] text-purple-700">{activeAgr.description}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-purple-500 font-bold block uppercase">Objectif par membre</span>
                    <span className="text-xs font-black text-purple-900 bg-white px-3 py-1 rounded-xl border border-purple-200 font-mono">
                      {activeAgr.requiredAmountPerMember
                        ? `${activeAgr.requiredAmountPerMember.toLocaleString('fr-FR')} F CFA`
                        : 'Acompte libre (min. 1 000 F)'}
                    </span>
                  </div>
                </div>
              )}

              {/* Step 2: Payment Mode */}
              <div>
                <label className="block text-xs font-extrabold text-gray-700 uppercase mb-2">
                  2. Modalité de versement
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => handlePaymentModeChange('TRANCHE')}
                    className={`p-4 rounded-2xl text-left border transition-all flex items-start gap-3 ${
                      paymentMode === 'TRANCHE'
                        ? 'bg-amber-50 border-amber-400 ring-2 ring-amber-300 text-amber-950 shadow-sm'
                        : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <div className="w-5 h-5 rounded-full border-2 mt-0.5 flex items-center justify-center shrink-0 border-amber-500">
                      {paymentMode === 'TRANCHE' && <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />}
                    </div>
                    <div>
                      <span className="text-sm font-black block">Payer par tranche (Acompte modulable)</span>
                      <p className="text-xs text-gray-500 mt-1">
                        Versez un acompte libre. <strong className="text-amber-700">Minimum : 1 000 FCFA par versement.</strong>
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handlePaymentModeChange('TOTAL')}
                    className={`p-4 rounded-2xl text-left border transition-all flex items-start gap-3 ${
                      paymentMode === 'TOTAL'
                        ? 'bg-emerald-50 border-emerald-400 ring-2 ring-emerald-300 text-emerald-950 shadow-sm'
                        : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <div className="w-5 h-5 rounded-full border-2 mt-0.5 flex items-center justify-center shrink-0 border-emerald-500">
                      {paymentMode === 'TOTAL' && <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />}
                    </div>
                    <div>
                      <span className="text-sm font-black block">Payer la totalité en un seul coup</span>
                      <p className="text-xs text-gray-500 mt-1">
                        Soldez tout le reste dû ({activeTrancheProgress.remainingDue.toLocaleString('fr-FR')} F CFA).
                      </p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Step 3: Amount Input + Live Simulation */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-extrabold text-gray-700 uppercase">
                      3. Montant du versement (en F CFA)
                    </label>
                    <span className="text-[10px] font-black text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-300">
                      Min. {minTrancheAllowed.toLocaleString('fr-FR')} F CFA
                    </span>
                  </div>

                  <div className="relative">
                    <input
                      type="number"
                      placeholder="Ex: 2000, 5000..."
                      value={trancheAmountInput}
                      onChange={e => setTrancheAmountInput(e.target.value)}
                      className={`w-full bg-gray-50 border rounded-2xl px-4 py-3 text-base font-black text-gray-900 focus:outline-none focus:bg-white ${
                        trancheAmountInput.trim() !== '' && !isTrancheAmountValid
                          ? 'border-rose-400 ring-2 ring-rose-200'
                          : 'border-gray-300 focus:border-[#E67E22]'
                      }`}
                    />
                    <span className="absolute right-4 top-3 text-xs font-black text-gray-400">F CFA</span>
                  </div>

                  {trancheAmountInput.trim() !== '' && !isTrancheAmountValid && (
                    <p className="text-xs text-rose-600 font-bold mt-1.5 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>Le montant minimum autorisé par versement est de {minTrancheAllowed.toLocaleString('fr-FR')} F CFA.</span>
                    </p>
                  )}

                  {/* Live Simulation Card */}
                  {trancheAmountInput.trim() !== '' && isTrancheAmountValid && (
                    <div className="mt-2 text-xs text-slate-700 bg-amber-50/70 p-3 rounded-xl border border-amber-200 space-y-1">
                      <div className="flex justify-between">
                        <span>Nouveau Montant Avancé après ce paiement :</span>
                        <strong className="text-emerald-700 font-mono">
                          {(activeTrancheProgress.totalAdvanced + numericTrancheAmount).toLocaleString('fr-FR')} F CFA
                        </strong>
                      </div>
                      <div className="flex justify-between">
                        <span>Nouveau Reste à Régler :</span>
                        <strong className="text-amber-800 font-mono">
                          {Math.max(0, activeTrancheProgress.remainingDue - numericTrancheAmount).toLocaleString('fr-FR')} F CFA
                        </strong>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-gray-700 uppercase mb-2">
                    4. Référence Mobile Money / Wave (Optionnel)
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: MP260904.1145.C99887"
                    value={trancheTxnRef}
                    onChange={e => setTrancheTxnRef(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-300 rounded-2xl px-4 py-3 text-sm font-bold text-gray-900 focus:outline-none focus:border-[#E67E22] font-mono"
                  />
                  <p className="text-[11px] text-gray-400 mt-1">
                    Référence textuelle reçue lors du paiement Wave.
                  </p>
                </div>
              </div>

              {/* Step 4: Receipt Upload */}
              <div>
                <label className="block text-xs font-extrabold text-gray-700 uppercase mb-2">
                  5. Capture d'écran ou Photo du Reçu (Preuve Obligatoire)
                </label>
                <div
                  className={`border-2 border-dashed rounded-2xl p-4 text-center transition-all ${
                    trancheReceiptFile
                      ? 'border-emerald-500 bg-emerald-50/30'
                      : 'border-amber-300 bg-amber-50/20 hover:border-[#E67E22]'
                  }`}
                >
                  {trancheReceiptPreview ? (
                    <div className="relative inline-block">
                      <img
                        src={trancheReceiptPreview}
                        alt="Reçu"
                        className="max-h-48 rounded-xl border border-gray-300 shadow-md object-contain mx-auto"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setTrancheReceiptFile(null);
                          setTrancheReceiptPreview(null);
                        }}
                        className="absolute -top-2 -right-2 bg-rose-600 text-white rounded-full p-1 shadow-md hover:bg-rose-700"
                      >
                        <X className="w-4 h-4" />
                      </button>
                      <p className="text-xs font-bold text-emerald-700 mt-2 flex items-center justify-center gap-1">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        Reçu attaché : {trancheReceiptFile?.name}
                      </p>
                    </div>
                  ) : (
                    <label className="cursor-pointer flex flex-col items-center justify-center space-y-2 py-3">
                      <Paperclip className="w-8 h-8 text-[#E67E22]" />
                      <span className="text-xs font-bold text-gray-800">
                        Cliquez pour sélectionner la photo du reçu de versement (Requis)
                      </span>
                      <span className="text-[10px] text-gray-400">Formats acceptés : PNG, JPG, PDF</span>
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        onChange={handleTrancheFileChange}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={!isTrancheSubmitActive}
                className={`w-full font-black py-4 px-6 rounded-2xl shadow-lg transition-all text-sm sm:text-base flex items-center justify-center gap-2 ${
                  isTrancheSubmitActive
                    ? 'bg-[#E67E22] hover:bg-[#D35400] text-white active:scale-95 cursor-pointer'
                    : 'bg-gray-200 text-gray-400 border border-gray-300 cursor-not-allowed pointer-events-none'
                }`}
              >
                <CheckCircle2 className="w-5 h-5" />
                <span>
                  {paymentMode === 'TOTAL'
                    ? `DÉCLARER MON RÈGLEMENT TOTAL (${numericTrancheAmount > 0 ? numericTrancheAmount.toLocaleString('fr-FR') + ' F CFA' : ''})`
                    : `DÉCLARER MON ACOMPTE PAR TRANCHE (${numericTrancheAmount > 0 ? numericTrancheAmount.toLocaleString('fr-FR') + ' F CFA' : ''})`}
                </span>
              </button>

              {!isTrancheSubmitActive && (
                <p className="text-center text-xs text-amber-700 bg-amber-50 p-2.5 rounded-xl border border-amber-200 font-bold">
                  🔒 {trancheReceiptFile === null
                    ? "Veuillez joindre la preuve de reçu pour activer la déclaration."
                    : !isTrancheAmountValid
                    ? `Le montant doit être d'au moins ${minTrancheAllowed.toLocaleString('fr-FR')} F CFA.`
                    : "Complétez le formulaire."}
                </p>
              )}
            </form>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* VUE 3 : HISTORIQUE PERSONNEL DES VERSEMENTS */}
      {/* =================================================================== */}
      {activeSubTab === 'HISTORIQUE' && (
        <div className="bg-white border border-gray-200 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
          <div className="border-b border-gray-100 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-black text-gray-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#355E3B]" />
                <span>Historique Personnel des Versements & Déclarations</span>
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                Suivi chronologique de toutes vos cotisations mensuelles et acomptes soumis au Trésorier.
              </p>
            </div>

            {/* Filter Buttons */}
            <div className="flex items-center gap-1.5 bg-gray-100 p-1 rounded-xl">
              {[
                { key: 'TOUS', label: 'Tous' },
                { key: 'COTISATION', label: 'Cotis. Mensuelles' },
                { key: 'TRANCHES', label: 'Acomptes & Tranches' },
              ].map(f => (
                <button
                  type="button"
                  key={f.key}
                  onClick={() => setHistoryFilter(f.key as any)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all ${
                    historyFilter === f.key
                      ? 'bg-white text-gray-900 shadow-sm font-black'
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {filteredDeclarations.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-xs font-medium space-y-2">
              <Coins className="w-8 h-8 text-gray-300 mx-auto" />
              <p>Aucun versement enregistré sous ce filtre pour le moment.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-gray-200 text-gray-500 font-extrabold uppercase tracking-wider">
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Rubrique</th>
                    <th className="py-3 px-4">Type de Versement</th>
                    <th className="py-3 px-4">Montant Versé</th>
                    <th className="py-3 px-4">Référence</th>
                    <th className="py-3 px-4 text-right">Statut Trésorier</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-medium text-gray-800">
                  {filteredDeclarations.map(d => (
                    <tr key={d.id} className="hover:bg-gray-50 transition-colors">
                      <td className="py-3 px-4 text-gray-500 font-mono">{d.date}</td>
                      <td className="py-3 px-4 font-bold">
                        {FUND_LABELS[d.fund]}
                        {d.subCategory && (
                          <span className="block text-[10px] text-slate-500 font-normal">
                            {d.subCategory}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                            d.fund === 'COTISATION'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : d.paymentType === 'TOTAL'
                              ? 'bg-blue-100 text-blue-800 border border-blue-300'
                              : 'bg-amber-100 text-amber-800 border border-amber-300'
                          }`}
                        >
                          {d.fund === 'COTISATION'
                            ? `Mensualité fixe (${Math.round(d.amount / 500)} mois)`
                            : d.paymentType === 'TOTAL'
                            ? 'Règlement Total'
                            : 'Acompte par tranche'}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-black text-gray-900 font-mono text-sm">
                        {d.amount.toLocaleString('fr-FR')} F CFA
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-gray-600">{d.reference}</td>
                      <td className="py-3 px-4 text-right">
                        <span
                          className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-black ${
                            d.status === 'APPROVED'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : d.status === 'REJECTED'
                              ? 'bg-rose-100 text-rose-800 border border-rose-300'
                              : 'bg-amber-100 text-amber-800 border border-amber-300'
                          }`}
                        >
                          {d.status === 'APPROVED' && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
                          {d.status === 'REJECTED' && <XCircle className="w-3 h-3 text-rose-600" />}
                          {d.status === 'PENDING' && <Clock className="w-3 h-3 text-amber-600 animate-spin" />}
                          <span>
                            {d.status === 'APPROVED'
                              ? 'VALIDÉ PAR TRÉSORIER'
                              : d.status === 'REJECTED'
                              ? `REJETÉ (${d.rejectionReason || 'Non conforme'})`
                              : 'EN ATTENTE VALIDATION'}
                          </span>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
