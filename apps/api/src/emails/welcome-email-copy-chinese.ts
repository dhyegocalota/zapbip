import { WelcomeEmailCopyKey } from './welcome-email-copy-keys';

export const CHINESE_WELCOME_EMAIL_COPY: Record<WelcomeEmailCopyKey, string> = {
  [WelcomeEmailCopyKey.Subject]: '你已加入 zapbip 抢先体验名单',
  [WelcomeEmailCopyKey.Preview]: '感谢你的申请，接下来的安排如下。',
  [WelcomeEmailCopyKey.Heading]: '感谢你申请使用 zapbip',
  [WelcomeEmailCopyKey.Intro]: '有了 zapbip，你的 AI 智能体会在 WhatsApp 上给你发消息：用按钮向你提问，等你回复，再继续工作。',
  [WelcomeEmailCopyKey.Waves]:
    '我们分批开放使用资格，按申请的先后顺序进行。轮到你时，我们会通过邮件或 WhatsApp 通知你。在此之前，你无需做任何事。',
  [WelcomeEmailCopyKey.StartLead]: '使用资格开放后，通过这个链接即可在 WhatsApp 上开始与 zapbip 的第一次对话。',
  [WelcomeEmailCopyKey.StartAction]: '在 WhatsApp 上开始',
  [WelcomeEmailCopyKey.DocsLead]: '想了解它是怎么运作的？文档介绍了如何连接你的第一个智能体。',
  [WelcomeEmailCopyKey.DocsAction]: '阅读文档',
  [WelcomeEmailCopyKey.ReferralLead]: '认识可能感兴趣的朋友？分享你的链接：',
  [WelcomeEmailCopyKey.Signoff]: 'WhatsApp 上见。',
  [WelcomeEmailCopyKey.SignoffTeam]: 'zapbip 团队',
  [WelcomeEmailCopyKey.Footer]:
    '你收到这封邮件，是因为 {email} 加入了 zapbip 的候补名单。zapbip 由 {company} 打造。有任何问题，直接回复这封邮件即可。',
};
