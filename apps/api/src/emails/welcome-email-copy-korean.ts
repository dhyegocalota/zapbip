import { WelcomeEmailCopyKey } from './welcome-email-copy-keys';

export const KOREAN_WELCOME_EMAIL_COPY: Record<WelcomeEmailCopyKey, string> = {
  [WelcomeEmailCopyKey.Subject]: 'zapbip 얼리 액세스 명단에 등록되었어요',
  [WelcomeEmailCopyKey.Preview]: '신청해 주셔서 고마워요. 앞으로의 진행을 알려 드릴게요.',
  [WelcomeEmailCopyKey.Heading]: 'zapbip 이용을 신청해 주셔서 고마워요',
  [WelcomeEmailCopyKey.Intro]:
    'zapbip을 쓰면 AI 에이전트가 WhatsApp으로 먼저 말을 걸어요. 버튼으로 물어보고, 답을 기다린 뒤 작업을 이어 가요.',
  [WelcomeEmailCopyKey.Waves]:
    '이용은 신청한 순서대로 순차적으로 열어요. 차례가 되면 이메일이나 WhatsApp으로 알려 드릴게요. 그때까지 더 하실 일은 없어요.',
  [WelcomeEmailCopyKey.StartLead]: '이용이 열리면 이 링크로 WhatsApp에서 zapbip과 첫 대화를 시작할 수 있어요.',
  [WelcomeEmailCopyKey.StartAction]: 'WhatsApp에서 시작하기',
  [WelcomeEmailCopyKey.DocsLead]: '어떻게 작동하는지 궁금하세요? 문서에서 첫 에이전트를 연결하는 방법을 볼 수 있어요.',
  [WelcomeEmailCopyKey.DocsAction]: '문서 보기',
  [WelcomeEmailCopyKey.ReferralLead]: '좋아할 만한 분이 있다면 링크를 공유해 주세요:',
  [WelcomeEmailCopyKey.Signoff]: 'WhatsApp에서 만나요.',
  [WelcomeEmailCopyKey.SignoffTeam]: 'zapbip 팀',
  [WelcomeEmailCopyKey.Footer]:
    '{email} 주소로 zapbip 대기 명단에 등록해서 이 메일을 받으셨어요. zapbip은 {company}에서 만들어요. 궁금한 점이 있으면 이 메일에 답장해 주세요.',
};
