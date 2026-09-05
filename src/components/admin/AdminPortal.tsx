import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { AdminRole, FundType, FUND_LABELS, TargetAudience, Committee, AgrProject, FinancialBilan } from '../../types';
import { ADMIN_USERS } from '../../data/membersData';
import { sendEmailBroadcastAsync } from '../../utils/emailService';
import { fetchAELFDailyReadings, AELFDayData } from '../../utils/aelfService';
import { getDailyVerseForDate } from '../../utils/versesData';
import { RbacWarningBanner } from './RbacWarningBanner';
import {
  Shield,
  CheckCircle2,
  XCircle,
  Clock,
  Send,
  AlertTriangle,
  Lock,
  MessageSquare,
  FileText,
  DollarSign,
  Users,
  Rocket,
  Archive,
  Eye,
  Plus,
  RefreshCw,
  Printer,
  KeyRound,
  UserCheck,
  PieChart,
  Trash2,
  Sliders,
  ArrowRightLeft,
  Info,
  Loader2,
  Coins,
  ChevronDown,
  ChevronUp,
  Calendar,
} from 'lucide-react';

export const AdminPortal: React.FC = () => {
  const {
    currentUser,
    declarations,
    approvePayment,
    rejectPayment,
    withdrawals,
    createWithdrawalRequest,
    approveWithdrawal,
    rejectWithdrawal,
    members,
    getMemberDuesStatus,
    getMemberDuesDetail,
    getMemberRubricProgress,
    getAllMembersRubricSummary,
    fundBalances,
    transactions,
    newsItems,
    publishNews,
    deleteNewsItem,
    createFinancialBilan,
    approveBilanPayor,
    bilans,
    sendBilanToSecretariat,
    sendBilanFromSecretariatToCom,
    ackBilanCOM,
    publishBilanNewsCOM,
    ackAndPublishBilanCOM,
    archiveBilanSecretariat,
    pvs,
    createSecretaryPV,
    approvePVPayor,
    activities,
    createActivity,
    approveActivityPayor,
    projects,
    createProject,
    approveProjectPayor,
    publishProject,
    archiveProject,
    financialEvents,
    createFinancialEvent,
    archiveFinancialEvent,
    deleteFinancialEvent,
    broadcastCerveauAlert,
    assignMemberRole,
    resetMemberPin,
    adminUsers,
    updateAdminCredentials,
    verseOfTheDay,
    updateVerseOfTheDay,
    prayerIntentions,
    addPrayerIntention,
    religiousEvents,
    createReligiousEvent,
  } = useApp();

  // User's native admin role
  const userAdminRole = currentUser?.adminRole || 'TRESORIER';
  const activeRole: AdminRole = userAdminRole;

  // Temporal WhatsApp Check (28th of current month to 04th of next month until 23h59 GMT)
  const today = new Date();
  const currentDayOfMonth = today.getDate();
  const isWhatsAppRelanceActive = currentDayOfMonth >= 28 || currentDayOfMonth <= 4;

  // Local Form States
  // 1. Trésorier Forms
  const [tresorierRubrique, setTresorierRubrique] = useState<
    'VALIDATION' | 'MENSUELLES' | 'TRANCHES' | 'EVENEMENTS' | 'RELANCES' | 'DECAISSEMENTS' | 'HISTORIQUE' | 'BILAN'
  >('VALIDATION');
  const [monthlyFilterStatus, setMonthlyFilterStatus] = useState<'TOUS' | 'A_JOUR' | 'EN_AVANCE' | 'RETARD'>('TOUS');
  const [trancheSelectedFund, setTrancheSelectedFund] = useState<FundType>('ANNIVERSAIRE');
  const [trancheSubCategory, setTrancheSubCategory] = useState<string>('Mariage');
  const [trancheFilterStatus, setTrancheFilterStatus] = useState<'TOUS' | 'SOLDE' | 'EN_COURS' | 'NON_ENTAME'>('TOUS');
  const [expandedMemberHistoryId, setExpandedMemberHistoryId] = useState<string | null>(null);

  // Trésorier: Formulaire de Création & Publication d'Événements Financiers (Sorties, Cas Sociaux)
  const [finEventFund, setFinEventFund] = useState<'LOISIRS' | 'CAS_SOCIAUX'>('LOISIRS');
  const [finEventTitle, setFinEventTitle] = useState<string>('');
  const [finEventDesc, setFinEventDesc] = useState<string>('');
  const [finEventAmountInput, setFinEventAmountInput] = useState<string>('');
  const [finEventDate, setFinEventDate] = useState<string>('');
  const [finEventDeadline, setFinEventDeadline] = useState<string>('');

  const [withFund, setWithFund] = useState<FundType>('COTISATION');
  const [withAmountInput, setWithAmountInput] = useState<string>('');
  const [withReason, setWithReason] = useState<string>('');
  const [withProofRef, setWithProofRef] = useState<string>('');

  const [bilanTitle, setBilanTitle] = useState<string>('');
  const [bilanPeriodMode, setBilanPeriodMode] = useState<'GLOBAL' | 'PERIODIC'>('GLOBAL');
  const [bilanStartDate, setBilanStartDate] = useState<string>('');
  const [bilanEndDate, setBilanEndDate] = useState<string>('');

  // 2. Secrétariat Forms
  const [pvTitle, setPvTitle] = useState<string>('');
  const [pvDate, setPvDate] = useState<string>('');
  const [pvStartTime, setPvStartTime] = useState<string>('');
  const [pvEndTime, setPvEndTime] = useState<string>('');
  const [pvAttendeesCount, setPvAttendeesCount] = useState<string>('');
  const [pvContent, setPvContent] = useState<string>('');

  // 3. COM Broadcast Form
  const [newsTitle, setNewsTitle] = useState<string>('');
  const [newsContent, setNewsContent] = useState<string>('');
  const [newsCategory, setNewsCategory] = useState<'ANNONCE' | 'RELANCE' | 'ALERTE' | 'AUTRE'>('ANNONCE');
  const [newsTarget, setNewsTarget] = useState<TargetAudience>('TOUS');
  const [comDispatchChannel, setComDispatchChannel] = useState<'APP' | 'MAIL' | 'GENERAL'>('APP');

  // 4. Cerveau Emergency Form & Credentials Management
  const [cerveauAlertTitle, setCerveauAlertTitle] = useState<string>('');
  const [cerveauAlertContent, setCerveauAlertContent] = useState<string>('');
  const [cerveauDispatchChannel, setCerveauDispatchChannel] = useState<'APP' | 'MAIL' | 'GENERAL'>('APP');
  const [isSendingEmail, setIsSendingEmail] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [emailModalData, setEmailModalData] = useState<{
    title: string;
    content: string;
    authorRole: string;
    channel: 'APP' | 'MAIL' | 'GENERAL';
    recipients: string[];
  } | null>(null);
  const [editingAdminRole, setEditingAdminRole] = useState<AdminRole | null>(null);
  const [editLoginId, setEditLoginId] = useState<string>('');
  const [editPin, setEditPin] = useState<string>('');

  // 5. Organisation Form
  const [actTitle, setActTitle] = useState<string>('');
  const [actDate, setActDate] = useState<string>('');
  const [actDesc, setActDesc] = useState<string>('');
  const [actProgram, setActProgram] = useState<string>('');
  const [actBudgetInput, setActBudgetInput] = useState<string>('');

  // 6. Projet Form
  const [projTitle, setProjTitle] = useState<string>('');
  const [projCategory, setProjCategory] = useState<string>('');
  const [projCostInput, setProjCostInput] = useState<string>('');
  const [projRequiredPerMember, setProjRequiredPerMember] = useState<string>('');
  const [projEventDate, setProjEventDate] = useState<string>('');
  const [projPaymentDeadline, setProjPaymentDeadline] = useState<string>('');
  const [projDesc, setProjDesc] = useState<string>('');
  const [projPilotTeam, setProjPilotTeam] = useState<string[]>([]);
  const [customPilotInput, setCustomPilotInput] = useState<string>('');

  // 7. Spiritualité Forms
  const [aelfData, setAelfData] = useState<AELFDayData | null>(null);
  const [isLoadingAelf, setIsLoadingAelf] = useState<boolean>(false);
  const [aelfTitle, setAelfTitle] = useState<string>('');
  const [aelfContent, setAelfContent] = useState<string>('');
  
  const defaultAutoVerse = getDailyVerseForDate(new Date());
  const [verseInput, setVerseInput] = useState<string>(verseOfTheDay?.verse || defaultAutoVerse.verse);
  const [verseRefInput, setVerseRefInput] = useState<string>(verseOfTheDay?.reference || defaultAutoVerse.reference);
  const [relEvtTitle, setRelEvtTitle] = useState<string>('');
  const [relEvtDate, setRelEvtDate] = useState<string>('');
  const [relEvtTime, setRelEvtTime] = useState<string>('');
  const [relEvtLocation, setRelEvtLocation] = useState<string>('');
  const [relEvtTheme, setRelEvtTheme] = useState<string>('');
  const [prayerText, setPrayerText] = useState<string>('');
  const [prayerMember, setPrayerMember] = useState<string>('');
  const [isPrayerChain, setIsPrayerChain] = useState<boolean>(false);

  const loadAelfReadings = async () => {
    setIsLoadingAelf(true);
    try {
      const data = await fetchAELFDailyReadings(new Date());
      setAelfData(data);
      if (data) {
        setAelfTitle(`[LITURGIE AELF] ${data.jour_liturgique_nom}`);
        setAelfContent(data.formattedFullText);
      }
    } catch (err) {
      console.error('Failed to load AELF readings:', err);
    } finally {
      setIsLoadingAelf(false);
    }
  };

  useEffect(() => {
    if (activeRole === 'SPIRITUALITE') {
      if (!aelfData) {
        loadAelfReadings();
      }
      if (!verseInput) {
        const autoVerse = getDailyVerseForDate(new Date());
        setVerseInput(autoVerse.verse);
        setVerseRefInput(autoVerse.reference);
      }
    }
  }, [activeRole]);

  const handleSpiritualPublish = async (
    title: string,
    content: string,
    channel: 'APP' | 'MAIL' | 'GENERAL'
  ) => {
    if (channel === 'APP') {
      publishNews(title, content, 'ANNONCE', 'TOUS', 'SPIRITUALITÉ', 'APP');
      setToastMessage("✝️ Publié avec succès sur l'Application E-ROUAMA !");
      setTimeout(() => setToastMessage(null), 4000);
    } else if (channel === 'MAIL') {
      setIsSendingEmail(true);
      const res = await sendEmailBroadcastAsync(title, content, members, 'SPIRITUALITÉ', 'MAIL');
      setIsSendingEmail(false);
      setEmailModalData({
        authorRole: 'DÉPARTEMENT SPIRITUALITÉ',
        title,
        content,
        recipients: res.recipients,
        channel: 'MAIL',
      });
    } else if (channel === 'GENERAL') {
      publishNews(title, content, 'ANNONCE', 'TOUS', 'SPIRITUALITÉ', 'GENERAL');
      setIsSendingEmail(true);
      const res = await sendEmailBroadcastAsync(title, content, members, 'SPIRITUALITÉ', 'GENERAL');
      setIsSendingEmail(false);
      setEmailModalData({
        authorRole: 'DÉPARTEMENT SPIRITUALITÉ',
        title,
        content,
        recipients: res.recipients,
        channel: 'GENERAL',
      });
    }
  };

  // Modal preview state for proof receipts
  const [previewDeclaration, setPreviewDeclaration] = useState<any | null>(null);

  // Total cash balance calculation
  const totalFundBalance = (Object.values(fundBalances) as number[]).reduce((a, b) => a + b, 0);

  // Generate & Download PDF AGR Project Handler
  const handleGeneratePDFProject = (proj: AgrProject) => {
    const printWin = window.open('', '_blank');
    if (!printWin) {
      alert('Veuillez autoriser les fenêtres surgissantes (popups) pour imprimer la fiche du projet.');
      return;
    }

    const teamList =
      proj.pilotTeam && proj.pilotTeam.length > 0
        ? proj.pilotTeam.map(m => `<li style="margin-bottom:6px;">👤 <strong>${m}</strong></li>`).join('')
        : '<li><em>Aucun membre désigné</em></li>';

    const statusText =
      proj.status === 'PUBLISHED' || proj.status === 'APPROVED_PAYOR'
        ? 'PROJET VALIDÉ & ACTIF'
        : 'EN COURS D\'INSTRUCTION / PENDING';

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="UTF-8">
        <title>PROJET AGR - ${proj.title}</title>
        <style>
          @page { size: A4; margin: 15mm; }
          body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1e293b; line-height: 1.5; margin: 0; padding: 20px; background: #fff; }
          .header { text-align: center; border-bottom: 3px double #d97706; padding-bottom: 15px; margin-bottom: 25px; }
          .header h1 { font-size: 18pt; color: #065f46; margin: 0 0 5px 0; text-transform: uppercase; font-weight: 800; }
          .header h2 { font-size: 12pt; color: #d97706; margin: 0 0 5px 0; font-weight: 700; }
          .header p { font-size: 9pt; color: #64748b; margin: 0; }
          .title-box { background: #fffbe0; border: 1.5px solid #f59e0b; border-radius: 8px; padding: 15px; text-align: center; margin-bottom: 20px; }
          .title-box h3 { margin: 0; font-size: 15pt; color: #92400e; font-weight: 800; text-transform: uppercase; }
          .status-badge { display: inline-block; background: #dcfce7; color: #166534; font-weight: bold; font-size: 9pt; padding: 4px 12px; border-radius: 12px; border: 1px solid #86efac; margin-top: 6px; }
          .meta-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 25px; background: #f8fafc; padding: 15px; border-radius: 8px; border-left: 4px solid #d97706; }
          .meta-item { font-size: 10pt; }
          .meta-label { font-weight: bold; color: #475569; text-transform: uppercase; font-size: 8pt; display: block; }
          .meta-value { font-weight: 700; color: #0f172a; }
          .section-title { font-size: 11pt; font-weight: 800; color: #065f46; text-transform: uppercase; border-bottom: 1.5px solid #065f46; padding-bottom: 4px; margin-top: 20px; margin-bottom: 12px; }
          .team-box { background: #f0fdf4; border: 1px solid #bbf7d0; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
          .team-box ul { margin: 5px 0 0 0; padding-left: 20px; color: #166534; font-size: 10pt; list-style-type: none; }
          .content-body { font-size: 10pt; color: #334155; white-space: pre-wrap; background: #fafafa; border: 1px solid #e2e8f0; padding: 15px; border-radius: 8px; min-height: 150px; }
          .signatures { margin-top: 40px; display: flex; justify-content: space-between; page-break-inside: avoid; }
          .sig-box { text-align: center; width: 45%; }
          .sig-title { font-size: 9pt; font-weight: bold; color: #475569; text-transform: uppercase; margin-bottom: 45px; }
          .sig-line { border-top: 1px solid #94a3b8; margin-top: 10px; font-size: 8pt; color: #64748b; }
          .footer { margin-top: 35px; text-align: center; font-size: 8pt; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 10px; }
        </style>
      </head>
      <body>
        <div class="header">
          <img src="/LOGOPRO.png" alt="Logo E-ROUAMA" style="height:55px; margin-bottom:8px; object-fit:contain;" />
          <h1>ASSOCIATION ÉLÈVES & ÉTUDIANTS ROUAMA (E-ROUAMA)</h1>
          <h2>COMMISSION PROJETS (AGR) & DIRECTION ADMINISTRATIVE</h2>
          <p>Dossier Officiel de Montage de Projet Générateur de Revenus</p>
        </div>

        <div class="title-box">
          <h3>${proj.title}</h3>
          <span class="status-badge">${statusText}</span>
        </div>

        <div class="meta-grid">
          <div class="meta-item">
            <span class="meta-label">🏷️ Catégorie du Projet</span>
            <span class="meta-value">${proj.category || 'Non spécifiée'}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">💰 Coût Estimé (Budget)</span>
            <span class="meta-value">${proj.estimatedCost.toLocaleString('fr-FR')} F CFA</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">📅 Date de Soumission</span>
            <span class="meta-value">${proj.date || 'Non spécifiée'}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">📜 Référence Officielle</span>
            <span class="meta-value">${proj.id}</span>
          </div>
        </div>

        <div class="section-title">👥 ÉQUIPE PILOTE (RESPONSABLES DU SUIVI)</div>
        <div class="team-box">
          <ul>${teamList}</ul>
        </div>

        <div class="section-title">📝 DESCRIPTION & MODÈLE ÉCONOMIQUE DE RENTABILITÉ</div>
        <div class="content-body">${proj.description}</div>

        <div class="signatures">
          <div class="sig-box">
            <div class="sig-title">La Commission Projets</div>
            <div class="sig-line">Signature & Date</div>
          </div>
          <div class="sig-box">
            <div class="sig-title">Le PAYOR / Direction</div>
            <div class="sig-line">Visa de Validation</div>
          </div>
        </div>

        <div class="footer">
          Document d'ingénierie projet généré via la plateforme E-ROUAMA • Édité le ${new Date().toLocaleString('fr-FR')}
        </div>

        <script>
          window.onload = function() {
            window.print();
          }
        </script>
      </body>
      </html>
    `;

    printWin.document.open();
    printWin.document.write(htmlContent);
    printWin.document.close();
  };

  // Generate & Download PDF Procès-Verbal Handler
  const handleGeneratePDFPV = (pv: any) => {
    const printWin = window.open('', '_blank');
    if (!printWin) {
      alert('Veuillez autoriser les fenêtres surgissantes (popups) pour imprimer le PDF du PV.');
      return;
    }

    const startTimeStr = pv.startTime ? pv.startTime : 'Non renseignée';
    const endTimeStr = pv.endTime ? pv.endTime : 'Non renseignée';
    const countStr =
      pv.attendeesCount !== undefined && pv.attendeesCount !== null && pv.attendeesCount !== ''
        ? `${pv.attendeesCount} personne(s)`
        : 'Non renseigné';

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="UTF-8">
        <title>PROCÈS-VERBAL - ${pv.title}</title>
        <style>
          @page { size: A4; margin: 15mm; }
          body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1e293b; line-height: 1.5; margin: 0; padding: 20px; background: #fff; }
          .header { text-align: center; border-bottom: 3px double #065f46; padding-bottom: 15px; margin-bottom: 25px; }
          .header h1 { font-size: 18pt; color: #065f46; margin: 0 0 5px 0; text-transform: uppercase; font-weight: 800; }
          .header h2 { font-size: 12pt; color: #d97706; margin: 0 0 5px 0; font-weight: 700; }
          .header p { font-size: 9pt; color: #64748b; margin: 0; }
          .pv-title-box { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 15px; text-align: center; margin-bottom: 20px; }
          .pv-title-box h3 { margin: 0; font-size: 14pt; color: #0f172a; font-weight: 800; text-transform: uppercase; }
          .meta-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 25px; background: #f1f5f9; padding: 15px; border-radius: 8px; border-left: 4px solid #065f46; }
          .meta-item { font-size: 10pt; }
          .meta-label { font-weight: bold; color: #475569; text-transform: uppercase; font-size: 8pt; display: block; }
          .meta-value { font-weight: 700; color: #0f172a; }
          .section-title { font-size: 11pt; font-weight: 800; color: #065f46; text-transform: uppercase; border-bottom: 1.5px solid #065f46; padding-bottom: 4px; margin-top: 20px; margin-bottom: 12px; }
          .content-body { font-size: 10pt; color: #334155; white-space: pre-wrap; background: #fafafa; border: 1px solid #e2e8f0; padding: 15px; border-radius: 8px; min-height: 200px; }
          .status-badge { display: inline-block; background: #dcfce7; color: #166534; font-weight: bold; font-size: 9pt; padding: 4px 10px; border-radius: 12px; border: 1px solid #86efac; margin-top: 5px; }
          .signatures { margin-top: 50px; display: flex; justify-content: space-between; page-break-inside: avoid; }
          .sig-box { text-align: center; width: 45%; }
          .sig-title { font-size: 9pt; font-weight: bold; color: #475569; text-transform: uppercase; margin-bottom: 50px; }
          .sig-line { border-top: 1px solid #94a3b8; margin-top: 10px; font-size: 8pt; color: #64748b; }
          .footer { margin-top: 40px; text-align: center; font-size: 8pt; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 10px; }
        </style>
      </head>
      <body>
        <div class="header">
          <img src="/LOGOPRO.png" alt="Logo E-ROUAMA" style="height:55px; margin-bottom:8px; object-fit:contain;" />
          <h1>ASSOCIATION ÉLÈVES & ÉTUDIANTS ROUAMA (E-ROUAMA)</h1>
          <h2>SECRÉTARIAT GÉNÉRAL & DIRECTION ADMINISTRATIVE</h2>
          <p>Document Officiel d'Archivage • Procès-Verbal de Réunion</p>
        </div>

        <div class="pv-title-box">
          <h3>${pv.title}</h3>
          <span class="status-badge">PROCÈS-VERBAL OFFICIEL</span>
        </div>

        <div class="meta-grid">
          <div class="meta-item">
            <span class="meta-label">📅 Date de la Réunion</span>
            <span class="meta-value">${pv.meetingDate || 'Non spécifiée'}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">⏱️ Horaires de Séance</span>
            <span class="meta-value">Début : ${startTimeStr} — Fin : ${endTimeStr}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">👥 Effectif / Participants</span>
            <span class="meta-value">${countStr}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">📜 Référence du Document</span>
            <span class="meta-value">${pv.id}</span>
          </div>
        </div>

        <div class="section-title">Ordre du Jour, Résolutions & Décisions Prises</div>
        <div class="content-body">${pv.content}</div>

        <div class="signatures">
          <div class="sig-box">
            <div class="sig-title">Le Secrétaire Général</div>
            <div class="sig-line">Signature & Cachet</div>
          </div>
          <div class="sig-box">
            <div class="sig-title">Le PAYOR / Commissariat aux Comptes</div>
            <div class="sig-line">Visa de Validation</div>
          </div>
        </div>

        <div class="footer">
          Généré via la plateforme administrative E-ROUAMA • Impressum : ${new Date().toLocaleString('fr-FR')}
        </div>

        <script>
          window.onload = function() {
            window.print();
          }
        </script>
      </body>
      </html>
    `;

    printWin.document.open();
    printWin.document.write(htmlContent);
    printWin.document.close();
  };

  // Reusable PDF Generator with Dual Sequential Signatures (SIMAHO.png & SIDEPO.png)
  const renderAndPrintBilanPDF = (bilan: FinancialBilan) => {
    const printWin = window.open('', '_blank');
    if (!printWin) {
      alert('Veuillez autoriser les fenêtres surgissantes (popups) pour imprimer et télécharger le Bilan PDF.');
      return;
    }

    const isApprovedByPayor = bilan.status === 'APPROVED_PAYOR';

    const filteredApprovedDeclarations = declarations.filter(d => d.status === 'APPROVED');
    const filteredApprovedWithdrawals = withdrawals.filter(w => w.status === 'APPROVED');

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="UTF-8">
        <title>${bilan.title}</title>
        <style>
          body { font-family: system-ui, -apple-system, sans-serif; padding: 40px; color: #1e293b; line-height: 1.5; }
          .header { text-align: center; border-bottom: 3px solid #e67e22; padding-bottom: 20px; margin-bottom: 30px; }
          .header h1 { color: #e67e22; margin: 0; font-size: 24px; font-weight: 900; }
          .header h2 { color: #0f172a; margin: 6px 0 0 0; font-size: 16px; font-weight: 800; }
          .header p { color: #355e3b; font-weight: bold; margin: 4px 0 0 0; font-style: italic; font-size: 13px; }
          .meta-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 15px 20px; margin-bottom: 25px; display: flex; justify-content: space-between; align-items: center; font-size: 13px; }
          .status-badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-weight: bold; font-size: 11px; }
          .status-pending { background: #fef3c7; color: #b45309; border: 1px solid #f59e0b; }
          .status-approved { background: #dcfce7; color: #15803d; border: 1px solid #22c55e; }
          .cards-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 25px; }
          .card { background: #fff; border: 1px solid #cbd5e1; border-radius: 12px; padding: 15px; text-align: center; }
          .card-title { font-size: 11px; font-weight: bold; color: #64748b; text-transform: uppercase; }
          .card-value { font-size: 20px; font-weight: 900; color: #0f172a; margin-top: 5px; }
          .sub-balances { margin-bottom: 30px; }
          .sub-balances-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; }
          .sub-card { background: #f1f5f9; padding: 10px; border-radius: 8px; text-align: center; border: 1px solid #e2e8f0; }
          .sub-card-title { font-size: 10px; font-weight: bold; color: #475569; }
          .sub-card-val { font-size: 13px; font-weight: 800; color: #166534; margin-top: 3px; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; margin-bottom: 25px; font-size: 12px; }
          th { background: #355e3b; color: #fff; text-align: left; padding: 10px; font-weight: bold; }
          td { padding: 9px 10px; border-bottom: 1px solid #e2e8f0; }
          tr:nth-child(even) { background: #f8fafc; }
          .section-title { font-size: 14px; font-weight: 800; color: #0f172a; margin-top: 25px; margin-bottom: 10px; border-left: 4px solid #e67e22; padding-left: 10px; }
          .signatures { margin-top: 45px; display: flex; justify-content: space-between; padding-top: 20px; border-top: 2px solid #cbd5e1; font-size: 12px; }
          .sig-block { text-align: center; width: 46%; background: #fafafa; border: 1px solid #e2e8f0; padding: 15px; border-radius: 12px; }
          .sig-title { font-weight: 800; text-transform: uppercase; color: #0f172a; margin-bottom: 8px; font-size: 12px; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px; }
          .sig-img-box { height: 70px; display: flex; align-items: center; justify-content: center; margin: 8px 0; }
          .sig-img { max-height: 65px; object-fit: contain; }
          .sig-date { font-size: 10px; color: #15803d; font-weight: bold; margin-top: 4px; }
          .watermark-box { height: 60px; border: 1.5px dashed #94a3b8; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #64748b; font-style: italic; font-size: 11px; background: #f1f5f9; width: 100%; }
          .footer-stamp { text-align: center; margin-top: 30px; font-size: 10px; color: #64748b; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; }
        </style>
      </head>
      <body>
        <div class="header">
          <img src="/LOGOPRO.png" alt="Logo E-ROUAMA" style="height:55px; margin-bottom:8px; object-fit:contain;" />
          <h1>ASSOCIATION FRATERNELLE E-ROUAMA</h1>
          <p>« DINIYO ROUAMA, chez nous la mesure de l'amour c'est d'aimer sans mesure »</p>
          <h2>${bilan.title}</h2>
        </div>

        <div class="meta-box">
          <div><strong>Période du Bilan :</strong> ${bilan.period}</div>
          <div><strong>Date d'Émission :</strong> ${bilan.date}</div>
          <div>
            <strong>Circuit de Signature :</strong> 
            <span class="status-badge ${isApprovedByPayor ? 'status-approved' : 'status-pending'}">
              ${isApprovedByPayor ? '🟢 Bi-Signé & Validé Payor' : '⏳ En attente de visa Payor'}
            </span>
          </div>
        </div>

        <div class="cards-grid">
          <div class="card">
            <div class="card-title">Solde Caisse Total</div>
            <div class="card-value" style="color:#166534;">${totalFundBalance.toLocaleString('fr-FR')} F CFA</div>
          </div>
          <div class="card">
            <div class="card-title">Entrées Validées</div>
            <div class="card-value" style="color:#0284c7;">${bilan.totalIn.toLocaleString('fr-FR')} F CFA</div>
          </div>
          <div class="card">
            <div class="card-title">Sorties Approuvées</div>
            <div class="card-value" style="color:#e11d48;">${bilan.totalOut.toLocaleString('fr-FR')} F CFA</div>
          </div>
        </div>

        <div class="sub-balances">
          <h3 style="font-size:12px; margin-bottom:8px; font-weight:bold;">Répartition des 5 Sous-Soldes par Caisse :</h3>
          <div class="sub-balances-grid">
            <div class="sub-card">
              <div class="sub-card-title">Cotisation Mensuelle</div>
              <div class="sub-card-val">${((bilan.balances && bilan.balances.COTISATION) || fundBalances.COTISATION || 0).toLocaleString('fr-FR')} F</div>
            </div>
            <div class="sub-card">
              <div class="sub-card-title">Anniversaire (21 Mars)</div>
              <div class="sub-card-val">${((bilan.balances && bilan.balances.ANNIVERSAIRE) || fundBalances.ANNIVERSAIRE || 0).toLocaleString('fr-FR')} F</div>
            </div>
            <div class="sub-card">
              <div class="sub-card-title">Sorties & Loisirs</div>
              <div class="sub-card-val">${((bilan.balances && bilan.balances.LOISIRS) || fundBalances.LOISIRS || 0).toLocaleString('fr-FR')} F</div>
            </div>
            <div class="sub-card">
              <div class="sub-card-title">Projets AGR</div>
              <div class="sub-card-val">${((bilan.balances && bilan.balances.AGR) || fundBalances.AGR || 0).toLocaleString('fr-FR')} F</div>
            </div>
            <div class="sub-card">
              <div class="sub-card-title">Cas Sociaux</div>
              <div class="sub-card-val">${((bilan.balances && bilan.balances.CAS_SOCIAUX) || fundBalances.CAS_SOCIAUX || 0).toLocaleString('fr-FR')} F</div>
            </div>
          </div>
        </div>

        <div class="section-title">1. Historique des Entrées Validées (Encaissements)</div>
        <table>
          <thead>
            <tr>
              <th>Membre</th>
              <th>Date</th>
              <th>Caisse Impactée</th>
              <th>Montant</th>
              <th>Référence / Preuve Wave</th>
            </tr>
          </thead>
          <tbody>
            ${
              filteredApprovedDeclarations.length === 0
                ? '<tr><td colspan="5" style="text-align:center;">Aucun encaissement validé enregistré.</td></tr>'
                : filteredApprovedDeclarations
                    .slice(0, 15)
                    .map(
                      d => `
                <tr>
                  <td><strong>${d.memberNickname}</strong></td>
                  <td>${d.date}</td>
                  <td>${FUND_LABELS[d.fund]}</td>
                  <td style="font-weight:bold; color:#166534;">+${d.amount.toLocaleString('fr-FR')} F CFA</td>
                  <td>${d.reference}</td>
                </tr>
              `
                    )
                    .join('')
            }
          </tbody>
        </table>

        <div class="section-title">2. Historique des Sorties Approuvées (Décaissements)</div>
        <table>
          <thead>
            <tr>
              <th>Motif du Retrait</th>
              <th>Date</th>
              <th>Caisse Prélevée</th>
              <th>Montant</th>
              <th>Valideur / Cerveau</th>
            </tr>
          </thead>
          <tbody>
            ${
              filteredApprovedWithdrawals.length === 0
                ? '<tr><td colspan="5" style="text-align:center;">Aucun décaissement approuvé enregistré.</td></tr>'
                : filteredApprovedWithdrawals
                    .slice(0, 15)
                    .map(
                      w => `
                <tr>
                  <td><strong>${w.reason}</strong></td>
                  <td>${w.date}</td>
                  <td>${FUND_LABELS[w.fund]}</td>
                  <td style="font-weight:bold; color:#e11d48;">-${w.amount.toLocaleString('fr-FR')} F CFA</td>
                  <td>${w.requestedBy} (Validé CERVEAU)</td>
                </tr>
              `
                    )
                    .join('')
            }
          </tbody>
        </table>

        <!-- CIRCUIT DE SIGNATURE DUAL (SIMAHO.png & SIDEPO.png) -->
        <div class="signatures">
          <!-- EMPLACEMENT 1 : TRÉSORIER GÉNÉRAL -->
          <div class="sig-block">
            <div class="sig-title">Le Trésorier Général</div>
            <div class="sig-img-box">
              <img src="/SIMAHO.png" alt="Signature Trésorier" class="sig-img" />
            </div>
            <div class="sig-date">✍️ Signé & Validé le ${bilan.treasurerSignatureDate || bilan.date}</div>
          </div>

          <!-- EMPLACEMENT 2 : LE PAYOR (AUDIT & ARBITRAGE) -->
          <div class="sig-block">
            <div class="sig-title">Le Payor (Audit & Sécurité)</div>
            <div class="sig-img-box">
              ${
                isApprovedByPayor
                  ? `<img src="/SIDEPO.png" alt="Signature Payor" class="sig-img" />`
                  : `<div class="watermark-box">En attente du visa Payor</div>`
              }
            </div>
            <div class="sig-date" style="color: ${isApprovedByPayor ? '#15803d' : '#64748b'};">
              ${isApprovedByPayor ? `🟢 Approuvé & Visé le ${bilan.payorSignatureDate || bilan.date}` : '⏳ Non visé (En attente)'}
            </div>
          </div>
        </div>

        <div class="footer-stamp">
          ${
            isApprovedByPayor
              ? '✅ DOCUMENT OFFICIEL BI-SIGNÉ (TRÉSORIER + PAYOR) • DÉFINITIF & NON MODIFIABLE'
              : '⚠️ DOCUMENT PRÉ-GÉNÉRÉ PAR LE TRÉSORIER • EN ATTENTE DE CONTRE-SIGNATURE PAYOR'
          }
        </div>

        <script>
          window.onload = function() {
            window.print();
          }
        </script>
      </body>
      </html>
    `;

    printWin.document.write(htmlContent);
    printWin.document.close();
  };

  // Generate & Download PDF Bilan Handler (Trésorier)
  const handleGeneratePDFBilan = () => {
    const periodLabel =
      bilanPeriodMode === 'GLOBAL'
        ? 'Bilan Global (Intégralité des données)'
        : bilanStartDate && bilanEndDate
        ? `Du ${bilanStartDate} au ${bilanEndDate}`
        : 'Période Sélectionnée';

    const title = bilanTitle.trim()
      ? bilanTitle
      : `Bilan Financier E-ROUAMA (${bilanPeriodMode === 'GLOBAL' ? 'Global' : 'Périodique'})`;

    // 1. Record Bilan in state with status 'PENDING_PAYOR' & Trésorier signature
    const newBilan = createFinancialBilan(title, periodLabel, '');

    // 2. Open PDF with Trésorier signature (SIMAHO.png) and Payor watermark
    renderAndPrintBilanPDF(newBilan);

    setToastMessage("✍️ Bilan Financier généré avec la signature SIMAHO.png et transmis au Payor pour visa !");
  };

  return (
    <div className="space-y-8 animate-fadeIn text-slate-100">
      {/* ========================================================= */}
      {/* COCKPIT HEADER - DARK SLATE PROFESSIONAL STYLE */}
      {/* ========================================================= */}
      <div className="bg-slate-900 border border-slate-800 rounded-[3rem] p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        {/* Glow backdrop */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 bg-[#E67E22] text-white px-3.5 py-1 rounded-full text-xs font-black tracking-wide shadow-md">
              <Shield className="w-4 h-4" />
              <span>CONSOLE MULTI-RÔLES ADMIN • COCKPIT DÉCISIONNEL</span>
            </div>

            <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight flex items-center gap-3">
              <span>
                {activeRole === 'TRESORIER' && 'TRÉSORERIE GÉNÉRALE'}
                {activeRole === 'CERVEAU' && 'LE CERVEAU (PRÉSIDENCE)'}
                {activeRole === 'PAYOR' && 'ESPACE PAYOR (AUDIT & CO-VALIDATION)'}
                {activeRole === 'SECRETARIAT' && 'SECRÉTARIAT GÉNÉRAL'}
                {activeRole === 'COM' && 'GUICHET UNIQUE COMMUNICATION (COM)'}
                {activeRole === 'ORGANISATION' && 'COMMISSION ORGANISATION'}
                {activeRole === 'PROJET' && 'COMMISSION PROJETS (AGR)'}
                {activeRole === 'SPIRITUALITE' && 'DÉPARTEMENT SPIRITUALITÉ'}
              </span>
            </h1>

            <p className="text-xs sm:text-sm text-slate-400 font-medium max-w-2xl">
              {ADMIN_USERS.find(a => a.id === activeRole)?.description}
            </p>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 1. ESPACE TRÉSORIER GÉNÉRAL */}
      {/* ========================================================= */}
      {activeRole === 'TRESORIER' && (
        <div className="space-y-8">
          {/* RBAC Lock Badge */}
          <RbacWarningBanner
            roleName="TRÉSORIER GÉNÉRAL"
            allowedActionsText="Validation des reçus, relances, décaissements, historique et bilans financiers PDF."
          />

          {/* ========================================================= */}
          {/* 1. HEADER DU SOLDE DE LA CAISSE TOTAL ET SOUS-SOLDES */}
          {/* ========================================================= */}
          <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-6 sm:p-8 shadow-2xl space-y-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
            
            {/* Grand Solde Caisse Total */}
            <div className="bg-gradient-to-r from-emerald-950/80 via-slate-900 to-slate-950 border border-emerald-500/30 rounded-3xl p-6 sm:p-8 shadow-inner flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-emerald-400">
                  <DollarSign className="w-4 h-4" />
                  <span>SOLDE CAISSE TOTAL (F CFA)</span>
                </div>
                <div className="text-3xl sm:text-5xl font-black text-emerald-400 tracking-tight mt-2">
                  {totalFundBalance.toLocaleString('fr-FR')} F CFA
                </div>
                <p className="text-xs text-slate-400 font-medium mt-1">
                  Trésorerie Globale consolidée de l'Association Fraternelle E-ROUAMA 2026
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="bg-slate-900/90 border border-slate-800 px-4 py-3 rounded-2xl text-center">
                  <span className="block text-[10px] font-bold text-slate-400 uppercase">Reçus en Attente</span>
                  <span className="text-lg font-black text-amber-400">
                    {declarations.filter(d => d.status === 'PENDING').length}
                  </span>
                </div>
                <div className="bg-slate-900/90 border border-slate-800 px-4 py-3 rounded-2xl text-center">
                  <span className="block text-[10px] font-bold text-slate-400 uppercase">Membres en Retard</span>
                  <span className="text-lg font-black text-rose-400">
                    {members.filter(m => getMemberDuesStatus(m.id) === 'RETARD').length} / {members.length}
                  </span>
                </div>
              </div>
            </div>

            {/* Cartes / Blocs Secondaires : 5 Sous-Soldes Caisse Spécifiques */}
            <div>
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <PieChart className="w-4 h-4 text-amber-400" />
                <span>Décomposition des 5 Sous-Soldes de Caisse</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                {/* Sous-Solde 1 : Cotisation Mensuelle */}
                <div className="bg-slate-950 border border-slate-800/80 rounded-2xl p-4 space-y-1 hover:border-emerald-500/40 transition-all">
                  <span className="text-[11px] font-bold text-slate-400 block truncate">
                    Cotisation Mensuelle
                  </span>
                  <p className="text-xl font-black text-emerald-400">
                    {(fundBalances.COTISATION || 0).toLocaleString('fr-FR')} <span className="text-xs font-bold text-slate-400">F CFA</span>
                  </p>
                  <span className="text-[10px] text-slate-500 block font-medium">Cotisations statutaires</span>
                </div>

                {/* Sous-Solde 2 : Célébration 21 mars (Anniversaire) */}
                <div className="bg-slate-950 border border-slate-800/80 rounded-2xl p-4 space-y-1 hover:border-amber-500/40 transition-all">
                  <span className="text-[11px] font-bold text-slate-400 block truncate">
                    Célébration 21 mars (Anniversaire)
                  </span>
                  <p className="text-xl font-black text-amber-400">
                    {(fundBalances.ANNIVERSAIRE || 0).toLocaleString('fr-FR')} <span className="text-xs font-bold text-slate-400">F CFA</span>
                  </p>
                  <span className="text-[10px] text-slate-500 block font-medium">Événementiel 21 Mars</span>
                </div>

                {/* Sous-Solde 3 : Sorties & Loisirs */}
                <div className="bg-slate-950 border border-slate-800/80 rounded-2xl p-4 space-y-1 hover:border-blue-500/40 transition-all">
                  <span className="text-[11px] font-bold text-slate-400 block truncate">
                    Sorties & Loisirs
                  </span>
                  <p className="text-xl font-black text-blue-400">
                    {(fundBalances.LOISIRS || 0).toLocaleString('fr-FR')} <span className="text-xs font-bold text-slate-400">F CFA</span>
                  </p>
                  <span className="text-[10px] text-slate-500 block font-medium">Activités récréatives</span>
                </div>

                {/* Sous-Solde 4 : Projets AGR */}
                <div className="bg-slate-950 border border-slate-800/80 rounded-2xl p-4 space-y-1 hover:border-purple-500/40 transition-all">
                  <span className="text-[11px] font-bold text-slate-400 block truncate">
                    Projets AGR
                  </span>
                  <p className="text-xl font-black text-purple-400">
                    {(fundBalances.AGR || 0).toLocaleString('fr-FR')} <span className="text-xs font-bold text-slate-400">F CFA</span>
                  </p>
                  <span className="text-[10px] text-slate-500 block font-medium">Investissements & AGR</span>
                </div>

                {/* Sous-Solde 5 : Cas Sociaux & Entraide */}
                <div className="bg-slate-950 border border-slate-800/80 rounded-2xl p-4 space-y-1 hover:border-rose-500/40 transition-all">
                  <span className="text-[11px] font-bold text-slate-400 block truncate">
                    Cas Sociaux & Entraide
                  </span>
                  <p className="text-xl font-black text-rose-400">
                    {(fundBalances.CAS_SOCIAUX || 0).toLocaleString('fr-FR')} <span className="text-xs font-bold text-slate-400">F CFA</span>
                  </p>
                  <span className="text-[10px] text-slate-500 block font-medium">Mariage, Naissances, Décès</span>
                </div>
              </div>
            </div>
          </div>

          {/* ========================================================= */}
          {/* STRUCTURE DES SECTIONS (BOUTONS CLIQUABLES ALIGNÉS) */}
          {/* ========================================================= */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-3 shadow-xl">
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
              <button
                type="button"
                onClick={() => setTresorierRubrique('VALIDATION')}
                className={`px-4 py-3 rounded-2xl font-black text-xs sm:text-sm transition-all whitespace-nowrap flex items-center gap-2 shrink-0 ${
                  tresorierRubrique === 'VALIDATION'
                    ? 'bg-[#E67E22] text-white shadow-lg border border-amber-300/30'
                    : 'bg-slate-950 text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <span>📥 VALIDATION REÇUS</span>
                {declarations.filter(d => d.status === 'PENDING').length > 0 && (
                  <span className="bg-amber-400 text-slate-950 px-2 py-0.5 rounded-full text-[10px] font-black">
                    {declarations.filter(d => d.status === 'PENDING').length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setTresorierRubrique('MENSUELLES')}
                className={`px-4 py-3 rounded-2xl font-black text-xs sm:text-sm transition-all whitespace-nowrap flex items-center gap-2 shrink-0 ${
                  tresorierRubrique === 'MENSUELLES'
                    ? 'bg-[#355E3B] text-white shadow-lg border border-emerald-400/50'
                    : 'bg-slate-950 text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Calendar className="w-4 h-4 text-emerald-400" />
                <span>📅 COTISATIONS MENSUELLES (500 F/MOIS)</span>
              </button>

              <button
                type="button"
                onClick={() => setTresorierRubrique('TRANCHES')}
                className={`px-4 py-3 rounded-2xl font-black text-xs sm:text-sm transition-all whitespace-nowrap flex items-center gap-2 shrink-0 ${
                  tresorierRubrique === 'TRANCHES'
                    ? 'bg-[#E67E22] text-white shadow-lg border border-amber-300/30'
                    : 'bg-slate-950 text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Coins className="w-4 h-4 text-amber-400" />
                <span>💰 SUIVI DES ACOMPTES (TRANCHES)</span>
              </button>

              <button
                type="button"
                onClick={() => setTresorierRubrique('EVENEMENTS')}
                className={`px-4 py-3 rounded-2xl font-black text-xs sm:text-sm transition-all whitespace-nowrap flex items-center gap-2 shrink-0 ${
                  tresorierRubrique === 'EVENEMENTS'
                    ? 'bg-[#E67E22] text-white shadow-lg border border-amber-300/30'
                    : 'bg-slate-950 text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Plus className="w-4 h-4 text-emerald-400" />
                <span>🎯 PUBLIER ÉVÉNEMENTS (SORTIES & CAS SOCIAUX)</span>
              </button>

              <button
                type="button"
                onClick={() => setTresorierRubrique('RELANCES')}
                className={`px-4 py-3 rounded-2xl font-black text-xs sm:text-sm transition-all whitespace-nowrap flex items-center gap-2 shrink-0 ${
                  tresorierRubrique === 'RELANCES'
                    ? 'bg-[#E67E22] text-white shadow-lg border border-amber-300/30'
                    : 'bg-slate-950 text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <span>📲 RELANCES WHATSAPP</span>
              </button>

              <button
                type="button"
                onClick={() => setTresorierRubrique('DECAISSEMENTS')}
                className={`px-4 py-3 rounded-2xl font-black text-xs sm:text-sm transition-all whitespace-nowrap flex items-center gap-2 shrink-0 ${
                  tresorierRubrique === 'DECAISSEMENTS'
                    ? 'bg-[#E67E22] text-white shadow-lg border border-amber-300/30'
                    : 'bg-slate-950 text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <span>💸 DÉCAISSEMENTS</span>
              </button>

              <button
                type="button"
                onClick={() => setTresorierRubrique('HISTORIQUE')}
                className={`px-4 py-3 rounded-2xl font-black text-xs sm:text-sm transition-all whitespace-nowrap flex items-center gap-2 shrink-0 ${
                  tresorierRubrique === 'HISTORIQUE'
                    ? 'bg-[#E67E22] text-white shadow-lg border border-amber-300/30'
                    : 'bg-slate-950 text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <span>📊 HISTORIQUE DES MOUVEMENTS</span>
              </button>

              <button
                type="button"
                onClick={() => setTresorierRubrique('BILAN')}
                className={`px-4 py-3 rounded-2xl font-black text-xs sm:text-sm transition-all whitespace-nowrap flex items-center gap-2 shrink-0 ${
                  tresorierRubrique === 'BILAN'
                    ? 'bg-[#E67E22] text-white shadow-lg border border-amber-300/30'
                    : 'bg-slate-950 text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <span>📄 GÉNÉRATION DU BILAN FINANCIER PDF</span>
              </button>
            </div>
          </div>

          {/* ========================================================= */}
          {/* RUBRIQUE 1 : VALIDATION REÇUS */}
          {/* ========================================================= */}
          {tresorierRubrique === 'VALIDATION' && (
            <div className="bg-slate-900 rounded-[2.5rem] p-6 sm:p-8 border border-slate-800 shadow-xl space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-black text-white flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-amber-500" />
                  <span>Validation des Reçus de Dépôt en Attente</span>
                </h2>
                <span className="bg-amber-500/20 text-amber-300 text-xs font-extrabold px-3 py-1 rounded-full border border-amber-500/30">
                  {declarations.filter(d => d.status === 'PENDING').length} à traiter
                </span>
              </div>

              {declarations.filter(d => d.status === 'PENDING').length === 0 ? (
                <div className="text-center py-12 bg-slate-950 rounded-2xl border border-dashed border-slate-800 text-slate-500 text-sm">
                  Aucune déclaration de dépôt en attente de validation.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-slate-300">
                    <thead>
                      <tr className="border-b border-slate-800 text-xs font-black text-slate-400 uppercase tracking-wider">
                        <th className="py-3 px-4">Membre</th>
                        <th className="py-3 px-4">Caisse & Type</th>
                        <th className="py-3 px-4">Montant Versé</th>
                        <th className="py-3 px-4">Impact Reste Dû</th>
                        <th className="py-3 px-4">Référence / Preuve</th>
                        <th className="py-3 px-4 text-right">Actions Trésorier</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-medium">
                      {declarations
                        .filter(d => d.status === 'PENDING')
                        .map(d => {
                          const progress = getMemberRubricProgress(d.memberId, d.fund, d.subCategory);
                          const remainingAfter = Math.max(0, progress.remainingDue - d.amount);
                          return (
                            <tr key={d.id} className="hover:bg-slate-800/40 transition-colors">
                              <td className="py-3 px-4">
                                <span className="font-extrabold text-white block">{d.memberNickname}</span>
                                <span className="text-[11px] text-slate-400 font-mono">{d.date}</span>
                              </td>
                              <td className="py-3 px-4">
                                <div className="font-bold text-amber-400">{FUND_LABELS[d.fund]}</div>
                                {d.subCategory && (
                                  <span className="text-[10px] text-slate-400 block">{d.subCategory}</span>
                                )}
                                <span
                                  className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-black ${
                                    d.paymentType === 'TOTAL'
                                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                  }`}
                                >
                                  {d.paymentType === 'TOTAL' ? 'Règlement Totalité' : 'Acompte par Tranche'}
                                </span>
                              </td>
                              <td className="py-3 px-4 font-black text-emerald-400 text-base font-mono">
                                {d.amount.toLocaleString('fr-FR')} F CFA
                              </td>
                              <td className="py-3 px-4 text-xs">
                                <div className="text-slate-400">
                                  Déjà payé : <strong className="text-emerald-400">{progress.totalAdvanced.toLocaleString('fr-FR')} F</strong>
                                </div>
                                <div className="text-amber-300 font-bold">
                                  Reste après validation : {remainingAfter.toLocaleString('fr-FR')} F CFA
                                </div>
                              </td>
                              <td className="py-3 px-4">
                                <button
                                  type="button"
                                  onClick={() => setPreviewDeclaration(d)}
                                  className="font-mono text-xs text-amber-300 underline hover:text-amber-200 flex items-center gap-1"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>{d.reference}</span>
                                </button>
                              </td>
                              <td className="py-3 px-4 text-right space-x-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    approvePayment(d.id);
                                  }}
                                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-black px-3.5 py-2 rounded-xl text-xs shadow inline-flex items-center gap-1 active:scale-95 transition-all"
                                >
                                  <CheckCircle2 className="w-4 h-4" /> Valider
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const reason = prompt('Motif du rejet du reçu :');
                                    if (reason) rejectPayment(d.id, reason);
                                  }}
                                  className="bg-rose-600 hover:bg-rose-500 text-white font-black px-3.5 py-2 rounded-xl text-xs shadow inline-flex items-center gap-1 active:scale-95 transition-all"
                                >
                                  <XCircle className="w-4 h-4" /> Rejeter
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ========================================================= */}
          {/* RUBRIQUE MENSUELLES : SUIVI DES COTISATIONS STATUTAIRES (500 F/MOIS) */}
          {/* ========================================================= */}
          {tresorierRubrique === 'MENSUELLES' && (() => {
            // Calculations for Monthly Dues
            const membersDues = members.map(m => {
              const status = getMemberDuesStatus(m.id);
              const detail = getMemberDuesDetail(m.id);
              return {
                member: m,
                status,
                detail,
                dueAmount: detail.unpaidMonths * 500,
                paidMonths: Math.floor(detail.totalPaid / 500),
              };
            });

            const totalMonthlyCollected = membersDues.reduce((sum, item) => sum + item.detail.totalPaid, 0);
            const totalMonthlyArrears = membersDues.reduce((sum, item) => sum + item.dueAmount, 0);
            const upToDateCount = membersDues.filter(item => item.status === 'A_JOUR' || item.status === 'EN_AVANCE').length;
            const lateCount = membersDues.filter(item => item.status === 'RETARD').length;
            const advanceCount = membersDues.filter(item => item.status === 'EN_AVANCE').length;
            const upToDateRate = Math.round((upToDateCount / members.length) * 100);

            const filteredMonthlyMembers = membersDues.filter(item => {
              if (monthlyFilterStatus === 'A_JOUR') return item.status === 'A_JOUR';
              if (monthlyFilterStatus === 'EN_AVANCE') return item.status === 'EN_AVANCE';
              if (monthlyFilterStatus === 'RETARD') return item.status === 'RETARD';
              return true;
            });

            return (
              <div className="bg-slate-900 rounded-[2.5rem] p-6 sm:p-8 border border-slate-800 shadow-xl space-y-6">
                {/* Header */}
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
                  <div>
                    <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2.5">
                      <Calendar className="w-6 h-6 text-emerald-400" />
                      <span>Suivi des Cotisations Mensuelles Statutaires (500 FCFA / mois)</span>
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-400 mt-1">
                      <strong>Règle statutaire :</strong> Montant fixe de 500 FCFA par mois. Ce montant ne change pas et ne suit pas le système de versement par tranches modulable. Chaque membre règle le montant exact exigé pour son ou ses mois.
                    </p>
                  </div>

                  <div className="bg-emerald-950/60 border border-emerald-500/30 px-4 py-2 rounded-2xl flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-xs font-black text-emerald-300">Synchronisé en temps réel</span>
                  </div>
                </div>

                {/* KPI Metrics */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-slate-950 p-4 rounded-2xl border border-emerald-900/40 space-y-1">
                    <p className="text-[10px] font-black uppercase text-emerald-400">Total Mensualités Encaissées</p>
                    <p className="text-xl sm:text-2xl font-black text-emerald-400 font-mono">
                      {totalMonthlyCollected.toLocaleString('fr-FR')} F
                    </p>
                    <p className="text-[10px] text-slate-400">
                      Soit {Math.floor(totalMonthlyCollected / 500)} mensualités validées
                    </p>
                  </div>

                  <div className="bg-slate-950 p-4 rounded-2xl border border-sky-900/40 space-y-2">
                    <div className="flex justify-between items-center text-[10px] font-black uppercase">
                      <span className="text-sky-400">Taux de Conformité</span>
                      <span className="text-white font-mono text-sm">{upToDateRate}%</span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${upToDateRate}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-emerald-400 font-bold">
                      {upToDateCount} / {members.length} membres à jour ou en avance
                    </p>
                  </div>

                  <div className="bg-slate-950 p-4 rounded-2xl border border-rose-900/40 space-y-1">
                    <p className="text-[10px] font-black uppercase text-rose-400">Total Arriérés Exigibles</p>
                    <p className="text-xl sm:text-2xl font-black text-rose-400 font-mono">
                      {totalMonthlyArrears.toLocaleString('fr-FR')} F
                    </p>
                    <p className="text-[10px] text-rose-300 font-bold">
                      {lateCount} membre(s) en retard
                    </p>
                  </div>

                  <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-1">
                    <p className="text-[10px] font-black uppercase text-slate-400">Tarif par Mois</p>
                    <p className="text-xl sm:text-2xl font-black text-white font-mono">500 F CFA</p>
                    <p className="text-[10px] text-slate-400">Montant fixe et non fractionnable</p>
                  </div>
                </div>

                {/* Filter Pills */}
                <div className="flex flex-wrap items-center gap-2 pt-2">
                  <span className="text-xs font-black text-slate-400 mr-1">Filtrer les membres :</span>
                  {[
                    { key: 'TOUS', label: `Tous les Membres (${members.length})` },
                    { key: 'A_JOUR', label: `À Jour (${membersDues.filter(i => i.status === 'A_JOUR').length})` },
                    { key: 'EN_AVANCE', label: `En Avance (${advanceCount})` },
                    { key: 'RETARD', label: `En Retard (${lateCount})` },
                  ].map(f => (
                    <button
                      type="button"
                      key={f.key}
                      onClick={() => setMonthlyFilterStatus(f.key as any)}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all ${
                        monthlyFilterStatus === f.key
                          ? 'bg-emerald-600 text-white shadow font-black'
                          : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                {/* Table of Members */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-slate-300">
                    <thead>
                      <tr className="border-b border-slate-800 text-xs font-black text-slate-400 uppercase tracking-wider">
                        <th className="py-3 px-4">Membre Rouama</th>
                        <th className="py-3 px-4">Mois Réglés (500 F/m)</th>
                        <th className="py-3 px-4">Statut Statutaire</th>
                        <th className="py-3 px-4">Arriéré Exigible</th>
                        <th className="py-3 px-4 text-right">Relance WhatsApp</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-medium">
                      {filteredMonthlyMembers.map(item => {
                        const isLate = item.status === 'RETARD';
                        const isAdvance = item.status === 'EN_AVANCE';
                        return (
                          <tr key={item.member.id} className="hover:bg-slate-800/40 transition-colors">
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-[#355E3B] text-white flex items-center justify-center font-black text-xs border border-emerald-400/40">
                                  {item.member.nickname.substring(0, 2).toUpperCase()}
                                </div>
                                <div>
                                  <span className="font-extrabold text-white block">
                                    {item.member.fullRosterName || item.member.firstName}
                                  </span>
                                  <span className="text-[11px] text-slate-400">
                                    @{item.member.nickname} • {item.member.phone || 'Sans tél.'}
                                  </span>
                                </div>
                              </div>
                            </td>

                            <td className="py-3 px-4">
                              <span className="font-mono font-black text-emerald-400 text-sm block">
                                {item.detail.totalPaid.toLocaleString('fr-FR')} F CFA
                              </span>
                              <span className="text-[11px] text-slate-400 font-medium">
                                {item.paidMonths} mois couverts
                              </span>
                            </td>

                            <td className="py-3 px-4">
                              <span
                                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                                  item.status === 'A_JOUR'
                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                    : isAdvance
                                    ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                }`}
                              >
                                {item.status === 'A_JOUR' && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
                                {isAdvance && <CheckCircle2 className="w-3 h-3 text-blue-400" />}
                                {isLate && <Clock className="w-3 h-3 text-rose-400" />}
                                <span>
                                  {item.status === 'A_JOUR'
                                    ? 'À JOUR (500 F/m)'
                                    : isAdvance
                                    ? 'EN AVANCE'
                                    : `RETARD (${item.detail.unpaidMonths} mois)`}
                                </span>
                              </span>
                            </td>

                            <td className="py-3 px-4">
                              {isLate ? (
                                <div>
                                  <span className="font-mono font-black text-rose-400 text-sm block">
                                    {item.dueAmount.toLocaleString('fr-FR')} F CFA
                                  </span>
                                  <span className="text-[11px] text-rose-300">
                                    {item.detail.unpaidMonths} mois × 500 F
                                  </span>
                                </div>
                              ) : (
                                <span className="text-emerald-400 font-mono text-xs font-bold">
                                  0 F CFA (En règle)
                                </span>
                              )}
                            </td>

                            <td className="py-3 px-4 text-right">
                              {isLate ? (
                                <a
                                  href={
                                    isWhatsAppRelanceActive
                                      ? `https://wa.me/${item.member.phone}?text=Bonjour%20${encodeURIComponent(
                                          item.member.nickname
                                        )},%20rappel%20fraternel%20E-ROUAMA%20pour%20vos%20cotisations%20mensuelles%20statutaires%20(500%20FCFA/mois).%20Vous%20avez%20actuellement%20${item.detail.unpaidMonths}%20mois%20en%20retard,%20soit%20un%20montant%20exact%20de%20${item.dueAmount.toLocaleString('fr-FR')}%20FCFA%20à%20régulariser%20via%20Wave.%20Merci%20pour%20votre%20engagement%20!`
                                      : '#'
                                  }
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={e => {
                                    if (!isWhatsAppRelanceActive) {
                                      e.preventDefault();
                                      alert(
                                        "Règle Temporelle : La fenêtre de relance WhatsApp est active uniquement du 28 du mois en cours au 04 du mois suivant (jusqu'à 23h59 GMT)."
                                      );
                                    }
                                  }}
                                  className={`inline-flex items-center gap-1.5 font-black px-3.5 py-1.5 rounded-xl text-xs shadow transition-all ${
                                    isWhatsAppRelanceActive
                                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white active:scale-95'
                                      : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                                  }`}
                                  title={
                                    isWhatsAppRelanceActive
                                      ? 'Envoyer rappel WhatsApp'
                                      : "Relances autorisées uniquement du 28 au 04 du mois"
                                  }
                                >
                                  <MessageSquare className="w-3.5 h-3.5" />
                                  <span>Relancer ({item.dueAmount.toLocaleString('fr-FR')} F)</span>
                                </a>
                              ) : (
                                <span className="text-slate-500 text-xs font-semibold">Aucune dette</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}

          {/* ========================================================= */}
          {/* RUBRIQUE TRANCHES : SUIVI DES ACOMPTES ET DU RECOUVREMENT */}
          {/* ========================================================= */}
          {tresorierRubrique === 'TRANCHES' && (() => {
            const summary = getAllMembersRubricSummary(
              trancheSelectedFund,
              trancheSelectedFund === 'CAS_SOCIAUX' ? trancheSubCategory : undefined
            );

            // Filter members according to trancheFilterStatus
            const filteredMembers = summary.membersSummary.filter(item => {
              if (trancheFilterStatus === 'SOLDE') return item.status === 'SOLDE';
              if (trancheFilterStatus === 'EN_COURS') return item.status === 'EN_COURS';
              if (trancheFilterStatus === 'NON_ENTAME') return item.status === 'NON_ENTAME';
              return true;
            });

            return (
              <div className="bg-slate-900 rounded-[2.5rem] p-6 sm:p-8 border border-slate-800 shadow-xl space-y-6">
                {/* Header & Subcategory selection */}
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
                  <div>
                    <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2.5">
                      <Coins className="w-6 h-6 text-[#E67E22]" />
                      <span>Suivi des Acomptes & Tranches (Anniversaires, Sorties, Cas Sociaux)</span>
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-400 mt-1">
                      Vue consolidée par membre : <strong>[Montant Total] | [Montant Avancé] | [Reste à Régler] | [Historique des transactions]</strong>. (Pour les cotisations mensuelles statutaires à 500 F/mois, consultez l'onglet dédié).
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-slate-400">Cotisation suivie :</span>
                    <select
                      value={trancheSelectedFund}
                      onChange={e => setTrancheSelectedFund(e.target.value as FundType)}
                      className="bg-slate-950 border border-slate-700 text-amber-400 text-xs font-black rounded-xl px-3 py-2 focus:outline-none focus:border-amber-400"
                    >
                      <option value="ANNIVERSAIRE">🎂 Anniversaire (10 000 F)</option>
                      <option value="LOISIRS">🏖️ Sorties & Loisirs (5 000 F)</option>
                      <option value="CAS_SOCIAUX">🤝 Cas Sociaux</option>
                      <option value="AGR">🌱 Projets AGR (Investissements)</option>
                    </select>
                  </div>
                </div>

                {/* Subcategory pills if CAS_SOCIAUX */}
                {trancheSelectedFund === 'CAS_SOCIAUX' && (
                  <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl flex flex-wrap items-center gap-2">
                    <span className="text-xs font-black text-slate-400 mr-2">Événement social :</span>
                    {[
                      { key: 'Mariage', label: "Mariage d'un membre (30 000 F CFA)" },
                      { key: 'Décès', label: 'Décès (5 000 F CFA)' },
                      { key: 'Naissance', label: 'Naissance (2 000 F CFA)' },
                    ].map(item => (
                      <button
                        type="button"
                        key={item.key}
                        onClick={() => setTrancheSubCategory(item.key)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all ${
                          trancheSubCategory === item.key
                            ? 'bg-amber-500 text-slate-950 shadow font-black'
                            : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                )}

                {/* KPI Metrics Banner */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-1">
                    <p className="text-[10px] font-black uppercase text-slate-500">Total Attendu Collectif</p>
                    <p className="text-xl sm:text-2xl font-black text-white font-mono">
                      {summary.totalRequired.toLocaleString('fr-FR')} F
                    </p>
                    <p className="text-[10px] text-slate-400">12 membres Rouama</p>
                  </div>

                  <div className="bg-slate-950 p-4 rounded-2xl border border-emerald-900/40 space-y-1">
                    <p className="text-[10px] font-black uppercase text-emerald-400">Total Cumulé Encaissé</p>
                    <p className="text-xl sm:text-2xl font-black text-emerald-400 font-mono">
                      {summary.totalAdvanced.toLocaleString('fr-FR')} F
                    </p>
                    <p className="text-[10px] text-emerald-500 font-bold">Versements validés</p>
                  </div>

                  <div className="bg-slate-950 p-4 rounded-2xl border border-amber-900/40 space-y-1">
                    <p className="text-[10px] font-black uppercase text-amber-400">Reste Total à Recouvrer</p>
                    <p className="text-xl sm:text-2xl font-black text-amber-400 font-mono">
                      {summary.totalRemaining.toLocaleString('fr-FR')} F
                    </p>
                    <p className="text-[10px] text-amber-500 font-bold">À solder</p>
                  </div>

                  <div className="bg-slate-950 p-4 rounded-2xl border border-sky-900/40 space-y-2">
                    <div className="flex justify-between items-center text-[10px] font-black uppercase">
                      <span className="text-sky-400">Taux de Recouvrement</span>
                      <span className="text-white font-mono text-sm">{summary.completionPercentage}%</span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-sky-500 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${summary.completionPercentage}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] font-bold text-slate-400">
                      <span className="text-emerald-400">{summary.settledCount} Soldé(s)</span>
                      <span className="text-blue-400">{summary.partialCount} En cours</span>
                      <span className="text-rose-400">{summary.notStartedCount} Non entamé(s)</span>
                    </div>
                  </div>
                </div>

                {/* Filter Tabs */}
                <div className="flex flex-wrap items-center gap-2 pt-2">
                  <span className="text-xs font-black text-slate-400 mr-1">Filtrer l'état :</span>
                  {[
                    { key: 'TOUS', label: `Tous les Membres (${summary.membersSummary.length})` },
                    { key: 'SOLDE', label: `Soldés (${summary.settledCount})` },
                    { key: 'EN_COURS', label: `En cours d'acompte (${summary.partialCount})` },
                    { key: 'NON_ENTAME', label: `Non entamés (${summary.notStartedCount})` },
                  ].map(f => (
                    <button
                      type="button"
                      key={f.key}
                      onClick={() => setTrancheFilterStatus(f.key as any)}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all ${
                        trancheFilterStatus === f.key
                          ? 'bg-amber-500 text-slate-950 shadow font-black'
                          : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                {/* Members Breakdown Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-slate-300">
                    <thead>
                      <tr className="border-b border-slate-800 text-xs font-black text-slate-400 uppercase tracking-wider">
                        <th className="py-3 px-4">Membre Rouama</th>
                        <th className="py-3 px-4">Montant Total</th>
                        <th className="py-3 px-4">Total Avancé</th>
                        <th className="py-3 px-4">Reste à Régler</th>
                        <th className="py-3 px-4">Statut & Avancement</th>
                        <th className="py-3 px-4 text-right">Historique des Tranches</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-medium">
                      {filteredMembers.map(item => {
                        const isExpanded = expandedMemberHistoryId === item.member.id;
                        const percentage = item.totalRequired > 0
                          ? Math.min(100, Math.round((item.totalAdvanced / item.totalRequired) * 100))
                          : 100;

                        return (
                          <React.Fragment key={item.member.id}>
                            <tr className="hover:bg-slate-800/40 transition-colors">
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-9 h-9 rounded-xl bg-[#355E3B] text-white flex items-center justify-center font-black text-xs border border-amber-400/40">
                                    {item.member.nickname.substring(0, 2).toUpperCase()}
                                  </div>
                                  <div>
                                    <span className="font-extrabold text-white block">
                                      {item.member.fullRosterName || item.member.firstName}
                                    </span>
                                    <span className="text-[11px] text-slate-400">@{item.member.nickname}</span>
                                  </div>
                                </div>
                              </td>

                              <td className="py-3 px-4 font-mono font-bold text-slate-300">
                                {item.totalRequired.toLocaleString('fr-FR')} F
                              </td>

                              <td className="py-3 px-4 font-mono font-black text-emerald-400 text-base">
                                {item.totalAdvanced.toLocaleString('fr-FR')} F
                              </td>

                              <td className="py-3 px-4 font-mono font-black text-amber-400 text-base">
                                {item.remainingDue.toLocaleString('fr-FR')} F CFA
                              </td>

                              <td className="py-3 px-4">
                                <div className="space-y-1.5 min-w-[130px]">
                                  <span
                                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                                      item.status === 'SOLDE'
                                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                        : item.status === 'EN_COURS'
                                        ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                    }`}
                                  >
                                    {item.status === 'SOLDE' && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
                                    {item.status === 'EN_COURS' && <Clock className="w-3 h-3 text-blue-400" />}
                                    <span>
                                      {item.status === 'SOLDE'
                                        ? 'Soldé'
                                        : item.status === 'EN_COURS'
                                        ? 'En cours'
                                        : 'Non entamé'}
                                    </span>
                                  </span>

                                  <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                                    <div
                                      className={`h-1.5 rounded-full ${
                                        item.status === 'SOLDE' ? 'bg-emerald-500' : 'bg-blue-500'
                                      }`}
                                      style={{ width: `${percentage}%` }}
                                    />
                                  </div>
                                </div>
                              </td>

                              <td className="py-3 px-4 text-right">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setExpandedMemberHistoryId(isExpanded ? null : item.member.id)
                                  }
                                  className="bg-slate-950 hover:bg-slate-800 border border-slate-700 text-amber-300 font-extrabold px-3 py-1.5 rounded-xl text-xs inline-flex items-center gap-1.5 transition-all"
                                >
                                  <span>{item.history.length} versement(s)</span>
                                  {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                </button>
                              </td>
                            </tr>

                            {/* Expanded installment breakdown for this member */}
                            {isExpanded && (
                              <tr>
                                <td colSpan={6} className="bg-slate-950/80 px-6 py-4 border-y border-slate-800">
                                  <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                      <h4 className="text-xs font-black text-amber-300 uppercase tracking-wide flex items-center gap-1.5">
                                        <Coins className="w-4 h-4 text-amber-400" />
                                        <span>Détail des tranches versées par {item.member.fullRosterName || item.member.nickname}</span>
                                      </h4>
                                      <span className="text-[11px] text-slate-400">
                                        Cumul validé : <strong className="text-emerald-400">{item.totalAdvanced.toLocaleString('fr-FR')} F CFA</strong>
                                      </span>
                                    </div>

                                    {item.history.length === 0 ? (
                                      <p className="text-xs text-slate-500 italic py-2">
                                        Aucun versement n'a encore été enregistré pour cette cotisation.
                                      </p>
                                    ) : (
                                      <div className="overflow-x-auto rounded-xl border border-slate-800">
                                        <table className="w-full text-left text-xs text-slate-300 bg-slate-900">
                                          <thead>
                                            <tr className="border-b border-slate-800 text-slate-400 font-black uppercase text-[10px]">
                                              <th className="py-2.5 px-3">Date</th>
                                              <th className="py-2.5 px-3">Modalité</th>
                                              <th className="py-2.5 px-3">Montant Versé</th>
                                              <th className="py-2.5 px-3">Référence / Preuve</th>
                                              <th className="py-2.5 px-3 text-right">Statut Validation</th>
                                            </tr>
                                          </thead>
                                          <tbody className="divide-y divide-slate-800 font-medium">
                                            {item.history.map(dec => (
                                              <tr key={dec.id} className="hover:bg-slate-800/30">
                                                <td className="py-2.5 px-3 font-mono text-slate-400">{dec.date}</td>
                                                <td className="py-2.5 px-3">
                                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                                                    {dec.paymentType === 'TOTAL' ? 'Totalité' : 'Acompte (Tranche)'}
                                                  </span>
                                                </td>
                                                <td className="py-2.5 px-3 font-mono font-black text-emerald-400 text-sm">
                                                  {dec.amount.toLocaleString('fr-FR')} F CFA
                                                </td>
                                                <td className="py-2.5 px-3 font-mono text-amber-300">
                                                  {dec.reference}
                                                </td>
                                                <td className="py-2.5 px-3 text-right">
                                                  <span
                                                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                                                      dec.status === 'APPROVED'
                                                        ? 'bg-emerald-500/20 text-emerald-300'
                                                        : dec.status === 'REJECTED'
                                                        ? 'bg-rose-500/20 text-rose-300'
                                                        : 'bg-amber-500/20 text-amber-300'
                                                    }`}
                                                  >
                                                    {dec.status === 'APPROVED' && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
                                                    {dec.status === 'PENDING' && <Clock className="w-3 h-3 text-amber-400" />}
                                                    <span>
                                                      {dec.status === 'APPROVED'
                                                        ? 'Validé'
                                                        : dec.status === 'REJECTED'
                                                        ? 'Rejeté'
                                                        : 'En attente'}
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
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}

          {/* ========================================================= */}
          {/* RUBRIQUE : GESTION & PUBLICATION ÉVÉNEMENTS (SORTIES & CAS SOCIAUX) */}
          {/* ========================================================= */}
          {tresorierRubrique === 'EVENEMENTS' && (
            <div className="space-y-8">
              {/* Formulaire de Publication */}
              <div className="bg-slate-900 rounded-[2.5rem] p-6 sm:p-8 border border-slate-800 shadow-xl space-y-6">
                <div className="border-b border-slate-800 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-black text-white flex items-center gap-2">
                      <Plus className="w-5 h-5 text-emerald-400" />
                      <span>Publication d'un Événement Financier (Sorties & Loisirs / Cas Sociaux)</span>
                    </h2>
                    <p className="text-xs text-slate-400 mt-1">
                      Créez et publiez les événements ou cas sociaux exigeant une cotisation. Dès publication, la rubrique devient instantanément active et accessible aux membres.
                    </p>
                  </div>
                  <span className="text-[11px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/30 px-3 py-1.5 rounded-xl self-start sm:self-auto">
                    Trésorier Général
                  </span>
                </div>

                <div className="space-y-4">
                  {/* Rubrique Choice */}
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-2">
                      1. Rubrique Concernée
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setFinEventFund('LOISIRS')}
                        className={`p-4 rounded-2xl border text-left flex items-center gap-3 transition-all ${
                          finEventFund === 'LOISIRS'
                            ? 'bg-blue-600/20 text-blue-300 border-blue-500 ring-2 ring-blue-500/40'
                            : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <span className="text-2xl">🏖️</span>
                        <div>
                          <strong className="block text-sm font-black text-white">Sorties & Loisirs</strong>
                          <span className="text-[11px] text-slate-400">Excursion, pique-nique, cohésion fraternelle</span>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setFinEventFund('CAS_SOCIAUX')}
                        className={`p-4 rounded-2xl border text-left flex items-center gap-3 transition-all ${
                          finEventFund === 'CAS_SOCIAUX'
                            ? 'bg-rose-600/20 text-rose-300 border-rose-500 ring-2 ring-rose-500/40'
                            : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <span className="text-2xl">🤝</span>
                        <div>
                          <strong className="block text-sm font-black text-white">Cas Sociaux</strong>
                          <span className="text-[11px] text-slate-400">Mariage, Naissance, Décès, Soutien fraternel</span>
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Title & Amount per member */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase mb-2">
                        2. Titre de l'Événement ou du Cas Social
                      </label>
                      <input
                        type="text"
                        placeholder={
                          finEventFund === 'LOISIRS'
                            ? 'Ex: Grande Sortie Détente Assinie 2027'
                            : 'Ex: Soutien Mariage Frère Jean & Sœur Marie'
                        }
                        value={finEventTitle}
                        onChange={e => setFinEventTitle(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-sm font-bold text-white focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase mb-2">
                        3. Montant Requis par Membre (F CFA)
                      </label>
                      <input
                        type="number"
                        placeholder={finEventFund === 'LOISIRS' ? 'Ex: 5000' : 'Ex: 30000'}
                        value={finEventAmountInput}
                        onChange={e => setFinEventAmountInput(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-sm font-bold text-white focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>

                  {/* Dates */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase mb-2">
                        4. Date de Réalisation / Événement
                      </label>
                      <input
                        type="date"
                        value={finEventDate}
                        onChange={e => setFinEventDate(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-sm font-bold text-white focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase mb-2">
                        5. Date Limite de Paiement des Cotisations
                      </label>
                      <input
                        type="date"
                        value={finEventDeadline}
                        onChange={e => setFinEventDeadline(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-sm font-bold text-white focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-2">
                      6. Description & Modalités
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Précisez le lieu, les dispositions pratiques et les conditions pour les membres..."
                      value={finEventDesc}
                      onChange={e => setFinEventDesc(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-sm font-medium text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  {/* Submit Button */}
                  <button
                    type="button"
                    onClick={() => {
                      if (!finEventTitle.trim()) {
                        alert('Veuillez renseigner le titre de l\'événement.');
                        return;
                      }
                      const amt = Number(finEventAmountInput);
                      if (!amt || amt <= 0) {
                        alert('Veuillez indiquer un montant requis par membre valide (ex: 5 000 F CFA).');
                        return;
                      }
                      if (!finEventDate.trim() || !finEventDeadline.trim()) {
                        alert('Veuillez spécifier la date de l\'événement et la date limite de paiement.');
                        return;
                      }

                      createFinancialEvent({
                        fund: finEventFund,
                        title: finEventTitle.trim(),
                        description: finEventDesc.trim(),
                        requiredAmountPerMember: amt,
                        eventDate: finEventDate,
                        paymentDeadline: finEventDeadline,
                        createdBy: 'TRÉSORIER GÉNÉRAL',
                      });

                      alert(`🔔 Événement "${finEventTitle}" publié avec succès ! La rubrique est désormais activée pour tous les membres.`);
                      setFinEventTitle('');
                      setFinEventDesc('');
                      setFinEventAmountInput('');
                      setFinEventDate('');
                      setFinEventDeadline('');
                    }}
                    className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-500 text-white font-black py-3.5 px-8 rounded-2xl shadow-lg text-sm flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
                  >
                    <Send className="w-4 h-4 text-emerald-200" />
                    <span>🔔 Publier Immédiatement & Ouvrir les Cotisations Membres</span>
                  </button>
                </div>
              </div>

              {/* État des Rubriques en Direct */}
              <div className="bg-slate-900 rounded-[2.5rem] p-6 sm:p-8 border border-slate-800 shadow-xl space-y-4">
                <h3 className="text-base font-black text-white flex items-center gap-2">
                  <Coins className="w-5 h-5 text-amber-500" />
                  <span>Statut en Temps Réel des Rubriques Cotisables (Espace Membre)</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Anniversaire */}
                  <div className="p-4 rounded-2xl bg-slate-950 border border-amber-500/30 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-amber-300">🎂 Anniversaire</span>
                      <span className="text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                        🟢 Toujours Actif
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 font-bold">21 Mars (Fixe annuel)</p>
                    <p className="text-[11px] text-amber-400 font-mono">10 000 F CFA / membre</p>
                  </div>

                  {/* Loisirs */}
                  {(() => {
                    const active = financialEvents?.find(e => e.fund === 'LOISIRS' && e.status === 'PUBLISHED');
                    return (
                      <div className={`p-4 rounded-2xl border space-y-2 ${
                        active
                          ? 'bg-slate-950 border-blue-500/40'
                          : 'bg-slate-950/50 border-slate-800 border-dashed opacity-75'
                      }`}>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-blue-300">🏖️ Sorties & Loisirs</span>
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                            active
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                              : 'bg-slate-800 text-slate-400 border-slate-700'
                          }`}>
                            {active ? '🟢 Actif' : '⚪ Grisé / Fermé'}
                          </span>
                        </div>
                        {active ? (
                          <>
                            <p className="text-xs text-white font-bold truncate">{active.title}</p>
                            <p className="text-[11px] text-blue-400 font-mono">
                              {active.requiredAmountPerMember.toLocaleString('fr-FR')} F CFA / membre
                            </p>
                          </>
                        ) : (
                          <p className="text-xs text-slate-500 italic">Aucune sortie programmée</p>
                        )}
                      </div>
                    );
                  })()}

                  {/* Cas Sociaux */}
                  {(() => {
                    const active = financialEvents?.find(e => e.fund === 'CAS_SOCIAUX' && e.status === 'PUBLISHED');
                    return (
                      <div className={`p-4 rounded-2xl border space-y-2 ${
                        active
                          ? 'bg-slate-950 border-rose-500/40'
                          : 'bg-slate-950/50 border-slate-800 border-dashed opacity-75'
                      }`}>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-rose-300">🤝 Cas Sociaux</span>
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                            active
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                              : 'bg-slate-800 text-slate-400 border-slate-700'
                          }`}>
                            {active ? '🟢 Actif' : '⚪ Grisé / Fermé'}
                          </span>
                        </div>
                        {active ? (
                          <>
                            <p className="text-xs text-white font-bold truncate">{active.title}</p>
                            <p className="text-[11px] text-rose-400 font-mono">
                              {active.requiredAmountPerMember.toLocaleString('fr-FR')} F CFA / membre
                            </p>
                          </>
                        ) : (
                          <p className="text-xs text-slate-500 italic">Aucun cas social en cours</p>
                        )}
                      </div>
                    );
                  })()}

                  {/* Projets AGR */}
                  {(() => {
                    const active = projects?.find(p => p.status === 'PUBLISHED');
                    return (
                      <div className={`p-4 rounded-2xl border space-y-2 ${
                        active
                          ? 'bg-slate-950 border-purple-500/40'
                          : 'bg-slate-950/50 border-slate-800 border-dashed opacity-75'
                      }`}>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-purple-300">🌱 Projets AGR</span>
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                            active
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                              : 'bg-slate-800 text-slate-400 border-slate-700'
                          }`}>
                            {active ? '🟢 Actif' : '⚪ Grisé / Fermé'}
                          </span>
                        </div>
                        {active ? (
                          <>
                            <p className="text-xs text-white font-bold truncate">{active.title}</p>
                            <p className="text-[11px] text-purple-400 font-mono">
                              {(active.requiredAmountPerMember || 0).toLocaleString('fr-FR')} F CFA / membre
                            </p>
                          </>
                        ) : (
                          <p className="text-xs text-slate-500 italic">Aucun projet AGR lancé</p>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Historique des Événements Créés */}
              <div className="bg-slate-900 rounded-[2.5rem] p-6 sm:p-8 border border-slate-800 shadow-xl space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-black text-white flex items-center gap-2">
                    <FileText className="w-5 h-5 text-amber-500" />
                    <span>Historique des Événements Financiers Créés ({financialEvents?.length || 0})</span>
                  </h3>
                </div>

                {(!financialEvents || financialEvents.length === 0) ? (
                  <div className="text-center py-8 text-slate-500 text-sm bg-slate-950 rounded-2xl border border-dashed border-slate-800">
                    Aucun événement financier créé pour le moment. Utilisez le formulaire ci-dessus pour publier une sortie ou un cas social.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {financialEvents.map(evt => {
                      const isPublished = evt.status === 'PUBLISHED';
                      return (
                        <div
                          key={evt.id}
                          className="bg-slate-950 p-5 rounded-2xl border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-xs"
                        >
                          <div className="space-y-2 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border ${
                                evt.fund === 'LOISIRS'
                                  ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                                  : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                              }`}>
                                {evt.fund === 'LOISIRS' ? '🏖️ SORTIES & LOISIRS' : '🤝 CAS SOCIAUX'}
                              </span>

                              <p className="font-extrabold text-white text-base">{evt.title}</p>

                              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border ${
                                isPublished
                                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                  : 'bg-slate-800 text-slate-400 border-slate-700'
                              }`}>
                                {isPublished ? '🟢 EN COURS / ACTIF (OUVERT AUX PAIEMENTS)' : '📦 ARCHIVÉ / CLÔTURÉ'}
                              </span>
                            </div>

                            <p className="text-slate-300 font-medium">
                              Montant requis par membre :{' '}
                              <strong className="text-amber-400 font-mono text-sm">
                                {evt.requiredAmountPerMember.toLocaleString('fr-FR')} F CFA
                              </strong>{' '}
                              • Date Réalisation : <strong className="text-white">{evt.eventDate}</strong> • Date Limite :{' '}
                              <strong className="text-rose-400">{evt.paymentDeadline}</strong>
                            </p>

                            {evt.description && (
                              <p className="text-slate-400 italic bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/60">
                                {evt.description}
                              </p>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-2 shrink-0">
                            {isPublished ? (
                              <button
                                type="button"
                                onClick={() => {
                                  if (window.confirm(`Voulez-vous clôturer / archiver l'événement "${evt.title}" ? La rubrique deviendra grisée dans l'espace membre.`)) {
                                    archiveFinancialEvent(evt.id);
                                    alert(`L'événement "${evt.title}" a été clôturé.`);
                                  }
                                }}
                                className="bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 font-bold px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-all text-xs cursor-pointer"
                              >
                                <Archive className="w-3.5 h-3.5" />
                                <span>Clôturer / Archiver</span>
                              </button>
                            ) : (
                              <span className="text-slate-500 font-bold text-xs bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800">
                                Événement Clôturé
                              </span>
                            )}

                            <button
                              type="button"
                              onClick={() => {
                                if (window.confirm(`Supprimer définitivement l'événement "${evt.title}" ?`)) {
                                  deleteFinancialEvent(evt.id);
                                }
                              }}
                              className="bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-900/50 font-bold px-3 py-2 rounded-xl flex items-center gap-1 transition-all text-xs cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Supprimer</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
          {/* ========================================================= */}
          {tresorierRubrique === 'RELANCES' && (
            <div className="bg-slate-900 rounded-[2.5rem] p-6 sm:p-8 border border-slate-800 shadow-xl space-y-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
                <div>
                  <h2 className="text-xl font-black text-white flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-emerald-400" />
                    <span>Tableau de Suivi des Dettes ({members.length} Membres) & Relances WhatsApp</span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Fenêtre de relance active du 28 du mois en cours au 04 du mois suivant (jusqu'à 23h59 GMT).
                  </p>
                </div>

                <div
                  className={`px-4 py-2 rounded-2xl font-black text-xs flex items-center gap-2 border ${
                    isWhatsAppRelanceActive
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                  }`}
                >
                  <Clock className="w-4 h-4" />
                  <span>
                    {isWhatsAppRelanceActive
                      ? 'RELANCES ACTIVÉES'
                      : `RELANCES DÉSACTIVÉES (Aujourd'hui : Jour ${currentDayOfMonth})`}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {members.map(m => {
                  const status = getMemberDuesStatus(m.id);
                  const detail = getMemberDuesDetail(m.id);
                  const isLate = status === 'RETARD';

                  return (
                    <div
                      key={m.id}
                      className="p-4 rounded-2xl border border-slate-800 bg-slate-950 flex items-center justify-between gap-3"
                    >
                      <div>
                        <p className="font-extrabold text-sm text-white">{m.nickname}</p>
                        <p className="text-[11px] text-slate-400 font-mono">{m.phone || 'Non renseigné'}</p>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span
                            className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                              status === 'A_JOUR'
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : status === 'EN_AVANCE'
                                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            }`}
                          >
                            {status === 'A_JOUR' ? 'À JOUR' : status === 'EN_AVANCE' ? 'EN AVANCE' : 'RETARD'}
                          </span>
                          {isLate && (
                            <span className="text-[10px] text-rose-300 font-bold">
                              ({detail.unpaidMonths} mois)
                            </span>
                          )}
                        </div>
                      </div>

                      <a
                        href={
                          isWhatsAppRelanceActive && isLate
                            ? `https://wa.me/${m.phone}?text=Bonjour%20${encodeURIComponent(
                                m.nickname
                              )},%20rappel%20fraternel%20E-ROUAMA%20pour%20la%20cotisation%20mensuelle%20(${detail.unpaidMonths}%20mois%20en%20retard).`
                            : '#'
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={e => {
                          if (!isWhatsAppRelanceActive || !isLate) {
                            e.preventDefault();
                            alert(
                              !isWhatsAppRelanceActive
                                ? "Règle Temporelle : La fenêtre de relance WhatsApp est active uniquement du 28 du mois en cours au 04 du mois suivant (jusqu'à 23h59 GMT)."
                                : 'Ce membre est à jour de ses cotisations.'
                            );
                          }
                        }}
                        className={`px-3 py-2 rounded-xl text-xs font-black flex items-center gap-1 transition-all ${
                          isWhatsAppRelanceActive && isLate
                            ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md active:scale-95'
                            : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                        }`}
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Relancer</span>
                      </a>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* RUBRIQUE 3 : DÉCAISSEMENTS */}
          {/* ========================================================= */}
          {tresorierRubrique === 'DECAISSEMENTS' && (
            <div className="bg-slate-900 rounded-[2.5rem] p-6 sm:p-8 border border-slate-800 shadow-xl space-y-6">
              <h2 className="text-xl font-black text-white flex items-center gap-2">
                <Lock className="w-5 h-5 text-amber-500" />
                <span>Formuler une Sortie de Caisse / Décaissement (Soumise au CERVEAU)</span>
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Caisse Source</label>
                  <select
                    value={withFund}
                    onChange={e => setWithFund(e.target.value as FundType)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-sm font-bold text-white focus:outline-none focus:border-amber-500"
                  >
                    {Object.entries(FUND_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Montant (F CFA)</label>
                  <input
                    type="number"
                    placeholder="Ex: 25000"
                    value={withAmountInput}
                    onChange={e => setWithAmountInput(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-sm font-bold text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Motif / Intitulé Dépense</label>
                  <input
                    type="text"
                    placeholder="Ex: Achat fournitures bureau"
                    value={withReason}
                    onChange={e => setWithReason(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-sm font-bold text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-2">N° Facture / Pièce (Optionnel)</label>
                  <input
                    type="text"
                    placeholder="Ex: FAC-2026-089"
                    value={withProofRef}
                    onChange={e => setWithProofRef(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-sm font-bold text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (!withReason.trim()) {
                    alert('Veuillez indiquer le motif du décaissement.');
                    return;
                  }
                  const amt = Number(withAmountInput) || 0;
                  if (amt <= 0) {
                    alert('Veuillez entrer un montant valide.');
                    return;
                  }
                  const reasonFull = withProofRef.trim() ? `${withReason} (Réf: ${withProofRef})` : withReason;
                  createWithdrawalRequest(withFund, amt, reasonFull);
                  alert('Demande de décaissement transmise au CERVEAU avec succès pour déverrouillage !');
                  setWithReason('');
                  setWithAmountInput('');
                  setWithProofRef('');
                }}
                className="bg-[#E67E22] hover:bg-[#D35400] text-white font-black py-3.5 px-6 rounded-2xl shadow-lg text-sm flex items-center gap-2 transition-all active:scale-95 cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>Transmettre la Demande au CERVEAU</span>
              </button>

              {/* Display existing withdrawal requests */}
              <div className="pt-4 border-t border-slate-800 space-y-3">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider">
                  Suivi des Demandes de Décaissement Soumises
                </h3>
                {withdrawals.length === 0 ? (
                  <p className="text-xs text-slate-500 italic">Aucune demande de décaissement soumise.</p>
                ) : (
                  <div className="space-y-2">
                    {withdrawals.map(w => (
                      <div key={w.id} className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex items-center justify-between text-xs">
                        <div>
                          <p className="font-bold text-white">{w.reason}</p>
                          <p className="text-slate-400">Caisse: {FUND_LABELS[w.fund]} • Date: {w.date}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-black text-rose-400 text-sm">{w.amount.toLocaleString('fr-FR')} F CFA</span>
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-black ${
                            w.status === 'APPROVED'
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : w.status === 'REJECTED'
                              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                              : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          }`}>
                            {w.status === 'APPROVED' ? '✅ Approuvé (Cerveau)' : w.status === 'REJECTED' ? '❌ Rejeté' : '⏳ En attente Cerveau'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* RUBRIQUE 4 : HISTORIQUE DES MOUVEMENTS */}
          {/* ========================================================= */}
          {tresorierRubrique === 'HISTORIQUE' && (
            <div className="space-y-6">
              {/* Bloc Entrées (Encaissements validés) */}
              <div className="bg-slate-900 rounded-[2.5rem] p-6 sm:p-8 border border-slate-800 shadow-xl space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-black text-white flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    <span>Bloc Entrées (Encaissements Validés)</span>
                  </h2>
                  <span className="bg-emerald-500/20 text-emerald-300 text-xs font-black px-3 py-1 rounded-full border border-emerald-500/30">
                    {declarations.filter(d => d.status === 'APPROVED').length} encaissements
                  </span>
                </div>

                {declarations.filter(d => d.status === 'APPROVED').length === 0 ? (
                  <div className="text-center py-10 bg-slate-950 rounded-2xl border border-dashed border-slate-800 text-slate-500 text-sm">
                    Aucun encaissement validé enregistré pour le moment.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-300">
                      <thead>
                        <tr className="border-b border-slate-800 text-xs font-black text-slate-400 uppercase tracking-wider">
                          <th className="py-3 px-4">Auteur du Paiement</th>
                          <th className="py-3 px-4">Date</th>
                          <th className="py-3 px-4">Caisse Impactée</th>
                          <th className="py-3 px-4">Montant (F CFA)</th>
                          <th className="py-3 px-4">Référence / Preuve Wave</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 font-medium">
                        {declarations
                          .filter(d => d.status === 'APPROVED')
                          .map(d => (
                            <tr key={d.id} className="hover:bg-slate-800/40 transition-colors">
                              <td className="py-3 px-4 font-extrabold text-white">{d.memberNickname}</td>
                              <td className="py-3 px-4 text-xs text-slate-400">{d.date}</td>
                              <td className="py-3 px-4 font-bold text-amber-400">{FUND_LABELS[d.fund]}</td>
                              <td className="py-3 px-4 font-black text-emerald-400 text-base">
                                +{d.amount.toLocaleString('fr-FR')} F CFA
                              </td>
                              <td className="py-3 px-4 font-mono text-xs text-amber-300">
                                {d.reference}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Bloc Sorties (Décaissements approuvés) */}
              <div className="bg-slate-900 rounded-[2.5rem] p-6 sm:p-8 border border-slate-800 shadow-xl space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-black text-white flex items-center gap-2">
                    <XCircle className="w-5 h-5 text-rose-400" />
                    <span>Bloc Sorties (Décaissements Approuvés par le CERVEAU)</span>
                  </h2>
                  <span className="bg-rose-500/20 text-rose-300 text-xs font-black px-3 py-1 rounded-full border border-rose-500/30">
                    {withdrawals.filter(w => w.status === 'APPROVED').length} décaissements
                  </span>
                </div>

                {withdrawals.filter(w => w.status === 'APPROVED').length === 0 ? (
                  <div className="text-center py-10 bg-slate-950 rounded-2xl border border-dashed border-slate-800 text-slate-500 text-sm">
                    Aucun décaissement approuvé enregistré pour le moment.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-300">
                      <thead>
                        <tr className="border-b border-slate-800 text-xs font-black text-slate-400 uppercase tracking-wider">
                          <th className="py-3 px-4">Motif du Retrait</th>
                          <th className="py-3 px-4">Date</th>
                          <th className="py-3 px-4">Caisse Prélevée</th>
                          <th className="py-3 px-4">Montant (F CFA)</th>
                          <th className="py-3 px-4">Valideur / Cerveau</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 font-medium">
                        {withdrawals
                          .filter(w => w.status === 'APPROVED')
                          .map(w => (
                            <tr key={w.id} className="hover:bg-slate-800/40 transition-colors">
                              <td className="py-3 px-4 font-extrabold text-white">{w.reason}</td>
                              <td className="py-3 px-4 text-xs text-slate-400">{w.date}</td>
                              <td className="py-3 px-4 font-bold text-amber-400">{FUND_LABELS[w.fund]}</td>
                              <td className="py-3 px-4 font-black text-rose-400 text-base">
                                -{w.amount.toLocaleString('fr-FR')} F CFA
                              </td>
                              <td className="py-3 px-4 font-bold text-emerald-300 text-xs">
                                🛡️ {w.requestedBy} (Validé CERVEAU)
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* RUBRIQUE 5 : GÉNÉRATION DU BILAN FINANCIER PDF */}
          {/* ========================================================= */}
          {tresorierRubrique === 'BILAN' && (
            <div className="bg-slate-900 rounded-[2.5rem] p-6 sm:p-8 border border-slate-800 shadow-xl space-y-6">
              <h2 className="text-xl font-black text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-amber-500" />
                <span>Génération du Bilan Financier PDF Officiel</span>
              </h2>

              <p className="text-xs text-slate-400 font-medium">
                Configurez la période du bilan pour exporter le rapport comptable certifié (Entrées, Sorties, Sous-soldes et Solde total).
              </p>

              {/* Sélection de la Période du Bilan (Interdiction de saisie textuelle - Radio buttons) */}
              <div className="bg-slate-950 p-5 rounded-3xl border border-slate-800 space-y-4">
                <label className="block text-xs font-black text-amber-400 uppercase tracking-wider">
                  1. Sélection de la Période du Bilan (Sélecteur Dynamique)
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Option A : Bilan Global */}
                  <label
                    onClick={() => setBilanPeriodMode('GLOBAL')}
                    className={`p-4 rounded-2xl border flex items-center gap-3 cursor-pointer transition-all ${
                      bilanPeriodMode === 'GLOBAL'
                        ? 'bg-amber-500/10 border-amber-500 text-white shadow-lg'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="bilanPeriodMode"
                      checked={bilanPeriodMode === 'GLOBAL'}
                      onChange={() => setBilanPeriodMode('GLOBAL')}
                      className="w-4 h-4 text-amber-500 focus:ring-amber-500"
                    />
                    <div>
                      <span className="font-extrabold text-sm block">Option A : Bilan Global</span>
                      <span className="text-[11px] text-slate-400 font-medium">
                        Prend en compte l'intégralité des données financières depuis la création.
                      </span>
                    </div>
                  </label>

                  {/* Option B : Bilan Périodique */}
                  <label
                    onClick={() => setBilanPeriodMode('PERIODIC')}
                    className={`p-4 rounded-2xl border flex items-center gap-3 cursor-pointer transition-all ${
                      bilanPeriodMode === 'PERIODIC'
                        ? 'bg-amber-500/10 border-amber-500 text-white shadow-lg'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="bilanPeriodMode"
                      checked={bilanPeriodMode === 'PERIODIC'}
                      onChange={() => setBilanPeriodMode('PERIODIC')}
                      className="w-4 h-4 text-amber-500 focus:ring-amber-500"
                    />
                    <div>
                      <span className="font-extrabold text-sm block">Option B : Bilan Périodique</span>
                      <span className="text-[11px] text-slate-400 font-medium">
                        Sélection par calendrier dynamique (Date Début & Date Fin).
                      </span>
                    </div>
                  </label>
                </div>

                {/* Datepickers for Option B */}
                {bilanPeriodMode === 'PERIODIC' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-800/80 animate-fadeIn">
                    <div>
                      <label className="block text-[11px] font-extrabold text-slate-300 uppercase mb-1">
                        📅 Date de Début (Datepicker)
                      </label>
                      <input
                        type="date"
                        value={bilanStartDate}
                        onChange={e => setBilanStartDate(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-2xl px-4 py-3 text-sm font-bold text-white focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-extrabold text-slate-300 uppercase mb-1">
                        📅 Date de Fin (Datepicker)
                      </label>
                      <input
                        type="date"
                        value={bilanEndDate}
                        onChange={e => setBilanEndDate(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-2xl px-4 py-3 text-sm font-bold text-white focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Titre du Bilan */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">
                  Titre du Bilan Financier (Optionnel)
                </label>
                <input
                  type="text"
                  placeholder="Ex: Bilan Financier Clôture Exercice 2026"
                  value={bilanTitle}
                  onChange={e => setBilanTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-sm font-bold text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Action de Génération PDF avec Signature SIMAHO.png */}
              <button
                type="button"
                onClick={handleGeneratePDFBilan}
                className="w-full bg-[#E67E22] hover:bg-[#D35400] text-white font-black py-4 px-6 rounded-2xl shadow-xl text-base flex items-center justify-center gap-3 transition-all active:scale-98 cursor-pointer"
              >
                <Printer className="w-5 h-5" />
                <span>✍️ GÉNÉRER ET TRANSMETTRE AU PAYOR</span>
              </button>

              {/* List of generated bilans & Payor approval status */}
              {bilans.length > 0 && (
                <div className="mt-6 pt-6 border-t border-slate-800 space-y-3">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider">
                    Historique des Bilans Générés & Statuts de Contre-Signature
                  </h3>

                  {bilans.map(b => (
                    <div
                      key={b.id}
                      className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="font-extrabold text-white text-sm">{b.title}</p>
                          {b.status === 'APPROVED_PAYOR' ? (
                            <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2.5 py-0.5 rounded-full text-[10px] font-bold">
                              🟢 Bi-Signé (SIMAHO + SIDEPO)
                            </span>
                          ) : (
                            <span className="bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2.5 py-0.5 rounded-full text-[10px] font-bold">
                              ⏳ En attente du visa Payor
                            </span>
                          )}
                        </div>
                        <p className="text-slate-400">
                          Période : {b.period} • Reçus: {b.totalIn.toLocaleString('fr-FR')} F • Dépenses: {b.totalOut.toLocaleString('fr-FR')} F
                        </p>
                        <p className="text-[10px] text-slate-500">
                          ✍️ Signé Trésorier (SIMAHO.png) le : {b.treasurerSignatureDate || b.date}
                          {b.payorSignatureDate && ` • 🟢 Visé Payor (SIDEPO.png) le : ${b.payorSignatureDate}`}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => renderAndPrintBilanPDF(b)}
                          className="bg-slate-800 hover:bg-slate-700 text-amber-400 font-bold px-3.5 py-2 rounded-xl flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>Voir PDF</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* 2. ESPACE COMMUNICATEUR / SECRÉTAIRE (COM) */}
      {/* ========================================================= */}
      {activeRole === 'COM' && (
        <div className="space-y-8">
          {/* RBAC Lock Badge */}
          <RbacWarningBanner
            roleName="CHARGÉ DE COMMUNICATION (COM)"
            allowedActionsText="Studio de diffusion d'annonces, accusé de réception (ACK) & publication officielle dans le fil."
          />

          {/* Guichet de Réception Bilans (Du Secrétariat) & Actions COM */}
          <div className="bg-slate-900 rounded-[2.5rem] p-6 sm:p-8 border border-slate-800 shadow-xl space-y-6">
            <h2 className="text-xl font-black text-white flex items-center gap-2">
              <Eye className="w-5 h-5 text-amber-500" />
              <span>Guichet de Réception Bilans (Du Secrétariat) & Actions COM</span>
            </h2>

            {bilans.filter(b => b.sentToCom).length === 0 ? (
              <div className="text-center py-10 bg-slate-950 rounded-2xl border border-dashed border-slate-800 text-slate-500 text-sm">
                Aucun bilan financier transmis par le Secrétariat Général pour le moment.
              </div>
            ) : (
              <div className="space-y-4">
                {bilans
                  .filter(b => b.sentToCom)
                  .map(b => (
                    <div
                      key={b.id}
                      className="bg-slate-950 p-5 rounded-2xl border border-slate-800 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 text-xs"
                    >
                      <div className="space-y-1 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-extrabold text-white text-base">{b.title}</p>
                          {b.ackByCom ? (
                            <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2.5 py-0.5 rounded-full text-[10px] font-black">
                              🟢 ACK Validé (Signal Secrétariat OK)
                            </span>
                          ) : (
                            <span className="bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2.5 py-0.5 rounded-full text-[10px] font-black animate-pulse">
                              ⏳ En attente de votre Accusé de Réception
                            </span>
                          )}
                          {b.publishedByCom && (
                            <span className="bg-blue-500/20 text-blue-400 border border-blue-500/30 px-2.5 py-0.5 rounded-full text-[10px] font-black">
                              📢 Diffusé aux 13 Membres
                            </span>
                          )}
                        </div>
                        <p className="text-slate-300 font-medium">
                          Période: <strong className="text-amber-400">{b.period}</strong> • Document bi-signé transmis par le Secrétariat Général.
                        </p>
                      </div>

                      {/* 3 BOUTONS D'ACTION COM STRICTEMENT DEMANDÉS */}
                      <div className="flex flex-wrap items-center gap-2 shrink-0 self-end lg:self-center">
                        {/* 1. Ouvrir / Consulter le fichier */}
                        <button
                          type="button"
                          onClick={() => renderAndPrintBilanPDF(b)}
                          className="bg-slate-800 hover:bg-slate-700 text-amber-400 font-extrabold px-3.5 py-2.5 rounded-xl border border-slate-700 flex items-center gap-1.5 transition-all active:scale-95 text-xs cursor-pointer"
                          title="Prévisualiser et télécharger le PDF Bi-Signé"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>📄 Ouvrir / Consulter le fichier</span>
                        </button>

                        {/* 2. Accuser Réception */}
                        {!b.ackByCom ? (
                          <button
                            type="button"
                            onClick={() => {
                              ackBilanCOM(b.id);
                              setToastMessage("📥 Accusé de réception (ACK) transmis au Secrétariat ! Bouton Archiver débloqué.");
                            }}
                            className="bg-amber-600 hover:bg-amber-500 text-white font-black px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 shadow-lg active:scale-95 transition-all text-xs cursor-pointer"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 text-amber-200" />
                            <span>📥 Accuser Réception</span>
                          </button>
                        ) : (
                          <span className="bg-emerald-500/10 text-emerald-400 font-bold px-3 py-2 rounded-xl border border-emerald-500/20 text-xs flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>ACK Transmis</span>
                          </span>
                        )}

                        {/* 3. Publier aux Membres */}
                        <button
                          type="button"
                          onClick={() => {
                            publishBilanNewsCOM(b.id);
                            setToastMessage("📢 Bilan Financier Officiel diffusé sur le Fil des Nouvelles des 13 membres !");
                          }}
                          className={`font-black px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 shadow-lg transition-all text-xs cursor-pointer ${
                            b.publishedByCom
                              ? 'bg-blue-700 hover:bg-blue-600 text-white'
                              : 'bg-emerald-600 hover:bg-emerald-500 text-white active:scale-95'
                          }`}
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>{b.publishedByCom ? '📢 Ré-Annoncer aux Membres' : '📢 Publier aux Membres'}</span>
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* Broadcast Studio Form */}
          <div className="bg-slate-900 rounded-[2.5rem] p-6 sm:p-8 border border-slate-800 shadow-xl space-y-6">
            <h2 className="text-xl font-black text-white flex items-center gap-2">
              <Send className="w-5 h-5 text-amber-500" />
              <span>Studio de Publication d'Annonces & Communiqués Officiels</span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Titre du Communiqué</label>
                <input
                  type="text"
                  placeholder="Ex: Convocation Assemblée Générale"
                  value={newsTitle}
                  onChange={e => setNewsTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-sm font-bold text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Catégorie</label>
                <select
                  value={newsCategory}
                  onChange={e => setNewsCategory(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-sm font-bold text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="ANNONCE">ANNONCE OFFICIELLE</option>
                  <option value="RELANCE">RELANCE COTISATION</option>
                  <option value="ALERTE">ALERTE URGENTE</option>
                  <option value="AUTRE">DIVERS</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Ciblage Automatique</label>
                <select
                  value={newsTarget}
                  onChange={e => setNewsTarget(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-sm font-bold text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="TOUS">Tous les Membres</option>
                  <option value="RETARD">Membres en RETARD</option>
                  <option value="A_JOUR">Membres À JOUR</option>
                  <option value="EN_AVANCE">Membres EN AVANCE</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Message du Communiqué</label>
              <textarea
                rows={4}
                placeholder="Rédigez le texte officiel du message..."
                value={newsContent}
                onChange={e => setNewsContent(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-sm font-medium text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* 3 Dispatch Channel Options Selector */}
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-2">
                Canal de Diffusion (3 Options)
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setComDispatchChannel('APP')}
                  className={`py-3 px-4 rounded-2xl border text-xs font-black transition-all flex items-center justify-center gap-2 ${
                    comDispatchChannel === 'APP'
                      ? 'bg-[#E67E22] border-amber-500 text-white shadow-lg'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <span>📲</span>
                  <span>PUBLIER DANS L'APP</span>
                </button>

                <button
                  type="button"
                  onClick={() => setComDispatchChannel('MAIL')}
                  className={`py-3 px-4 rounded-2xl border text-xs font-black transition-all flex items-center justify-center gap-2 ${
                    comDispatchChannel === 'MAIL'
                      ? 'bg-[#E67E22] border-amber-500 text-white shadow-lg'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <span>✉️</span>
                  <span>PUBLIER VIA MAIL</span>
                </button>

                <button
                  type="button"
                  onClick={() => setComDispatchChannel('GENERAL')}
                  className={`py-3 px-4 rounded-2xl border text-xs font-black transition-all flex items-center justify-center gap-2 ${
                    comDispatchChannel === 'GENERAL'
                      ? 'bg-[#E67E22] border-amber-500 text-white shadow-lg'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <span>🌐</span>
                  <span>ENVOI GÉNÉRAL (APP + MAIL)</span>
                </button>
              </div>
            </div>

            <button
              disabled={isSendingEmail}
              onClick={async () => {
                if (!newsTitle.trim() || !newsContent.trim()) {
                  alert('Veuillez renseigner le titre et le contenu du communiqué.');
                  return;
                }

                const validEmails = members.filter(m => m.email).map(m => m.email!);

                if (comDispatchChannel === 'MAIL' || comDispatchChannel === 'GENERAL') {
                  setIsSendingEmail(true);
                  await sendEmailBroadcastAsync(newsTitle, newsContent, members, 'COMMISSION COMMUNICATION (COM)', comDispatchChannel);
                  publishNews(newsTitle, newsContent, newsCategory, newsTarget, 'COM', comDispatchChannel);
                  setIsSendingEmail(false);

                  setToastMessage("✉️ Email envoyé automatiquement avec succès aux membres !");
                  setTimeout(() => setToastMessage(null), 5000);

                  setEmailModalData({
                    title: newsTitle,
                    content: newsContent,
                    authorRole: 'COMMISSION COMMUNICATION (COM)',
                    channel: comDispatchChannel,
                    recipients: validEmails,
                  });
                } else {
                  publishNews(newsTitle, newsContent, newsCategory, newsTarget, 'COM', comDispatchChannel);
                  setToastMessage("Annonce publiée dans l'application avec succès !");
                  setTimeout(() => setToastMessage(null), 4000);
                }

                setNewsTitle('');
                setNewsContent('');
              }}
              className="bg-[#E67E22] hover:bg-[#D35400] text-white font-black py-3.5 px-6 rounded-2xl shadow-lg text-sm flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {isSendingEmail ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Envoi automatique des emails en cours...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Diffuser l'Annonce dans le Fil</span>
                </>
              )}
            </button>
          </div>

          {/* Manage Published Announcements (Edit / Delete) */}
          <div className="bg-slate-900 rounded-[2.5rem] p-6 sm:p-8 border border-slate-800 shadow-xl space-y-6">
            <h2 className="text-xl font-black text-white flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-amber-500" />
              <span>Gestion & Suppression des Communiqués Publiés</span>
            </h2>

            {newsItems.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-sm">
                Aucun communiqué publié dans le fil.
              </div>
            ) : (
              <div className="space-y-3">
                {newsItems.map(item => (
                  <div
                    key={item.id}
                    className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-4 text-xs"
                  >
                    <div>
                      <span className="font-extrabold text-white text-sm">{item.title}</span>
                      <p className="text-slate-400 text-xs mt-0.5">{item.date} • Auteur: {item.authorRole} • Cible: {item.targetAudience}</p>
                    </div>

                    <button
                      onClick={() => {
                        if (confirm(`Voulez-vous vraiment supprimer le communiqué "${item.title}" ?`)) {
                          deleteNewsItem(item.id);
                        }
                      }}
                      className="bg-rose-600/20 text-rose-300 hover:bg-rose-600 hover:text-white border border-rose-500/30 px-3 py-1.5 rounded-xl font-black flex items-center gap-1 transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Supprimer</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 3. ESPACE SECRÉTARIAT GÉNÉRAL */}
      {/* ========================================================= */}
      {activeRole === 'SECRETARIAT' && (
        <div className="space-y-8">
          {/* RBAC Lock Badge */}
          <RbacWarningBanner
            roleName="SECRÉTARIAT GÉNÉRAL"
            allowedActionsText="Rédaction des Procès-Verbaux (PV), gestion des archives et transmissions officielles."
          />

          {/* Draft PV Form */}
          <div className="bg-slate-900 rounded-[2.5rem] p-6 sm:p-8 border border-slate-800 shadow-xl space-y-6">
            <h2 className="text-xl font-black text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-amber-500" />
              <span>Rédaction des Procès-Verbaux (PV)</span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2">
                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Titre de la Séance</label>
                <input
                  type="text"
                  placeholder="Ex: PV Assemblée Ordinaire du 28 Juillet 2026"
                  value={pvTitle}
                  onChange={e => setPvTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-sm font-bold text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Date de la Réunion</label>
                <input
                  type="date"
                  value={pvDate}
                  onChange={e => setPvDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-sm font-bold text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-2 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-500" />
                  <span>Heure de Début</span>
                </label>
                <input
                  type="time"
                  value={pvStartTime}
                  onChange={e => setPvStartTime(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-sm font-bold text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-2 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-500" />
                  <span>Heure de Fin</span>
                </label>
                <input
                  type="time"
                  value={pvEndTime}
                  onChange={e => setPvEndTime(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-sm font-bold text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-2 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-amber-500" />
                  <span>Nombre de personnes</span>
                </label>
                <input
                  type="number"
                  min={1}
                  placeholder="Ex: 15"
                  value={pvAttendeesCount}
                  onChange={e => setPvAttendeesCount(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-sm font-bold text-white focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Contenu du PV / Ordre du jour & Décisions</label>
              <textarea
                rows={5}
                placeholder="Rédigez l'ordre du jour, les points traités et les décisions prises lors de la séance..."
                value={pvContent}
                onChange={e => setPvContent(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-sm font-medium text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
              <button
                type="button"
                onClick={() => {
                  if (!pvTitle.trim() || !pvContent.trim()) {
                    alert('Veuillez renseigner au moins le titre et le contenu du PV.');
                    return;
                  }
                  createSecretaryPV({
                    title: pvTitle,
                    meetingDate: pvDate || new Date().toISOString().split('T')[0],
                    startTime: pvStartTime,
                    endTime: pvEndTime,
                    attendeesCount: pvAttendeesCount ? Number(pvAttendeesCount) : undefined,
                    content: pvContent,
                    attendance: members.map(m => ({ memberId: m.id, present: true })),
                  });
                  alert('PV rédigé et transmis au PAYOR pour validation administrative !');
                  setPvTitle('');
                  setPvDate('');
                  setPvStartTime('');
                  setPvEndTime('');
                  setPvAttendeesCount('');
                  setPvContent('');
                }}
                className="w-full sm:w-auto bg-[#E67E22] hover:bg-[#D35400] text-white font-black py-3.5 px-6 rounded-2xl shadow-lg text-sm flex items-center justify-center gap-2 transition-all active:scale-95"
              >
                <Send className="w-4 h-4" />
                <span>Transmettre au PAYOR</span>
              </button>
            </div>

            {/* Sub-section: Historique des PVs */}
            {pvs.length > 0 && (
              <div className="pt-6 border-t border-slate-800 space-y-4">
                <h3 className="text-xs font-black text-slate-400 uppercase flex items-center gap-2">
                  <FileText className="w-4 h-4 text-amber-500" />
                  <span>Historique des PV Rédigés ({pvs.length})</span>
                </h3>
                <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                  {pvs.map(p => (
                    <div key={p.id} className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-white text-sm">{p.title}</span>
                          <span className={`px-2 py-0.5 text-[10px] font-black rounded-full border ${
                            p.status === 'APPROVED_PAYOR' || p.status === 'ARCHIVED'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                          }`}>
                            {p.status === 'APPROVED_PAYOR' || p.status === 'ARCHIVED' ? 'Validé PAYOR' : 'En attente PAYOR'}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-slate-400">
                          <span>📅 Réunion du : {p.meetingDate || 'Non spécifiée'}</span>
                          {(p.startTime || p.endTime) && (
                            <span>⏱️ Horaires : {p.startTime || '--:--'} à {p.endTime || '--:--'}</span>
                          )}
                          {p.attendeesCount !== undefined && p.attendeesCount !== null && (
                            <span>👥 Participants : {p.attendeesCount} pers.</span>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleGeneratePDFPV(p)}
                        className="bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 font-bold px-3 py-2 rounded-xl flex items-center gap-1.5 transition-all self-end sm:self-auto"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>PDF / Imprimer</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Received Bilans & Sequential Transmission (COM & Archiving) */}
          <div className="bg-slate-900 rounded-[2.5rem] p-6 sm:p-8 border border-slate-800 shadow-xl space-y-6">
            <h2 className="text-xl font-black text-white flex items-center gap-2">
              <Archive className="w-5 h-5 text-amber-500" />
              <span>Réception Bilans (Payor / Trésorier) & Transmission Séquentielle</span>
            </h2>

            {bilans.filter(b => b.sentToSecretariat).length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-sm bg-slate-950 rounded-2xl border border-dashed border-slate-800">
                Aucun bilan reçu du Payor / Trésorier pour le moment.
              </div>
            ) : (
              <div className="space-y-4">
                {bilans
                  .filter(b => b.sentToSecretariat)
                  .map(b => (
                    <div
                      key={b.id}
                      className="bg-slate-950 p-5 rounded-2xl border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-xs"
                    >
                      <div className="space-y-1 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-extrabold text-white text-base">{b.title}</p>
                          <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2.5 py-0.5 rounded-full text-[10px] font-black">
                            🟢 Bi-Signé Payor
                          </span>
                          {b.ackByCom ? (
                            <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2.5 py-0.5 rounded-full text-[10px] font-black">
                              🟢 Accusé de réception COM validé
                            </span>
                          ) : (
                            <span className="bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2.5 py-0.5 rounded-full text-[10px] font-bold">
                              ⏳ En attente de l'accusé de réception de la COM
                            </span>
                          )}
                        </div>
                        <p className="text-slate-400">
                          Période: <strong className="text-amber-400">{b.period}</strong> • Reçus: <strong className="text-emerald-400">{b.totalIn.toLocaleString('fr-FR')} F</strong> • Dépenses: <strong className="text-rose-400">{b.totalOut.toLocaleString('fr-FR')} F</strong>
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        {/* Consulter PDF */}
                        <button
                          type="button"
                          onClick={() => renderAndPrintBilanPDF(b)}
                          className="bg-slate-800 hover:bg-slate-700 text-amber-400 font-extrabold px-3.5 py-2.5 rounded-xl border border-slate-700 flex items-center gap-1.5 transition-all active:scale-95 text-xs cursor-pointer"
                          title="Prévisualiser le PDF"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>PDF</span>
                        </button>

                        {/* 1. Transmettre à la COM */}
                        {!b.sentToCom ? (
                          <button
                            type="button"
                            onClick={() => {
                              sendBilanFromSecretariatToCom(b.id);
                              setToastMessage("🟢 Bilan financier transmis au Chargé de Communication (COM) !");
                            }}
                            className="bg-amber-600 hover:bg-amber-500 text-white font-black px-4 py-2.5 rounded-xl flex items-center gap-1.5 shadow active:scale-95 transition-all cursor-pointer"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>🟢 Transmettre à la COM</span>
                          </button>
                        ) : (
                          <span className="bg-blue-500/20 text-blue-300 font-bold px-3 py-2 rounded-xl border border-blue-500/30 text-xs flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />
                            <span>Transmis à la COM</span>
                          </span>
                        )}

                        {/* 2. Archiver (DÉSACTIVÉ / GRISÉ si !b.ackByCom, ACTIVÉ dès que b.ackByCom) */}
                        <button
                          type="button"
                          disabled={!b.ackByCom || b.archivedBySecretariat}
                          title={!b.ackByCom ? "En attente de l'accusé de réception de la COM" : "Classer dans les Archives Officielle"}
                          onClick={() => {
                            archiveBilanSecretariat(b.id);
                            setToastMessage("📦 Bilan Financier classé définitivement dans les Archives Officielle !");
                          }}
                          className={`px-4 py-2.5 rounded-xl font-black flex items-center gap-1.5 transition-all shadow ${
                            b.archivedBySecretariat
                              ? 'bg-slate-800 text-slate-500 cursor-default'
                              : b.ackByCom
                              ? 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer active:scale-95'
                              : 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-60 border border-slate-700'
                          }`}
                        >
                          <Archive className="w-3.5 h-3.5" />
                          <span>
                            {b.archivedBySecretariat
                              ? '📦 Archivé'
                              : b.ackByCom
                              ? '🟢 Archiver'
                              : '⚪ Archiver'}
                          </span>
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 4. ESPACE PAYOR (AUDIT & CO-VALIDATION) */}
      {/* ========================================================= */}
      {activeRole === 'PAYOR' && (
        <div className="space-y-8">
          {/* RBAC Lock Badge */}
          <RbacWarningBanner
            roleName="PAYOR (AUDIT & SÉCURITÉ)"
            allowedActionsText="Audit financier en lecture seule, co-validation des PV/dossiers et exportation des bilans."
          />

          {/* Read-Only Audit Dashboard of Fund Balances */}
          <div className="bg-slate-900 rounded-[2.5rem] p-6 sm:p-8 border border-slate-800 shadow-xl space-y-6">
            <h2 className="text-xl font-black text-white flex items-center gap-2">
              <PieChart className="w-5 h-5 text-amber-500" />
              <span>Dashboard d'Audit Financier en Lecture Seule</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
              {Object.entries(fundBalances).map(([fKey, amount]) => (
                <div key={fKey} className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-1">
                  <p className="text-[10px] text-slate-400 font-bold uppercase truncate">
                    {FUND_LABELS[fKey as FundType]}
                  </p>
                  <p className="text-lg font-black text-amber-400">
                    {(amount as number).toLocaleString('fr-FR')} F CFA
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Administrative Co-validation Queues */}
          <div className="bg-slate-900 rounded-[2.5rem] p-6 sm:p-8 border border-slate-800 shadow-xl space-y-6">
            <h2 className="text-xl font-black text-white flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-amber-500" />
              <span>File de Co-Validation Administrative</span>
            </h2>

            {/* Validation PVs */}
            <div className="space-y-3">
              <h3 className="text-xs font-black text-slate-400 uppercase">A. Procès-Verbaux (Secrétariat)</h3>
              {pvs.filter(p => p.status === 'SENT_TO_PAYOR').length === 0 ? (
                <p className="text-xs text-slate-500 py-3 italic">Aucun PV en attente de validation.</p>
              ) : (
                pvs
                  .filter(p => p.status === 'SENT_TO_PAYOR')
                  .map(p => (
                    <div key={p.id} className="bg-slate-950 p-5 rounded-2xl border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-xs">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <p className="font-black text-white text-base">{p.title}</p>
                          <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2.5 py-0.5 rounded-full text-[10px] font-bold">
                            En Attente Validation
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-slate-300 font-medium">
                          <span className="flex items-center gap-1">
                            📅 Réunion : <strong className="text-white">{p.meetingDate}</strong>
                          </span>
                          {(p.startTime || p.endTime) && (
                            <span className="flex items-center gap-1 text-amber-300">
                              ⏱️ Horaires : <strong>{p.startTime || '--:--'} à {p.endTime || '--:--'}</strong>
                            </span>
                          )}
                          {p.attendeesCount !== undefined && p.attendeesCount !== null && (
                            <span className="flex items-center gap-1 text-emerald-300">
                              👥 Participants : <strong>{p.attendeesCount} personne(s)</strong>
                            </span>
                          )}
                        </div>
                        {p.content && (
                          <div className="mt-2 p-3 bg-slate-900 border border-slate-800 rounded-xl text-slate-300 text-xs max-h-24 overflow-y-auto whitespace-pre-line">
                            {p.content}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                        <button
                          type="button"
                          onClick={() => handleGeneratePDFPV(p)}
                          className="bg-slate-800 hover:bg-slate-700 text-amber-400 font-extrabold px-3.5 py-2.5 rounded-xl border border-slate-700 flex items-center gap-1.5 transition-all active:scale-95"
                          title="Consulter et imprimer le PDF du PV"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>PDF</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            approvePVPayor(p.id);
                            alert('PV approuvé par le PAYOR !');
                          }}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white font-black px-4 py-2.5 rounded-xl flex items-center gap-1.5 shadow active:scale-95 transition-all"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Valider Le PV</span>
                        </button>
                      </div>
                    </div>
                  ))
              )}
            </div>

            {/* Validation Activities */}
            <div className="space-y-3 pt-4 border-t border-slate-800">
              <h3 className="text-xs font-black text-slate-400 uppercase">B. Programmes d'Événements (Organisation)</h3>
              {activities.filter(a => a.status === 'PENDING_PAYOR').length === 0 ? (
                <p className="text-xs text-slate-500 py-3 italic">Aucun programme en attente de validation.</p>
              ) : (
                activities
                  .filter(a => a.status === 'PENDING_PAYOR')
                  .map(a => (
                    <div key={a.id} className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex items-center justify-between gap-3 text-xs">
                      <div>
                        <p className="font-extrabold text-white">{a.title}</p>
                        <p className="text-slate-400">Date: {a.eventDate} • Budget: {a.budget} F CFA</p>
                      </div>
                      <button
                        onClick={() => {
                          approveActivityPayor(a.id);
                          alert('Programme approuvé par le PAYOR !');
                        }}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-black px-4 py-2 rounded-xl flex items-center gap-1 shadow"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Valider Le Programme
                      </button>
                    </div>
                  ))
              )}
            </div>

            {/* Validation Projects */}
            <div className="space-y-3 pt-4 border-t border-slate-800">
              <h3 className="text-xs font-black text-slate-400 uppercase">C. Projets AGR (Commission Projets)</h3>
              {projects.filter(p => p.status === 'PENDING_PAYOR').length === 0 ? (
                <p className="text-xs text-slate-500 py-3 italic">Aucun projet AGR en attente de validation.</p>
              ) : (
                projects
                  .filter(p => p.status === 'PENDING_PAYOR')
                  .map(p => (
                    <div key={p.id} className="bg-slate-950 p-4 sm:p-5 rounded-2xl border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-xs">
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-extrabold text-white text-sm">{p.title}</p>
                          <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2.5 py-0.5 rounded-full text-[10px] font-bold">
                            {p.category}
                          </span>
                        </div>
                        <p className="text-slate-300 font-medium">
                          Coût estimé : <strong className="text-amber-400">{p.estimatedCost.toLocaleString('fr-FR')} F CFA</strong> • Soumis le : {p.date}
                        </p>
                        {p.pilotTeam && p.pilotTeam.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1.5 pt-1">
                            <span className="font-bold text-slate-400 text-[11px] flex items-center gap-1">
                              👥 Équipe Pilote :
                            </span>
                            {p.pilotTeam.map((m, idx) => (
                              <span key={idx} className="bg-slate-900 text-amber-300 px-2.5 py-0.5 rounded-lg border border-slate-800 font-bold text-[11px]">
                                {m}
                              </span>
                            ))}
                          </div>
                        )}
                        {p.description && (
                          <p className="text-slate-400 text-xs italic bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/60 mt-1">
                            {p.description}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                        <button
                          type="button"
                          onClick={() => handleGeneratePDFProject(p)}
                          className="bg-slate-800 hover:bg-slate-700 text-amber-400 font-extrabold px-3 py-2 rounded-xl border border-slate-700 flex items-center gap-1.5 transition-all active:scale-95 text-xs"
                          title="Imprimer le PDF du projet"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>PDF</span>
                        </button>
                        <button
                          onClick={() => {
                            approveProjectPayor(p.id);
                            alert('Projet AGR approuvé par le PAYOR !');
                          }}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white font-black px-4 py-2 rounded-xl flex items-center gap-1 shadow active:scale-95 transition-all text-xs"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Valider Le Projet
                        </button>
                      </div>
                    </div>
                  ))
              )}
            </div>

            {/* Validation Bilans Financiers (Double Signature Sequential) */}
            <div className="space-y-3 pt-4 border-t border-slate-800">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center justify-between">
                <span>D. Bilans Financiers (Trésorerie Générale) • Double Signature (SIMAHO.png & SIDEPO.png)</span>
                <span className="text-[10px] text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                  Audit & Contre-Signature Payor
                </span>
              </h3>

              {bilans.length === 0 ? (
                <p className="text-xs text-slate-500 py-3 italic">Aucun bilan financier n'a été transmis par le Trésorier pour l'instant.</p>
              ) : (
                bilans.map(b => {
                  const isApproved = b.status === 'APPROVED_PAYOR';
                  return (
                    <div
                      key={b.id}
                      className="bg-slate-950 p-4 sm:p-5 rounded-2xl border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-xs"
                    >
                      <div className="space-y-1.5 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-extrabold text-white text-sm">{b.title}</p>
                          {isApproved ? (
                            <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2.5 py-0.5 rounded-full text-[10px] font-black">
                              🟢 Bi-Signé & Validé
                            </span>
                          ) : (
                            <span className="bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2.5 py-0.5 rounded-full text-[10px] font-black animate-pulse">
                              ⏳ En attente du visa Payor
                            </span>
                          )}
                        </div>
                        <p className="text-slate-300 font-medium">
                          Période : <strong className="text-amber-400">{b.period}</strong> • Reçus: <strong className="text-emerald-400">{b.totalIn.toLocaleString('fr-FR')} F CFA</strong> • Dépenses: <strong className="text-rose-400">{b.totalOut.toLocaleString('fr-FR')} F CFA</strong>
                        </p>
                        <p className="text-[11px] text-slate-400 flex flex-wrap items-center gap-2">
                          <span>✍️ Signé Trésorier (SIMAHO.png) le : <strong className="text-slate-200">{b.treasurerSignatureDate || b.date}</strong></span>
                          {b.payorSignatureDate && (
                            <span>• 🟢 Visé Payor (SIDEPO.png) le : <strong className="text-emerald-300">{b.payorSignatureDate}</strong></span>
                          )}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                        <button
                          type="button"
                          onClick={() => renderAndPrintBilanPDF(b)}
                          className="bg-slate-800 hover:bg-slate-700 text-amber-400 font-extrabold px-3.5 py-2.5 rounded-xl border border-slate-700 flex items-center gap-1.5 transition-all active:scale-95 text-xs cursor-pointer"
                          title="Consulter le PDF du Bilan"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>PDF</span>
                        </button>

                        {!isApproved ? (
                          <button
                            type="button"
                            onClick={() => {
                              approveBilanPayor(b.id);
                              const nowStr = `${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
                              renderAndPrintBilanPDF({
                                ...b,
                                status: 'APPROVED_PAYOR',
                                payorSignatureDate: nowStr,
                              });
                              setToastMessage("🟢 Bilan Financier approuvé avec succès ! Signature SIDEPO.png apposée. Document bi-signé transmis au Secrétariat et publié à la COM.");
                            }}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white font-black px-4 py-2.5 rounded-xl flex items-center gap-2 shadow-lg active:scale-95 transition-all text-xs cursor-pointer"
                          >
                            <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                            <span>🟢 APPROUVER ET APPOSER LE VISA PAYOR</span>
                          </button>
                        ) : (
                          <span className="bg-emerald-500/10 text-emerald-400 font-bold px-3 py-1.5 rounded-xl border border-emerald-500/20 text-xs">
                            ✅ Transmis Secrétariat & COM
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Exportation of Reports */}
          <div className="bg-slate-900 rounded-[2.5rem] p-6 sm:p-8 border border-slate-800 shadow-xl space-y-6">
            <h2 className="text-xl font-black text-white flex items-center gap-2">
              <Printer className="w-5 h-5 text-amber-500" />
              <span>Exportation & Impression des Bilans Financiers Officiels</span>
            </h2>

            <button
              onClick={() => {
                window.print();
              }}
              className="bg-[#E67E22] hover:bg-[#D35400] text-white font-black py-3.5 px-6 rounded-2xl shadow-lg text-sm flex items-center gap-2 active:scale-95 transition-all"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimer / Exporter Rapport PDF</span>
            </button>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 5. ESPACE CERVEAU (SUPER ADMINISTRATEUR) */}
      {/* ========================================================= */}
      {activeRole === 'CERVEAU' && (
        <div className="space-y-8">
          {/* RBAC Lock Badge */}
          <RbacWarningBanner
            roleName="LE CERVEAU (PRÉSIDENCE)"
            allowedActionsText="Gestion stratégique, validation suprême et gouvernance globale."
          />

          {/* Withdrawal Lock Queue */}
          <div className="bg-slate-900 rounded-[2.5rem] p-6 sm:p-8 border border-slate-800 shadow-xl space-y-6">
            <h2 className="text-xl font-black text-white flex items-center gap-2">
              <Lock className="w-5 h-5 text-amber-500" />
              <span>Verrou des Retraits (Demandes de Décaissement du Trésorier)</span>
            </h2>

            {withdrawals.filter(w => w.status === 'PENDING').length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-sm bg-slate-950 rounded-2xl border border-dashed border-slate-800">
                Aucune demande de décaissement en attente de déverrouillage.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-300">
                  <thead>
                    <tr className="border-b border-slate-800 text-xs font-black text-slate-400 uppercase">
                      <th className="py-3 px-4">Demandeur</th>
                      <th className="py-3 px-4">Caisse</th>
                      <th className="py-3 px-4">Montant</th>
                      <th className="py-3 px-4">Motif</th>
                      <th className="py-3 px-4 text-right">Décision Cerveau</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {withdrawals
                      .filter(w => w.status === 'PENDING')
                      .map(w => (
                        <tr key={w.id}>
                          <td className="py-3 px-4 font-bold text-white">{w.requestedBy}</td>
                          <td className="py-3 px-4 font-bold text-amber-400">{FUND_LABELS[w.fund]}</td>
                          <td className="py-3 px-4 font-black text-rose-400">
                            {w.amount.toLocaleString('fr-FR')} F CFA
                          </td>
                          <td className="py-3 px-4 text-xs">{w.reason}</td>
                          <td className="py-3 px-4 text-right space-x-2">
                            <button
                              onClick={() => {
                                approveWithdrawal(w.id);
                                alert('Retrait déverrouillé et approuvé par le CERVEAU !');
                              }}
                              className="bg-emerald-600 hover:bg-emerald-500 text-white font-black px-3 py-1.5 rounded-xl text-xs shadow active:scale-95 transition-all inline-flex items-center gap-1"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" /> Approuver
                            </button>
                            <button
                              onClick={() => {
                                rejectWithdrawal(w.id);
                                alert('Retrait verrouillé et rejeté.');
                              }}
                              className="bg-rose-600 hover:bg-rose-500 text-white font-black px-3 py-1.5 rounded-xl text-xs shadow active:scale-95 transition-all inline-flex items-center gap-1"
                            >
                              <XCircle className="w-3.5 h-3.5" /> Verrouiller
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Registre Officiel des Postes Administrateurs & Accès Direct */}
          <div className="bg-slate-900 rounded-[2.5rem] p-6 sm:p-8 border border-slate-800 shadow-xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <h2 className="text-xl font-black text-white flex items-center gap-2">
                  <Shield className="w-5 h-5 text-amber-500" />
                  <span>Registre Officiel des {adminUsers.length} Postes Administrateurs & Accès Direct</span>
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Consultez et modifiez en direct les Identifiants de connexion (ID) et Mots de passe (PIN) des {adminUsers.length} postes administrateurs.
                </p>
              </div>
              <div className="text-xs font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-xl self-start sm:self-auto">
                {adminUsers.length} Postes Administrateurs
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead>
                  <tr className="border-b border-slate-800 text-xs font-black text-slate-400 uppercase">
                    <th className="py-3 px-4">Poste Admin</th>
                    <th className="py-3 px-4">Identifiant de Connexion (ID)</th>
                    <th className="py-3 px-4">Code PIN / Mot de Passe</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium">
                  {adminUsers.map(admin => {
                    const isEditing = editingAdminRole === admin.id;
                    return (
                      <tr key={admin.id} className="hover:bg-slate-950/40 transition-colors">
                        <td className="py-4 px-4">
                          <div className="font-black text-white flex items-center gap-2">
                            <span className="text-amber-400">🛡️</span>
                            <span>{admin.roleName}</span>
                          </div>
                          <div className="text-[11px] text-slate-400 font-normal">{admin.description}</div>
                        </td>

                        <td className="py-4 px-4">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editLoginId}
                              onChange={e => setEditLoginId(e.target.value)}
                              className="bg-slate-950 border border-amber-500/50 rounded-xl px-3 py-1.5 text-xs font-black text-amber-300 focus:outline-none"
                              placeholder="Nouveau ID..."
                            />
                          ) : (
                            <span className="font-mono text-xs font-bold bg-slate-950 text-emerald-400 px-3 py-1.5 rounded-xl border border-slate-800">
                              {admin.loginId || admin.id}
                            </span>
                          )}
                        </td>

                        <td className="py-4 px-4">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editPin}
                              onChange={e => setEditPin(e.target.value)}
                              className="bg-slate-950 border border-amber-500/50 rounded-xl px-3 py-1.5 text-xs font-black text-amber-300 focus:outline-none"
                              placeholder="Nouveau PIN..."
                            />
                          ) : (
                            <span className="font-mono text-xs font-bold bg-slate-950 text-amber-300 px-3 py-1.5 rounded-xl border border-slate-800">
                              {admin.pin}
                            </span>
                          )}
                        </td>

                        <td className="py-4 px-4 text-right">
                          {isEditing ? (
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => {
                                  const res = updateAdminCredentials(admin.id, editLoginId, editPin);
                                  if (res.success) {
                                    alert(res.message);
                                    setEditingAdminRole(null);
                                  } else {
                                    alert(res.message);
                                  }
                                }}
                                className="bg-emerald-600 hover:bg-emerald-500 text-white font-black px-3 py-1.5 rounded-xl text-xs shadow transition-all active:scale-95"
                              >
                                Enregistrer
                              </button>
                              <button
                                onClick={() => setEditingAdminRole(null)}
                                className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold px-3 py-1.5 rounded-xl text-xs transition-all"
                              >
                                Annuler
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                setEditingAdminRole(admin.id);
                                setEditLoginId(admin.loginId || admin.id);
                                setEditPin(admin.pin);
                              }}
                              className="bg-amber-500/20 text-amber-300 hover:bg-amber-500 hover:text-white border border-amber-500/30 px-3.5 py-1.5 rounded-xl text-xs font-black inline-flex items-center gap-1.5 transition-all shadow-sm"
                            >
                              ✏️ <span>MODIFIER LOGINS</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Diffusion d'Alerte Cerveau & Notifications (Requirements 3 & 4) */}
          <div className="bg-slate-900 rounded-[2.5rem] p-6 sm:p-8 border border-slate-800 shadow-xl space-y-6">
            <h2 className="text-xl font-black text-white flex items-center gap-2 border-b border-slate-800 pb-4">
              <AlertTriangle className="w-5 h-5 text-rose-500" />
              <span>Diffusion d'Alerte Cerveau (Message d'Urgence Fraternelle)</span>
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Titre ou Motif de l'Alerte</label>
                <input
                  type="text"
                  placeholder="Renseignez le titre de l'alerte ou de l'information financière d'urgence..."
                  value={cerveauAlertTitle}
                  onChange={e => setCerveauAlertTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-sm font-bold text-white focus:outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Contenu / Message Complet de l'Alerte</label>
                <textarea
                  rows={4}
                  placeholder="Rédigez le contenu complet du message à transmettre à la communauté..."
                  value={cerveauAlertContent}
                  onChange={e => setCerveauAlertContent(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-sm font-medium text-white focus:outline-none focus:border-rose-500"
                />
              </div>

              {/* 3 Dispatch Channel Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">
                  Canal de Diffusion (3 Options)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => setCerveauDispatchChannel('APP')}
                    className={`py-3 px-4 rounded-2xl border text-xs font-black transition-all flex items-center justify-center gap-2 ${
                      cerveauDispatchChannel === 'APP'
                        ? 'bg-rose-600 border-rose-500 text-white shadow-lg'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <span>📲</span>
                    <span>PUBLIER DANS L'APP</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCerveauDispatchChannel('MAIL')}
                    className={`py-3 px-4 rounded-2xl border text-xs font-black transition-all flex items-center justify-center gap-2 ${
                      cerveauDispatchChannel === 'MAIL'
                        ? 'bg-rose-600 border-rose-500 text-white shadow-lg'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <span>✉️</span>
                    <span>PUBLIER VIA MAIL</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCerveauDispatchChannel('GENERAL')}
                    className={`py-3 px-4 rounded-2xl border text-xs font-black transition-all flex items-center justify-center gap-2 ${
                      cerveauDispatchChannel === 'GENERAL'
                        ? 'bg-rose-600 border-rose-500 text-white shadow-lg'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <span>🌐</span>
                    <span>ENVOI GÉNÉRAL (APP + MAIL)</span>
                  </button>
                </div>
              </div>
            </div>

            <button
              disabled={isSendingEmail}
              onClick={async () => {
                if (!cerveauAlertTitle.trim() || !cerveauAlertContent.trim()) {
                  alert("Veuillez renseigner le titre et le contenu de l'alerte.");
                  return;
                }

                const validEmails = members.filter(m => m.email).map(m => m.email!);
                const formattedTitle = cerveauAlertTitle.startsWith('🟢') || cerveauAlertTitle.startsWith('🚨')
                  ? cerveauAlertTitle
                  : `🚨 ALERTE CERVEAU : ${cerveauAlertTitle}`;

                if (cerveauDispatchChannel === 'MAIL' || cerveauDispatchChannel === 'GENERAL') {
                  setIsSendingEmail(true);
                  await sendEmailBroadcastAsync(formattedTitle, cerveauAlertContent, members, 'CERVEAU (EXÉCUTIF)', cerveauDispatchChannel);
                  broadcastCerveauAlert(cerveauAlertTitle, cerveauAlertContent, cerveauDispatchChannel);
                  setIsSendingEmail(false);

                  setToastMessage("✉️ Email envoyé automatiquement avec succès aux membres !");
                  setTimeout(() => setToastMessage(null), 5000);

                  setEmailModalData({
                    title: formattedTitle,
                    content: cerveauAlertContent,
                    authorRole: 'CERVEAU (EXÉCUTIF)',
                    channel: cerveauDispatchChannel,
                    recipients: validEmails,
                  });
                } else {
                  broadcastCerveauAlert(cerveauAlertTitle, cerveauAlertContent, cerveauDispatchChannel);
                  setToastMessage("Alerte Cerveau publiée dans l'application avec succès !");
                  setTimeout(() => setToastMessage(null), 4000);
                }

                setCerveauAlertTitle('');
                setCerveauAlertContent('');
              }}
              className="bg-rose-600 hover:bg-rose-500 text-white font-black py-3.5 px-6 rounded-2xl shadow-lg text-sm flex items-center gap-2 active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
            >
              {isSendingEmail ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Envoi automatique des emails en cours...</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-4 h-4" />
                  <span>Diffuser l'Alerte Officielle</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 6. COMMISSION ORGANISATION */}
      {/* ========================================================= */}
      {activeRole === 'ORGANISATION' && (
        <div className="space-y-8">
          <RbacWarningBanner
            roleName="COMMISSION ORGANISATION"
            allowedActionsText="Planification des événements, gestion de la logistique, des comités et des dossiers d'activités."
          />
          <div className="bg-slate-900 rounded-[2.5rem] p-6 sm:p-8 border border-slate-800 shadow-xl space-y-6">
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-amber-500" />
            <span>Création d'Événement & Dossier Unifié Programme (Envoi au PAYOR)</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Titre Événement</label>
              <input
                type="text"
                placeholder="Ex: Sortie Annuelle Grand-Bassam"
                value={actTitle}
                onChange={e => setActTitle(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-sm font-bold text-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Date Événement</label>
              <input
                type="date"
                value={actDate}
                onChange={e => setActDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-sm font-bold text-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Budget Prévisionnel (F CFA)</label>
              <input
                type="number"
                placeholder="Ex: 150000"
                value={actBudgetInput}
                onChange={e => setActBudgetInput(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-sm font-bold text-white focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Description & Objectifs</label>
            <textarea
              rows={2}
              placeholder="Ex: Journée récréative et fraternelle..."
              value={actDesc}
              onChange={e => setActDesc(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-sm font-medium text-white focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Programme Déroulé</label>
            <textarea
              rows={3}
              placeholder="Rédigez le programme d'activités..."
              value={actProgram}
              onChange={e => setActProgram(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-sm font-medium text-white focus:outline-none"
            />
          </div>

          <button
            onClick={() => {
              if (!actTitle.trim() || !actDate.trim()) {
                alert('Veuillez renseigner le titre et la date.');
                return;
              }

              const defaultCommittees: Committee[] = [
                { name: 'CAMBUSE', leaderNickname: 'CAPELO', memberNicknames: ['CAPELO', 'TYPO'], description: 'Gestion boissons et réserves' },
                { name: 'RESTAURATION', leaderNickname: 'LA MADRE', memberNicknames: ['LA MADRE', 'SOUKA', 'NOUNOURS'], description: 'Repas et buffet' },
                { name: 'LOGISTIQUE', leaderNickname: 'ESPRIT', memberNicknames: ['ESPRIT', 'DOJON'], description: 'Matériel et installation' },
                { name: 'TRANSPORT', leaderNickname: 'KOSSONGBETO', memberNicknames: ['KOSSONGBETO', 'SYLAS'], description: 'Déplacements' },
              ];

              createActivity({
                title: actTitle,
                eventDate: actDate,
                description: actDesc,
                program: actProgram,
                budget: Number(actBudgetInput) || 0,
                committees: defaultCommittees,
                createdBy: 'COMMISSION ORGANISATION',
              });

              alert('Dossier Unifié créé et transmis au PAYOR pour validation !');
              setActTitle('');
              setActDate('');
              setActDesc('');
              setActProgram('');
              setActBudgetInput('');
            }}
            className="bg-[#E67E22] hover:bg-[#D35400] text-white font-black py-3.5 px-6 rounded-2xl shadow-lg text-sm flex items-center gap-2 active:scale-95 transition-all"
          >
            <Send className="w-4 h-4" />
            <span>Transmettre au PAYOR</span>
          </button>
        </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 7. COMMISSION PROJETS (AGR) */}
      {/* ========================================================= */}
      {activeRole === 'PROJET' && (
        <div className="space-y-8">
          <RbacWarningBanner
            roleName="COMMISSION PROJETS (AGR)"
            allowedActionsText="Montage des dossiers AGR, soumission des projets générateurs de revenus et suivi de rentabilité."
          />
          <div className="bg-slate-900 rounded-[2.5rem] p-6 sm:p-8 border border-slate-800 shadow-xl space-y-6">
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <Rocket className="w-5 h-5 text-amber-500" />
            <span>Montage de Projet AGR</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Titre du Projet</label>
              <input
                type="text"
                placeholder="Ex: Élevage de Volaille E-ROUAMA"
                value={projTitle}
                onChange={e => setProjTitle(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-sm font-bold text-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Catégorie</label>
              <input
                type="text"
                placeholder="Ex: Élevage / Commerce / Agriculture"
                value={projCategory}
                onChange={e => setProjCategory(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-sm font-bold text-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Coût Total Estimé (F CFA)</label>
              <input
                type="number"
                placeholder="Ex: 500000"
                value={projCostInput}
                onChange={e => setProjCostInput(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-sm font-bold text-white focus:outline-none"
              />
            </div>
          </div>

          {/* New fields: Contribution requise par membre (variable, sans montant fixe) & Dates */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-amber-400 uppercase mb-2 flex items-center justify-between">
                <span>Contribution Requise par Membre (F CFA)</span>
                <span className="text-[10px] text-slate-400 font-normal">Montant libre & variable</span>
              </label>
              <input
                type="number"
                placeholder="Ex: 15000 (défini pour ce projet spécifique)"
                value={projRequiredPerMember}
                onChange={e => setProjRequiredPerMember(e.target.value)}
                className="w-full bg-slate-950 border border-amber-500/40 rounded-2xl px-4 py-3 text-sm font-bold text-amber-300 focus:outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-2">
                Date de Réalisation / Lancement
              </label>
              <input
                type="date"
                value={projEventDate}
                onChange={e => setProjEventDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-sm font-bold text-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-2">
                Date Limite de Paiement des Cotisations
              </label>
              <input
                type="date"
                value={projPaymentDeadline}
                onChange={e => setProjPaymentDeadline(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-sm font-bold text-white focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Description & Modèle Économique</label>
            <textarea
              rows={3}
              placeholder="Présentez le modèle de rentabilité du projet, objectifs de retour et calendrier d'exécution..."
              value={projDesc}
              onChange={e => setProjDesc(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-sm font-medium text-white focus:outline-none"
            />
          </div>

          {/* Équipe Pilote Field */}
          <div className="space-y-3 pt-2">
            <label className="block text-xs font-bold text-slate-400 uppercase flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-amber-400">
                <Users className="w-4 h-4" />
                <span>👥 Équipe Pilote (Responsables du Suivi)</span>
              </span>
              <span className="text-[10px] text-slate-400 font-normal">
                {projPilotTeam.length} membre(s) désigné(s)
              </span>
            </label>

            {/* Selected pilot team member badges */}
            {projPilotTeam.length > 0 && (
              <div className="flex flex-wrap gap-2 p-3 bg-slate-950/80 rounded-2xl border border-amber-500/30">
                {projPilotTeam.map((member, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 bg-amber-500/20 text-amber-300 border border-amber-500/40 px-3 py-1 rounded-full text-xs font-bold"
                  >
                    <span>👤 {member}</span>
                    <button
                      type="button"
                      onClick={() => setProjPilotTeam(prev => prev.filter((_, i) => i !== idx))}
                      className="hover:text-red-400 text-amber-400 transition-colors ml-1"
                      title="Retirer de l'équipe pilote"
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Selection by clicking association members */}
            <div className="space-y-3 bg-slate-950 p-4 rounded-2xl border border-slate-800">
              <p className="text-[11px] font-bold text-slate-400">
                Sélection rapide parmi les membres de l'association ({members.length}) :
              </p>
              <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto pr-1">
                {members.map(m => {
                  const isSelected = projPilotTeam.includes(m.fullRosterName);
                  return (
                    <button
                      type="button"
                      key={m.id}
                      onClick={() => {
                        if (isSelected) {
                          setProjPilotTeam(prev => prev.filter(name => name !== m.fullRosterName));
                        } else {
                          setProjPilotTeam(prev => [...prev, m.fullRosterName]);
                        }
                      }}
                      className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition-all flex items-center gap-1 ${
                        isSelected
                          ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md scale-105'
                          : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <span>{isSelected ? '✓' : '+'}</span>
                      <span>{m.fullRosterName}</span>
                    </button>
                  );
                })}
              </div>

              {/* Manual entry for custom member names */}
              <div className="flex items-center gap-2 pt-2 border-t border-slate-800/60">
                <input
                  type="text"
                  placeholder="Sélectionnez ou saisissez les membres de l'équipe pilote chargés de suivre ce projet..."
                  value={customPilotInput}
                  onChange={e => setCustomPilotInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && customPilotInput.trim()) {
                      e.preventDefault();
                      if (!projPilotTeam.includes(customPilotInput.trim())) {
                        setProjPilotTeam(prev => [...prev, customPilotInput.trim()]);
                      }
                      setCustomPilotInput('');
                    }
                  }}
                  className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-medium text-white focus:outline-none focus:border-amber-500"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (customPilotInput.trim()) {
                      if (!projPilotTeam.includes(customPilotInput.trim())) {
                        setProjPilotTeam(prev => [...prev, customPilotInput.trim()]);
                      }
                      setCustomPilotInput('');
                    }
                  }}
                  className="bg-slate-800 hover:bg-slate-700 text-amber-400 font-bold px-4 py-2.5 rounded-xl text-xs border border-slate-700 transition-all shrink-0"
                >
                  + Ajouter
                </button>
              </div>
            </div>
          </div>

          <button
            onClick={() => {
              if (!projTitle.trim()) {
                alert('Veuillez spécifier le titre du projet.');
                return;
              }
              const requiredAmt = Number(projRequiredPerMember) || 0;
              createProject({
                title: projTitle,
                category: projCategory,
                estimatedCost: Number(projCostInput) || 0,
                requiredAmountPerMember: requiredAmt,
                eventDate: projEventDate,
                paymentDeadline: projPaymentDeadline,
                description: projDesc,
                pilotTeam: projPilotTeam,
                date: new Date().toLocaleDateString('fr-FR'),
                createdBy: 'COMMISSION PROJET',
              });
              alert('Projet AGR enregistré avec succès au niveau de la Commission Projet !');
              setProjTitle('');
              setProjCategory('');
              setProjCostInput('');
              setProjRequiredPerMember('');
              setProjEventDate('');
              setProjPaymentDeadline('');
              setProjDesc('');
              setProjPilotTeam([]);
              setCustomPilotInput('');
            }}
            className="bg-[#E67E22] hover:bg-[#D35400] text-white font-black py-3.5 px-6 rounded-2xl shadow-lg text-sm flex items-center gap-2 active:scale-95 transition-all"
          >
            <Send className="w-4 h-4" />
            <span>Enregistrer le Dossier Projet AGR</span>
          </button>
        </div>

        {/* History of AGR Projects for Commission Projets */}
        <div className="bg-slate-900 rounded-[2.5rem] p-6 sm:p-8 border border-slate-800 shadow-xl space-y-6">
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <Rocket className="w-5 h-5 text-emerald-500" />
            <span>Dossiers de Projets AGR Montés & Suivis ({projects.length})</span>
          </h2>

          {projects.length === 0 ? (
            <p className="text-slate-500 text-xs italic py-4">Aucun projet AGR enregistré dans le système.</p>
          ) : (
            <div className="space-y-4">
              {projects.map(p => {
                const isPublished = p.status === 'PUBLISHED';
                return (
                  <div key={p.id} className="bg-slate-950 p-5 rounded-2xl border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-xs">
                    <div className="space-y-2 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-extrabold text-white text-base">{p.title}</p>
                        <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2.5 py-0.5 rounded-full text-[10px] font-bold">
                          {p.category}
                        </span>
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                          isPublished
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                            : p.status === 'ARCHIVED'
                            ? 'bg-slate-800 text-slate-400 border-slate-700'
                            : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        }`}>
                          {isPublished
                            ? '🟢 OUVERT AUX COTISATIONS (PUBLIÉ)'
                            : p.status === 'ARCHIVED'
                            ? '📦 ARCHIVÉ / CLÔTURÉ'
                            : 'EN ATTENTE DE PUBLICATION'}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-slate-300 font-medium">
                        <span>Coût total : <strong className="text-amber-400">{p.estimatedCost.toLocaleString('fr-FR')} F CFA</strong></span>
                        <span>
                          Contribution par membre :{' '}
                          <strong className="text-emerald-400 font-mono">
                            {p.requiredAmountPerMember ? `${p.requiredAmountPerMember.toLocaleString('fr-FR')} F CFA` : 'Libre'}
                          </strong>
                        </span>
                        {p.eventDate && <span>Lancement : <strong className="text-white">{p.eventDate}</strong></span>}
                        {p.paymentDeadline && <span>Date limite : <strong className="text-rose-400">{p.paymentDeadline}</strong></span>}
                      </div>

                      {/* Équipe Pilote Display */}
                      {p.pilotTeam && p.pilotTeam.length > 0 ? (
                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          <span className="font-bold text-slate-400 text-[11px] flex items-center gap-1">
                            👥 Équipe Pilote :
                          </span>
                          {p.pilotTeam.map((m, idx) => (
                            <span key={idx} className="bg-slate-900 text-amber-300 px-2.5 py-0.5 rounded-lg border border-slate-800 font-bold text-[11px]">
                              👤 {m}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-slate-500 text-[11px] italic">👥 Équipe pilote : Aucun membre spécifié</p>
                      )}

                      {p.description && (
                        <p className="text-slate-400 text-xs italic bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/60 mt-1">
                          {p.description}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {/* Publish / Archive Actions */}
                      {!isPublished && p.status !== 'ARCHIVED' && (
                        <button
                          type="button"
                          onClick={() => {
                            publishProject(p.id);
                            alert(`🚀 Projet "${p.title}" publié avec succès ! La rubrique AGR est désormais active dans l'espace membre.`);
                          }}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white font-black px-4 py-2.5 rounded-xl flex items-center gap-1.5 shadow-lg active:scale-95 transition-all text-xs cursor-pointer"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>🚀 Publier pour cotisations</span>
                        </button>
                      )}

                      {isPublished && (
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`Voulez-vous clôturer / archiver le projet "${p.title}" ? La rubrique AGR deviendra grisée dans l'espace membre.`)) {
                              archiveProject(p.id);
                              alert(`Projet "${p.title}" clôturé / archivé.`);
                            }
                          }}
                          className="bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 font-bold px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 transition-all text-xs cursor-pointer"
                        >
                          <Archive className="w-3.5 h-3.5" />
                          <span>Clôturer / Archiver</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleGeneratePDFProject(p)}
                        className="bg-slate-800 hover:bg-slate-700 text-amber-400 font-extrabold px-3.5 py-2.5 rounded-xl border border-slate-700 flex items-center gap-1.5 transition-all active:scale-95"
                        title="Imprimer ou enregistrer en PDF"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>PDF</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 8. ESPACE DÉPARTEMENT SPIRITUALITÉ */}
      {/* ========================================================= */}
      {activeRole === 'SPIRITUALITE' && (
        <div className="space-y-8">
          <RbacWarningBanner
            roleName="DÉPARTEMENT SPIRITUALITÉ"
            allowedActionsText="Prière ROUAMA, liturgie AELF, événements religieux et verset du jour."
          />

          {/* SECTION 1: PRIÈRE ROUAMA & PRIÈRES AELF */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Prière ROUAMA Card */}
            <div className="bg-slate-900 border border-amber-500/30 rounded-3xl p-6 shadow-xl flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2 text-amber-400 font-black text-lg">
                    <span className="text-2xl">✝️</span>
                    <span>Prière ROUAMA (Saint Augustin)</span>
                  </div>
                  <span className="bg-amber-500/20 text-amber-300 text-[10px] font-black px-3 py-1 rounded-full border border-amber-500/30">
                    Officielle
                  </span>
                </div>
                <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 text-xs sm:text-sm text-slate-200 italic leading-relaxed space-y-2">
                  <p>
                    « Seigneur notre Dieu, notre unique espérance, exauce-nous de peur que par découragement nous ne voulions plus te chercher. Tu as fait que nous te trouvions et tu nous as donné l'espoir de te trouver de plus en plus. »
                  </p>
                  <p>
                    « Accorde à tous les membres de la famille ROUAMA la grâce d'aimer sans mesure, de fortifier notre fraternité et de cheminer ensemble dans la foi, l'entraide et la charité. Amen. »
                  </p>
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-800">
                <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">
                  Diffusion de la Prière ROUAMA Aux Membres :
                </p>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() =>
                      handleSpiritualPublish(
                        "Prière ROUAMA (Saint Augustin)",
                        "« Seigneur notre Dieu, notre unique espérance, exauce-nous de peur que par découragement nous ne voulions plus te chercher. Tu as fait que nous te trouvions et tu nous as donné l'espoir de te trouver de plus en plus. »\n\n« Accorde à tous les membres de la famille ROUAMA la grâce d'aimer sans mesure, de fortifier notre fraternité et de cheminer ensemble dans la foi, l'entraide et la charité. Amen. »",
                        'APP'
                      )
                    }
                    className="bg-amber-600/80 hover:bg-amber-600 text-white font-black py-2.5 px-2 rounded-xl text-xs flex items-center justify-center gap-1 shadow transition-all active:scale-95"
                  >
                    <span>[Publier App]</span>
                  </button>
                  <button
                    onClick={() =>
                      handleSpiritualPublish(
                        "Prière ROUAMA (Saint Augustin)",
                        "« Seigneur notre Dieu, notre unique espérance, exauce-nous de peur que par découragement nous ne voulions plus te chercher. Tu as fait que nous te trouvions et tu nous as donné l'espoir de te trouver de plus en plus. »\n\n« Accorde à tous les membres de la famille ROUAMA la grâce d'aimer sans mesure, de fortifier notre fraternité et de cheminer ensemble dans la foi, l'entraide et la charité. Amen. »",
                        'MAIL'
                      )
                    }
                    className="bg-emerald-600/80 hover:bg-emerald-600 text-white font-black py-2.5 px-2 rounded-xl text-xs flex items-center justify-center gap-1 shadow transition-all active:scale-95"
                  >
                    <span>[Publier Mail]</span>
                  </button>
                  <button
                    onClick={() =>
                      handleSpiritualPublish(
                        "Prière ROUAMA (Saint Augustin)",
                        "« Seigneur notre Dieu, notre unique espérance, exauce-nous de peur que par découragement nous ne voulions plus te chercher. Tu as fait que nous te trouvions et tu nous as donné l'espoir de te trouver de plus en plus. »\n\n« Accorde à tous les membres de la famille ROUAMA la grâce d'aimer sans mesure, de fortifier notre fraternité et de cheminer ensemble dans la foi, l'entraide et la charité. Amen. »",
                        'GENERAL'
                      )
                    }
                    className="bg-gradient-to-r from-amber-600 to-emerald-600 hover:opacity-90 text-white font-black py-2.5 px-2 rounded-xl text-xs flex items-center justify-center gap-1 shadow transition-all active:scale-95"
                  >
                    <span>[Publier App + Mail]</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Prières Quotidiennes AELF Card */}
            <div className="bg-slate-900 border border-amber-500/30 rounded-3xl p-6 shadow-xl flex flex-col justify-between space-y-4">
              <div>
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4 border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2 text-amber-400 font-black text-lg">
                    <span className="text-2xl">📖</span>
                    <div>
                      <span>Prières Quotidiennes (AELF)</span>
                      <p className="text-[11px] font-medium text-slate-400">Import automatique officiel de la messe du jour</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={loadAelfReadings}
                      disabled={isLoadingAelf}
                      className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 shadow transition-all active:scale-95 disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isLoadingAelf ? 'animate-spin' : ''}`} />
                      <span>[ 🔄 RECHARGER LES TEXTES DU JOUR ]</span>
                    </button>
                    <a
                      href="https://www.aelf.org"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold px-2.5 py-1.5 rounded-xl border border-slate-700 flex items-center gap-1"
                    >
                      <span>AELF.org ↗</span>
                    </a>
                  </div>
                </div>

                {/* Loading state */}
                {isLoadingAelf ? (
                  <div className="bg-slate-950 p-8 rounded-2xl border border-slate-800 text-center space-y-3">
                    <RefreshCw className="w-8 h-8 text-amber-400 animate-spin mx-auto" />
                    <p className="text-sm font-bold text-slate-200">
                      Chargement automatique des lectures AELF de la messe du jour...
                    </p>
                  </div>
                ) : aelfData ? (
                  <div className="space-y-4">
                    {/* Liturgical Banner */}
                    <div className="bg-slate-950 p-3.5 rounded-2xl border border-amber-500/30 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">📌</span>
                        <div>
                          <p className="text-xs font-black text-amber-400 uppercase tracking-wide">
                            Jour Liturgique AELF
                          </p>
                          <h4 className="text-sm font-extrabold text-white">
                            {aelfData.jour_liturgique_nom} {aelfData.fete ? `• (${aelfData.fete})` : ''}
                          </h4>
                        </div>
                      </div>
                      <span className="bg-slate-900 text-slate-300 text-[10px] font-bold px-3 py-1 rounded-full border border-slate-800">
                        Date: {aelfData.date}
                      </span>
                    </div>

                    {/* Preview Cards Grid */}
                    <div className="space-y-3 max-h-96 overflow-y-auto no-scrollbar pr-1">
                      {/* Première Lecture */}
                      {aelfData.lecture1 && (
                        <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-extrabold text-amber-400">📖 PREMIÈRE LECTURE</span>
                            <span className="text-slate-400 font-bold">{aelfData.lecture1.ref}</span>
                          </div>
                          {aelfData.lecture1.titre && (
                            <p className="text-xs font-bold text-slate-200 italic">« {aelfData.lecture1.titre} »</p>
                          )}
                          <p className="text-xs text-slate-300 whitespace-pre-line leading-relaxed line-clamp-4 hover:line-clamp-none transition-all">
                            {aelfData.lecture1.contenu}
                          </p>
                        </div>
                      )}

                      {/* Psaume */}
                      {aelfData.psaume && (
                        <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-extrabold text-amber-400">🎵 PSAUME</span>
                            <span className="text-slate-400 font-bold">{aelfData.psaume.ref}</span>
                          </div>
                          {aelfData.psaume.refrain_psalmique && (
                            <p className="text-xs font-bold text-amber-300 bg-amber-500/10 p-2 rounded-xl border border-amber-500/20">
                              R/ {aelfData.psaume.refrain_psalmique}
                            </p>
                          )}
                          <p className="text-xs text-slate-300 whitespace-pre-line leading-relaxed line-clamp-3 hover:line-clamp-none transition-all">
                            {aelfData.psaume.contenu}
                          </p>
                        </div>
                      )}

                      {/* Deuxième Lecture (if present) */}
                      {aelfData.lecture2 && (
                        <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-extrabold text-amber-400">📖 DEUXIÈME LECTURE</span>
                            <span className="text-slate-400 font-bold">{aelfData.lecture2.ref}</span>
                          </div>
                          {aelfData.lecture2.titre && (
                            <p className="text-xs font-bold text-slate-200 italic">« {aelfData.lecture2.titre} »</p>
                          )}
                          <p className="text-xs text-slate-300 whitespace-pre-line leading-relaxed line-clamp-4 hover:line-clamp-none transition-all">
                            {aelfData.lecture2.contenu}
                          </p>
                        </div>
                      )}

                      {/* Évangile */}
                      {aelfData.evangile && (
                        <div className="bg-slate-950 p-4 rounded-2xl border border-amber-500/40 space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-extrabold text-amber-400">✝️ ÉVANGILE</span>
                            <span className="text-slate-400 font-bold">{aelfData.evangile.ref}</span>
                          </div>
                          {aelfData.evangile.verset_evangile && (
                            <p className="text-[11px] font-bold text-slate-300 italic">
                              Acclamation: {aelfData.evangile.verset_evangile}
                            </p>
                          )}
                          {aelfData.evangile.titre && (
                            <p className="text-xs font-bold text-amber-300 italic">« {aelfData.evangile.titre} »</p>
                          )}
                          <p className="text-xs text-slate-200 whitespace-pre-line leading-relaxed line-clamp-5 hover:line-clamp-none transition-all">
                            {aelfData.evangile.contenu}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase mb-1">
                        Titre / Référence Liturgique AELF du Jour
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: Évangile de Jésus-Christ selon Saint Matthieu"
                        value={aelfTitle}
                        onChange={e => setAelfTitle(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-2xl px-4 py-2.5 text-xs sm:text-sm font-semibold text-white focus:outline-none focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase mb-1">
                        Texte de l'Évangile / Oraison du Jour
                      </label>
                      <textarea
                        rows={3}
                        placeholder="Collez ou saisissez la lecture liturgique du jour..."
                        value={aelfContent}
                        onChange={e => setAelfContent(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-3 text-xs sm:text-sm font-medium text-white focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-3 border-t border-slate-800">
                <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">
                  Diffusion de la Messe & Lectures AELF du Jour :
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    onClick={() => {
                      const title = aelfTitle || (aelfData ? `[LITURGIE AELF] ${aelfData.jour_liturgique_nom}` : 'Messe du jour AELF');
                      const content = aelfContent || (aelfData ? aelfData.formattedFullText : 'Lectures AELF du jour.');
                      handleSpiritualPublish(title, content, 'APP');
                    }}
                    className="bg-amber-600/80 hover:bg-amber-600 text-white font-black py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow transition-all active:scale-95"
                  >
                    <span>📲 [ PUBLIER DANS L'APP ]</span>
                  </button>
                  <button
                    onClick={() => {
                      const title = aelfTitle || (aelfData ? `[LITURGIE AELF] ${aelfData.jour_liturgique_nom}` : 'Messe du jour AELF');
                      const content = aelfContent || (aelfData ? aelfData.formattedFullText : 'Lectures AELF du jour.');
                      handleSpiritualPublish(title, content, 'MAIL');
                    }}
                    className="bg-emerald-600/80 hover:bg-emerald-600 text-white font-black py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow transition-all active:scale-95"
                  >
                    <span>✉️ [ PUBLIER VIA MAIL ]</span>
                  </button>
                  <button
                    onClick={() => {
                      const title = aelfTitle || (aelfData ? `[LITURGIE AELF] ${aelfData.jour_liturgique_nom}` : 'Messe du jour AELF');
                      const content = aelfContent || (aelfData ? aelfData.formattedFullText : 'Lectures AELF du jour.');
                      handleSpiritualPublish(title, content, 'GENERAL');
                    }}
                    className="bg-gradient-to-r from-amber-600 to-emerald-600 hover:opacity-90 text-white font-black py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow transition-all active:scale-95"
                  >
                    <span>🌐 [ ENVOI GÉNÉRAL (APP + MAIL) ]</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 2: VERSET & PENSÉE DU JOUR */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-3 gap-2">
              <div className="flex items-center gap-2">
                <span className="text-2xl">✨</span>
                <div>
                  <h3 className="text-lg font-black text-white">Verset / Pensée du Jour (Affichage Tableau de bord)</h3>
                  <p className="text-xs text-slate-400">Pré-rempli automatiquement chaque jour • Éditable par le responsable Spiritualité</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const autoVerse = getDailyVerseForDate(new Date());
                    setVerseInput(autoVerse.verse);
                    setVerseRefInput(autoVerse.reference);
                  }}
                  className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-bold px-3 py-1.5 rounded-xl border border-amber-500/30 flex items-center gap-1.5 transition-all active:scale-95"
                  title="Recharger le verset quotidien tiré de la base d'inspiration"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
                  <span>[ 🔄 Auto-Charger Verset du Jour ]</span>
                </button>
                <span className="text-xs text-amber-400 font-bold bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20 hidden md:inline-block">
                  Direct Dashboard
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2 space-y-2">
                <label className="block text-xs font-bold text-slate-400 uppercase">
                  Verset Biblique ou Pensée Spirituelle
                </label>
                <textarea
                  rows={2}
                  placeholder="Ex: « Que tout ce que vous faites soit fait avec amour. »"
                  value={verseInput}
                  onChange={e => setVerseInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 text-sm font-semibold text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="space-y-4 flex flex-col justify-between">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">
                    Référence / Auteur
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: 1 Corinthiens 16:14"
                    value={verseRefInput}
                    onChange={e => setVerseRefInput(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-2.5 text-sm font-bold text-amber-300 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <button
                  onClick={() => {
                    if (!verseInput.trim()) {
                      alert('Veuillez saisir le verset ou la pensée.');
                      return;
                    }
                    updateVerseOfTheDay(verseInput, verseRefInput);
                    alert('Verset du jour mis à jour avec succès sur le Tableau de Bord !');
                  }}
                  className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-black py-3 px-4 rounded-2xl text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Mettre à Jour le Verset du Jour</span>
                </button>
              </div>
            </div>
          </div>

          {/* SECTION 3: MODULE ÉVÉNEMENTS RELIGIEUX */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
              <span className="text-2xl">📅</span>
              <div>
                <h3 className="text-lg font-black text-white">Module Événements Religieux</h3>
                <p className="text-xs text-slate-400">Programmation des messes, veillées de prière et célébrations spirituelles</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Titre de l'Événement *</label>
                <input
                  type="text"
                  placeholder="Ex: Messe de Rentrée E-ROUAMA"
                  value={relEvtTitle}
                  onChange={e => setRelEvtTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-2.5 text-xs font-bold text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Date *</label>
                <input
                  type="date"
                  value={relEvtDate}
                  onChange={e => setRelEvtDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-2.5 text-xs font-bold text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Heure *</label>
                <input
                  type="time"
                  value={relEvtTime}
                  onChange={e => setRelEvtTime(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-2.5 text-xs font-bold text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Lieu *</label>
                <input
                  type="text"
                  placeholder="Ex: Paroisse Saint Augustin"
                  value={relEvtLocation}
                  onChange={e => setRelEvtLocation(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-2.5 text-xs font-bold text-white focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Thème Facultatif</label>
              <input
                type="text"
                placeholder="Ex: « Marcher ensemble dans la foi et la fraternité »"
                value={relEvtTheme}
                onChange={e => setRelEvtTheme(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-2.5 text-xs font-medium text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-950 p-4 rounded-2xl border border-slate-800">
              <span className="text-xs font-bold text-slate-300">
                Choix du canal de publication de l'événement religieux :
              </span>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  onClick={() => {
                    if (!relEvtTitle.trim() || !relEvtDate || !relEvtTime || !relEvtLocation.trim()) {
                      alert('Veuillez renseigner le titre, la date, l\'heure et le lieu.');
                      return;
                    }
                    createReligiousEvent(
                      { title: relEvtTitle, eventDate: relEvtDate, eventTime: relEvtTime, location: relEvtLocation, theme: relEvtTheme },
                      'APP'
                    );
                    setRelEvtTitle(''); setRelEvtDate(''); setRelEvtTime(''); setRelEvtLocation(''); setRelEvtTheme('');
                    alert('Événement religieux publié sur l\'App !');
                  }}
                  className="flex-1 sm:flex-none bg-amber-600 hover:bg-amber-500 text-white font-black py-2.5 px-4 rounded-xl text-xs transition-all active:scale-95"
                >
                  [Publier App]
                </button>
                <button
                  onClick={() => {
                    if (!relEvtTitle.trim() || !relEvtDate || !relEvtTime || !relEvtLocation.trim()) {
                      alert('Veuillez renseigner le titre, la date, l\'heure et le lieu.');
                      return;
                    }
                    createReligiousEvent(
                      { title: relEvtTitle, eventDate: relEvtDate, eventTime: relEvtTime, location: relEvtLocation, theme: relEvtTheme },
                      'MAIL'
                    );
                    setRelEvtTitle(''); setRelEvtDate(''); setRelEvtTime(''); setRelEvtLocation(''); setRelEvtTheme('');
                  }}
                  className="flex-1 sm:flex-none bg-emerald-600 hover:bg-emerald-500 text-white font-black py-2.5 px-4 rounded-xl text-xs transition-all active:scale-95"
                >
                  [Publier Mail]
                </button>
                <button
                  onClick={() => {
                    if (!relEvtTitle.trim() || !relEvtDate || !relEvtTime || !relEvtLocation.trim()) {
                      alert('Veuillez renseigner le titre, la date, l\'heure et le lieu.');
                      return;
                    }
                    createReligiousEvent(
                      { title: relEvtTitle, eventDate: relEvtDate, eventTime: relEvtTime, location: relEvtLocation, theme: relEvtTheme },
                      'GENERAL'
                    );
                    setRelEvtTitle(''); setRelEvtDate(''); setRelEvtTime(''); setRelEvtLocation(''); setRelEvtTheme('');
                  }}
                  className="flex-1 sm:flex-none bg-gradient-to-r from-amber-600 to-emerald-600 text-white font-black py-2.5 px-4 rounded-xl text-xs transition-all active:scale-95"
                >
                  [Publier App + Mail]
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL PREVIEW FOR PAYMENT RECEIPT REFERENCE */}
      {/* ========================================================= */}
      {previewDeclaration && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-lg w-full space-y-4 shadow-2xl relative">
            <button
              onClick={() => setPreviewDeclaration(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <XCircle className="w-6 h-6" />
            </button>

            <h3 className="text-xl font-black text-white flex items-center gap-2">
              <Eye className="w-5 h-5 text-amber-500" />
              <span>Détails du Reçu de Dépôt</span>
            </h3>

            <div className="space-y-3 bg-slate-950 p-4 rounded-2xl border border-slate-800 text-sm text-slate-300">
              <p><strong className="text-white">Membre :</strong> {previewDeclaration.memberNickname}</p>
              <p><strong className="text-white">Caisse :</strong> {FUND_LABELS[previewDeclaration.fund as FundType]}</p>
              <p><strong className="text-white">Montant :</strong> <span className="text-emerald-400 font-bold">{previewDeclaration.amount.toLocaleString('fr-FR')} F CFA</span></p>
              <p><strong className="text-white">Référence Déclarée :</strong> <span className="font-mono text-amber-300">{previewDeclaration.reference}</span></p>
              <p><strong className="text-white">Date de Déclaration :</strong> {previewDeclaration.date}</p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  approvePayment(previewDeclaration.id);
                  setPreviewDeclaration(null);
                  alert('Reçu validé avec succès !');
                }}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-black px-4 py-2 rounded-xl text-xs flex items-center gap-1 shadow"
              >
                <CheckCircle2 className="w-4 h-4" /> Valider Reçu
              </button>
              <button
                onClick={() => setPreviewDeclaration(null)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold px-4 py-2 rounded-xl text-xs"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EMAIL BROADCAST CONFIRMATION MODAL */}
      {emailModalData && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-emerald-500/40 rounded-3xl p-6 sm:p-8 max-w-lg w-full space-y-6 shadow-2xl relative">
            <button
              onClick={() => setEmailModalData(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <XCircle className="w-6 h-6" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 text-2xl">
                ✉️
              </div>
              <div>
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                  <span>Succès de Transmission de Courriel</span>
                  <span className="bg-emerald-500/20 text-emerald-400 text-[10px] px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                    100% Transmis
                  </span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Mode : {emailModalData.channel === 'GENERAL' ? '🌐 App + Email (Diffusé)' : '✉️ Email Uniquement'}
                </p>
              </div>
            </div>

            <div className="space-y-3 bg-slate-950 p-4 rounded-2xl border border-slate-800 text-xs text-slate-300">
              <p><strong className="text-white">Émetteur :</strong> {emailModalData.authorRole}</p>
              <p><strong className="text-white">Objet :</strong> <span className="text-amber-300 font-bold">{emailModalData.title}</span></p>
              <p><strong className="text-white">Adresses Email Destinataires ({emailModalData.recipients.length} membres) :</strong></p>
              <div className="max-h-28 overflow-y-auto bg-slate-900 p-2.5 rounded-xl border border-slate-800 font-mono text-[11px] text-emerald-300 space-y-1">
                {emailModalData.recipients.map((email, idx) => (
                  <div key={idx} className="flex items-center gap-1.5">
                    <span className="text-emerald-500 font-bold">✓</span>
                    <span>{email}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-3 bg-emerald-950/40 border border-emerald-800/60 rounded-2xl flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <p className="text-xs text-emerald-200 font-medium leading-relaxed">
                Le courriel a été transmis directement et automatiquement en arrière-plan par API aux {emailModalData.recipients.length} membres sans ouverture de logiciel tiers.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setEmailModalData(null)}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-black px-6 py-3 rounded-2xl text-xs shadow-lg transition-all active:scale-95 flex items-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Compris & Fermer</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FLOATING SPINNER / LOADING INDICATOR */}
      {isSendingEmail && (
        <div className="fixed top-6 right-6 z-50 bg-slate-900/95 border border-amber-500/60 text-amber-300 px-5 py-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-bounce">
          <Loader2 className="w-5 h-5 animate-spin text-amber-400 shrink-0" />
          <span className="text-xs font-bold">Envoi automatique des emails en cours...</span>
        </div>
      )}

      {/* FLOATING SUCCESS TOAST NOTIFICATION */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 bg-emerald-950/95 border border-emerald-500 text-white px-5 py-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-fadeIn">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-xs font-bold text-emerald-100">{toastMessage}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="ml-2 text-slate-400 hover:text-white"
          >
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};
