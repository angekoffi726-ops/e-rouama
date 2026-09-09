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

/**
 * Direct automated background email dispatch service powered by EmailJS.
 * Sends emails directly to all targeted members without opening third-party email clients.
 */
export const sendEmailBroadcastAsync = async (
  title: string,
  content: string,
  members: RouamaMember[],
  authorRole: string = 'COM',
  dispatchChannel: 'MAIL' | 'GENERAL' = 'GENERAL'
): Promise<{ success: boolean; recipientCount: number; recipients: string[]; log: EmailDispatchLog }> => {
  // Extract all valid member email addresses from roster
  const recipientEmails = members
    .map(m => m.email?.trim())
    .filter((email): email is string => Boolean(email && email.includes('@')));

  // Unique list of email recipients
  const uniqueRecipients = Array.from(new Set(recipientEmails));

  if (uniqueRecipients.length === 0) {
    throw new Error('Aucun destinataire avec une adresse email valide trouvé.');
  }

  // Initialise EmailJS avec la clé publique officielle
  emailjs.init({ publicKey: EMAILJS_CONFIG.publicKey });

  // Envoi réel vers chaque membre par Promise.all
  const sendResponses = await Promise.all(
    uniqueRecipients.map(async (email) => {
      const templateParams = {
        subject: title,
        message: content,
        to_email: email,
      };

      const res = await emailjs.send(
        EMAILJS_CONFIG.serviceId,
        EMAILJS_CONFIG.templateId,
        templateParams,
        EMAILJS_CONFIG.publicKey
      );

      if (res.status !== 200) {
        throw new Error(`Échec d'envoi vers ${email} : HTTP ${res.status} (${res.text})`);
      }

      return res;
    })
  );

  const allOk = sendResponses.every(r => r && r.status === 200);
  if (!allOk) {
    throw new Error("L'un des envois d'email n'a pas retourné le code de succès HTTP 200.");
  }

  // Create delivery log
  const log: EmailDispatchLog = {
    id: 'EMAIL-LOG-' + Date.now(),
    title,
    content,
    authorRole,
    dispatchChannel,
    recipientCount: uniqueRecipients.length,
    recipients: uniqueRecipients,
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
    recipientCount: uniqueRecipients.length,
    recipients: uniqueRecipients,
    log,
  };
};
