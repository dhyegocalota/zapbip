# Meta setup

Prepare the one zapbip Meta app, its Embedded Signup configuration and its webhook, choose the numbers, set the app secret, then go live and approve the utility templates.

zapbip has one Meta app, `714836811568009`, for staging and production ([ADR 0036](../adr/0036-one-fixed-meta-app-and-numbers-join-through-embedded-signup.md)). Its ID, its label and the Embedded Signup configuration ID are constants in `libs/types/src/constants.ts`; none of them is secret. The app secret is the Worker secret `META_APP_SECRET` of each environment, and the same value goes to both. Numbers are not typed anywhere: the backoffice connects each one through Meta's own onboarding ([backoffice.md](backoffice.md), step 2). The business token that onboarding returns is sealed in the numbers registry and never shown. Never paste a secret into chat, a ticket or the repository. The app secret and the verify token go only into the `wrangler secret put` prompt ([deploy.md](deploy.md), step 3), and the two-step PIN only into the backoffice connect page.

1. **Check the AI-provider policy.** Open the current WhatsApp Business Solution Terms (`https://www.whatsapp.com/legal/business-solution-terms`) and the WhatsApp Business Messaging Policy (`https://business.whatsapp.com/policy`). Find the clause on AI providers. Secondary sources (TechCrunch, 2025-10-18; respond.io) report that from 2026-01-15 the terms bar general-purpose AI assistants from being distributed on the platform, while business uses such as notifications stay allowed, with reported exceptions for Italy and Brazil; the official text was not read when this was written. Decide in writing, in the go-live record, whether zapbip fits: every conversation is between one verified owner and that owner's own agents, no stranger can message an agent, and no agent is offered to the public. If the text is unclear, ask Meta support through the Business Support Home before connecting the production number.

   Expect: a dated decision in the go-live record that cites the clause and its wording today.

   If it fails: if the terms bar the use, stop before step 5. Staging may continue, but production does not go live until the owner accepts the risk in writing.

2. **Create the Business portfolio.** Open `https://business.facebook.com`, create a Business portfolio for the owner's company or name, and add the owner as admin.

   Expect: Business settings opens with the portfolio.

   If it fails: a personal Facebook account is required to create one; create or recover it first.

3. **Prepare the zapbip app.** Open `https://developers.facebook.com/apps/714836811568009`. The app is of the Business type, attached to the Business portfolio of step 2, with the WhatsApp and Facebook Login for Business products. In App settings, Basic, add `backoffice.zapbip.com` and `backoffice-staging.zapbip.com` to App domains. In Facebook Login for Business, Settings, turn on Login with the JavaScript SDK and add `https://backoffice.zapbip.com/` and `https://backoffice-staging.zapbip.com/` to Allowed domains for the JavaScript SDK.

   Expect: both products are listed on the app dashboard and both backoffice hosts are saved as allowed domains.

   If it fails: a product missing from the dashboard is added with Add product. An allowed domain that does not save needs the matching App domain first. The Connect popup of the backoffice says the domain is not allowed when a host is missing here.

4. **Check the Embedded Signup configuration.** In Facebook Login for Business, Configurations, open the configuration made from the WhatsApp Embedded Signup template (or create one: Create configuration, the WhatsApp Embedded Signup template, token expiration Never, assets WhatsApp accounts, permissions `whatsapp_business_management` and `whatsapp_business_messaging`). Its ID is `META_LOGIN_CONFIGURATION_ID` in `libs/types/src/constants.ts`. It is not a secret, so a new ID reaches the repository by an ordinary pull request.

   Expect: the configuration lists the permissions the shipped configuration `946808808378298` grants (`business_management`, `whatsapp_business_manage_events`, `whatsapp_business_management` and `whatsapp_business_messaging`), token expiration Never, and its ID equals the constant. A dedicated configuration with only the two WhatsApp permissions (`whatsapp_business_management` and `whatsapp_business_messaging`) is the least-privilege follow-up; swapping it in is a change to the one constant `META_LOGIN_CONFIGURATION_ID`.

   If it fails: a configuration with a token that expires in 60 days works until the token dies; create a new one with Never and change the constant. An ID that differs from the constant makes the popup open the wrong configuration or none.

5. **Choose the numbers.** Pick one number for staging and one for production. Each must be able to receive an SMS or a voice call and must not be registered in the WhatsApp or WhatsApp Business app; delete it there first. Meta's test number from API Setup cannot be connected through Embedded Signup, so staging needs a real number too. For each number choose a six-digit two-step PIN and keep it in a password manager: the backoffice connect page asks for it, a new number takes it as its PIN, and a number that already has two-step verification needs the PIN it has. Write the digits of each number, country code first and no plus sign, in the go-live record.

   Expect: two numbers that can receive a code, with a PIN for each in the password manager.

   If it fails: a number still bound to the consumer app is the usual cause of a refusal later; delete that account in the app, wait, and retry.

