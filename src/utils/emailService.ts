import emailjs from '@emailjs/browser';
import { RouamaMember } from '../types';

export interface EmailDispatchLog {
  id: string;
  title: string;
  content: string;
  authorRole: string;
  dispatchChannel: 'MAIL' | 'GENERAL';
  recipientCount: number;
  recipients: string[];
  sentAt: string;
  status: 'SENT' | 'DELIVERED';
}

export const EMAILJS_CONFIG = {
  serviceId: 'service_fmxtmw1',
  templateId: 'template_z2nyaem',
  publicKey: '4uaf30m_mKHnobzKh',
};

export interface SendEmailOptions {
  recipientMode?: 'ALL' | 'SPECIFIC';
  selectedMemberId?: string;
  onProgress?: (current: number, total: number, email: string) => void;
  filterFn?: (member: RouamaMember) => boolean;
}

export interface EmailDispatchResult {
  success: boolean;
  recipientCount: number;
  totalAttempted: number;
  recipients: string[];
  isSingleRecipient: boolean;
  recipientName?: string;
  log: EmailDispatchLog;
}

/**
 * Direct automated background email dispatch service powered by EmailJS.
 * Supports flexible targeting:
 * - "SPECIFIC": Single direct email to the selected member.
 * - "ALL": Sequential loop over all eligible members with a 1000ms pause to respect EmailJS rate limits.
 */
export const sendEmailBroadcastAsync = async (
  title: string,
  content: string,
  members: RouamaMember[],
  authorRole: string = 'COM',
  dispatchChannel: 'MAIL' | 'GENERAL' = 'GENERAL',
  options: SendEmailOptions = {}
): Promise<EmailDispatchResult> => {
  const { recipientMode = 'ALL', selectedMemberId, onProgress, filterFn } = options;

  // Initialize EmailJS with the official public key
  emailjs.init({ publicKey: EMAILJS_CONFIG.publicKey });

  const successfulRecipients: string[] = [];

  // =========================================================================
  // MODE 1: UN MEMBRE SPÉCIFIQUE
  // =========================================================================
  if (recipientMode === 'SPECIFIC') {
    if (!selectedMemberId) {
      throw new Error('Veuillez sélectionner un membre destinataire dans la liste.');
    }

    const targetMember = members.find(m => m.id === selectedMemberId);
    const cleanEmail = targetMember?.email?.trim();

    if (!targetMember || !cleanEmail || !cleanEmail.includes('@')) {
      throw new Error("Le membre sélectionné ne dispose pas d'une adresse email valide.");
    }

    const memberName =
      targetMember.fullRosterName ||
      `${targetMember.name || ''} ${targetMember.firstName || ''}`.trim() ||
      targetMember.nickname ||
      'Membre';

    if (onProgress) {
      onProgress(1, 1, cleanEmail);
    }

    // Exact template parameters structure
    const templateParams = {
      to_email: cleanEmail,
      subject: title,
      message: content,
      name: memberName,
    };

    const res = await emailjs.send(
      EMAILJS_CONFIG.serviceId,
      EMAILJS_CONFIG.templateId,
      templateParams,
      EMAILJS_CONFIG.publicKey
    );

    if (res.status !== 200) {
      throw new Error(`Échec d'envoi vers ${cleanEmail} : statut HTTP ${res.status} (${res.text || 'Erreur'})`);
    }

    successfulRecipients.push(cleanEmail);

    const log: EmailDispatchLog = {
      id: 'EMAIL-LOG-' + Date.now(),
      title,
      content,
      authorRole,
      dispatchChannel,
      recipientCount: 1,
      recipients: successfulRecipients,
      sentAt: new Date().toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
      status: 'DELIVERED',
    };

    return {
      success: true,
      recipientCount: 1,
      totalAttempted: 1,
      recipients: successfulRecipients,
      isSingleRecipient: true,
      recipientName: memberName,
      log,
    };
  }

  // =========================================================================
  // MODE 2: TOUS LES MEMBRES (DIFFUSION GÉNÉRALE)
  // =========================================================================
  let candidateMembers = members;
  if (filterFn) {
    candidateMembers = candidateMembers.filter(filterFn);
  }

  // Filter unique members with valid email
  const seenEmails = new Set<string>();
  const uniqueMembersWithEmail: RouamaMember[] = [];

  for (const m of candidateMembers) {
    const cleanEmail = m.email?.trim();
    if (cleanEmail && cleanEmail.includes('@') && !seenEmails.has(cleanEmail.toLowerCase())) {
      seenEmails.add(cleanEmail.toLowerCase());
      uniqueMembersWithEmail.push({
        ...m,
        email: cleanEmail,
        name:
          m.fullRosterName ||
          `${m.name || ''} ${m.firstName || ''}`.trim() ||
          m.nickname ||
          'Membre',
      });
    }
  }

  if (uniqueMembersWithEmail.length === 0) {
    throw new Error('Aucun destinataire avec une adresse email valide trouvé.');
  }

  // Sequential loop with for...of and 1000ms delay between calls
  for (let i = 0; i < uniqueMembersWithEmail.length; i++) {
    const member = uniqueMembersWithEmail[i];

    if (onProgress) {
      onProgress(i + 1, uniqueMembersWithEmail.length, member.email!);
    }

    // Exact template parameters structure
    const templateParams = {
      to_email: member.email!,
      subject: title,
      message: content,
      name: member.name || member.fullRosterName || member.firstName || 'Membre',
    };

    const res = await emailjs.send(
      EMAILJS_CONFIG.serviceId,
      EMAILJS_CONFIG.templateId,
      templateParams,
      EMAILJS_CONFIG.publicKey
    );

    if (res.status !== 200) {
      throw new Error(`Échec d'envoi vers ${member.email} : HTTP ${res.status} (${res.text || 'Erreur'})`);
    }

    successfulRecipients.push(member.email!);

    // Pause de 1000ms (1 seconde) entre chaque appel
    if (i < uniqueMembersWithEmail.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  const log: EmailDispatchLog = {
    id: 'EMAIL-LOG-' + Date.now(),
    title,
    content,
    authorRole,
    dispatchChannel,
    recipientCount: successfulRecipients.length,
    recipients: successfulRecipients,
    sentAt: new Date().toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }),
    status: 'DELIVERED',
  };

  return {
    success: true,
    recipientCount: successfulRecipients.length,
    totalAttempted: uniqueMembersWithEmail.length,
    recipients: successfulRecipients,
    isSingleRecipient: false,
    log,
  };
};
