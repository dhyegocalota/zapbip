import {
  AccountReplyIntent,
  COMPANY,
  CommandKind,
  ONBOARDING_REQUEST_ACCESS_LINKS,
  ONBOARDING_SETUP_LINKS,
  OwnerLocale,
} from '@zapbip/types';
import { invalidInput } from '../inbox/inbox-error-factories';
import type { AccountReply, MenuRow } from './account-types';
import { formatMenuRowId } from './command';
import { MENU_COMMAND_KINDS } from './command-words';

type LocalizedText = Record<OwnerLocale, string>;

const COPY_TOKEN_PATTERN = /\{(\w+)\}/g;
const PARAGRAPH_BREAK = '\n\n';

export const COMPANY_LINE: LocalizedText = {
  [OwnerLocale.PortugueseBrazil]: `zapbip é um produto da ${COMPANY.tradeName}`,
  [OwnerLocale.EnglishUs]: `zapbip is a product of ${COMPANY.tradeName}`,
  [OwnerLocale.Spanish]: `zapbip es un producto de ${COMPANY.tradeName}`,
  [OwnerLocale.German]: `zapbip ist ein Produkt von ${COMPANY.tradeName}`,
  [OwnerLocale.French]: `zapbip est un produit de ${COMPANY.tradeName}`,
  [OwnerLocale.Japanese]: `zapbipは${COMPANY.tradeName}の製品です`,
  [OwnerLocale.Korean]: `zapbip은 ${COMPANY.tradeName}의 제품이에요`,
  [OwnerLocale.ChineseSimplified]: `zapbip 是 ${COMPANY.tradeName} 的产品`,
  [OwnerLocale.Arabic]: `zapbip منتج من ${COMPANY.tradeName}`,
};

const COMPANY_LINE_INTENTS: ReadonlySet<AccountReplyIntent> = new Set([
  AccountReplyIntent.Waitlisted,
  AccountReplyIntent.Unknown,
  AccountReplyIntent.Menu,
]);