6. **Copy the app secret.** In the app open App settings, Basic, App secret, Show, and keep the value for the `META_APP_SECRET` prompt of both environments ([deploy.md](deploy.md), step 3).

   Expect: a 32-character hexadecimal string.

   If it fails: Meta asks for the account password; enter it. If the secret was exposed, use Reset, then set `META_APP_SECRET` again in both environments: webhooks answer `401` until you do.

7. **Generate the verify token.** Run `openssl rand -hex 24` once per environment. Keep the value for `WHATSAPP_VERIFY_TOKEN` of that environment.

   Expect: 48 hexadecimal characters.

   If it fails: install OpenSSL, or use any password manager to generate 48 hexadecimal characters.

8. **Subscribe the app webhook.** Do this only after the Worker of the environment you bring up first is deployed ([deploy.md](deploy.md), step 5): the handshake needs only the deployed Worker and its `WHATSAPP_VERIFY_TOKEN`. In the app open WhatsApp, Configuration, Edit the callback URL and type `https://mcp-staging.zapbip.com/webhooks/whatsapp` with the staging verify token while only staging runs, then change it to `https://mcp.zapbip.com/webhooks/whatsapp` with the production verify token at the production go-live. Choose Verify and save. Then Manage webhook fields and subscribe `messages`. The app has one callback URL, so every number the backoffice connects gets its own override, set by the backoffice to the environment it was connected from: staging numbers stay on staging after the switch. The WABA itself is subscribed without an override, so a production number that shares a WABA with a staging number keeps its deliveries; connecting a number whose override already points to another environment is refused.

   Expect: Meta accepts the callback and shows `messages` subscribed. Sending `novo agente smoke` from the owner's phone later reaches the Worker of the number's environment.

   If it fails: a rejection means the Worker answered with something other than the challenge. Check that the `WHATSAPP_VERIFY_TOKEN` secret of the Worker equals the token typed in Meta (`pnpm --filter @zapbip/api exec wrangler secret list --env staging` shows the name) and that `pnpm smoke:staging` passes its webhook verify check. Set the secret again if they differ.

9. **Add a payment method.** After a number is connected ([backoffice.md](backoffice.md), step 2), open WhatsApp Manager for its WhatsApp Business account, Overview, Add payment method. Utility templates sent outside the 24-hour window are billed per message and Meta blocks sending without one. Check the display name review of the number in Phone numbers.

   Expect: a payment method on file and the display name Approved.

   If it fails: Meta rejects a card from a country it does not bill; try another card. A rejected display name is edited and resubmitted.

10. **Go live and verify the business.** In the app fill App settings, Basic with a privacy policy URL and a category, then switch the app mode to Live. In Business settings, Security centre, start Business verification and upload the documents Meta asks for. Connecting numbers of the owner's own Business portfolio needs no Advanced Access; request it for a permission only if the dashboard states it is needed for the number you use.

    Expect: the app shows Live, and the verification shows In review or Verified. Unverified businesses have low messaging limits, which are enough to start with one owner.

    If it fails: the privacy policy page must be public. The privacy page is part of the docs site: use `https://docs.zapbip.com/help/privacy` (English) or `https://docs.zapbip.com/pt-BR/help/privacy`, and open it in a browser before pasting it, which needs [mintlify-publish.md](mintlify-publish.md) done first. A rejected verification lists what to correct.

11. **Submit and approve the templates.** In WhatsApp Manager, Message templates, Create template, once per row below in the WhatsApp Business account of each environment's number. To have them approved before the production number is connected, create the production WhatsApp Business account in WhatsApp Manager first and pick it in the Connect popup later. Category Utility. The name is identical across languages; each language is its own template. Fill the sample values with the fictional text shown, add one Quick reply button and submit.

    | Name | Language | Body, exactly | Samples | Quick reply |
    |---|---|---|---|---|
    | `zapbip_agent_notice` | `pt_BR` | `Mensagem de {{1}}: {{2}} — toque em Abrir para ler.` | `Agente de teste`, `Mensagem de exemplo` | `Abrir` |
    | `zapbip_agent_notice` | `en_US` | `Message from {{1}}: {{2}} — tap Open to read it.` | `Test agent`, `Example message` | `Open` |
    | `zapbip_agent_question` | `pt_BR` | `Pergunta de {{1}}: {{2}} — toque em Responder para ver as opções.` | `Agente de teste`, `Pergunta de exemplo` | `Responder` |
    | `zapbip_agent_question` | `en_US` | `Question from {{1}}: {{2}} — tap Reply to see the options.` | `Test agent`, `Example question` | `Reply` |

    Expect: all four templates change from In review to Approved, usually within minutes to a day, with the category Utility.

    If it fails: if Meta recategorises one as Marketing, edit it to remove promotional wording or appeal in WhatsApp Manager; a Marketing template costs more and is not what the Worker sends. A template that stays rejected blocks production, because outside the 24-hour window zapbip can only reach the owner through these templates.
