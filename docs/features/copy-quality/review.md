# Review: Copy quality

Two passes. The first removed the tap and click gesture ("you tap", "your tap"); the second read every owner-facing string of the site, the client app, the install prompts, the WhatsApp copy and the legal wording as a native product writer would. Every confirmed trap is in `apps/api/test/unit/copy-literal-translation-traps.test.ts`.

## Rules applied

- Say what the person does ("you reply"), not the gesture. Keep instructions that name a real button ("tap Open").
- One address per language: tú, du, vous, あなた (omitted where natural), 내/당신 in Korean, 你. In story voice the person is "you", never "owner", "dueño", "Besitzer", "主人", "オーナー", "주인".
- "Client" became "app" wherever it names the software the person uses (a client is a customer in pt-BR, es, fr). The protocol term "MCP client" stays in the reference docs.
- Demo button labels are localized in the demo text and the image alt text (es Adelante/Espera, de Ausrollen/Warten, fr Déployer/Attendre, ja デプロイ/待つ, ko 배포/대기, zh 部署/等一等).
- "Streamable HTTP" is the name of the transport; it is no longer translated.
- "Access opens" became "access is activated" (de freigeschaltet, fr activé, ko 이용할 수 있게 되면, es esté activo).
- "Set up zapbip for yourself" became "Connect to zapbip" (the person does not set up the product for themselves).
- "Join the PR" and the like: developers say merge (es hacer merge, fr merger, de mergen, pt fazer merge).

## pt-BR (the lead reviewed the rest)

| Before | After |
| --- | --- |
| Só o toque em um botão vale | Só a resposta por botão vale |
| Toque num botão ou escreva | Responda pelo botão ou escreva |
| o dono responde Publicar | Você escolhe Publicar |
| Junto o PR #42 na main? / Juntar | Faço o merge do PR #42 na main? / Fazer merge |
| Configure o zapbip para você mesmo | Conecte-se ao zapbip |
| Escrevemos para você assim que seu acesso abrir | Avisamos você assim que seu acesso for liberado |
| o agente que ela responde | o agente que fez a pergunta |
| passo 2: o servidor MCP do seu cliente | passo 2: o servidor MCP no seu app |
| O agente olha a caixa … próxima olhada | O agente confere o inbox … próxima checagem |
| ainda não é suportado | ainda não tem suporte |

## es

| Before | After |
| --- | --- |
| Tú tocas / El agente pregunta. Tú tocas. | Tú respondes / El agente pregunta. Tú respondes. |
| esperan tu toque | esperan tu respuesta |
| El dueño responde Ship it | Tú eliges Adelante |
| ¿Fusiono la PR #42 en main? / Fusionar | ¿Hago merge del PR #42 en main? / Hacer merge |
| Configura zapbip por tu cuenta | Conéctate a zapbip |
| Toca un botón o escribe | Responde con un botón o escribe |
| servidor MCP de tu cliente | servidor MCP en tu app |
| nada puede hacer que bloqueen tu WhatsApp | tu WhatsApp no corre riesgo de que lo bloqueen |
| El registro está en pausa | Las solicitudes están en pausa |
| HTTP en streaming | Streamable HTTP |
| Agentes: usen las herramientas MCP (ustedes among tú) | Agentes: usa las herramientas MCP |
| cliente desconocido | app desconocida |

## de

| Before | After |
| --- | --- |
| Du tippst | Du antwortest |
| wartest auf deinen Tipp / Mit einem Antippen antworten | wartest auf deine Antwort / Per Button antworten |
| Der Besitzer antwortet mit Ship it | Du wählst Ausrollen |
| Richte zapbip für dich selbst ein | Verbinde dich mit zapbip |
| Mach mit meinem Link mit | Komm über meinen Link dazu |
| sobald dein Zugang öffnet | sobald dein Zugang freigeschaltet ist |
| Der Zugang öffnet in Wellen | Der Zugang wird in Wellen freigeschaltet |
| also kann dein WhatsApp nicht gesperrt werden | Dein WhatsApp riskiert keine Sperre |
| Die Anmeldung ist kurz pausiert | Anfragen sind kurz pausiert |
| MCP-Server für deinen Client | MCP-Server in deiner App |
| Agenten: Nutzt die MCP-Tools (ihr among du) | Agenten: Nutze die MCP-Tools |
| Der Besitzer (docs) | der Owner, as in the other docs |
| Er spricht nur mit dir | zapbip spricht nur mit dir |

