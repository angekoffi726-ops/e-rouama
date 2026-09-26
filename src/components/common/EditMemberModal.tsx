import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Camera,
  Upload,
  Check,
  User,
  Phone,
  Mail,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react';
import { RouamaMember } from '../../types';
import { useApp } from '../../context/AppContext';
import { compressProfileImage } from '../../utils/imageCompressor';

interface EditMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  member: RouamaMember | null;
  isAdminMode?: boolean;
  onSuccess?: () => void;
}

export const EditMemberModal: React.FC<EditMemberModalProps> = ({
  isOpen,
  onClose,
  member,
  isAdminMode = false,
  onSuccess,
}) => {
  const { updateMember } = useApp();

  const [firstName, setFirstName] = useState('');
  const [nickname, setNickname] = useState('');
  const [fullRosterName, setFullRosterName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');

  // Gestion de la photo de profil avec préservation stricte par défaut
  const [keepExistingPhoto, setKeepExistingPhoto] = useState(true);
  const [newPhotoBase64, setNewPhotoBase64] = useState<string | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialisation à l'ouverture de la modal
  useEffect(() => {
    if (member) {
      setFirstName(member.firstName || '');
      setNickname(member.nickname || '');
      setFullRosterName(member.fullRosterName || member.name || member.firstName || '');
      setPhone(member.phone || '');
      setEmail(member.email || '');
      setPin(member.pin && member.pin !== 'Non défini' ? member.pin : '');
      setKeepExistingPhoto(true);
      setNewPhotoBase64(null);
      setErrorMessage(null);
      setSuccessMessage(null);
    }
  }, [member, isOpen]);

  if (!isOpen || !member) return null;

  // Détermination de la photo existante
  const existingPhoto =
    member.photoUrl ||
    member.avatar ||
    (member.nickname?.toUpperCase() === 'CAPELO' || member.firstName?.toUpperCase() === 'WILFRIED'
      ? '/PP-CAPELO.jpeg'
      : '');

  // Photo actuellement affichée dans le preview (nouvelle photo si uploadée, sinon photo existante)
  const displayPhoto = (!keepExistingPhoto && newPhotoBase64) ? newPhotoBase64 : existingPhoto;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMessage('Veuillez sélectionner un fichier image valide (JPG, PNG, WebP).');
      return;
    }

    setIsCompressing(true);
    setErrorMessage(null);

    try {
      // Compression optimisée (400x400 max, qualité 0.82)
      const compressed = await compressProfileImage(file, 400, 0.82);
      if (!compressed) {
        throw new Error("Échec de la lecture de l'image.");
      }
      setNewPhotoBase64(compressed);
      setKeepExistingPhoto(false);
    } catch (err) {
      console.error('Erreur compression image profil:', err);
      setErrorMessage("Impossible de traiter cette image. Veuillez en essayer une autre.");
    } finally {
      setIsCompressing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleCancelNewPhoto = () => {
    setNewPhotoBase64(null);
    setKeepExistingPhoto(true);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!member) return;

    const trimmedFirstName = firstName.trim();
    if (!trimmedFirstName) {
      setErrorMessage('Le prénom est obligatoire.');
      return;
    }

    const trimmedPin = pin.trim();
    if (trimmedPin && (trimmedPin.length !== 4 || !/^\d{4}$/.test(trimmedPin))) {
      setErrorMessage('Le code PIN doit comporter exactement 4 chiffres.');
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const existingMemberData = member;
      const formFields = {
        firstName: trimmedFirstName,
        nickname: nickname.trim() || trimmedFirstName,
        fullRosterName: fullRosterName.trim() || trimmedFirstName,
        phone: phone.trim(),
        email: email.trim(),
        pin: trimmedPin || existingMemberData.pin || '',
        isRegistered: Boolean(trimmedPin || existingMemberData.isRegistered),
      };

      // RÈGLE STRICTE N°1 & N°2 :
      // Fusion de la nouvelle photo avec l'ancienne valeur si aucune nouvelle image n'est choisie
      const finalPhoto = (!keepExistingPhoto && newPhotoBase64)
        ? newPhotoBase64
        : (existingMemberData.photoUrl || existingMemberData.avatar || '');

      const updatedData = {
        ...existingMemberData,
        ...formFields,
        photoUrl: finalPhoto,
        avatar: finalPhoto,
      };

      const ok = await updateMember(member.id, updatedData);
      if (!ok) {
        throw new Error("Erreur lors de la mise à jour dans Firestore.");
      }

      setSuccessMessage(`Profil et photo de ${trimmedFirstName} enregistrés avec succès !`);
      if (onSuccess) {
        onSuccess();
      }

      setTimeout(() => {
        setIsSaving(false);
        onClose();
      }, 1400);
    } catch (err: any) {
      console.error('Erreur mise à jour profil membre:', err);
      setErrorMessage(err?.message || "Une erreur est survenue lors de l'enregistrement.");
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto">
      <div className="bg-slate-900 border border-amber-500/30 rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-800 bg-slate-950/60 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-300">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-white leading-tight">
                {isAdminMode ? 'Modifier le Membre' : 'Modifier mon Profil'}
              </h3>
              <p className="text-xs text-amber-300 font-bold">
                {member.firstName} « {member.nickname} »
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSaving}
            className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 overflow-y-auto space-y-5 text-slate-200">
          {/* SECTION FEEDBACK VISUEL DE LA PHOTO DE PROFIL */}
          <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-4 space-y-3.5 shadow-inner">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-amber-400" />
                <span>Photo de profil du membre</span>
              </span>
              {keepExistingPhoto && existingPhoto ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                  <ShieldCheck className="w-3 h-3" />
                  <span>Photo actuelle conservée</span>
                </span>
              ) : newPhotoBase64 ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-300 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20">
                  <Sparkles className="w-3 h-3" />
                  <span>Nouvelle photo prête</span>
                </span>
              ) : (
                <span className="text-[11px] text-slate-500 italic">
                  Aucune photo définie (initiales)
                </span>
              )}
            </div>

            {/* Avatar Preview & Contrôles */}
            <div className="flex flex-col sm:flex-row items-center gap-4 pt-1">
              <div className="relative group shrink-0">
                <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden border-2 border-amber-500/40 shadow-lg bg-slate-900 flex items-center justify-center">
                  {displayPhoto ? (
                    <img
                      src={displayPhoto}
                      alt={member.firstName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-[#355E3B] flex items-center justify-center text-white text-3xl font-black">
                      {member.firstName.charAt(0).toUpperCase()}
                    </div>
                  )}

                  {isCompressing && (
                    <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center text-white text-[10px] font-bold gap-1">
                      <Loader2 className="w-5 h-5 text-amber-300 animate-spin" />
                      <span>Compression...</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Options de gestion de la photo */}
              <div className="flex-1 space-y-2.5 w-full text-xs">
                {/* Option 1 : Conserver la photo actuelle (Par défaut) */}
                <label className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-all ${
                  keepExistingPhoto
                    ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}>
                  <input
                    type="radio"
                    name="photoChoice"
                    checked={keepExistingPhoto}
                    onChange={() => {
                      setKeepExistingPhoto(true);
                      setNewPhotoBase64(null);
                    }}
                    className="mt-0.5 text-emerald-500 focus:ring-emerald-400"
                  />
                  <div>
                    <div className="font-bold flex items-center gap-1.5">
                      <span>Conserver la photo actuelle</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-mono">Par défaut</span>
                    </div>
                    <p className="text-[11px] opacity-80 mt-0.5">
                      Préserve fidèlement l'image enregistrée du membre sans aucune altération.
                    </p>
                  </div>
                </label>

                {/* Option 2 : Téléverser une nouvelle photo */}
                <div className="space-y-1.5">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="image/*"
                    className="hidden"
                  />

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isCompressing || isSaving}
                      className="flex-1 py-2 px-3 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 font-bold flex items-center justify-center gap-1.5 transition-all text-xs cursor-pointer shadow-sm active:scale-95 disabled:opacity-50"
                    >
                      <Upload className="w-3.5 h-3.5 text-amber-400" />
                      <span>{newPhotoBase64 ? 'Remplacer cette image' : 'Téléverser une nouvelle photo'}</span>
                    </button>

                    {newPhotoBase64 && (
                      <button
                        type="button"
                        onClick={handleCancelNewPhoto}
                        className="py-2 px-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 font-bold flex items-center gap-1 text-xs"
                        title="Annuler la nouvelle photo et conserver l'actuelle"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-rose-400" />
                        <span>Annuler</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* FORMULAIRE DES INFORMATIONS DU MEMBRE */}
          <div className="space-y-3.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Prénom Officiel *
                </label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Ex: WILFRIED"
                  required
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Surnom Fraternel (Nouchi)
                </label>
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="Ex: CAPELO"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-amber-300 focus:outline-none focus:border-amber-400 font-medium"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Nom complet / Roster officiel
              </label>
              <input
                type="text"
                value={fullRosterName}
                onChange={(e) => setFullRosterName(e.target.value)}
                placeholder="Ex: KOUASSI Wilfried"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400 font-medium"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1 flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  <span>Numéro Téléphone / WhatsApp</span>
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Ex: +225 07 00 00 00 00"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1 flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  <span>Adresse Email</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Ex: membre@rouama.ci"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            {/* Code PIN (MDP de connexion) */}
            <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 space-y-1.5">
              <label className="block text-xs font-bold text-slate-300 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                  <span>Code PIN Secret (4 chiffres)</span>
                </span>
                <span className="text-[10px] text-slate-500 font-normal">Accès E-ROUAMA</span>
              </label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="Ex: 2026"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-center text-lg font-mono font-black text-amber-300 tracking-widest focus:outline-none focus:border-amber-400"
              />
              <p className="text-[10px] text-slate-500">
                Laissé intact si vous ne souhaitez pas modifier le code PIN existant du membre.
              </p>
            </div>
          </div>

          {/* Messages d'erreur et de succès */}
          {errorMessage && (
            <div className="p-3 bg-rose-950/60 border border-rose-800 text-rose-300 rounded-xl text-xs font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 bg-emerald-950/60 border border-emerald-800 text-emerald-300 rounded-xl text-xs font-medium flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex gap-3 pt-2 border-t border-slate-800/80">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="flex-1 py-2.5 rounded-xl border border-slate-700 bg-slate-800 text-slate-300 text-xs font-bold hover:bg-slate-700 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSaving || isCompressing}
              className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-[#E67E22] hover:from-amber-400 hover:to-[#D35400] text-slate-950 text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow-lg active:scale-95 disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                  <span>Enregistrement...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 text-slate-950" />
                  <span>Enregistrer les modifications</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