const ACCOUNT_COPY: Record<AccountReplyIntent, LocalizedText> = {
  [AccountReplyIntent.Waitlisted]: {
    [OwnerLocale.PortugueseBrazil]: `O zapbip é o seu WhatsApp pessoal para conversar com seus agentes de IA. O acesso é por lista de espera e você já está nela: avisamos aqui quando seu acesso for liberado. Para ir se preparando, veja como conectar seus agentes: ${ONBOARDING_SETUP_LINKS[OwnerLocale.PortugueseBrazil]}\n\nQuer entrar mais cedo? Peça acesso: ${ONBOARDING_REQUEST_ACCESS_LINKS[OwnerLocale.PortugueseBrazil]}\n\nEnvie "ajuda" quando seu acesso for liberado.`,
    [OwnerLocale.EnglishUs]: `zapbip is your personal WhatsApp for talking to your AI agents. Access is by waitlist and you are already on it: we will tell you here when it opens. To get ready, see how to connect your agents: ${ONBOARDING_SETUP_LINKS[OwnerLocale.EnglishUs]}\n\nWant in sooner? Request access: ${ONBOARDING_REQUEST_ACCESS_LINKS[OwnerLocale.EnglishUs]}\n\nSend "help" when access opens.`,
    [OwnerLocale.Spanish]: `zapbip es tu WhatsApp personal para hablar con tus agentes de IA. El acceso es por lista de espera y ya estás en ella: te avisaremos aquí cuando tu acceso esté activo. Para ir preparándote, mira cómo conectar tus agentes: ${ONBOARDING_SETUP_LINKS[OwnerLocale.Spanish]}\n\n¿Quieres entrar antes? Pide acceso: ${ONBOARDING_REQUEST_ACCESS_LINKS[OwnerLocale.Spanish]}\n\nEnvía "ayuda" cuando tu acceso esté activo.`,
    [OwnerLocale.German]: `zapbip ist dein persönliches WhatsApp, um mit deinen KI-Agenten zu sprechen. Der Zugang läuft über eine Warteliste, und du stehst schon darauf: Wir sagen dir hier Bescheid, sobald er freigeschaltet ist. Um dich vorzubereiten, sieh dir an, wie du deine Agenten verbindest: ${ONBOARDING_SETUP_LINKS[OwnerLocale.German]}\n\nDu willst früher rein? Frag den Zugang an: ${ONBOARDING_REQUEST_ACCESS_LINKS[OwnerLocale.German]}\n\nSende "hilfe", sobald der Zugang öffnet.`,
    [OwnerLocale.French]: `zapbip est votre WhatsApp personnel pour parler à vos agents IA. L’accès se fait par liste d’attente et vous y êtes déjà\u00a0: nous vous préviendrons ici dès que votre accès sera activé. Pour vous préparer, voyez comment connecter vos agents\u00a0: ${ONBOARDING_SETUP_LINKS[OwnerLocale.French]}\n\nEnvie d’entrer plus tôt\u202f? Demandez l’accès\u00a0: ${ONBOARDING_REQUEST_ACCESS_LINKS[OwnerLocale.French]}\n\nEnvoyez "aide" quand l’accès ouvrira.`,
    [OwnerLocale.Japanese]: `zapbipは、AIエージェントと話すためのあなた専用のWhatsAppです。アクセスはウェイトリスト制で、あなたはすでに登録されています。利用できるようになったらここでお知らせします。準備のために、エージェントの接続方法をご覧ください: ${ONBOARDING_SETUP_LINKS[OwnerLocale.Japanese]}\n\nもっと早く使いたい場合は、アクセスをリクエストしてください: ${ONBOARDING_REQUEST_ACCESS_LINKS[OwnerLocale.Japanese]}\n\n利用できるようになったら「ヘルプ」と送信してください。`,
    [OwnerLocale.Korean]: `zapbip은 AI 에이전트와 대화하는 나만의 WhatsApp이에요. 이용은 대기자 명단 순서로 제공되고, 이미 명단에 등록되어 있어요. 이용할 수 있게 되면 여기서 알려 드릴게요. 미리 준비하려면 에이전트를 연결하는 방법을 확인하세요: ${ONBOARDING_SETUP_LINKS[OwnerLocale.Korean]}\n\n더 일찍 들어오고 싶다면 이용을 신청하세요: ${ONBOARDING_REQUEST_ACCESS_LINKS[OwnerLocale.Korean]}\n\n이용할 수 있게 되면 "도움말"을 보내 주세요.`,
    [OwnerLocale.ChineseSimplified]: `zapbip 是你用来和 AI 智能体对话的专属 WhatsApp。使用资格通过候补名单开放，你已经在名单中：开放时我们会在这里通知你。想提前准备，可以看看如何连接你的智能体：${ONBOARDING_SETUP_LINKS[OwnerLocale.ChineseSimplified]}\n\n想早点进来？申请使用：${ONBOARDING_REQUEST_ACCESS_LINKS[OwnerLocale.ChineseSimplified]}\n\n使用资格开放后，请发送“帮助”。`,
    [OwnerLocale.Arabic]: `zapbip هو WhatsApp الشخصي الخاص بك للتحدث مع وكلاء الذكاء الاصطناعي. الوصول عبر قائمة انتظار وأنت مسجَّل فيها بالفعل: سنخبرك هنا عندما يُفعَّل وصولك. وللاستعداد، تعرّف على طريقة ربط وكلائك:\n${ONBOARDING_SETUP_LINKS[OwnerLocale.Arabic]}\n\nتريد الدخول مبكرًا؟ اطلب الوصول:\n${ONBOARDING_REQUEST_ACCESS_LINKS[OwnerLocale.Arabic]}\n\nأرسل «مساعدة» عندما يُفعَّل وصولك.`,
  },
  [AccountReplyIntent.Suspended]: {
    [OwnerLocale.PortugueseBrazil]: 'Sua conta está suspensa.',
    [OwnerLocale.EnglishUs]: 'Your account is suspended.',
    [OwnerLocale.Spanish]: 'Tu cuenta está suspendida.',
    [OwnerLocale.German]: 'Dein Konto ist gesperrt.',
    [OwnerLocale.French]: 'Votre compte est suspendu.',
    [OwnerLocale.Japanese]: 'アカウントは停止されています。',
    [OwnerLocale.Korean]: '계정이 정지되었어요.',
    [OwnerLocale.ChineseSimplified]: '你的账户已被暂停。',
    [OwnerLocale.Arabic]: 'حسابك موقوف.',
  },
  [AccountReplyIntent.Created]: {
    [OwnerLocale.PortugueseBrazil]:
      'Agente {agent_name} criado. Cole no seu agente:\n\n{install_prompt}\n\nSe o link expirar ou for usado, envie "renovar {agent_name}".',
    [OwnerLocale.EnglishUs]:
      'Agent {agent_name} created. Paste this into your agent:\n\n{install_prompt}\n\nIf the link expires or was used, send "rotate {agent_name}".',
    [OwnerLocale.Spanish]:
      'Agente {agent_name} creado. Pega esto en tu agente:\n\n{install_prompt}\n\nSi el enlace caduca o ya se usó, envía "rotar {agent_name}".',
    [OwnerLocale.German]:
      'Agent {agent_name} erstellt. Füge das in deinen Agenten ein:\n\n{install_prompt}\n\nWenn der Link abläuft oder schon benutzt wurde, sende "erneuern {agent_name}".',
    [OwnerLocale.French]:
      'Agent {agent_name} créé. Collez ceci dans votre agent\u00a0:\n\n{install_prompt}\n\nSi le lien expire ou a déjà servi, envoyez "renouveler {agent_name}".',
    [OwnerLocale.Japanese]:
      'エージェント{agent_name}を作成しました。次の内容をエージェントに貼り付けてください:\n\n{install_prompt}\n\nリンクの期限が切れた場合や使用済みの場合は、「再発行 {agent_name}」と送信してください。',
    [OwnerLocale.Korean]:
      '에이전트 {agent_name}을(를) 만들었어요. 이 내용을 에이전트에 붙여넣으세요:\n\n{install_prompt}\n\n링크가 만료되었거나 이미 사용했다면 "재발급 {agent_name}"을(를) 보내세요.',
    [OwnerLocale.ChineseSimplified]:
      '智能体 {agent_name} 已创建。请把下面的内容粘贴到你的智能体中：\n\n{install_prompt}\n\n如果链接过期或已被使用，请发送“轮换 {agent_name}”。',
    [OwnerLocale.Arabic]:
      'تم إنشاء الوكيل {agent_name}. الصق هذا في وكيلك:\n\n{install_prompt}\n\nإذا انتهت صلاحية الرابط أو استُخدم، أرسل «تجديد رابط {agent_name}».',
  },
  [AccountReplyIntent.InvalidName]: {
    [OwnerLocale.PortugueseBrazil]: 'Nome inválido. Use de 1 a 20 letras minúsculas, números ou hífens, começando por letra ou número.',
    [OwnerLocale.EnglishUs]: 'Invalid name. Use 1 to 20 lowercase letters, numbers or hyphens, starting with a letter or number.',
    [OwnerLocale.Spanish]: 'Nombre no válido. Usa de 1 a 20 letras minúsculas, números o guiones, empezando por una letra o un número.',
    [OwnerLocale.German]:
      'Ungültiger Name. Nutze 1 bis 20 Kleinbuchstaben, Ziffern oder Bindestriche, beginnend mit einem Buchstaben oder einer Ziffer.',
    [OwnerLocale.French]:
      'Nom invalide. Utilisez de 1 à 20 lettres minuscules, chiffres ou tirets, en commençant par une lettre ou un chiffre.',
    [OwnerLocale.Japanese]: '名前が正しくありません。英字または数字で始まる、小文字の英字・数字・ハイフンの1〜20文字にしてください。',
    [OwnerLocale.Korean]: '올바르지 않은 이름이에요. 문자나 숫자로 시작하는 소문자, 숫자, 하이픈 1~20자를 사용하세요.',
    [OwnerLocale.ChineseSimplified]: '名称无效。请使用 1 到 20 个小写字母、数字或连字符，并以字母或数字开头。',
    [OwnerLocale.Arabic]: 'اسم غير صالح. استخدم من 1 إلى 20 حرفًا لاتينيًا صغيرًا أو أرقامًا أو شرطات، على أن يبدأ بحرف أو رقم.',
  },
  [AccountReplyIntent.ReservedName]: {
    [OwnerLocale.PortugueseBrazil]: 'Esse nome é reservado porque é o início de um comando. Escolha outro.',
    [OwnerLocale.EnglishUs]: 'That name is reserved because it starts a command. Choose another one.',
    [OwnerLocale.Spanish]: 'Ese nombre está reservado porque inicia un comando. Elige otro.',
    [OwnerLocale.German]: 'Dieser Name ist reserviert, weil er einen Befehl einleitet. Wähle einen anderen.',
    [OwnerLocale.French]: 'Ce nom est réservé, car il déclenche une commande. Choisissez-en un autre.',
    [OwnerLocale.Japanese]: 'この名前はコマンドの開始に使われるため予約されています。別の名前にしてください。',
    [OwnerLocale.Korean]: '명령어의 시작으로 쓰이는 이름이라 예약되어 있어요. 다른 이름을 골라 주세요.',
    [OwnerLocale.ChineseSimplified]: '该名称因用于启动命令而被保留。请换一个。',
    [OwnerLocale.Arabic]: 'هذا الاسم محجوز لأنه يبدأ أمرًا. اختر اسمًا آخر.',
  },
  [AccountReplyIntent.NameTaken]: {
    [OwnerLocale.PortugueseBrazil]: 'Já existe um agente chamado {agent_name}.',
    [OwnerLocale.EnglishUs]: 'An agent named {agent_name} already exists.',
    [OwnerLocale.Spanish]: 'Ya existe un agente llamado {agent_name}.',
    [OwnerLocale.German]: 'Es gibt bereits einen Agenten namens {agent_name}.',
    [OwnerLocale.French]: 'Un agent nommé {agent_name} existe déjà.',
    [OwnerLocale.Japanese]: '{agent_name}という名前のエージェントはすでに存在します。',
    [OwnerLocale.Korean]: '{agent_name}이라는 에이전트가 이미 있어요.',
    [OwnerLocale.ChineseSimplified]: '已经有一个名为 {agent_name} 的智能体。',
    [OwnerLocale.Arabic]: 'يوجد بالفعل وكيل باسم {agent_name}.',
  },
  [AccountReplyIntent.LimitReached]: {
    [OwnerLocale.PortugueseBrazil]: 'Limite de {limit} agentes atingido. Envie "revogar <nome>" para liberar uma vaga.',
    [OwnerLocale.EnglishUs]: 'Limit of {limit} agents reached. Send "revoke <name>" to free a slot.',
    [OwnerLocale.Spanish]: 'Has alcanzado el límite de {limit} agentes. Envía "revocar <nombre>" para liberar un hueco.',
    [OwnerLocale.German]: 'Das Limit von {limit} Agenten ist erreicht. Sende "widerrufen <name>", um einen Platz freizumachen.',
    [OwnerLocale.French]: 'Limite de {limit} agents atteinte. Envoyez "révoquer <nom>" pour libérer une place.',
    [OwnerLocale.Japanese]: 'エージェントの上限{limit}件に達しました。「無効化 <名前>」と送信して空きを作ってください。',
    [OwnerLocale.Korean]: '에이전트 한도인 {limit}개에 도달했어요. "폐기 <이름>"을 보내 자리를 만드세요.',
    [OwnerLocale.ChineseSimplified]: '已达到 {limit} 个智能体的上限。发送“撤销 <名称>”可腾出名额。',
    [OwnerLocale.Arabic]: 'بلغت الحد الأقصى للوكلاء ({limit}). أرسل «إبطال <الاسم>» لتحرير مكان.',
  },
  [AccountReplyIntent.NotFound]: {
    [OwnerLocale.PortugueseBrazil]: 'Nenhum agente ativo tem esse nome.',
    [OwnerLocale.EnglishUs]: 'No active agent has that name.',
    [OwnerLocale.Spanish]: 'Ningún agente activo tiene ese nombre.',
    [OwnerLocale.German]: 'Kein aktiver Agent hat diesen Namen.',
    [OwnerLocale.French]: 'Aucun agent actif ne porte ce nom.',
    [OwnerLocale.Japanese]: 'その名前の有効なエージェントはありません。',
    [OwnerLocale.Korean]: '그 이름의 활성 에이전트가 없어요.',
    [OwnerLocale.ChineseSimplified]: '没有叫这个名字的有效智能体。',
    [OwnerLocale.Arabic]: 'لا يوجد وكيل نشط بهذا الاسم.',
  },
  [AccountReplyIntent.Revoked]: {
    [OwnerLocale.PortugueseBrazil]: 'Agente {agent_name} revogado. O link deixou de funcionar.',
    [OwnerLocale.EnglishUs]: 'Agent {agent_name} revoked. Its link no longer works.',
    [OwnerLocale.Spanish]: 'Agente {agent_name} revocado. Su enlace dejó de funcionar.',
    [OwnerLocale.German]: 'Agent {agent_name} widerrufen. Sein Link funktioniert nicht mehr.',
    [OwnerLocale.French]: 'Agent {agent_name} révoqué. Son lien ne fonctionne plus.',
    [OwnerLocale.Japanese]: 'エージェント{agent_name}を無効にしました。リンクは使えなくなりました。',
    [OwnerLocale.Korean]: '에이전트 {agent_name}을(를) 폐기했어요. 링크는 더 이상 작동하지 않아요.',
    [OwnerLocale.ChineseSimplified]: '智能体 {agent_name} 已撤销。它的链接已失效。',
    [OwnerLocale.Arabic]: 'تم إبطال الوكيل {agent_name}. لم يعد رابطه يعمل.',
  },
  [AccountReplyIntent.Rotated]: {
    [OwnerLocale.PortugueseBrazil]:
      'Link do agente {agent_name} trocado. O link antigo deixou de funcionar. Cole no seu agente:\n\n{install_prompt}\n\nSe o link expirar ou for usado, envie "renovar {agent_name}".',
    [OwnerLocale.EnglishUs]:
      'Link of agent {agent_name} replaced. The old link no longer works. Paste this into your agent:\n\n{install_prompt}\n\nIf the link expires or was used, send "rotate {agent_name}".',
    [OwnerLocale.Spanish]:
      'Enlace del agente {agent_name} reemplazado. El enlace anterior dejó de funcionar. Pega esto en tu agente:\n\n{install_prompt}\n\nSi el enlace caduca o ya se usó, envía "rotar {agent_name}".',
    [OwnerLocale.German]:
      'Link des Agenten {agent_name} ersetzt. Der alte Link funktioniert nicht mehr. Füge das in deinen Agenten ein:\n\n{install_prompt}\n\nWenn der Link abläuft oder schon benutzt wurde, sende "erneuern {agent_name}".',
    [OwnerLocale.French]:
      'Lien de l’agent {agent_name} remplacé. L’ancien lien ne fonctionne plus. Collez ceci dans votre agent\u00a0:\n\n{install_prompt}\n\nSi le lien expire ou a déjà servi, envoyez "renouveler {agent_name}".',
    [OwnerLocale.Japanese]:
      'エージェント{agent_name}のリンクを入れ替えました。古いリンクは使えなくなりました。次の内容をエージェントに貼り付けてください:\n\n{install_prompt}\n\nリンクの期限が切れた場合や使用済みの場合は、「再発行 {agent_name}」と送信してください。',
    [OwnerLocale.Korean]:
      '에이전트 {agent_name}의 링크를 교체했어요. 이전 링크는 더 이상 작동하지 않아요. 이 내용을 에이전트에 붙여넣으세요:\n\n{install_prompt}\n\n링크가 만료되었거나 이미 사용했다면 "재발급 {agent_name}"을(를) 보내세요.',
    [OwnerLocale.ChineseSimplified]:
      '智能体 {agent_name} 的链接已更换。旧链接已失效。请把下面的内容粘贴到你的智能体中：\n\n{install_prompt}\n\n如果链接过期或已被使用，请发送“轮换 {agent_name}”。',
    [OwnerLocale.Arabic]:
      'تم استبدال رابط الوكيل {agent_name}. الرابط القديم لم يعد يعمل. الصق هذا في وكيلك:\n\n{install_prompt}\n\nإذا انتهت صلاحية الرابط أو استُخدم، أرسل «تجديد رابط {agent_name}».',
  },
  [AccountReplyIntent.Listed]: {
    [OwnerLocale.PortugueseBrazil]: 'Seus agentes:\n{agents}',
    [OwnerLocale.EnglishUs]: 'Your agents:\n{agents}',
    [OwnerLocale.Spanish]: 'Tus agentes:\n{agents}',
    [OwnerLocale.German]: 'Deine Agenten:\n{agents}',
    [OwnerLocale.French]: 'Vos agents\u00a0:\n{agents}',
    [OwnerLocale.Japanese]: 'あなたのエージェント:\n{agents}',
    [OwnerLocale.Korean]: '내 에이전트:\n{agents}',
    [OwnerLocale.ChineseSimplified]: '你的智能体：\n{agents}',
    [OwnerLocale.Arabic]: 'وكلاؤك:\n{agents}',
  },
  [AccountReplyIntent.EmptyList]: {
    [OwnerLocale.PortugueseBrazil]: 'Você ainda não tem agentes. Envie "novo agente <nome>" para criar um.',
    [OwnerLocale.EnglishUs]: 'You have no agents yet. Send "new agent <name>" to create one.',
    [OwnerLocale.Spanish]: 'Aún no tienes agentes. Envía "nuevo agente <nombre>" para crear uno.',
    [OwnerLocale.German]: 'Du hast noch keine Agenten. Sende "neuer agent <name>", um einen zu erstellen.',
    [OwnerLocale.French]: 'Vous n’avez pas encore d’agent. Envoyez "nouvel agent <nom>" pour en créer un.',
    [OwnerLocale.Japanese]: 'エージェントはまだありません。「新規エージェント <名前>」と送信して作成してください。',
    [OwnerLocale.Korean]: '아직 에이전트가 없어요. "새 에이전트 <이름>"을 보내 만들어 보세요.',
    [OwnerLocale.ChineseSimplified]: '你还没有智能体。发送“新建智能体 <名称>”来创建一个。',
    [OwnerLocale.Arabic]: 'ليس لديك وكلاء بعد. أرسل «وكيل جديد <الاسم>» لإنشاء وكيل.',
  },
  [AccountReplyIntent.Usage]: {
    [OwnerLocale.PortugueseBrazil]: 'Use: {usage}',
    [OwnerLocale.EnglishUs]: 'Use: {usage}',
    [OwnerLocale.Spanish]: 'Usa: {usage}',
    [OwnerLocale.German]: 'Nutze: {usage}',
    [OwnerLocale.French]: 'Utilisez\u00a0: {usage}',
    [OwnerLocale.Japanese]: '使い方: {usage}',
    [OwnerLocale.Korean]: '사용법: {usage}',
    [OwnerLocale.ChineseSimplified]: '用法：{usage}',
    [OwnerLocale.Arabic]: 'الاستخدام: {usage}',
  },
  [AccountReplyIntent.Menu]: {
    [OwnerLocale.PortugueseBrazil]: 'O que você quer fazer?',
    [OwnerLocale.EnglishUs]: 'What do you want to do?',
    [OwnerLocale.Spanish]: '¿Qué quieres hacer?',
    [OwnerLocale.German]: 'Was möchtest du tun?',
    [OwnerLocale.French]: 'Que voulez-vous faire\u202f?',
    [OwnerLocale.Japanese]: '何をしますか？',
    [OwnerLocale.Korean]: '무엇을 하시겠어요?',
    [OwnerLocale.ChineseSimplified]: '你想做什么？',
    [OwnerLocale.Arabic]: 'ماذا تريد أن تفعل؟',
  },
  [AccountReplyIntent.DeletionRequest]: {
    [OwnerLocale.PortugueseBrazil]:
      'Isso apaga sua conta, todos os agentes, mensagens e arquivos, e não tem volta. Para confirmar em até 10 minutos, envie: {phrase}',
    [OwnerLocale.EnglishUs]:
      'This deletes your account, every agent, message and file, and cannot be undone. To confirm within 10 minutes, send: {phrase}',
    [OwnerLocale.Spanish]:
      'Esto elimina tu cuenta, todos los agentes, mensajes y archivos, y no se puede deshacer. Para confirmar en un plazo de 10 minutos, envía: {phrase}',
    [OwnerLocale.German]:
      'Das löscht dein Konto, alle Agenten, Nachrichten und Dateien und kann nicht rückgängig gemacht werden. Zum Bestätigen innerhalb von 10 Minuten sende: {phrase}',
    [OwnerLocale.French]:
      'Cela supprime votre compte, tous vos agents, messages et fichiers, et c’est irréversible. Pour confirmer dans les 10 minutes, envoyez\u00a0: {phrase}',
    [OwnerLocale.Japanese]:
      'アカウント、すべてのエージェント、メッセージ、ファイルが削除され、元に戻せません。10分以内に確認するには、次を送信してください: {phrase}',
    [OwnerLocale.Korean]: '계정, 모든 에이전트, 메시지, 파일이 삭제되며 되돌릴 수 없어요. 10분 안에 확인하려면 다음을 보내세요: {phrase}',
    [OwnerLocale.ChineseSimplified]: '这会删除你的账户、所有智能体、消息和文件，且无法恢复。要在 10 分钟内确认，请发送：{phrase}',
    [OwnerLocale.Arabic]: 'سيؤدي هذا إلى حذف حسابك وكل وكيل ورسالة وملف فيه، ولا يمكن التراجع عنه. للتأكيد خلال 10 دقائق، أرسل: {phrase}',
  },
  [AccountReplyIntent.DeletionExpired]: {
    [OwnerLocale.PortugueseBrazil]: 'Não há pedido de exclusão válido. Envie "apagar conta" para começar de novo.',
    [OwnerLocale.EnglishUs]: 'There is no valid deletion request. Send "delete account" to start again.',
    [OwnerLocale.Spanish]: 'No hay ninguna solicitud de eliminación válida. Envía "eliminar cuenta" para empezar de nuevo.',
    [OwnerLocale.German]: 'Es gibt keine gültige Löschanfrage. Sende "konto löschen", um von vorn zu beginnen.',
    [OwnerLocale.French]: 'Il n’y a pas de demande de suppression valide. Envoyez "supprimer le compte" pour recommencer.',
    [OwnerLocale.Japanese]: '有効な削除リクエストがありません。最初からやり直すには「アカウント削除」と送信してください。',
    [OwnerLocale.Korean]: '유효한 삭제 요청이 없어요. 처음부터 다시 하려면 "계정 삭제"를 보내세요.',
    [OwnerLocale.ChineseSimplified]: '没有有效的删除请求。发送“删除账户”可重新开始。',
    [OwnerLocale.Arabic]: 'لا يوجد طلب حذف صالح. أرسل «حذف الحساب» للبدء من جديد.',
  },
  [AccountReplyIntent.DeletionDone]: {
    [OwnerLocale.PortugueseBrazil]: 'Sua conta foi apagada. A próxima mensagem começa uma nova conta.',
    [OwnerLocale.EnglishUs]: 'Your account is deleted. Your next message starts a new account.',
    [OwnerLocale.Spanish]: 'Tu cuenta se eliminó. Tu próximo mensaje inicia una cuenta nueva.',
    [OwnerLocale.German]: 'Dein Konto wurde gelöscht. Deine nächste Nachricht startet ein neues Konto.',
    [OwnerLocale.French]: 'Votre compte est supprimé. Votre prochain message ouvre un nouveau compte.',
    [OwnerLocale.Japanese]: 'アカウントを削除しました。次のメッセージから新しいアカウントが始まります。',
    [OwnerLocale.Korean]: '계정을 삭제했어요. 다음 메시지부터 새 계정이 시작돼요.',
    [OwnerLocale.ChineseSimplified]: '你的账户已删除。你的下一条消息会开启一个新账户。',
    [OwnerLocale.Arabic]: 'تم حذف حسابك. ستبدأ رسالتك التالية حسابًا جديدًا.',
  },
  [AccountReplyIntent.SignInLink]: {
    [OwnerLocale.PortugueseBrazil]:
      'Abra este link em até 10 minutos para entrar no app do zapbip:\n\n{sign_in_link}\n\nEle funciona uma vez. Não o compartilhe.',
    [OwnerLocale.EnglishUs]:
      'Open this link within 10 minutes to sign in to the zapbip app:\n\n{sign_in_link}\n\nIt works once. Do not share it.',
    [OwnerLocale.Spanish]:
      'Abre este enlace en los próximos 10 minutos para entrar en la app de zapbip:\n\n{sign_in_link}\n\nFunciona una sola vez. No lo compartas.',
    [OwnerLocale.German]:
      'Öffne diesen Link innerhalb von 10 Minuten, um dich in der zapbip-App anzumelden:\n\n{sign_in_link}\n\nEr funktioniert nur einmal. Gib ihn nicht weiter.',
    [OwnerLocale.French]:
      'Ouvrez ce lien dans les 10 minutes pour vous connecter à l’application zapbip\u00a0:\n\n{sign_in_link}\n\nIl ne fonctionne qu’une fois. Ne le partagez pas.',
    [OwnerLocale.Japanese]:
      'zapbipアプリにログインするには、10分以内にこのリンクを開いてください:\n\n{sign_in_link}\n\nリンクは1回だけ使えます。他の人に共有しないでください。',
    [OwnerLocale.Korean]:
      'zapbip 앱에 로그인하려면 10분 안에 이 링크를 여세요:\n\n{sign_in_link}\n\n한 번만 쓸 수 있어요. 다른 사람과 공유하지 마세요.',
    [OwnerLocale.ChineseSimplified]: '请在 10 分钟内打开此链接，登录 zapbip 应用：\n\n{sign_in_link}\n\n它只能使用一次。请勿分享。',
    [OwnerLocale.Arabic]:
      'افتح هذا الرابط خلال 10 دقائق لتسجيل الدخول إلى تطبيق zapbip:\n\n{sign_in_link}\n\nيعمل مرة واحدة فقط. لا تشاركه.',
  },
  [AccountReplyIntent.SendFailed]: {
    [OwnerLocale.PortugueseBrazil]: 'Não consegui entregar as instruções. Nada foi alterado; tente de novo.',
    [OwnerLocale.EnglishUs]: 'I could not deliver the instructions. Nothing was changed; try again.',
    [OwnerLocale.Spanish]: 'No pude entregar las instrucciones. No se cambió nada; inténtalo de nuevo.',
    [OwnerLocale.German]: 'Ich konnte die Anleitung nicht zustellen. Es wurde nichts geändert; versuche es erneut.',
    [OwnerLocale.French]: 'Je n’ai pas pu remettre les instructions. Rien n’a été modifié\u202f; réessayez.',
    [OwnerLocale.Japanese]: '手順をお届けできませんでした。何も変更されていません。もう一度お試しください。',
    [OwnerLocale.Korean]: '안내를 전달하지 못했어요. 바뀐 것은 없으니 다시 시도해 주세요.',
    [OwnerLocale.ChineseSimplified]: '我没能送达说明。没有任何改动；请再试一次。',
    [OwnerLocale.Arabic]: 'تعذّر عليّ إرسال التعليمات. لم يتغيّر شيء؛ حاول مرة أخرى.',
  },
  [AccountReplyIntent.AccessOpened]: {
    [OwnerLocale.PortugueseBrazil]:
      'Seu acesso ao zapbip está aberto. Envie "novo agente <nome>" para criar seu primeiro agente ou abra {app_link}.',
    [OwnerLocale.EnglishUs]: 'Your zapbip access is open. Send "new agent <name>" to create your first agent or open {app_link}.',
    [OwnerLocale.Spanish]: 'Tu acceso a zapbip está abierto. Envía "nuevo agente <nombre>" para crear tu primer agente o abre {app_link}.',
    [OwnerLocale.German]:
      'Dein zapbip-Zugang ist freigeschaltet. Sende "neuer agent <name>", um deinen ersten Agenten zu erstellen, oder öffne {app_link}.',
    [OwnerLocale.French]:
      'Votre accès à zapbip est activé. Envoyez "nouvel agent <nom>" pour créer votre premier agent ou ouvrez {app_link}.',
    [OwnerLocale.Japanese]:
      'zapbipを利用できるようになりました。「新規エージェント <名前>」と送信して最初のエージェントを作成するか、{app_link}を開いてください。',
    [OwnerLocale.Korean]:
      '이제 zapbip을 이용할 수 있어요. "새 에이전트 <이름>"을 보내 첫 에이전트를 만들거나 {app_link}을(를) 열어 보세요.',
    [OwnerLocale.ChineseSimplified]: '你的 zapbip 使用资格已开放。发送“新建智能体 <名称>”来创建你的第一个智能体，或打开 {app_link}。',
    [OwnerLocale.Arabic]: 'تم تفعيل وصولك إلى zapbip. أرسل «وكيل جديد <الاسم>» لإنشاء أول وكيل لك، أو افتح التطبيق:\n{app_link}',
  },
  [AccountReplyIntent.WindowClosed]: {
    [OwnerLocale.PortugueseBrazil]:
      'Não posso enviar esse link agora porque a janela de 24 horas está fechada. Escreva para o zapbip e peça de novo.',
    [OwnerLocale.EnglishUs]: 'I cannot send that link now because the 24-hour window is closed. Write to zapbip and ask again.',
    [OwnerLocale.Spanish]:
      'No puedo enviar ese enlace ahora porque la ventana de 24 horas está cerrada. Escribe a zapbip y pídelo de nuevo.',
    [OwnerLocale.German]:
      'Ich kann diesen Link jetzt nicht senden, weil das 24-Stunden-Fenster geschlossen ist. Schreib zapbip und frag erneut.',
    [OwnerLocale.French]:
      'Je ne peux pas envoyer ce lien maintenant, car la fenêtre de 24 heures est fermée. Écrivez à zapbip et redemandez.',
    [OwnerLocale.Japanese]:
      '24時間ウィンドウが閉じているため、今はそのリンクを送れません。zapbipにメッセージを送ってから、もう一度お願いします。',
    [OwnerLocale.Korean]: '24시간 창이 닫혀 있어서 지금은 그 링크를 보낼 수 없어요. zapbip에 메시지를 보낸 뒤 다시 요청해 주세요.',
    [OwnerLocale.ChineseSimplified]: '24 小时窗口已关闭，现在无法发送该链接。请先给 zapbip 发条消息，再重新请求。',
    [OwnerLocale.Arabic]: 'لا أستطيع إرسال هذا الرابط الآن لأن نافذة الـ24 ساعة مغلقة. اكتب إلى zapbip واطلبه مرة أخرى.',
  },
  [AccountReplyIntent.CoolingDown]: {
    [OwnerLocale.PortugueseBrazil]: 'Esse pedido não foi aprovado há pouco e está em pausa por alguns minutos.',
    [OwnerLocale.EnglishUs]: 'That request was not approved a moment ago and is paused for a few minutes.',
    [OwnerLocale.Spanish]: 'Esa solicitud no se aprobó hace un momento y está en pausa unos minutos.',
    [OwnerLocale.German]: 'Diese Anfrage wurde vor einem Moment nicht genehmigt und ist für ein paar Minuten pausiert.',
    [OwnerLocale.French]: 'Cette demande n’a pas été approuvée à l’instant et est suspendue pendant quelques minutes.',
    [OwnerLocale.Japanese]: 'そのリクエストはさきほど承認されなかったため、数分間停止しています。',
    [OwnerLocale.Korean]: '그 요청은 방금 승인되지 않아 몇 분 동안 중단되었어요.',
    [OwnerLocale.ChineseSimplified]: '该请求刚才未被批准，已暂停几分钟。',
    [OwnerLocale.Arabic]: 'لم تتم الموافقة على هذا الطلب قبل لحظات، وهو متوقف لبضع دقائق.',
  },
  [AccountReplyIntent.LanguageChanged]: {
    [OwnerLocale.PortugueseBrazil]: 'Idioma alterado para português. A partir de agora escrevo em português.',
    [OwnerLocale.EnglishUs]: 'Language set to English. I will write to you in English from now on.',
    [OwnerLocale.Spanish]: 'Idioma cambiado a español. A partir de ahora te escribo en español.',
    [OwnerLocale.German]: 'Sprache auf Deutsch gestellt. Ab jetzt schreibe ich dir auf Deutsch.',
    [OwnerLocale.French]: 'Langue réglée sur le français. Désormais, je vous écris en français.',
    [OwnerLocale.Japanese]: '言語を日本語に変更しました。これからは日本語でお伝えします。',
    [OwnerLocale.Korean]: '언어를 한국어로 바꿨어요. 지금부터 한국어로 말씀드릴게요.',
    [OwnerLocale.ChineseSimplified]: '语言已切换为中文。从现在起我会用中文给你发消息。',
    [OwnerLocale.Arabic]: 'تم ضبط اللغة على العربية. سأكتب لك بالعربية من الآن فصاعدًا.',
  },
  [AccountReplyIntent.LanguageUnknown]: {
    [OwnerLocale.PortugueseBrazil]: 'Não conheço esse idioma. Envie "idioma <código>" com um destes: en, pt, es, de, fr, ja, ko, zh, ar.',
    [OwnerLocale.EnglishUs]: 'I do not know that language. Send "language <code>" with one of: en, pt, es, de, fr, ja, ko, zh, ar.',
    [OwnerLocale.Spanish]: 'No conozco ese idioma. Envía "cambiar idioma <código>" con uno de estos: en, pt, es, de, fr, ja, ko, zh, ar.',
    [OwnerLocale.German]: 'Diese Sprache kenne ich nicht. Sende "sprache <code>" mit einem von: en, pt, es, de, fr, ja, ko, zh, ar.',
    [OwnerLocale.French]:
      'Je ne connais pas cette langue. Envoyez "langue <code>" avec l’un de ces codes\u00a0: en, pt, es, de, fr, ja, ko, zh, ar.',
    [OwnerLocale.Japanese]:
      'その言語は分かりません。次のいずれかを指定して「言語 <コード>」と送信してください: en, pt, es, de, fr, ja, ko, zh, ar。',
    [OwnerLocale.Korean]: '그 언어는 몰라요. 다음 중 하나를 넣어 "언어 <코드>"를 보내 주세요: en, pt, es, de, fr, ja, ko, zh, ar.',
    [OwnerLocale.ChineseSimplified]: '我不认识这个语言。请发送“语言 <代码>”，代码可选：en, pt, es, de, fr, ja, ko, zh, ar。',
    [OwnerLocale.Arabic]: 'لا أعرف هذه اللغة. أرسل «تغيير اللغة <الرمز>» مع أحد الرموز: en, pt, es, de, fr, ja, ko, zh, ar.',
  },
  [AccountReplyIntent.Unknown]: {
    [OwnerLocale.PortugueseBrazil]: 'Não entendi. Envie "ajuda" para ver os comandos.',
    [OwnerLocale.EnglishUs]: 'I did not understand. Send "help" to see the commands.',
    [OwnerLocale.Spanish]: 'No te he entendido. Envía "ayuda" para ver los comandos.',
    [OwnerLocale.German]: 'Das habe ich nicht verstanden. Sende "hilfe", um die Befehle zu sehen.',
    [OwnerLocale.French]: 'Je n’ai pas compris. Envoyez "aide" pour voir les commandes.',
    [OwnerLocale.Japanese]: '理解できませんでした。コマンドを見るには「ヘルプ」と送信してください。',
    [OwnerLocale.Korean]: '이해하지 못했어요. 명령어를 보려면 "도움말"을 보내 주세요.',
    [OwnerLocale.ChineseSimplified]: '我没听懂。发送“帮助”查看命令。',
    [OwnerLocale.Arabic]: 'لم أفهم. أرسل «مساعدة» لعرض الأوامر.',
  },
};