## fr

| Before | After |
| --- | --- |
| Vous appuyez | Vous répondez |
| votre appui / d'un toucher | votre réponse / par bouton |
| Le propriétaire répond Ship it | Vous choisissez Déployer |
| Configurez zapbip par vous-même | Connectez-vous à zapbip |
| dès que votre accès ouvrira | dès que votre accès sera activé |
| L'accès ouvre par vagues | L'accès est activé par vagues |
| Fusionner la PR #42 | Merger la PR #42 |
| Appuyez sur un bouton ou tapez | Répondez avec un bouton ou écrivez |
| serveur MCP de votre client | serveur MCP dans votre appli |
| pour sa personne | pour la personne pour qui il travaille |
| Aucune carte requise | Aucune carte bancaire requise |
| HTTP streamable | Streamable HTTP |

## ja

| Before | After |
| --- | --- |
| あなたがタップ / あなたはタップ | あなたが返信 |
| あなたのタップを待って | あなたの返信を待って |
| ワンタップで | ボタン1つで |
| オーナーがShip itをタップ | あなたが「デプロイ」を選ぶ |
| zapbipを自分でセットアップする | zapbipに接続する |
| ほかにする操作はありません | ほかに必要な操作はありません |
| 課金は招待の開始と同時に始まります | 課金はアクセスの開放後に始まります |
| zapbipとのWhatsAppが開く | zapbipとのトークが開く |
| そのメッセージを貼り付けてもらって | そのメッセージをあなたに転送してもらって |
| お使いのクライアント | お使いのアプリ |
| ストリーミング対応HTTP | Streamable HTTP |
| カードの登録は不要 | クレジットカードの登録は不要 |

## ko

| Before | After |
| --- | --- |
| 내가 탭 / 나는 탭합니다 | 내가 답 / 나는 답합니다 |
| 내 탭을 기다립니다 | 내 답을 기다립니다 |
| 한 번 탭하면 | 버튼 하나로 |
| 주인이 Ship it을 고르면 | 내가 ‘배포’를 고르면 |
| zapbip를 직접 설정하세요 | zapbip에 연결하세요 |
| 자리표시자를 바꾼 | 당신의 이름을 넣은 |
| 이용이 열리면 | 이용할 수 있게 되면 |
| 결제는 초대와 함께 열립니다 | 결제는 이용할 수 있게 될 때부터 시작됩니다 |
| 자신의 사용자를 위해 | 함께 일하는 사람을 위해 |
| 사용 중인 클라이언트 | 사용 중인 앱 |
| 스트리머블 HTTP | Streamable HTTP |
| 카드는 필요 없습니다 | 카드 등록은 필요 없습니다 |

## zh-CN

| Before | After |
| --- | --- |
| 你来点选 | 你来回复 |
| 等你点一下 / 点按作答 | 等你回复 / 按钮回复 |
| 主人选了 Ship it | 你选“部署” |
| 自己设置 zapbip | 连接 zapbip |
| 请他 / 告诉他 (gendered, and "他" for any person) | 请对方 / 告诉对方 |
| 报名暂时暂停 | 申请暂时暂停了 |
| 为你的客户端添加 MCP 服务器 | 为你的应用添加 MCP 服务器 |
| 开始邀请时才会开通计费 | 使用资格开放后才开始计费 |
| 替它的主人申请 | 替它所服务的人申请 |
| 回到所回应的智能体 | 回到提问的智能体 |
| 可流式传输的 HTTP | Streamable HTTP |
| 客户端 (client app label) | 应用 |

## Kept on purpose

Instructions that tell the person to press a real button on a real screen: "tap Open" in the templates, "Tippe auf einen Button", "ボタンをタップ", "버튼을 탭", "点按使用 WhatsApp 登录". The pt, es and fr docs say "choose" for the same sign-in step. Keyboard keys ("Ctrl+C") are untouched. The pt-BR site line "Você responde com um toque" is the owner's own example of the right form and has a test. The reference docs in third person keep their owner noun (pt dono, es propietario, de Owner, fr propriétaire, ja オーナー, ko 소유자, zh 所有者); the story voice of the site and the replies never uses it.

