import React, { useState, useEffect } from 'react';
import { Bell, CheckCircle2, X, AlertCircle, Sparkles, Shield, Smartphone } from 'lucide-react';
import {
  isPushNotificationSupported,
  requestPushPermissionAndSaveToken,
} from '../../utils/pushNotificationService';

interface PushNotificationPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  memberId: string;
  memberNickname: string;
}

export const PushNotificationPromptModal: React.FC<PushNotificationPromptModalProps> = ({
  isOpen,
  onClose,
  memberId,
  memberNickname,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'denied' | 'unsupported'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (!isPushNotificationSupported()) {
        setStatus('unsupported');
      } else if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        setStatus('success');
      } else {
        setStatus('idle');
        setErrorMessage(null);
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleRequestPermission = async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const result = await requestPushPermissionAndSaveToken(memberId, 'MEMBER', memberId);
      if (result.success) {
        setStatus('success');
        setTimeout(() => {
          onClose();
        }, 1600);
      } else {
        if (result.permission === 'denied') {
          setStatus('denied');
          setErrorMessage(
            "L'autorisation a été bloquée par votre navigateur. Vous pouvez l'autoriser en cliquant sur l'icône de cadenas ou de paramètres à gauche de l'adresse web."
          );
        } else {
          setErrorMessage(result.message || "Impossible d'activer les notifications.");
        }
      }
    } catch (err: any) {
      console.warn('Erreur demande push modal:', err);
      setErrorMessage(err?.message || "Une erreur est survenue lors de l'activation.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDismiss = () => {
    try {
      sessionStorage.setItem('erouama_push_prompt_dismissed', 'true');
      localStorage.setItem('erouama_push_prompt_dismissed_time', Date.now().toString());
    } catch {}
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border-2 border-emerald-600/40 overflow-hidden transform transition-all animate-scaleUp">
        {/* En-tête officiel vert E-ROUAMA */}
        <div className="bg-gradient-to-r from-[#355E3B] to-[#2A4B2F] p-6 text-white relative">
          <button
            onClick={handleDismiss}
            className="absolute top-4 right-4 p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-colors cursor-pointer"
            title="Fermer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300 shadow-inner">
              <Bell className="w-6 h-6 animate-bounce" />
            </div>
            <div>
              <span className="bg-amber-400 text-slate-950 text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full">
                OFFICIEL E-ROUAMA
              </span>
              <h3 className="text-lg font-black tracking-tight text-white mt-1">
                Notifications Push en Direct
              </h3>
            </div>
          </div>
        </div>

        {/* Corps du modal */}
        <div className="p-6 space-y-5 text-slate-700 text-sm">
          {status === 'success' ? (
            <div className="text-center py-6 space-y-3">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 className="w-10 h-10 animate-pulse" />
              </div>
              <h4 className="text-lg font-black text-slate-900">
                Notifications Push Activées !
              </h4>
              <p className="text-xs text-slate-600 max-w-xs mx-auto">
                Parfait, {memberNickname} ! Vous recevrez désormais les nouvelles du Gbaïraï et les décisions administratives directement sur votre appareil.
              </p>
            </div>
          ) : (
            <>
              <div>
                <p className="font-bold text-slate-900 text-base">
                  Bienvenue dans votre Espace Membre, {memberNickname} !
                </p>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  Pour rester connecté(e) en temps réel avec la Fraternité, autorisez l'envoi des notifications push officielles sur votre appareil :
                </p>
              </div>

              {/* Avantages listés */}
              <div className="space-y-2.5 bg-emerald-50/60 p-4 rounded-2xl border border-emerald-100 text-xs">
                <div className="flex items-start gap-2.5">
                  <span className="text-base leading-none">📢</span>
                  <div>
                    <strong className="text-slate-900">Gbaïraï en direct :</strong>
                    <span className="text-slate-600 ml-1">
                      Alertes instantanées dès qu'une information ou annonce est publiée.
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <span className="text-base leading-none">⚖️</span>
                  <div>
                    <strong className="text-slate-900">Transmissions & Visas :</strong>
                    <span className="text-slate-600 ml-1">
                      Suivi immédiat des validations de PVs, projets AGR et programmes du Payor.
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <span className="text-base leading-none">📲</span>
                  <div>
                    <strong className="text-slate-900">Même application fermée :</strong>
                    <span className="text-slate-600 ml-1">
                      L'alerte apparaît directement dans le volet de notification de votre téléphone.
                    </span>
                  </div>
                </div>
              </div>

              {/* Message d'erreur éventuel */}
              {errorMessage && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {status === 'unsupported' && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
                  Votre navigateur actuel ne prend pas en charge les notifications Push Web. Vous pouvez installer l'application PWA pour une prise en charge complète.
                </div>
              )}

              {/* Boutons d'action */}
              <div className="space-y-2 pt-2">
                <button
                  type="button"
                  onClick={handleRequestPermission}
                  disabled={isLoading || status === 'unsupported'}
                  className="w-full bg-[#355E3B] hover:bg-[#2A4B2F] active:scale-98 disabled:opacity-50 text-white font-black py-3 px-4 rounded-2xl text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer"
                >
                  <Bell className="w-4 h-4 text-amber-300" />
                  <span>{isLoading ? 'Activation en cours...' : '🔔 Activer les notifications push'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleDismiss}
                  disabled={isLoading}
                  className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-2.5 px-4 rounded-2xl text-xs transition-colors cursor-pointer"
                >
                  Plus tard
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