const INSTALL_LINK_TOKEN = '{install_link}';

const INSTALL_LINES: LocalizedText = {
  [OwnerLocale.PortugueseBrazil]:
    'Conecte-se ao meu WhatsApp pelo zapbip: leia {install_link} e siga as instruções.\nEste link vale 30 minutos e funciona uma vez. Não o compartilhe.',
  [OwnerLocale.EnglishUs]:
    'Connect yourself to my WhatsApp with zapbip: read {install_link} and follow the instructions.\nThis link works once for 30 minutes. Do not share it.',
  [OwnerLocale.Spanish]:
    'Conéctate a mi WhatsApp con zapbip: lee {install_link} y sigue las instrucciones.\nEste enlace funciona una vez durante 30 minutos. No lo compartas.',
  [OwnerLocale.German]:
    'Verbinde dich über zapbip mit meinem WhatsApp: Lies {install_link} und folge den Anweisungen.\nDieser Link ist 30 Minuten gültig und nur einmal nutzbar. Gib ihn nicht weiter.',
  [OwnerLocale.French]:
    'Connectez-vous à mon WhatsApp avec zapbip\u00a0: lisez {install_link} et suivez les instructions.\nCe lien est valable 30 minutes et ne fonctionne qu’une fois. Ne le partagez pas.',
  [OwnerLocale.Japanese]:
    'zapbipで私のWhatsAppにつながってください。{install_link}を読み、手順に従ってください。\nこのリンクは30分間、1回だけ使えます。共有しないでください。',
  [OwnerLocale.Korean]:
    'zapbip으로 제 WhatsApp에 연결하세요. {install_link}을(를) 읽고 안내를 따르세요.\n이 링크는 30분 동안 한 번만 쓸 수 있어요. 공유하지 마세요.',
  [OwnerLocale.ChineseSimplified]:
    '请通过 zapbip 连接到我的 WhatsApp：阅读 {install_link} 并按说明操作。\n此链接 30 分钟内只能使用一次。请勿分享。',
  [OwnerLocale.Arabic]:
    'اتصل بحساب WhatsApp الخاص بي عبر zapbip: اقرأ {install_link} واتبع التعليمات.\nهذا الرابط صالح 30 دقيقة ويعمل مرة واحدة فقط. لا تشاركه.',
};

