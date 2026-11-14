import { WelcomeEmailCopyKey } from './welcome-email-copy-keys';

export const SPANISH_WELCOME_EMAIL_COPY: Record<WelcomeEmailCopyKey, string> = {
  [WelcomeEmailCopyKey.Subject]: 'Ya estás en la lista de acceso anticipado de zapbip',
  [WelcomeEmailCopyKey.Preview]: 'Gracias por tu solicitud. Esto es lo que sigue.',
  [WelcomeEmailCopyKey.Heading]: 'Gracias por solicitar acceso a zapbip',
  [WelcomeEmailCopyKey.Intro]:
    'Con zapbip, tus agentes de IA te escriben por WhatsApp: preguntan con botones, esperan tu respuesta y siguen trabajando.',
  [WelcomeEmailCopyKey.Waves]:
    'Abrimos el acceso por oleadas, en el orden de las solicitudes. Cuando llegue tu turno, te avisaremos por correo o por WhatsApp. Hasta entonces, no tienes que hacer nada más.',
  [WelcomeEmailCopyKey.StartLead]: 'Cuando se abra tu acceso, este enlace inicia tu primera conversación con zapbip en WhatsApp.',
  [WelcomeEmailCopyKey.StartAction]: 'Empezar en WhatsApp',
  [WelcomeEmailCopyKey.DocsLead]: '¿Quieres ver cómo funciona? La documentación explica cómo conectar tu primer agente.',
  [WelcomeEmailCopyKey.DocsAction]: 'Leer la documentación',
  [WelcomeEmailCopyKey.ReferralLead]: '¿Conoces a alguien a quien le pueda gustar? Comparte tu enlace:',
  [WelcomeEmailCopyKey.Signoff]: 'Nos vemos en WhatsApp.',
  [WelcomeEmailCopyKey.SignoffTeam]: 'El equipo de zapbip',
  [WelcomeEmailCopyKey.Footer]:
    'Recibes este correo porque {email} se unió a la lista de espera de zapbip. zapbip es un producto de {company}. ¿Dudas? Responde a este correo.',
};
