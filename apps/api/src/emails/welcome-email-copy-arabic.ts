import { WelcomeEmailCopyKey } from './welcome-email-copy-keys';

export const ARABIC_WELCOME_EMAIL_COPY: Record<WelcomeEmailCopyKey, string> = {
  [WelcomeEmailCopyKey.Subject]: 'أنت الآن في قائمة الوصول المبكر إلى zapbip',
  [WelcomeEmailCopyKey.Preview]: 'شكرًا على طلبك. إليك ما سيحدث بعد ذلك.',
  [WelcomeEmailCopyKey.Heading]: 'شكرًا لطلبك الوصول إلى zapbip',
  [WelcomeEmailCopyKey.Intro]: 'مع zapbip، يراسلك وكلاء الذكاء الاصطناعي على WhatsApp: يسألونك بالأزرار، وينتظرون ردّك، ثم يواصلون العمل.',
  [WelcomeEmailCopyKey.Waves]:
    'نفتح الوصول على دفعات، بحسب ترتيب الطلبات. عندما يحين دورك، سنخبرك بالبريد الإلكتروني أو على WhatsApp. حتى ذلك الحين، لا شيء آخر مطلوب منك.',
  [WelcomeEmailCopyKey.StartLead]: 'عندما يُفتح وصولك، يبدأ هذا الرابط محادثتك الأولى مع zapbip على WhatsApp.',
  [WelcomeEmailCopyKey.StartAction]: 'ابدأ على WhatsApp',
  [WelcomeEmailCopyKey.DocsLead]: 'هل تريد أن تعرف كيف يعمل؟ تشرح الوثائق كيف تربط وكيلك الأول.',
  [WelcomeEmailCopyKey.DocsAction]: 'اقرأ الوثائق',
  [WelcomeEmailCopyKey.ReferralLead]: 'تعرف شخصًا قد يعجبه؟ شارك رابطك:',
  [WelcomeEmailCopyKey.Signoff]: 'نلقاك على WhatsApp.',
  [WelcomeEmailCopyKey.SignoffTeam]: 'فريق zapbip',
  [WelcomeEmailCopyKey.Footer]:
    'وصلتك هذه الرسالة لأن ⁦{email}⁩ انضم إلى قائمة انتظار zapbip. يأتيك zapbip من ⁦{company}⁩. لديك سؤال؟ ردّ على هذه الرسالة فحسب.',
};
