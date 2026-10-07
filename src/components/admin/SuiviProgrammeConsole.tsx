import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, addDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useApp } from '../../context/AppContext';
import {
  AdminRole,
  DepartmentRole,
  ProgrammeTask,
  ProgrammeAlert,
  TaskStatus,
  SecretaryPV,
  FinancialBilan,
  AgrProject,
  EventActivity,
  AdminLoginLog,
} from '../../types';
import {
  Shield,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Calendar,
  Search,
  Filter,
  Plus,
  Trash2,
  Eye,
  FileText,
  DollarSign,
  Layers,
  Sparkles,
  ExternalLink,
  Lock,
  RefreshCw,
  AlertCircle,
  TrendingUp,
  BarChart3,
  X,
  PhoneCall,
  User,
  Check,
  Activity,
  Users,
  Zap,
  Radio,
  CheckCircle,
  XCircle,
  ArrowUpRight,
  History,
  LogIn,
} from 'lucide-react';

interface AdminDepartmentConfig {
  key: string;
  name: string;
  shortName: string;
  icon: string;
  badgeBg: string;
  badgeText: string;
  borderColor: string;
  description: string;
  aliases: string[];
}

export const ADMIN_DEPARTMENTS_CONFIG: AdminDepartmentConfig[] = [
  {
    key: 'TRESORIER',
    name: 'Trésorerie Générale',
    shortName: 'Trésorier',
    icon: '💰',
    badgeBg: 'bg-emerald-500/10',
    badgeText: 'text-emerald-400',
    borderColor: 'border-emerald-500/30',
    description: 'Gestion des caisses, validation des dépôts et bilans financiers',
    aliases: ['TRESOR', 'TRESORIER', 'TRESORERIE'],
  },
  {
    key: 'CERVEAU',
    name: 'Le Cerveau (Président)',
    shortName: 'Présidence (Cerveau)',
    icon: '🧠',
    badgeBg: 'bg-amber-500/10',
    badgeText: 'text-amber-400',
    borderColor: 'border-amber-500/30',
    description: 'Verrouillage des décaissements et alertes financières',
    aliases: ['CERVEAU', 'PRESID', 'PRESIDENT', 'PRESIDENCE'],
  },
  {
    key: 'PAYOR',
    name: 'Espace Payor',
    shortName: 'Payor',
    icon: '⚖️',
    badgeBg: 'bg-purple-500/10',
    badgeText: 'text-purple-400',
    borderColor: 'border-purple-500/30',
    description: 'Validation administrative des PV, règlements et bilans',
    aliases: ['PAYOR', 'RESP_PAYOR'],
  },
  {
    key: 'SECRETARIAT',
    name: 'Secrétariat Général',
    shortName: 'Secrétariat',
    icon: '📝',
    badgeBg: 'bg-blue-500/10',
    badgeText: 'text-blue-400',
    borderColor: 'border-blue-500/30',
    description: 'Rédaction des PVs, présences et registre officiel',
    aliases: ['SECRETAR', 'SECRETAIRE', 'SECRETARIAT', 'SG'],
  },
  {
    key: 'COM',
    name: "Base d'Information et de Communication (BIC)",
    shortName: 'BIC (Com)',
    icon: '📢',
    badgeBg: 'bg-cyan-500/10',
    badgeText: 'text-cyan-400',
    borderColor: 'border-cyan-500/30',
    description: 'Diffusion officielle, alertes publiques et accusés ACK',
    aliases: ['COM', 'BIC', 'COMMUNICATION'],
  },
  {
    key: 'ORGANISATION',
    name: 'Commission Organisation',
    shortName: 'Organisation',
    icon: '🎪',
    badgeBg: 'bg-rose-500/10',
    badgeText: 'text-rose-400',
    borderColor: 'border-rose-500/30',
    description: 'Événements, comités ad-hoc et budget prévisionnel',
    aliases: ['ORGANIS', 'ORGANISATEUR', 'ORGANISATION', 'PCO'],
  },
  {
    key: 'PROJET',
    name: 'Commission Projets (AGR)',
    shortName: 'Respo Projet',
    icon: '🚀',
    badgeBg: 'bg-indigo-500/10',
    badgeText: 'text-indigo-400',
    borderColor: 'border-indigo-500/30',
    description: 'Études de rentabilité et montage des projets d’investissement',
    aliases: ['PROJET', 'AGR', 'RESPO_PROJET', 'RESP_PROJET'],
  },
  {
    key: 'SPIRITUALITE',
    name: 'Commission Spiritualité',
    shortName: 'Spiritualité',
    icon: '🕊️',
    badgeBg: 'bg-violet-500/10',
    badgeText: 'text-violet-400',
    borderColor: 'border-violet-500/30',
    description: 'Prière ROUAMA, liturgie AELF et méditations',
    aliases: ['SPIRIT', 'SPIRITUALITE'],
  },
  {
    key: 'SDP',
    name: 'Chargé du Suivi du Programme (SDP)',
    shortName: 'Chargé du Suivi',
    icon: '🕵️',
    badgeBg: 'bg-yellow-500/10',
    badgeText: 'text-yellow-400',
    borderColor: 'border-yellow-500/30',
    description: 'Supervision interne et contrôle du respect du calendrier',
    aliases: ['SDP', 'PROGRAMME', 'SUIVI', 'RESP_PROGRAMME', 'SUIVI_PROGRAMME', 'CHARGE_DU_SUIVI'],
  },
  {
    key: 'SUPER_ADMIN',
    name: 'Super Administrateur',
    shortName: 'Super Admin',
    icon: '👑',
    badgeBg: 'bg-red-500/10',
    badgeText: 'text-red-400',
    borderColor: 'border-red-500/30',
    description: 'Supervision générale et audit souverain de la plateforme',
    aliases: ['SUPER_ADMIN', 'SUPERADMIN', 'ADMIN_GENERAL'],
  },
];

interface SuiviProgrammeConsoleProps {
  activeRole?: AdminRole;
}