const MENU_ROW_TITLES: Partial<Record<CommandKind, LocalizedText>> = {
  [CommandKind.CreateAgent]: {
    [OwnerLocale.PortugueseBrazil]: 'Novo agente',
    [OwnerLocale.EnglishUs]: 'New agent',
    [OwnerLocale.Spanish]: 'Nuevo agente',
    [OwnerLocale.German]: 'Neuer Agent',
    [OwnerLocale.French]: 'Nouvel agent',
    [OwnerLocale.Japanese]: '新規エージェント',
    [OwnerLocale.Korean]: '새 에이전트',
    [OwnerLocale.ChineseSimplified]: '新建智能体',
    [OwnerLocale.Arabic]: 'وكيل جديد',
  },
  [CommandKind.ListAgents]: {
    [OwnerLocale.PortugueseBrazil]: 'Meus agentes',
    [OwnerLocale.EnglishUs]: 'My agents',
    [OwnerLocale.Spanish]: 'Mis agentes',
    [OwnerLocale.German]: 'Meine Agenten',
    [OwnerLocale.French]: 'Mes agents',
    [OwnerLocale.Japanese]: 'エージェント一覧',
    [OwnerLocale.Korean]: '내 에이전트',
    [OwnerLocale.ChineseSimplified]: '我的智能体',
    [OwnerLocale.Arabic]: 'وكلائي',
  },
  [CommandKind.RevokeAgent]: {
    [OwnerLocale.PortugueseBrazil]: 'Revogar agente',
    [OwnerLocale.EnglishUs]: 'Revoke agent',
    [OwnerLocale.Spanish]: 'Revocar agente',
    [OwnerLocale.German]: 'Agent widerrufen',
    [OwnerLocale.French]: 'Révoquer un agent',
    [OwnerLocale.Japanese]: 'エージェントを無効化',
    [OwnerLocale.Korean]: '에이전트 폐기',
    [OwnerLocale.ChineseSimplified]: '撤销智能体',
    [OwnerLocale.Arabic]: 'إبطال وكيل',
  },
  [CommandKind.RotateAgent]: {
    [OwnerLocale.PortugueseBrazil]: 'Renovar link',
    [OwnerLocale.EnglishUs]: 'Rotate link',
    [OwnerLocale.Spanish]: 'Rotar enlace',
    [OwnerLocale.German]: 'Link erneuern',
    [OwnerLocale.French]: 'Renouveler le lien',
    [OwnerLocale.Japanese]: 'リンクを再発行',
    [OwnerLocale.Korean]: '링크 재발급',
    [OwnerLocale.ChineseSimplified]: '轮换链接',
    [OwnerLocale.Arabic]: 'تجديد الرابط',
  },
  [CommandKind.Help]: {
    [OwnerLocale.PortugueseBrazil]: 'Ajuda',
    [OwnerLocale.EnglishUs]: 'Help',
    [OwnerLocale.Spanish]: 'Ayuda',
    [OwnerLocale.German]: 'Hilfe',
    [OwnerLocale.French]: 'Aide',
    [OwnerLocale.Japanese]: 'ヘルプ',
    [OwnerLocale.Korean]: '도움말',
    [OwnerLocale.ChineseSimplified]: '帮助',
    [OwnerLocale.Arabic]: 'مساعدة',
  },
  [CommandKind.SetLanguage]: {
    [OwnerLocale.PortugueseBrazil]: 'Idioma',
    [OwnerLocale.EnglishUs]: 'Language',
    [OwnerLocale.Spanish]: 'Idioma',
    [OwnerLocale.German]: 'Sprache',
    [OwnerLocale.French]: 'Langue',
    [OwnerLocale.Japanese]: '言語',
    [OwnerLocale.Korean]: '언어',
    [OwnerLocale.ChineseSimplified]: '语言',
    [OwnerLocale.Arabic]: 'اللغة',
  },
  [CommandKind.RequestDeletion]: {
    [OwnerLocale.PortugueseBrazil]: 'Apagar conta',
    [OwnerLocale.EnglishUs]: 'Delete account',
    [OwnerLocale.Spanish]: 'Eliminar cuenta',
    [OwnerLocale.German]: 'Konto löschen',
    [OwnerLocale.French]: 'Supprimer le compte',
    [OwnerLocale.Japanese]: 'アカウント削除',
    [OwnerLocale.Korean]: '계정 삭제',
    [OwnerLocale.ChineseSimplified]: '删除账户',
    [OwnerLocale.Arabic]: 'حذف الحساب',
  },
};

