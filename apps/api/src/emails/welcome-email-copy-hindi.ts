import { WelcomeEmailCopyKey } from './welcome-email-copy-keys';

export const HINDI_WELCOME_EMAIL_COPY: Record<WelcomeEmailCopyKey, string> = {
  [WelcomeEmailCopyKey.Subject]: 'आप zapbip की अर्ली एक्सेस लिस्ट में हैं',
  [WelcomeEmailCopyKey.Preview]: 'एक्सेस माँगने के लिए धन्यवाद। आगे क्या होगा, यह रहा।',
  [WelcomeEmailCopyKey.Heading]: 'zapbip का एक्सेस माँगने के लिए धन्यवाद',
  [WelcomeEmailCopyKey.Intro]:
    'zapbip के साथ आपके AI एजेंट आपको WhatsApp पर लिखते हैं: वे बटन के साथ पूछते हैं, आपके जवाब का इंतज़ार करते हैं, फिर काम आगे बढ़ाते हैं।',
  [WelcomeEmailCopyKey.Waves]:
    'हम एक्सेस चरणों में खोलते हैं, उसी क्रम में जिसमें लोगों ने माँगा था। आपकी बारी आने पर हम आपको ईमेल या WhatsApp पर बताएँगे। तब तक आपको और कुछ नहीं करना है।',
  [WelcomeEmailCopyKey.StartLead]: 'आपका एक्सेस खुलते ही यह लिंक WhatsApp पर zapbip के साथ आपकी पहली बातचीत शुरू करेगा।',
  [WelcomeEmailCopyKey.StartAction]: 'WhatsApp पर शुरू करें',
  [WelcomeEmailCopyKey.DocsLead]: 'जानना चाहते हैं कि यह कैसे काम करता है? डॉक्स में बताया गया है कि अपना पहला एजेंट कैसे जोड़ें।',
  [WelcomeEmailCopyKey.DocsAction]: 'डॉक्स पढ़ें',
  [WelcomeEmailCopyKey.ReferralLead]: 'किसी ऐसे व्यक्ति को जानते हैं जिसे यह पसंद आएगा? अपना लिंक शेयर करें:',
  [WelcomeEmailCopyKey.Signoff]: 'WhatsApp पर मिलते हैं।',
  [WelcomeEmailCopyKey.SignoffTeam]: 'zapbip टीम',
  [WelcomeEmailCopyKey.Footer]:
    'आपको यह ईमेल इसलिए मिला क्योंकि {email} ने zapbip की वेटलिस्ट जॉइन की। zapbip को {company} बनाता है। कोई सवाल हो तो बस इस ईमेल का जवाब दें।',
};
