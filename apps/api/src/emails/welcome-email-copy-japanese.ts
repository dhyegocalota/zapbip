import { WelcomeEmailCopyKey } from './welcome-email-copy-keys';

export const JAPANESE_WELCOME_EMAIL_COPY: Record<WelcomeEmailCopyKey, string> = {
  [WelcomeEmailCopyKey.Subject]: 'zapbipのアーリーアクセスリストに登録されました',
  [WelcomeEmailCopyKey.Preview]: 'リクエストありがとうございます。今後の流れをご案内します。',
  [WelcomeEmailCopyKey.Heading]: 'zapbipへのアクセスをリクエストいただき、ありがとうございます',
  [WelcomeEmailCopyKey.Intro]:
    'zapbipを使うと、AIエージェントがWhatsAppでメッセージを送ってきます。ボタンで質問し、あなたの返信を待ってから作業を続けます。',
  [WelcomeEmailCopyKey.Waves]:
    'アクセスはリクエストいただいた順に、順次開放しています。順番が来たら、メールまたはWhatsAppでお知らせします。それまで必要な操作はありません。',
  [WelcomeEmailCopyKey.StartLead]: 'アクセスが開始されたら、このリンクからWhatsAppでzapbipとの最初の会話を始められます。',
  [WelcomeEmailCopyKey.StartAction]: 'WhatsAppで始める',
  [WelcomeEmailCopyKey.DocsLead]: '仕組みが気になりますか？ドキュメントで、最初のエージェントのつなぎ方を説明しています。',
  [WelcomeEmailCopyKey.DocsAction]: 'ドキュメントを読む',
  [WelcomeEmailCopyKey.ReferralLead]: '興味を持ちそうな方がいれば、あなたのリンクを共有してください：',
  [WelcomeEmailCopyKey.Signoff]: 'WhatsAppでお会いしましょう。',
  [WelcomeEmailCopyKey.SignoffTeam]: 'zapbipチーム',
  [WelcomeEmailCopyKey.Footer]:
    'このメールは、{email}がzapbipのウェイトリストに登録されたためお送りしています。zapbipは{company}が提供しています。ご質問は、このメールにそのままご返信ください。',
};