## Unsure

- Korean mixes the 합니다 and 해요 registers on the site; a full conversion to one register is a rewrite of about 150 strings and needs a native reader.
- Korean "폐기" for revoke and Japanese "無効にする" are accepted, not ideal.
- pt-BR command word "girar" (rotate a link) is a calque; it is a command word with tests and users, so I did not change it.
- Spanish uses "ordenador" and "móvil" (Spain) throughout; a Latin American variant would say "computadora" and "celular".
- The Meta templates in the six newer languages are still the English ones until approved; their wording is for the owner to confirm at submission.
- Demo videos and Open Graph images may still show the English button labels "Ship it" and "Wait"; lane L11 owns them, and the image alt texts now name the localized labels.

## Second review (copy-review-complete)

Registers decided by the orchestrator and applied everywhere a person is addressed: Korean 해요체 (합니다체 only in the legal pages and the operator backoffice), neutral Latin American Spanish with tú, German du, French vous, Japanese です/ます, Chinese 你 (never 您). `copy-literal-translation-traps.test.ts` bans each register's giveaways: Korean 합니다 forms outside legal and backoffice copy, Spanish ordenador, móvil, pulsas, vosotros, vuestro, Chinese 您.

| Language | Before | After |
| --- | --- | --- |
| pt-BR | rotate command `girar` (and "Girar link") | `renovar`, with tests, docs and install prompts moved; the English `rotate` still works |
| pt-BR | ainda não é suportado | ainda não tem suporte |
| es | el ordenador, tu móvil | la computadora, tu celular |
| es | cuando pulsas Ctrl+C | cuando presionas Ctrl+C |
| es | Al apuntarte / que se apunte | Al registrarte / que se registre |
| es | te avisaremos cuando se abra | te avisaremos cuando tu acceso esté activo |
| de | sobald er öffnet | sobald er freigeschaltet ist |
| de | Dieser Link funktioniert einmal und 30 Minuten lang | Dieser Link ist 30 Minuten gültig und nur einmal nutzbar |
| de | Verbinde dich mit zapbip mit meinem WhatsApp | Verbinde dich über zapbip mit meinem WhatsApp |
| de | Der Besitzer (docs) | der Owner, as in the rest of the docs |
| fr | Connecte-toi à mon WhatsApp … lis … suis | Connectez-vous à mon WhatsApp … lisez … suivez |
| fr | Envoie ✅ installé quand tu es installé | Envoyez ✅ installé quand vous avez terminé |
| fr | à l’ouverture / Votre accès est ouvert | dès que votre accès sera activé / Votre accès est activé |
| fr | Ce lien fonctionne une seule fois pendant 30 minutes | Ce lien est valable 30 minutes et ne fonctionne qu’une fois |
| ja | あなたはすでにWhatsAppで暮らしています | あなたはいつもWhatsAppを使っています |
| ja | アクセスが開放されたら / アクセスが開いたら | 利用できるようになったら |
| ja | メッセージを押し込み | メッセージを届け |
| ko | 합니다, 입니다, 습니다 across the site, app, WhatsApp copy, docs and install prompts (about 1,000 lines) | 해요, 이에요/예요, 어요 |
| ko | 이용이 열리면 / 이용이 열렸어요 | 이용할 수 있게 되면 / 이제 이용할 수 있어요 |
| zh | no change needed in the WhatsApp copy, docs index, FAQ and command pages | read in full; clean |

The Korean conversion was rule-based (stem and vowel contraction, copula by final consonant) and read through for irregular verbs (ㅂ, ㄷ, ㅅ, 르) in the list of distinct conversions; code spans and Latin words before 입니다 were fixed by hand.

### Unsure

- The legal pages were checked for register and for the one sentence changed in the first pass; the Spanish one now says "registrarte". No legal substance moved.
- Docs pages beyond the home, FAQ, commands and how-to-start of each language were scanned for owner, client, gesture and register words, not read line by line.
- Korean backoffice copy stays in 합니다체: it addresses the operator, not the owner.