const MENU_BUTTON_TEXT: LocalizedText = {
  [OwnerLocale.PortugueseBrazil]: 'Comandos',
  [OwnerLocale.EnglishUs]: 'Commands',
  [OwnerLocale.Spanish]: 'Comandos',
  [OwnerLocale.German]: 'Befehle',
  [OwnerLocale.French]: 'Commandes',
  [OwnerLocale.Japanese]: 'コマンド',
  [OwnerLocale.Korean]: '명령어',
  [OwnerLocale.ChineseSimplified]: '命令',
  [OwnerLocale.Arabic]: 'الأوامر',
};

export function renderAccountReply(input: { reply: AccountReply }): string {
  const { intent, locale } = input.reply;
  const parameters: Record<string, string | undefined> = input.reply.parameters;
  const body = ACCOUNT_COPY[intent][locale].replace(COPY_TOKEN_PATTERN, (_token, name: string) => {
    const value = parameters[name];
    if (value === undefined) throw invalidInput({ message: `copy: missing parameter ${name}` });
    return value;
  });
  return COMPANY_LINE_INTENTS.has(intent) ? `${body}${PARAGRAPH_BREAK}${COMPANY_LINE[locale]}` : body;
}

export const UNKNOWN_CLIENT_LABEL: Record<OwnerLocale, string> = {
  [OwnerLocale.PortugueseBrazil]: 'app desconhecido',
  [OwnerLocale.EnglishUs]: 'unknown client',
  [OwnerLocale.Spanish]: 'app desconocida',
  [OwnerLocale.German]: 'unbekannte App',
  [OwnerLocale.French]: 'appli inconnue',
  [OwnerLocale.Japanese]: '不明なアプリ',
  [OwnerLocale.Korean]: '알 수 없는 앱',
  [OwnerLocale.ChineseSimplified]: '未知应用',
  [OwnerLocale.Arabic]: 'تطبيق غير معروف',
};

export function buildMenuRows(input: { locale: OwnerLocale }): MenuRow[] {
  return MENU_COMMAND_KINDS.map((kind) => {
    const titles = MENU_ROW_TITLES[kind];
    if (titles === undefined) throw invalidInput({ message: `menu: no title for ${kind}` });
    return { id: formatMenuRowId({ kind }), title: titles[input.locale] };
  });
}

export function buildMenuButtonText(input: { locale: OwnerLocale }): string {
  return MENU_BUTTON_TEXT[input.locale];
}

export function renderInstallLines(input: { installLink: string; locale: OwnerLocale }): string {
  return INSTALL_LINES[input.locale].replace(INSTALL_LINK_TOKEN, () => input.installLink);
}