export const SuiviProgrammeConsole: React.FC<SuiviProgrammeConsoleProps> = ({ activeRole }) => {
  const {
    members,
    pvs,
    bilans,
    projects,
    activities,
    fundBalances,
    declarations,
    programmeTasks,
    programmeAlerts,
    adminLogs,
    logAdminConnection,
    addProgrammeTask,
    updateProgrammeTask,
    deleteProgrammeTask,
    createProgrammeAlert,
    resolveProgrammeAlert,
  } = useApp();

  // Tab state: SYNTHESE, TACHES, ALERTES, AUDIT, CONNEXIONS
  const [activeTab, setActiveTab] = useState<'SYNTHESE' | 'TACHES' | 'ALERTES' | 'AUDIT' | 'CONNEXIONS'>('SYNTHESE');

  // =========================================================
  // ÉCOUTE FIRESTORE EN TEMPS RÉEL (onSnapshot) DES ADMIN_LOGS
  // =========================================================
  const [realtimeAdminLogs, setRealtimeAdminLogs] = useState<AdminLoginLog[]>([]);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'admin_logs'),
      (snapshot) => {
        const loaded: AdminLoginLog[] = [];
        snapshot.forEach((d) => {
          loaded.push({ id: d.id, ...(d.data() as any) });
        });
        loaded.sort((a, b) => (b.loginTimestamp || '').localeCompare(a.loginTimestamp || ''));
        setRealtimeAdminLogs(loaded);
      },
      (err) => {
        console.warn('Erreur écoute collection admin_logs:', err);
      }
    );
    return () => unsub();
  }, []);

  const effectiveAdminLogs = useMemo(() => {
    if (realtimeAdminLogs.length > 0) return realtimeAdminLogs;
    return adminLogs || [];
  }, [realtimeAdminLogs, adminLogs]);

  // Date du jour (Multi-format pour prise en compte stricte des fuseaux horaires)
  const todayDateStrings = useMemo(() => {
    const now = new Date();
    const isoDate = now.toISOString().split('T')[0];
    const localYear = now.getFullYear();
    const localMonth = String(now.getMonth() + 1).padStart(2, '0');
    const localDay = String(now.getDate()).padStart(2, '0');
    return [isoDate, `${localYear}-${localMonth}-${localDay}`];
  }, []);

  const todayDisplayDate = useMemo(() => {
    return new Date().toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }, []);

  // Filtrage des logs pour la journée actuelle
  const todayLogs = useMemo(() => {
    return effectiveAdminLogs.filter((log) => {
      if (!log) return false;
      if (log.dateString && todayDateStrings.includes(log.dateString)) return true;
      if (log.loginTimestamp) {
        const logDateIso = log.loginTimestamp.split('T')[0];
        if (todayDateStrings.includes(logDateIso)) return true;
        const d = new Date(log.loginTimestamp);
        if (!isNaN(d.getTime())) {
          const now = new Date();
          return (
            d.getFullYear() === now.getFullYear() &&
            d.getMonth() === now.getMonth() &&
            d.getDate() === now.getDate()
          );
        }
      }
      return false;
    });
  }, [effectiveAdminLogs, todayDateStrings]);

  const deptAttendanceMatch = (dept: AdminDepartmentConfig, role?: string) => {
    if (!role) return false;
    const cleanRole = role.toUpperCase().trim();
    const cleanKey = dept.key.toUpperCase().trim();
    return (
      cleanRole === cleanKey ||
      cleanRole.includes(cleanKey) ||
      cleanKey.includes(cleanRole) ||
      dept.aliases.some((alias) => cleanRole.includes(alias))
    );
  };

  // Compilation des statistiques par département pour le jour en cours
  const departmentAttendance = useMemo(() => {
    return ADMIN_DEPARTMENTS_CONFIG.map((dept) => {
      const logsForDept = todayLogs.filter((log) => deptAttendanceMatch(dept, log.role));

      const count = logsForDept.length;
      const isConnectedToday = count > 0;
      const sortedLogs = [...logsForDept].sort((a, b) =>
        (b.loginTimestamp || '').localeCompare(a.loginTimestamp || '')
      );
      const latestLog = sortedLogs[0];
      const lastLoginTime = latestLog?.loginTimestamp
        ? new Date(latestLog.loginTimestamp).toLocaleTimeString('fr-FR', {
            hour: '2-digit',
            minute: '2-digit',
          })
        : null;

      return {
        ...dept,
        count,
        isConnectedToday,
        latestLog,
        lastLoginTime,
        logs: sortedLogs,
      };
    });
  }, [todayLogs]);

  const connectedDepts = useMemo(() => {
    return departmentAttendance.filter((d) => d.isConnectedToday);
  }, [departmentAttendance]);

  const absentDepts = useMemo(() => {
    return departmentAttendance.filter((d) => !d.isConnectedToday);
  }, [departmentAttendance]);

  const totalConnectionsToday = todayLogs.length;

  // Simulation test pour vérification immédiate dans l'espace SDP
  const [isSimulatingLogin, setIsSimulatingLogin] = useState<boolean>(false);
  const [simulationRoleSelected, setSimulationRoleSelected] = useState<string>('TRESORIER');

  const handleSimulateAdminLogin = async (deptKey: string) => {
    setIsSimulatingLogin(true);
    try {
      const targetDept = ADMIN_DEPARTMENTS_CONFIG.find((d) => d.key === deptKey);
      const now = new Date();
      await addDoc(collection(db, 'admin_logs'), {
        userId: deptKey,
        memberName: targetDept?.name || deptKey,
        role: deptKey,
        loginTimestamp: now.toISOString(),
        dateString: now.toISOString().split('T')[0],
      });
    } catch (err) {
      console.warn('Erreur simulation admin_logs:', err);
    } finally {
      setIsSimulatingLogin(false);
    }
  };

  // =========================================================
  // RENDU DES 2 BLOCS D'AUDIT DES CONNEXIONS ADMINS (JOUR J)
  // =========================================================
  const renderAdminAttendanceTwoBlocks = () => (
    <div className="space-y-6">
      {/* En-tête de section avec badge temps réel et assiduité */}
      <div className="bg-slate-900 border border-emerald-500/30 rounded-3xl p-5 sm:p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 bg-emerald-500/20 text-emerald-300 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider mb-2 border border-emerald-500/30">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
              <span>Audit des Connexions Administrateurs • En Direct (onSnapshot)</span>
            </div>
            <h3 className="text-lg sm:text-xl font-black text-white flex flex-wrap items-center gap-2">
              <span>Contrôle d'Assiduité des Départements Admins</span>
              <span className="text-xs font-mono font-bold text-slate-300 bg-slate-950 px-2.5 py-1 rounded-xl border border-slate-800">
                {todayDisplayDate}
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl">
              Supervision continue de l'assiduité des responsables de départements admins (Trésorier, Organisateur, Respo Projet, Payor, Secrétaire, etc.).
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-slate-950 px-4 py-2.5 rounded-2xl border border-slate-800 text-right">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Assiduité Globale</span>
              <span className="text-xl font-black text-emerald-400 font-mono">
                {connectedDepts.length} / {ADMIN_DEPARTMENTS_CONFIG.length} connectés
              </span>
              <span className="text-[10px] text-slate-500 block">
                {totalConnectionsToday} session{totalConnectionsToday > 1 ? 's' : ''} au total
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* GRILLE DES 2 BLOCS DU CAHIER DES CHARGES */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ========================================================= */}
        {/* BLOC 1 : DÉPARTEMENTS ADMINS CONNECTÉS AUJOURD'HUI */}
        {/* ========================================================= */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-500/10 rounded-xl border border-emerald-500/20 text-emerald-400">
                  <CheckCircle className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-white uppercase tracking-wide">
                    BLOC 1 : DÉPARTEMENTS ADMINS CONNECTÉS AUJOURD'HUI
                  </h4>
                  <p className="text-[11px] text-slate-400 font-medium">
                    Responsables ayant effectué au moins 1 connexion ce jour
                  </p>
                </div>
              </div>
              <span className="bg-emerald-500/20 text-emerald-300 text-xs font-black px-2.5 py-1 rounded-full border border-emerald-500/30">
                🟢 {connectedDepts.length} Présent(s)
              </span>
            </div>

            {connectedDepts.length === 0 ? (
              <div className="bg-slate-950/80 rounded-2xl border border-slate-800/80 p-8 text-center space-y-2 my-2">
                <Clock className="w-8 h-8 text-slate-600 mx-auto animate-pulse" />
                <p className="text-xs font-bold text-slate-300">
                  Aucune connexion administrative enregistrée aujourd'hui pour l'instant.
                </p>
                <p className="text-[11px] text-slate-500">
                  Dès qu'un responsable se connecte, son statut passera instantanément à 🟢 En ligne / Passé aujourd'hui.
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                {connectedDepts.map((dept) => (
                  <div
                    key={dept.key}
                    className="bg-slate-950 p-3.5 rounded-2xl border border-emerald-500/30 hover:border-emerald-500/60 transition-all flex items-center justify-between gap-3 shadow-md"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-2xl p-2 bg-slate-900 rounded-xl border border-slate-800 shrink-0">
                        {dept.icon}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${dept.badgeBg} ${dept.badgeText} border ${dept.borderColor}`}>
                            {dept.shortName}
                          </span>
                          <span className="text-xs font-black text-white truncate">
                            {dept.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400">
                          <Clock className="w-3 h-3 text-emerald-400 shrink-0" />
                          <span>
                            Dernière connexion : <strong className="text-white">{dept.lastLoginTime ? `Connecté à ${dept.lastLoginTime}` : "Aujourd'hui"}</strong>
                          </span>
                          {dept.latestLog?.memberName && dept.latestLog.memberName !== dept.key && (
                            <span className="text-slate-500 truncate hidden sm:inline">
                              • {dept.latestLog.memberName}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-black">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span>🟢 En ligne / Passé aujourd'hui</span>
                      </div>
                      <span className="block text-[10px] font-bold text-slate-400 mt-1">
                        {dept.count} connexion{dept.count > 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
            <span>Mise à jour instantanée sans rechargement (onSnapshot)</span>
            <span className="text-emerald-400 font-mono font-bold">● Synchronisé</span>
          </div>
        </div>

        {/* ========================================================= */}
        {/* BLOC 2 : FRÉQUENCE & NOMBRE DE CONNEXIONS DU JOUR */}
        {/* ========================================================= */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-500/10 rounded-xl border border-amber-500/20 text-amber-400">
                  <BarChart3 className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-white uppercase tracking-wide">
                    BLOC 2 : FRÉQUENCE & NOMBRE DE CONNEXIONS DU JOUR
                  </h4>
                  <p className="text-[11px] text-slate-400 font-medium">
                    Compteur d'assiduité par département ({totalConnectionsToday} sessions au total)
                  </p>
                </div>
              </div>
              <span className="bg-slate-950 text-slate-300 text-xs font-mono font-black px-2.5 py-1 rounded-full border border-slate-800">
                {totalConnectionsToday} Connexions
              </span>
            </div>

            {/* Tableau ou cartes récapitulatives avec le compteur d'assiduité du jour */}
            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
              {departmentAttendance.map((dept) => {
                const isZero = dept.count === 0;
                return (
                  <div
                    key={dept.key}
                    className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                      isZero
                        ? 'bg-rose-950/20 border-rose-500/30 hover:border-rose-500/50'
                        : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-xl p-1.5 bg-slate-900 rounded-xl border border-slate-800 shrink-0">
                        {dept.icon}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-white truncate">
                            {dept.name}
                          </span>
                          <span className="text-[10px] text-slate-400 font-semibold">
                            ({dept.shortName})
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 truncate">
                          {dept.description}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      {isZero ? (
                        <div className="space-y-1">
                          <span className="inline-block px-2.5 py-1 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-300 text-[10px] font-black">
                            🔴 0 connexion aujourd'hui
                          </span>
                          <span className="block text-[10px] text-rose-400/80 font-bold">
                            Absent / Non connecté
                          </span>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <span className="inline-block px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[10px] font-black font-mono">
                            {dept.shortName} : {dept.count} connexion{dept.count > 1 ? 's' : ''} aujourd'hui
                          </span>
                          <span className="block text-[10px] text-slate-400">
                            Dernier passage : {dept.lastLoginTime || 'Aujourd’hui'}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Barre de relance pour absents */}
          <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-[11px]">
            <div className="flex items-center gap-2 text-slate-400">
              <span>Départements non connectés aujourd'hui :</span>
              <span className="text-rose-400 font-bold font-mono">{absentDepts.length} / {ADMIN_DEPARTMENTS_CONFIG.length}</span>
            </div>
            {absentDepts.length > 0 && (
              <button
                type="button"
                onClick={() => handleOpenAlertModal(absentDepts[0].key, absentDepts[0].name)}
                className="text-[10px] bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 transition-all"
              >
                <AlertTriangle className="w-3 h-3 text-rose-400" />
                <span>Relancer les absents</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* BARRE DE SIMULATION & TEST IMMÉDIAT DE CONNEXION */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Zap className="w-4 h-4 text-amber-400 shrink-0" />
          <div>
            <span className="text-xs font-bold text-white block">
              Tester l'actualisation temps réel d'une connexion admin
            </span>
            <span className="text-[10px] text-slate-400 block">
              Simule l'enregistrement immédiat dans Firestore (admin_logs) pour tester l'actualisation instantanée sans rafraîchir.
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={simulationRoleSelected}
            onChange={(e) => setSimulationRoleSelected(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white font-bold"
          >
            {ADMIN_DEPARTMENTS_CONFIG.map((d) => (
              <option key={d.key} value={d.key}>
                {d.icon} {d.shortName} ({d.name})
              </option>
            ))}
          </select>

          <button
            type="button"
            disabled={isSimulatingLogin}
            onClick={() => handleSimulateAdminLogin(simulationRoleSelected)}
            className="bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-black px-3.5 py-1.5 rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
          >
            {isSimulatingLogin ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <LogIn className="w-3.5 h-3.5" />
            )}
            <span>Simuler Connexion</span>
          </button>
        </div>
      </div>
    </div>
  );

  // Filters for TACHES tab
  const [filterDepartment, setFilterDepartment] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modal: Add / Edit Task
  const [isAddTaskModalOpen, setIsAddTaskModalOpen] = useState(false);
  const [taskForm, setTaskForm] = useState<{
    department: DepartmentRole;
    departmentName: string;
    source: 'PV' | 'PROJET' | 'ACTIVITE' | 'CALENDRIER' | 'MANUAL';
    sourceTitle: string;
    title: string;
    description: string;
    assignedTo: string;
    deadline: string;
    status: TaskStatus;
    notes: string;
  }>({
    department: 'SECRETARIAT',
    departmentName: 'Secrétariat Général',
    source: 'CALENDRIER',
    sourceTitle: 'Programme Annuel 2026',
    title: '',
    description: '',
    assignedTo: '',
    deadline: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
    status: 'IN_PROGRESS',
    notes: '',
  });

  // Modal: Create Alert / Signalement
  const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);
  const [alertTargetTask, setAlertTargetTask] = useState<ProgrammeTask | null>(null);
  const [alertForm, setAlertForm] = useState<{
    targetDepartment: DepartmentRole;
    targetDepartmentName: string;
    title: string;
    message: string;
    severity: 'INFO' | 'WARNING' | 'CRITICAL';
    targetPhone: string;
  }>({
    targetDepartment: 'SECRETARIAT',
    targetDepartmentName: 'Secrétariat Général',
    title: '',
    message: '',
    severity: 'WARNING',
    targetPhone: '',
  });

  // Modal: Audit Detail (Read-Only)
  const [auditItemModal, setAuditItemModal] = useState<{
    type: 'PV' | 'BILAN' | 'PROJET' | 'ACTIVITE';
    item: SecretaryPV | FinancialBilan | AgrProject | EventActivity | any;
  } | null>(null);

  // Sub-filter for Audit view
  const [auditSubCategory, setAuditSubCategory] = useState<'PVS' | 'BILANS' | 'PROJETS' | 'ACTIVITES' | 'CAISSES'>('PVS');

  // Default Baseline Tasks if programmeTasks is empty
  const defaultBaselineTasks: Omit<ProgrammeTask, 'id' | 'createdAt'>[] = useMemo(() => [
    {
      department: 'SECRETARIAT',
      departmentName: 'Secrétariat Général',
      source: 'PV',
      sourceTitle: 'Règlement Intérieur E-ROUAMA',
      title: 'Rédaction et archivage systématique des Procès-Verbaux de réunions',
      description: 'Chaque réunion doit faire l’objet d’un PV complet avec registre des présences et transmission au Payor.',
      assignedTo: 'Secrétariat Général',
      deadline: '2026-12-31',
      status: 'IN_PROGRESS',
      notes: 'Suivi permanent des émargements',
    },
    {
      department: 'TRESORIER',
      departmentName: 'Trésorerie Générale',
      source: 'CALENDRIER',
      sourceTitle: 'Statuts E-ROUAMA (Art. Cotisations)',
      title: 'Recouvrement mensuel des cotisations statutaires (500 FCFA/mois)',
      description: 'Tenue des 5 caisses, validation des reçus Wave et relances régulières des membres en retard.',
      assignedTo: 'Trésorier Général (Capelo)',
      deadline: '2026-10-31',
      status: 'WARNING',
      notes: 'Relances périodiques nécessaires',
    },
    {
      department: 'TRESORIER',
      departmentName: 'Trésorerie Générale',
      source: 'CALENDRIER',
      sourceTitle: 'Comptabilité Annuelle',
      title: 'Publication du Bilan Financier Trimestriel consolidé',
      description: 'Arrêté des caisses, pointage des décaissements et soumission au Payor pour double visa.',
      assignedTo: 'Trésorier Général',
      deadline: '2026-11-15',
      status: 'IN_PROGRESS',
    },
    {
      department: 'PROJET',
      departmentName: 'Commission Projets (AGR)',
      source: 'PROJET',
      sourceTitle: 'Projet Élevage Poulets Goliath',
      title: 'Finalisation de la levée de fonds et démarrage du site pilote AGR',
      description: 'Atteindre le coût estimé du projet, vérifier les quotes-parts des membres et lancer les acquisitions.',
      assignedTo: 'Responsable Commission Projets',
      deadline: '2026-11-30',
      status: 'WARNING',
      notes: 'Investissement prioritaire de la Fraternité',
    },
    {
      department: 'ORGANISATION',
      departmentName: 'Commission Organisation',
      source: 'ACTIVITE',
      sourceTitle: 'Soirée Fraternelle Rouama',
      title: 'Mise en place du Comité Ad-hoc (PCO, Cambuse, Logistique)',
      description: 'Dépôt du budget prévisionnel de l’événement et validation par le Trésorier Général.',
      assignedTo: 'Commission Organisation',
      deadline: '2026-11-10',
      status: 'IN_PROGRESS',
    },
    {
      department: 'SPIRITUALITE',
      departmentName: 'Département Spiritualité',
      source: 'CALENDRIER',
      sourceTitle: 'Vie Spirituelle Rouama',
      title: 'Animation de la Chaîne de Prière et intentions fraternelles',
      description: 'Veiller au maintien quotidien de la prière de Saint Augustin et du verset du jour.',
      assignedTo: 'Responsable Spiritualité',
      deadline: '2026-12-31',
      status: 'IN_PROGRESS',
    },
    {
      department: 'COM',
      departmentName: 'Base d’Information et Communication (BIC)',
      source: 'CALENDRIER',
      sourceTitle: 'Gbaïraï & Annonces',
      title: 'Diffusion des communiqués officiels et suivi des accusés de réception (ACK)',
      description: 'Garantir que 100% des décisions validées par Payor soient portées à la connaissance des membres.',
      assignedTo: 'Responsable Communication (COM)',
      deadline: '2026-12-31',
      status: 'IN_PROGRESS',
    },
    {
      department: 'CERVEAU',
      departmentName: 'Le Cerveau (Présidence)',
      source: 'CALENDRIER',
      sourceTitle: 'Haute Gouvernance',
      title: 'Audit des accès membres et arbitrage des décaissements',
      description: 'Supervision de la collégialité, validation des clés PIN et verrouillage des sorties de caisse.',
      assignedTo: 'Le Cerveau (Président)',
      deadline: '2026-12-31',
      status: 'IN_PROGRESS',
    },
  ], []);

  // Merged live tasks: from Firestore, or fallback to default baseline tasks
  const allTasks: ProgrammeTask[] = useMemo(() => {
    if (programmeTasks && programmeTasks.length > 0) {
      return programmeTasks;
    }
    return defaultBaselineTasks.map((t, idx) => ({
      ...t,
      id: `BASE-TASK-${idx + 1}`,
      createdAt: new Date().toISOString(),
    }));
  }, [programmeTasks, defaultBaselineTasks]);

  // Derived tasks from real database records (Projects with deadline, PVs with status)
  const autoDerivedTasks: ProgrammeTask[] = useMemo(() => {
    const derived: ProgrammeTask[] = [];

    // 1. Projects deadlines
    projects.forEach(p => {
      if (p.paymentDeadline) {
        const isPast = new Date(p.paymentDeadline).getTime() < Date.now();
        derived.push({
          id: `DERIVED-PROJ-${p.id}`,
          department: 'PROJET',
          departmentName: 'Commission Projets (AGR)',
          source: 'PROJET',
          sourceTitle: p.title,
          sourceId: p.id,
          title: `Date Limite Cotisation AGR : ${p.title}`,
          description: `Objectif per capita : ${p.requiredAmountPerMember?.toLocaleString('fr-FR')} F CFA. Coût total : ${p.estimatedCost?.toLocaleString('fr-FR')} F CFA.`,
          assignedTo: (p.pilotTeam && p.pilotTeam[0]) || 'Commission Projets',
          deadline: p.paymentDeadline,
          status: isPast ? 'OVERDUE' : 'IN_PROGRESS',
          createdAt: new Date().toISOString(),
        });
      }
    });

    // 2. Activities deadlines
    activities.forEach(a => {
      if (a.eventDate) {
        const isPast = new Date(a.eventDate).getTime() < Date.now();
        derived.push({
          id: `DERIVED-ACT-${a.id}`,
          department: 'ORGANISATION',
          departmentName: 'Commission Organisation',
          source: 'ACTIVITE',
          sourceTitle: a.title,
          sourceId: a.id,
          title: `Échéance Événement : ${a.title}`,
          description: `Budget estimé : ${(a.budget || 0).toLocaleString('fr-FR')} F CFA. Statut : ${a.status}.`,
          assignedTo: (a.committees && a.committees[0]?.leaderNickname) || 'Organisation',
          deadline: a.eventDate,
          status: isPast ? 'COMPLETED' : 'IN_PROGRESS',
          createdAt: new Date().toISOString(),
        });
      }
    });

    return derived;
  }, [projects, activities]);

  // Combined master list of tasks for the SDP
  const consolidatedTasks: ProgrammeTask[] = useMemo(() => {
    const map = new Map<string, ProgrammeTask>();
    allTasks.forEach(t => map.set(t.id, t));
    autoDerivedTasks.forEach(t => {
      if (!map.has(t.id)) {
        map.set(t.id, t);
      }
    });
    return Array.from(map.values());
  }, [allTasks, autoDerivedTasks]);

  // Compute Task Status based on deadline if not completed
  const evaluatedTasks = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return consolidatedTasks.map(task => {
      if (task.status === 'COMPLETED') {
        return task;
      }
      if (!task.deadline) {
        return task;
      }
      const dDate = new Date(task.deadline);
      dDate.setHours(0, 0, 0, 0);
      const diffDays = Math.ceil((dDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      let autoStatus: TaskStatus = task.status;
      if (diffDays < 0) {
        autoStatus = 'OVERDUE';
      } else if (diffDays <= 7) {
        autoStatus = 'WARNING';
      } else {
        autoStatus = 'IN_PROGRESS';
      }

      return {
        ...task,
        status: autoStatus,
      };
    });
  }, [consolidatedTasks]);

  // Filtered tasks for the list
  const filteredTasks = useMemo(() => {
    return evaluatedTasks.filter(t => {
      if (filterDepartment !== 'ALL' && t.department !== filterDepartment) return false;
      if (filterStatus !== 'ALL' && t.status !== filterStatus) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = t.title.toLowerCase().includes(q);
        const matchDesc = t.description?.toLowerCase().includes(q);
        const matchDept = t.departmentName?.toLowerCase().includes(q);
        const matchResp = t.assignedTo?.toLowerCase().includes(q);
        if (!matchTitle && !matchDesc && !matchDept && !matchResp) return false;
      }
      return true;
    });
  }, [evaluatedTasks, filterDepartment, filterStatus, searchQuery]);

  // Statistics & Progress Indicators
  const stats = useMemo(() => {
    const total = evaluatedTasks.length;
    const completed = evaluatedTasks.filter(t => t.status === 'COMPLETED').length;
    const inProgress = evaluatedTasks.filter(t => t.status === 'IN_PROGRESS').length;
    const warning = evaluatedTasks.filter(t => t.status === 'WARNING').length;
    const overdue = evaluatedTasks.filter(t => t.status === 'OVERDUE').length;
    const activeAlerts = (programmeAlerts || []).filter(a => a.status === 'PENDING').length;

    const rate = total > 0 ? Math.round(((completed + inProgress * 0.5) / total) * 100) : 100;

    return {
      total,
      completed,
      inProgress,
      warning,
      overdue,
      activeAlerts,
      rate,
    };
  }, [evaluatedTasks, programmeAlerts]);

  // Department Summaries for SYNTHESE Tab
  const departmentSummaries = useMemo(() => {
    const depts: {
      key: DepartmentRole;
      name: string;
      roleTitle: string;
      responsibleName: string;
      responsiblePhone: string;
      color: string;
      icon: string;
      missions: string;
    }[] = [
      {
        key: 'SECRETARIAT',
        name: 'Secrétariat Général',
        roleTitle: 'Secrétaire Général',
        responsibleName: 'Secrétariat (PIN 4040)',
        responsiblePhone: '2250757537785',
        color: 'from-blue-600 to-sky-700',
        icon: '📝',
        missions: 'Rédaction et archivage des PV de réunions, registre des présences et tenue des résolutions.',
      },
      {
        key: 'TRESORIER',
        name: 'Trésorerie Générale',
        roleTitle: 'Trésorier Général',
        responsibleName: 'Wilfried Capelo (PIN 210300)',
        responsiblePhone: '2250501948962',
        color: 'from-emerald-600 to-teal-700',
        icon: '💰',
        missions: 'Tenue des 5 caisses, validation des cotisations Wave (500 F/mois) et bilans trimestriels.',
      },
      {
        key: 'PROJET',
        name: 'Commission Projets (AGR)',
        roleTitle: 'Responsable Projets AGR',
        responsibleName: 'Commission Projets (PIN 2020)',
        responsiblePhone: '2250564281013',
        color: 'from-amber-600 to-orange-700',
        icon: '🚀',
        missions: 'Montage et exécution des projets d’investissement rentables (Poulets Goliath), respect des échéances.',
      },
      {
        key: 'ORGANISATION',
        name: 'Commission Organisation',
        roleTitle: 'Responsable Organisation',
        responsibleName: 'Commission Organisation (PIN 3030)',
        responsiblePhone: '2250584346071',
        color: 'from-purple-600 to-indigo-700',
        icon: '🎪',
        missions: 'Préparation des sorties et soirées statutaires, constitution des comités PCO et budgets.',
      },
      {
        key: 'SPIRITUALITE',
        name: 'Département Spiritualité',
        roleTitle: 'Responsable Spiritualité',
        responsibleName: 'Spiritualité (PIN 5050)',
        responsiblePhone: '2250747195076',
        color: 'from-cyan-600 to-blue-700',
        icon: '✝️',
        missions: 'Prière ROUAMA, liturgie AELF, chaîne de prière et intentions fraternelles.',
      },
      {
        key: 'COM',
        name: 'Base d’Information & COM (BIC)',
        roleTitle: 'Responsable Communication',
        responsibleName: 'BIC / COM (PIN 1010)',
        responsiblePhone: '2250503643626',
        color: 'from-rose-600 to-pink-700',
        icon: '📢',
        missions: 'Diffusion des décisions officielles, validation des communiqués avec accusé de réception (ACK).',
      },
      {
        key: 'CERVEAU',
        name: 'Le Cerveau (Présidence)',
        roleTitle: 'Président / Le Cerveau',
        responsibleName: 'Le Cerveau (PIN 1234)',
        responsiblePhone: '2250501948962',
        color: 'from-amber-500 to-yellow-600',
        icon: '👑',
        missions: 'Haute gouvernance, arbitrage suprême, verrouillage et validation des décaissements.',
      },
    ];

    return depts.map(d => {
      const deptTasks = evaluatedTasks.filter(t => t.department === d.key);
      const total = deptTasks.length;
      const overdue = deptTasks.filter(t => t.status === 'OVERDUE').length;
      const warning = deptTasks.filter(t => t.status === 'WARNING').length;
      const completed = deptTasks.filter(t => t.status === 'COMPLETED').length;
      const inProgress = deptTasks.filter(t => t.status === 'IN_PROGRESS').length;
      const pendingAlerts = (programmeAlerts || []).filter(a => a.targetDepartment === d.key && a.status === 'PENDING').length;

      // Status indicator: 🔴 En retard > 0 | 🟡 À relancer > 0 ou alertes > 0 | 🟢 En cours / Dans les temps
      let healthStatus: 'GREEN' | 'YELLOW' | 'RED' = 'GREEN';
      let healthLabel = '🟢 Dans les temps / Conforme';
      if (overdue > 0) {
        healthStatus = 'RED';
        healthLabel = `🔴 ${overdue} Tâche(s) en retard`;
      } else if (warning > 0 || pendingAlerts > 0) {
        healthStatus = 'YELLOW';
        healthLabel = `🟡 À relancer (${warning} échéance(s) proche(s))`;
      }

      return {
        ...d,
        totalTasks: total,
        overdueTasks: overdue,
        warningTasks: warning,
        completedTasks: completed,
        inProgressTasks: inProgress,
        pendingAlerts,
        healthStatus,
        healthLabel,
      };
    });
  }, [evaluatedTasks, programmeAlerts]);

  // Open Alert Modal with prefill for a specific department or task
  const handleOpenAlertModal = (dept: string, deptName: string, task?: ProgrammeTask) => {
    const summary = departmentSummaries.find(d => d.key === dept);
    setAlertTargetTask(task || null);
    setAlertForm({
      targetDepartment: dept as DepartmentRole,
      targetDepartmentName: deptName,
      title: task ? `Rappel : ${task.title}` : `Signalement d'audit : ${deptName}`,
      message: task
        ? `Bonjour fraternel. En qualité de Chargé du Suivi du Programme, je constate que l'engagement « ${task.title} » arrive à échéance le ${task.deadline}. Merci de bien vouloir faire le point sur son état d'avancement et régulariser la situation.`
        : `Bonjour fraternel. En qualité de Chargé du Suivi du Programme, je sollicite un point d'étape urgent concernant les engagements statutaires de votre département.`,
      severity: task?.status === 'OVERDUE' ? 'CRITICAL' : 'WARNING',
      targetPhone: summary?.responsiblePhone || '2250501948962',
    });
    setIsAlertModalOpen(true);
  };

  // Submit Alert / Signalement
  const handleSubmitAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!alertForm.title.trim() || !alertForm.message.trim()) {
      alert('Veuillez renseigner le titre et le message du signalement.');
      return;
    }

    const res = await createProgrammeAlert({
      taskId: alertTargetTask?.id,
      taskTitle: alertTargetTask?.title,
      targetDepartment: alertForm.targetDepartment,
      targetDepartmentName: alertForm.targetDepartmentName,
      title: alertForm.title,
      message: alertForm.message,
      severity: alertForm.severity,
      targetPhone: alertForm.targetPhone,
      sentBy: 'Chargé du Suivi du Programme (SDP)',
    });

    if (res.success) {
      setIsAlertModalOpen(false);
      setAlertTargetTask(null);
    }
  };

  // Direct WhatsApp Link Generator for SDP Reminders
  const generateWhatsAppReminderLink = (alert: {
    targetDepartmentName: string;
    title: string;
    message: string;
    targetPhone?: string;
  }) => {
    const phone = (alert.targetPhone || '2250501948962').replace(/\D/g, '');
    const text = encodeURIComponent(
      `🚨 *[E-ROUAMA - AUDIT & CONTRÔLE INTERNE]*\n\n` +
      `📌 *Destinataire :* ${alert.targetDepartmentName}\n` +
      `⚠️ *Objet :* ${alert.title}\n\n` +
      `${alert.message}\n\n` +
      `_Message officiel transmis par le Chargé du Suivi du Programme (SDP) E-ROUAMA._`
    );
    return `https://wa.me/${phone}?text=${text}`;
  };

  // Submit Add Task
  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskForm.title.trim()) {
      alert('Veuillez saisir l’intitulé de la tâche.');
      return;
    }

    const res = await addProgrammeTask({
      department: taskForm.department,
      departmentName: taskForm.departmentName,
      source: taskForm.source,
      sourceTitle: taskForm.sourceTitle || 'Programme Annuel',
      title: taskForm.title.trim(),
      description: taskForm.description.trim(),
      assignedTo: taskForm.assignedTo.trim() || taskForm.departmentName,
      deadline: taskForm.deadline,
      status: taskForm.status,
      notes: taskForm.notes.trim(),
    });

    if (res.success) {
      setIsAddTaskModalOpen(false);
      setTaskForm({
        department: 'SECRETARIAT',
        departmentName: 'Secrétariat Général',
        source: 'CALENDRIER',
        sourceTitle: 'Programme Annuel 2026',
        title: '',
        description: '',
        assignedTo: '',
        deadline: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
        status: 'IN_PROGRESS',
        notes: '',
      });
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn text-slate-100">
      {/* ========================================================= */}
      {/* 1. HEADER AUDITEUR & CONTRÔLE DU PROGRAMME */}
      {/* ========================================================= */}
      <div className="bg-slate-900 border border-amber-500/40 rounded-[2.5rem] p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 bg-amber-500 text-slate-950 px-4 py-1 rounded-full text-xs font-black tracking-wide shadow-md">
              <span className="text-base">🕵️</span>
              <span>RÔLE OFFICIEL : SUIVI PROGRAMME (SDP) • POLICIER & AUDITEUR INTERNE</span>
            </div>

            <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight flex items-center gap-3">
              <span>CONTRÔLE & SUIVI DU PROGRAMME DE L'ANNÉE</span>
            </h1>

            <p className="text-xs sm:text-sm text-slate-300 font-medium max-w-3xl leading-relaxed">
              Supervision indépendante de l'exécution des résolutions des PVs, des projets et du calendrier annuel par l'ensemble des départements (Secrétariat, Trésorerie, Projets, Organisation, Spiritualité, BIC, Présidence).
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setIsAddTaskModalOpen(true)}
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black px-5 py-3 rounded-2xl text-xs sm:text-sm shadow-xl flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>[ ➕ Enregistrer une Tâche / Échéance ]</span>
            </button>
            <button
              type="button"
              onClick={() => handleOpenAlertModal('SECRETARIAT', 'Secrétariat Général')}
              className="bg-rose-600 hover:bg-rose-500 text-white font-black px-5 py-3 rounded-2xl text-xs sm:text-sm shadow-xl flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
            >
              <AlertTriangle className="w-4 h-4" />
              <span>[ ⚠️ Émettre un Signalement ]</span>
            </button>
          </div>
        </div>

        {/* Global KPIs Bar */}
        <div className="mt-6 pt-6 border-t border-slate-800 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800">
            <span className="text-[10px] font-bold text-slate-400 uppercase block">Taux d'Exécution</span>
            <span className="text-2xl font-black text-amber-400 font-mono">{stats.rate}%</span>
            <span className="text-[10px] text-slate-500 block">Indice de conformité</span>
          </div>

          <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800">
            <span className="text-[10px] font-bold text-slate-400 uppercase block">Total Engagements</span>
            <span className="text-2xl font-black text-white font-mono">{stats.total}</span>
            <span className="text-[10px] text-slate-500 block">Tâches répertoriées</span>
          </div>

          <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-emerald-500/30">
            <span className="text-[10px] font-bold text-emerald-400 uppercase block">Dans les temps</span>
            <span className="text-2xl font-black text-emerald-400 font-mono">{stats.inProgress + stats.completed}</span>
            <span className="text-[10px] text-emerald-500/80 block">🟢 Conformes</span>
          </div>

          <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-amber-500/30">
            <span className="text-[10px] font-bold text-amber-400 uppercase block">À Relancer</span>
            <span className="text-2xl font-black text-amber-400 font-mono">{stats.warning}</span>
            <span className="text-[10px] text-amber-500/80 block">🟡 Échéance &lt; 7j</span>
          </div>

          <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-rose-500/30">
            <span className="text-[10px] font-bold text-rose-400 uppercase block">En Retard</span>
            <span className="text-2xl font-black text-rose-400 font-mono">{stats.overdue}</span>
            <span className="text-[10px] text-rose-500/80 block">🔴 Non exécuté</span>
          </div>

          <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-orange-500/30">
            <span className="text-[10px] font-bold text-orange-400 uppercase block">Alertes Actives</span>
            <span className="text-2xl font-black text-orange-400 font-mono">{stats.activeAlerts}</span>
            <span className="text-[10px] text-orange-500/80 block">⚠️ En cours</span>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 2. ONGLETS DE NAVIGATION DE LA CONSOLE */}
      {/* ========================================================= */}
      <div className="flex flex-wrap items-center gap-2 bg-slate-900/90 p-2 rounded-2xl border border-slate-800">
        <button
          type="button"
          onClick={() => setActiveTab('SYNTHESE')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-black text-xs sm:text-sm transition-all cursor-pointer ${
            activeTab === 'SYNTHESE'
              ? 'bg-amber-500 text-slate-950 shadow-md scale-102'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>VUE SYNTHÉTIQUE DES DÉPARTEMENTS</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('CONNEXIONS')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-black text-xs sm:text-sm transition-all cursor-pointer ${
            activeTab === 'CONNEXIONS'
              ? 'bg-amber-500 text-slate-950 shadow-md scale-102'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <LogIn className="w-4 h-4 text-emerald-400" />
          <span>AUDIT CONNEXIONS ADMINS ({connectedDepts.length}/{ADMIN_DEPARTMENTS_CONFIG.length})</span>
          {connectedDepts.length > 0 && (
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('TACHES')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-black text-xs sm:text-sm transition-all cursor-pointer ${
            activeTab === 'TACHES'
              ? 'bg-amber-500 text-slate-950 shadow-md scale-102'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>ENGAGEMENTS & ÉCHÉANCES ({evaluatedTasks.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('ALERTES')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-black text-xs sm:text-sm transition-all cursor-pointer ${
            activeTab === 'ALERTES'
              ? 'bg-amber-500 text-slate-950 shadow-md scale-102'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          <span>SIGNALEMENTS & RELANCES D'AUDIT ({programmeAlerts?.length || 0})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('AUDIT')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-black text-xs sm:text-sm transition-all cursor-pointer ${
            activeTab === 'AUDIT'
              ? 'bg-emerald-600 text-white shadow-md scale-102'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Lock className="w-4 h-4 text-emerald-300" />
          <span>ACCÈS EN LECTURE SEULE D'AUDIT</span>
        </button>
      </div>

      {/* ========================================================= */}
      {/* 3. VUE SYNTHÉTIQUE DES DÉPARTEMENTS (TAB 1) */}
      {/* ========================================================= */}
      {activeTab === 'SYNTHESE' && (
        <div className="space-y-6">
          {/* Les 2 blocs d'audit de présence intégrés directement au sommet */}
          {renderAdminAttendanceTwoBlocks()}

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-5 rounded-2xl">
            <div>
              <h2 className="text-lg font-black text-white flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-amber-400" />
                <span>Tableau de Bord Récapitulatif par Département</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Surveillance du respect des résolutions de réunions, des délais budgétaires et des plans d'action statutaires.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs font-bold text-slate-300 bg-slate-950 px-3.5 py-1.5 rounded-xl border border-slate-800">
              <span>Légende :</span>
              <span className="text-emerald-400">🟢 Conforme</span>
              <span>•</span>
              <span className="text-amber-400">🟡 À relancer</span>
              <span>•</span>
              <span className="text-rose-400">🔴 En retard</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {departmentSummaries.map(dept => (
              <div
                key={dept.key}
                className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-3xl p-5 shadow-xl flex flex-col justify-between space-y-4 transition-all"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2.5">
                      <span className="text-2xl p-2 bg-slate-950 rounded-xl border border-slate-800">
                        {dept.icon}
                      </span>
                      <div>
                        <h3 className="text-base font-black text-white">{dept.name}</h3>
                        <p className="text-[11px] text-slate-400 font-medium">{dept.roleTitle}</p>
                      </div>
                    </div>

                    <div
                      className={`px-2.5 py-1 rounded-full text-[10px] font-black tracking-wider uppercase border ${
                        dept.healthStatus === 'GREEN'
                          ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                          : dept.healthStatus === 'YELLOW'
                          ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                          : 'bg-rose-500/15 text-rose-400 border-rose-500/30 animate-pulse'
                      }`}
                    >
                      {dept.healthStatus === 'GREEN' ? '🟢 Dans les temps' : dept.healthStatus === 'YELLOW' ? '🟡 À relancer' : '🔴 En retard'}
                    </div>
                  </div>

                  <p className="text-xs text-slate-400 line-clamp-2 mb-4 leading-relaxed">
                    {dept.missions}
                  </p>

                  <div className="grid grid-cols-3 gap-2 text-center bg-slate-950 p-2.5 rounded-2xl border border-slate-800 mb-3">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-bold">Tâches</span>
                      <span className="text-sm font-black text-white font-mono">{dept.totalTasks}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-amber-400 block font-bold">Attention</span>
                      <span className="text-sm font-black text-amber-400 font-mono">{dept.warningTasks}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-rose-400 block font-bold">Retard</span>
                      <span className="text-sm font-black text-rose-400 font-mono">{dept.overdueTasks}</span>
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-400 flex items-center justify-between border-t border-slate-800/80 pt-2.5">
                    <span>Responsable : <strong className="text-slate-200">{dept.responsibleName}</strong></span>
                    {dept.pendingAlerts > 0 && (
                      <span className="bg-orange-500/20 text-orange-300 font-bold px-2 py-0.5 rounded-md text-[10px]">
                        ⚠️ {dept.pendingAlerts} signalement(s)
                      </span>
                    )}
                  </div>
                </div>

                <div className="pt-2 flex items-center gap-2 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      setFilterDepartment(dept.key);
                      setActiveTab('TACHES');
                    }}
                    className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs py-2 rounded-xl transition-all flex items-center justify-center gap-1.5"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Voir Tâches ({dept.totalTasks})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenAlertModal(dept.key, dept.name)}
                    className="bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 font-bold text-xs py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-1"
                    title="Émettre un signalement officiel au département"
                  >
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                    <span>Relancer</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 4. ENGAGEMENTS & ÉCHÉANCES (TAB 2) */}
      {/* ========================================================= */}
      {activeTab === 'TACHES' && (
        <div className="space-y-6">
          {/* Filter Bar */}
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl space-y-4">
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
              <div className="flex-1 relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Rechercher une tâche, un PV, un projet ou un responsable..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl pl-10 pr-4 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={filterDepartment}
                  onChange={e => setFilterDepartment(e.target.value)}
                  className="bg-slate-950 border border-slate-800 text-slate-200 text-xs font-bold rounded-2xl px-3 py-2.5 focus:outline-none focus:border-amber-500"
                >
                  <option value="ALL">Tous les départements</option>
                  <option value="SECRETARIAT">Secrétariat Général</option>
                  <option value="TRESORIER">Trésorerie Générale</option>
                  <option value="PROJET">Commission Projets (AGR)</option>
                  <option value="ORGANISATION">Commission Organisation</option>
                  <option value="SPIRITUALITE">Spiritualité</option>
                  <option value="COM">Communication (BIC)</option>
                  <option value="CERVEAU">Le Cerveau (Présidence)</option>
                </select>

                <select
                  value={filterStatus}
                  onChange={e => setFilterStatus(e.target.value)}
                  className="bg-slate-950 border border-slate-800 text-slate-200 text-xs font-bold rounded-2xl px-3 py-2.5 focus:outline-none focus:border-amber-500"
                >
                  <option value="ALL">Tous les statuts</option>
                  <option value="IN_PROGRESS">🟢 En cours / Dans les temps</option>
                  <option value="WARNING">🟡 À relancer</option>
                  <option value="OVERDUE">🔴 En retard</option>
                  <option value="COMPLETED">✅ Exécuté / Terminé</option>
                </select>

                <button
                  type="button"
                  onClick={() => setIsAddTaskModalOpen(true)}
                  className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black px-4 py-2.5 rounded-2xl text-xs flex items-center gap-1.5 transition-all active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  <span>Ajouter une Tâche</span>
                </button>
              </div>
            </div>
          </div>

          {/* Tasks List */}
          <div className="space-y-3">
            {filteredTasks.length === 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center text-slate-400">
                <CheckCircle2 className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <p className="text-base font-bold text-slate-300">Aucune tâche correspondant aux filtres.</p>
                <p className="text-xs text-slate-500 mt-1">Tous les engagements sont à jour ou aucun critère ne correspond.</p>
              </div>
            ) : (
              filteredTasks.map(task => {
                const isOverdue = task.status === 'OVERDUE';
                const isWarning = task.status === 'WARNING';
                const isCompleted = task.status === 'COMPLETED';

                return (
                  <div
                    key={task.id}
                    className={`bg-slate-900 border rounded-3xl p-5 shadow-lg flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 transition-all ${
                      isOverdue
                        ? 'border-rose-500/50 bg-rose-950/10'
                        : isWarning
                        ? 'border-amber-500/50 bg-amber-950/10'
                        : isCompleted
                        ? 'border-emerald-500/30 opacity-75'
                        : 'border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="space-y-1.5 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="bg-slate-800 text-slate-300 font-bold px-2.5 py-0.5 rounded-md text-[10px] uppercase">
                          {task.departmentName}
                        </span>

                        <span className="bg-slate-950 text-slate-400 px-2 py-0.5 rounded-md text-[10px] border border-slate-800">
                          Source : {task.sourceTitle || task.source}
                        </span>

                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            isCompleted
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : isOverdue
                              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30 animate-pulse'
                              : isWarning
                              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                              : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                          }`}
                        >
                          {isCompleted
                            ? '✅ Terminé'
                            : isOverdue
                            ? '🔴 En retard'
                            : isWarning
                            ? '🟡 À relancer'
                            : '🟢 Dans les temps'}
                        </span>
                      </div>

                      <h3 className="text-base font-black text-white">{task.title}</h3>
                      <p className="text-xs text-slate-300 max-w-3xl leading-relaxed">{task.description}</p>

                      <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-400 pt-1">
                        <span>Responsable : <strong className="text-slate-200">{task.assignedTo || 'Non assigné'}</strong></span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-amber-400" />
                          <span>Échéance : <strong className={isOverdue ? 'text-rose-400 font-bold' : 'text-slate-200'}>{task.deadline || 'Non définie'}</strong></span>
                        </span>
                        {task.remindersCount && task.remindersCount > 0 ? (
                          <>
                            <span>•</span>
                            <span className="text-orange-400 font-bold">
                              ⚠️ {task.remindersCount} relance(s) effectuée(s)
                            </span>
                          </>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0 w-full lg:w-auto justify-end pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-800">
                      {/* Mark Completed Toggle */}
                      <button
                        type="button"
                        onClick={() =>
                          updateProgrammeTask(task.id, {
                            status: isCompleted ? 'IN_PROGRESS' : 'COMPLETED',
                            completedAt: isCompleted ? undefined : new Date().toISOString(),
                          })
                        }
                        className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                          isCompleted
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/30'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                        }`}
                        title={isCompleted ? 'Marquer comme non terminé' : 'Valider l’exécution de la tâche'}
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>{isCompleted ? '✓ Réalisé' : 'Marquer Réalisé'}</span>
                      </button>

                      {/* Émettre un signalement / relancer */}
                      <button
                        type="button"
                        onClick={() => handleOpenAlertModal(task.department, task.departmentName, task)}
                        className="bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/40 font-bold px-3 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                        title="Émettre un signalement d'audit ou relancer le responsable"
                      >
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                        <span>Relancer</span>
                      </button>

                      {/* Delete task if created manually */}
                      {task.id.startsWith('TASK-') && (
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm('Voulez-vous supprimer cet engagement ?')) {
                              deleteProgrammeTask(task.id);
                            }
                          }}
                          className="text-slate-500 hover:text-rose-400 p-2 rounded-xl hover:bg-slate-800 transition-all cursor-pointer"
                          title="Supprimer la tâche"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 5. REGISTRE DES SIGNALEMENTS & RELANCES (TAB 3) */}
      {/* ========================================================= */}
      {activeTab === 'ALERTES' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-5 rounded-3xl">
            <div>
              <h2 className="text-lg font-black text-white flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
                <span>Registre Officiel des Signalements & Relances du Contrôleur</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Historique des notifications de retard, rappels statutaires et mises en demeure adressées aux départements.
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleOpenAlertModal('SECRETARIAT', 'Secrétariat Général')}
              className="bg-rose-600 hover:bg-rose-500 text-white font-black px-4 py-2.5 rounded-2xl text-xs flex items-center gap-1.5 shadow-lg transition-all active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Nouveau Signalement</span>
            </button>
          </div>

          <div className="space-y-3">
            {(!programmeAlerts || programmeAlerts.length === 0) ? (
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center text-slate-400">
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                <p className="text-base font-bold text-slate-200">Aucun signalement émis pour le moment.</p>
                <p className="text-xs text-slate-500 mt-1">Tous les départements sont dans les temps ou aucune mise en demeure n'a été rédigée.</p>
              </div>
            ) : (
              programmeAlerts.map(alert => {
                const isPending = alert.status === 'PENDING';
                return (
                  <div
                    key={alert.id}
                    className={`bg-slate-900 border rounded-3xl p-5 shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-all ${
                      isPending ? 'border-amber-500/40 bg-amber-950/10' : 'border-slate-800 opacity-70'
                    }`}
                  >
                    <div className="space-y-1.5 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="bg-slate-800 text-slate-300 font-bold px-2.5 py-0.5 rounded-md text-[10px] uppercase">
                          {alert.targetDepartmentName}
                        </span>

                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            alert.severity === 'CRITICAL'
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                              : alert.severity === 'WARNING'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                          }`}
                        >
                          {alert.severity === 'CRITICAL' ? '🔴 ALERTE CRITIQUE' : alert.severity === 'WARNING' ? '🟠 RETARD CONSTATÉ' : '🟡 RAPPEL AMICAL'}
                        </span>

                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            isPending ? 'bg-orange-500/20 text-orange-300' : 'bg-emerald-500/20 text-emerald-300'
                          }`}
                        >
                          {isPending ? '⏳ En cours' : '✓ Régularisé'}
                        </span>
                      </div>

                      <h3 className="text-base font-black text-white">{alert.title}</h3>
                      <p className="text-xs text-slate-300 leading-relaxed max-w-3xl whitespace-pre-line">{alert.message}</p>

                      <div className="text-[11px] text-slate-400 pt-1 flex flex-wrap items-center gap-3">
                        <span>Émis le : <strong className="text-slate-200">{new Date(alert.sentAt).toLocaleDateString('fr-FR')}</strong></span>
                        <span>•</span>
                        <span>Par : <strong className="text-slate-200">{alert.sentBy}</strong></span>
                        {alert.taskTitle && (
                          <>
                            <span>•</span>
                            <span>Tâche liée : <strong className="text-amber-300">{alert.taskTitle}</strong></span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0 justify-end w-full md:w-auto pt-3 md:pt-0 border-t md:border-t-0 border-slate-800">
                      {/* WhatsApp Direct Action */}
                      <a
                        href={generateWhatsAppReminderLink(alert)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-md transition-all active:scale-95"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Transmettre via WhatsApp</span>
                      </a>

                      {isPending ? (
                        <button
                          type="button"
                          onClick={() => resolveProgrammeAlert(alert.id)}
                          className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold px-3.5 py-2 rounded-xl text-xs transition-all flex items-center gap-1.5"
                        >
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Marquer Régularisé</span>
                        </button>
                      ) : (
                        <span className="text-xs font-bold text-emerald-400 flex items-center gap-1 px-3 py-2 bg-emerald-950/40 rounded-xl border border-emerald-500/20">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Régularisé</span>
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 6. ACCÈS EN LECTURE SEULE D'AUDIT (TAB 4) */}
      {/* ========================================================= */}
      {activeTab === 'AUDIT' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-emerald-500/40 p-5 rounded-3xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 bg-emerald-500/20 text-emerald-300 px-3 py-1 rounded-full text-xs font-black border border-emerald-500/30">
                <Lock className="w-3.5 h-3.5" />
                <span>DROIT D'INSPECTION & CONTRÔLE INTERNE</span>
              </div>
              <h2 className="text-lg font-black text-white">Registre Intégral des Documents et Livrables en Lecture Seule</h2>
              <p className="text-xs text-slate-300">
                L’Auditeur consulte en toute transparence l'intégralité des PV, bilans financiers, projets AGR et soldes réels sans droit de modification directe.
              </p>
            </div>

            {/* Sub-Tabs for Audit */}
            <div className="flex flex-wrap items-center gap-1.5 bg-slate-950 p-1.5 rounded-2xl border border-slate-800 shrink-0">
              <button
                type="button"
                onClick={() => setAuditSubCategory('PVS')}
                className={`px-3 py-2 rounded-xl font-bold text-xs transition-all ${
                  auditSubCategory === 'PVS' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                PVs Réunions ({pvs.length})
              </button>
              <button
                type="button"
                onClick={() => setAuditSubCategory('BILANS')}
                className={`px-3 py-2 rounded-xl font-bold text-xs transition-all ${
                  auditSubCategory === 'BILANS' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                Bilans Financiers ({bilans.length})
              </button>
              <button
                type="button"
                onClick={() => setAuditSubCategory('PROJETS')}
                className={`px-3 py-2 rounded-xl font-bold text-xs transition-all ${
                  auditSubCategory === 'PROJETS' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                Projets AGR ({projects.length})
              </button>
              <button
                type="button"
                onClick={() => setAuditSubCategory('ACTIVITES')}
                className={`px-3 py-2 rounded-xl font-bold text-xs transition-all ${
                  auditSubCategory === 'ACTIVITES' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                Activités ({activities.length})
              </button>
              <button
                type="button"
                onClick={() => setAuditSubCategory('CAISSES')}
                className={`px-3 py-2 rounded-xl font-bold text-xs transition-all ${
                  auditSubCategory === 'CAISSES' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                Caisses & Reçus
              </button>
            </div>
          </div>

          {/* AUDIT: PVS */}
          {auditSubCategory === 'PVS' && (
            <div className="space-y-3">
              {pvs.length === 0 ? (
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-10 text-center text-slate-400">
                  <FileText className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                  <p className="font-bold text-slate-300">Aucun Procès-Verbal enregistré par le Secrétariat.</p>
                </div>
              ) : (
                pvs.map(pv => (
                  <div
                    key={pv.id}
                    className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-3xl p-5 shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="bg-blue-500/20 text-blue-300 text-[10px] font-bold px-2 py-0.5 rounded-md">
                          {pv.id}
                        </span>
                        <span className="text-xs text-slate-400">
                          Réunion du : <strong className="text-slate-200">{pv.meetingDate}</strong>
                        </span>
                        <span className="bg-slate-800 text-slate-300 text-[10px] font-bold px-2 py-0.5 rounded-full">
                          Statut : {pv.status}
                        </span>
                      </div>
                      <h4 className="text-base font-black text-white">{pv.title}</h4>
                      <p className="text-xs text-slate-400 line-clamp-2 max-w-3xl">{pv.content}</p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setAuditItemModal({ type: 'PV', item: pv })}
                      className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 shrink-0 transition-all cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Lire le PV Intégral (Audit)</span>
                    </button>
                  </div>
                ))
              )}
            </div>
          )}

          {/* AUDIT: BILANS FINANCIERS */}
          {auditSubCategory === 'BILANS' && (
            <div className="space-y-3">
              {bilans.length === 0 ? (
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-10 text-center text-slate-400">
                  <DollarSign className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                  <p className="font-bold text-slate-300">Aucun Bilan Financier officiel enregistré.</p>
                </div>
              ) : (
                bilans.map(bilan => (
                  <div
                    key={bilan.id}
                    className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-3xl p-5 shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded-md">
                          {bilan.period || bilan.id}
                        </span>
                        <span className="text-xs text-slate-400">
                          Date : <strong className="text-slate-200">{bilan.date}</strong>
                        </span>
                        <span className="bg-slate-800 text-slate-300 text-[10px] font-bold px-2 py-0.5 rounded-full">
                          {bilan.status}
                        </span>
                      </div>
                      <h4 className="text-base font-black text-white">{bilan.title}</h4>
                      <div className="flex items-center gap-4 text-xs font-mono">
                        <span className="text-emerald-400 font-bold">Total Entrées : {(bilan.totalIn || 0).toLocaleString('fr-FR')} F</span>
                        <span className="text-rose-400 font-bold">Total Sorties : {(bilan.totalOut || 0).toLocaleString('fr-FR')} F</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setAuditItemModal({ type: 'BILAN', item: bilan })}
                      className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 shrink-0 transition-all cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Inspecter le Bilan</span>
                    </button>
                  </div>
                ))
              )}
            </div>
          )}

          {/* AUDIT: PROJETS AGR */}
          {auditSubCategory === 'PROJETS' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {projects.length === 0 ? (
                <div className="col-span-2 bg-slate-900 border border-slate-800 rounded-3xl p-10 text-center text-slate-400">
                  <p className="font-bold text-slate-300">Aucun projet AGR déposé.</p>
                </div>
              ) : (
                projects.map(proj => (
                  <div key={proj.id} className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="bg-amber-500/20 text-amber-300 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                        Catégorie : {proj.category}
                      </span>
                      <span className="text-xs font-bold text-slate-400">{proj.status}</span>
                    </div>

                    <h4 className="text-base font-black text-white">{proj.title}</h4>
                    <p className="text-xs text-slate-300 line-clamp-3">{proj.description}</p>

                    <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 space-y-1 text-xs font-mono">
                      <div className="flex justify-between text-slate-400">
                        <span>Coût Estimé :</span>
                        <strong className="text-amber-400">{(proj.estimatedCost || 0).toLocaleString('fr-FR')} F CFA</strong>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>Quote-part par membre :</span>
                        <strong className="text-white">{(proj.requiredAmountPerMember || 0).toLocaleString('fr-FR')} F CFA</strong>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>Date Limite :</span>
                        <strong className="text-slate-300">{proj.paymentDeadline || 'Non renseignée'}</strong>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* AUDIT: ACTIVITES */}
          {auditSubCategory === 'ACTIVITES' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activities.length === 0 ? (
                <div className="col-span-2 bg-slate-900 border border-slate-800 rounded-3xl p-10 text-center text-slate-400">
                  <p className="font-bold text-slate-300">Aucune activité enregistrée.</p>
                </div>
              ) : (
                activities.map(act => (
                  <div key={act.id} className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="bg-purple-500/20 text-purple-300 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                        {act.fixedType || act.eventType || 'ACTIVITÉ'}
                      </span>
                      <span className="text-xs font-bold text-slate-400">Date : {act.eventDate}</span>
                    </div>

                    <h4 className="text-base font-black text-white">{act.title}</h4>
                    <p className="text-xs text-slate-300 line-clamp-2">{act.description}</p>

                    <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 text-xs flex justify-between font-mono">
                      <span className="text-slate-400">Budget prévisionnel :</span>
                      <strong className="text-emerald-400">{(act.budget || 0).toLocaleString('fr-FR')} F CFA</strong>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* AUDIT: CAISSES & REÇUS */}
          {auditSubCategory === 'CAISSES' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Caisse Cotisation</span>
                  <span className="text-xl font-black text-emerald-400 font-mono">{(fundBalances.COTISATION || 0).toLocaleString('fr-FR')} F</span>
                </div>
                <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Caisse Anniversaire</span>
                  <span className="text-xl font-black text-amber-400 font-mono">{(fundBalances.ANNIVERSAIRE || 0).toLocaleString('fr-FR')} F</span>
                </div>
                <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Caisse Loisirs</span>
                  <span className="text-xl font-black text-purple-400 font-mono">{(fundBalances.LOISIRS || 0).toLocaleString('fr-FR')} F</span>
                </div>
                <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Caisse Projets AGR</span>
                  <span className="text-xl font-black text-blue-400 font-mono">{(fundBalances.AGR || 0).toLocaleString('fr-FR')} F</span>
                </div>
                <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Caisse Cas Sociaux</span>
                  <span className="text-xl font-black text-rose-400 font-mono">{(fundBalances.CAS_SOCIAUX || 0).toLocaleString('fr-FR')} F</span>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5">
                <h3 className="text-sm font-black text-white mb-3">Reçus Déclarés Récents ({declarations.length})</h3>
                <div className="space-y-2 max-h-80 overflow-y-auto pr-2">
                  {declarations.slice(0, 10).map(d => (
                    <div key={d.id} className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
                      <div>
                        <strong className="text-white">{d.memberNickname || d.memberName}</strong>
                        <span className="text-slate-400 block text-[10px]">{d.fund} • Réf: {d.reference}</span>
                      </div>
                      <div className="text-right">
                        <strong className="text-emerald-400 font-mono">{(d.amount || 0).toLocaleString('fr-FR')} F</strong>
                        <span className={`block text-[10px] font-bold ${d.status === 'APPROVED' ? 'text-emerald-400' : d.status === 'PENDING' ? 'text-amber-400' : 'text-rose-400'}`}>
                          {d.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* 5. AUDIT DÉTAILLÉ DES CONNEXIONS ADMINS (TAB DÉDIÉ) */}
      {/* ========================================================= */}
      {activeTab === 'CONNEXIONS' && (
        <div className="space-y-6">
          {renderAdminAttendanceTwoBlocks()}

          {/* HISTORIQUE DÉTAILLÉ DE TOUTES LES CONNEXIONS DE LA JOURNÉE */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <div>
                <h4 className="text-base font-black text-white flex items-center gap-2">
                  <History className="w-5 h-5 text-amber-400" />
                  <span>Journal Chronologique des Connexions Administrateurs ({todayLogs.length} logs ce jour)</span>
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Flux continu d'événements enregistrés en temps réel dans Firestore (<code>admin_logs</code>).
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-mono bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 text-emerald-400 font-bold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
                  <span>Écoute en Direct (onSnapshot)</span>
                </span>
              </div>
            </div>

            {todayLogs.length === 0 ? (
              <div className="bg-slate-950 rounded-2xl border border-slate-800 p-8 text-center text-slate-400 text-xs">
                <Clock className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="font-bold text-slate-300">Aucun journal de connexion enregistré pour l'instant aujourd'hui.</p>
                <p className="text-slate-500 mt-1">Utilisez la barre de simulation ci-dessus ou connectez-vous avec l'un des rôles administrateurs pour tester.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] font-bold border-b border-slate-800">
                    <tr>
                      <th className="p-3">Heure</th>
                      <th className="p-3">Département / Rôle</th>
                      <th className="p-3">Responsable / Profil</th>
                      <th className="p-3">Identifiant</th>
                      <th className="p-3 text-right">Statut</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {todayLogs.map((log, idx) => {
                      const deptConfig = ADMIN_DEPARTMENTS_CONFIG.find(
                        d => d.key === log.role || deptAttendanceMatch(d, log.role)
                      );
                      const timeStr = log.loginTimestamp
                        ? new Date(log.loginTimestamp).toLocaleTimeString('fr-FR', {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })
                        : '--:--';

                      return (
                        <tr key={log.id || idx} className="hover:bg-slate-950/50 transition-colors">
                          <td className="p-3 text-white font-bold flex items-center gap-2">
                            <Clock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            <span>{timeStr}</span>
                          </td>
                          <td className="p-3">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase ${deptConfig?.badgeBg || 'bg-slate-800'} ${deptConfig?.badgeText || 'text-white'} border ${deptConfig?.borderColor || 'border-slate-700'}`}>
                              <span>{deptConfig?.icon || '🛡️'}</span>
                              <span>{deptConfig?.shortName || log.role}</span>
                            </span>
                          </td>
                          <td className="p-3 text-slate-200 font-sans font-bold">
                            {log.memberName || log.role}
                          </td>
                          <td className="p-3 text-slate-400 text-[11px]">
                            {log.userId || log.role}
                          </td>
                          <td className="p-3 text-right">
                            <span className="inline-flex items-center gap-1 text-emerald-400 text-[10px] font-bold">
                              <CheckCircle className="w-3 h-3" />
                              <span>Enregistré</span>
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: AJOUTER UNE TÂCHE / ENGAGEMENT */}
      {/* ========================================================= */}
      {isAddTaskModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-amber-500/40 rounded-3xl p-6 sm:p-8 max-w-xl w-full shadow-2xl space-y-5 animate-fadeIn">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2 text-amber-400 font-black text-base sm:text-lg">
                <Plus className="w-5 h-5" />
                <span>Enregistrer un Engagement / Échéance</span>
              </div>
              <button
                type="button"
                onClick={() => setIsAddTaskModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTask} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-300 uppercase mb-1">
                  Département Responsable
                </label>
                <select
                  value={taskForm.department}
                  onChange={e => {
                    const dKey = e.target.value as DepartmentRole;
                    const summary = departmentSummaries.find(s => s.key === dKey);
                    setTaskForm(prev => ({
                      ...prev,
                      department: dKey,
                      departmentName: summary?.name || dKey,
                    }));
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white font-bold"
                >
                  <option value="SECRETARIAT">Secrétariat Général</option>
                  <option value="TRESORIER">Trésorerie Générale</option>
                  <option value="PROJET">Commission Projets (AGR)</option>
                  <option value="ORGANISATION">Commission Organisation</option>
                  <option value="SPIRITUALITE">Département Spiritualité</option>
                  <option value="COM">Communication (BIC)</option>
                  <option value="CERVEAU">Le Cerveau (Présidence)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-300 uppercase mb-1">
                  Intitulé de l'engagement / Résolution
                </label>
                <input
                  type="text"
                  placeholder="Ex: Clôture de la levée de fonds pour l'élevage"
                  value={taskForm.title}
                  onChange={e => setTaskForm(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white font-bold"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-300 uppercase mb-1">
                    Source de la tâche
                  </label>
                  <select
                    value={taskForm.source}
                    onChange={e => setTaskForm(prev => ({ ...prev, source: e.target.value as any }))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white font-bold"
                  >
                    <option value="PV">Procès-Verbal de Réunion</option>
                    <option value="PROJET">Projet AGR</option>
                    <option value="ACTIVITE">Événement / Activité</option>
                    <option value="CALENDRIER">Calendrier Statutaire</option>
                    <option value="MANUAL">Recommandation d'Audit</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-300 uppercase mb-1">
                    Date Limite / Échéance
                  </label>
                  <input
                    type="date"
                    value={taskForm.deadline}
                    onChange={e => setTaskForm(prev => ({ ...prev, deadline: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-300 uppercase mb-1">
                  Responsable Désigné (Optionnel)
                </label>
                <input
                  type="text"
                  placeholder="Ex: Secrétaire Général, PCO, Trésorier..."
                  value={taskForm.assignedTo}
                  onChange={e => setTaskForm(prev => ({ ...prev, assignedTo: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-300 uppercase mb-1">
                  Description & Recommandation d'Exécution
                </label>
                <textarea
                  rows={3}
                  placeholder="Détails de l'obligation, livrables attendus..."
                  value={taskForm.description}
                  onChange={e => setTaskForm(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddTaskModalOpen(false)}
                  className="px-4 py-2.5 bg-slate-800 text-slate-300 font-bold rounded-xl hover:bg-slate-700"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl shadow-lg transition-all"
                >
                  Enregistrer l'Engagement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: ÉMETTRE UN SIGNALEMENT / RELANCE */}
      {/* ========================================================= */}
      {isAlertModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-rose-500/50 rounded-3xl p-6 sm:p-8 max-w-xl w-full shadow-2xl space-y-5 animate-fadeIn">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2 text-rose-400 font-black text-base sm:text-lg">
                <AlertTriangle className="w-5 h-5" />
                <span>Émettre un Signalement / Relancer le Département</span>
              </div>
              <button
                type="button"
                onClick={() => setIsAlertModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitAlert} className="space-y-4 text-xs">
              <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 space-y-1">
                <span className="text-[10px] text-slate-400 uppercase font-bold">Département Ciblé</span>
                <p className="text-sm font-black text-white">{alertForm.targetDepartmentName}</p>
                {alertTargetTask && (
                  <p className="text-[11px] text-amber-300">
                    Tâche liée : <strong>{alertTargetTask.title}</strong> (Échéance : {alertTargetTask.deadline})
                  </p>
                )}
              </div>

              <div>
                <label className="block font-bold text-slate-300 uppercase mb-1">
                  Niveau d'Urgence / Gravité
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setAlertForm(prev => ({ ...prev, severity: 'INFO' }))}
                    className={`py-2 px-2 rounded-xl font-bold text-center border transition-all ${
                      alertForm.severity === 'INFO'
                        ? 'bg-blue-500/20 text-blue-300 border-blue-500'
                        : 'bg-slate-950 text-slate-400 border-slate-800'
                    }`}
                  >
                    🟡 Rappel amical
                  </button>
                  <button
                    type="button"
                    onClick={() => setAlertForm(prev => ({ ...prev, severity: 'WARNING' }))}
                    className={`py-2 px-2 rounded-xl font-bold text-center border transition-all ${
                      alertForm.severity === 'WARNING'
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500'
                        : 'bg-slate-950 text-slate-400 border-slate-800'
                    }`}
                  >
                    🟠 Retard constaté
                  </button>
                  <button
                    type="button"
                    onClick={() => setAlertForm(prev => ({ ...prev, severity: 'CRITICAL' }))}
                    className={`py-2 px-2 rounded-xl font-bold text-center border transition-all ${
                      alertForm.severity === 'CRITICAL'
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500'
                        : 'bg-slate-950 text-slate-400 border-slate-800'
                    }`}
                  >
                    🔴 Alerte critique
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-300 uppercase mb-1">
                  Objet du Signalement
                </label>
                <input
                  type="text"
                  value={alertForm.title}
                  onChange={e => setAlertForm(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-300 uppercase mb-1">
                  Numéro WhatsApp du Responsable
                </label>
                <input
                  type="text"
                  value={alertForm.targetPhone}
                  onChange={e => setAlertForm(prev => ({ ...prev, targetPhone: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-300 uppercase mb-1">
                  Message Officiel de Relance
                </label>
                <textarea
                  rows={4}
                  value={alertForm.message}
                  onChange={e => setAlertForm(prev => ({ ...prev, message: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white leading-relaxed"
                />
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3 border-t border-slate-800">
                <a
                  href={generateWhatsAppReminderLink(alertForm)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-center flex items-center justify-center gap-1.5 transition-all"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Envoyer via WhatsApp</span>
                </a>

                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAlertModalOpen(false)}
                    className="px-4 py-2.5 bg-slate-800 text-slate-300 font-bold rounded-xl hover:bg-slate-700"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-black rounded-xl shadow-lg transition-all"
                  >
                    Enregistrer au Registre
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: DETAIL AUDIT (LECTURE SEULE STRICTE) */}
      {/* ========================================================= */}
      {auditItemModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-emerald-500/50 rounded-3xl p-6 sm:p-8 max-w-2xl w-full shadow-2xl space-y-4 animate-fadeIn max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-emerald-400 font-black text-base">
                <Lock className="w-4 h-4" />
                <span>INSPECTION AUDIT (LECTURE SEULE) • {auditItemModal.type}</span>
              </div>
              <button
                type="button"
                onClick={() => setAuditItemModal(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 space-y-4 text-xs">
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2">
                <h3 className="text-base font-black text-white">{auditItemModal.item.title}</h3>
                <p className="text-slate-400 font-mono text-[11px]">Identifiant : {auditItemModal.item.id}</p>
                <div className="flex items-center gap-2">
                  <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded">
                    Statut : {auditItemModal.item.status}
                  </span>
                  {auditItemModal.item.meetingDate && (
                    <span className="text-slate-400">Date réunion : {auditItemModal.item.meetingDate}</span>
                  )}
                  {auditItemModal.item.date && (
                    <span className="text-slate-400">Date : {auditItemModal.item.date}</span>
                  )}
                </div>
              </div>

              {auditItemModal.type === 'PV' && (
                <div className="space-y-3">
                  <div>
                    <span className="font-bold text-slate-300 uppercase block mb-1">Contenu Intégral du PV :</span>
                    <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 text-slate-200 leading-relaxed whitespace-pre-wrap font-sans text-xs">
                      {auditItemModal.item.content}
                    </div>
                  </div>

                  {auditItemModal.item.attendance && (
                    <div>
                      <span className="font-bold text-slate-300 uppercase block mb-1">Émargement / Présences :</span>
                      <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 grid grid-cols-2 gap-2">
                        {auditItemModal.item.attendance.map((att: any, idx: number) => {
                          const m = members.find(mem => mem.id === att.memberId);
                          return (
                            <div key={idx} className="flex items-center justify-between text-[11px] p-1.5 bg-slate-900 rounded-lg">
                              <span className="text-slate-200 font-bold">{m?.nickname || m?.firstName || att.memberId}</span>
                              <span className={att.present ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                                {att.present ? 'Présent' : 'Absent'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {auditItemModal.type === 'BILAN' && (
                <div className="space-y-3">
                  <div>
                    <span className="font-bold text-slate-300 uppercase block mb-1">Synthèse Financière :</span>
                    <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 text-slate-200 leading-relaxed whitespace-pre-wrap">
                      {auditItemModal.item.summary}
                    </div>
                  </div>

                  {auditItemModal.item.balances && (
                    <div>
                      <span className="font-bold text-slate-300 uppercase block mb-1">Soldes des Caisses du Bilan :</span>
                      <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 grid grid-cols-2 gap-2 text-mono">
                        {Object.entries(auditItemModal.item.balances).map(([fund, amt]: any) => (
                          <div key={fund} className="flex justify-between p-2 bg-slate-900 rounded-lg">
                            <span className="text-slate-400">{fund}</span>
                            <span className="text-emerald-400 font-bold">{(amt || 0).toLocaleString('fr-FR')} F</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setAuditItemModal(null)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs"
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
