# Meta setup

Create the Meta apps, the WhatsApp Business account and numbers, the tokens, the webhook and the approved utility templates for staging and production.

Staging uses a Meta test number and its own app. Production uses the real official number and its own app, so a leaked staging secret never reaches production. Steps 4, 6, 7 and 8 are done once per environment. Never paste a secret into chat, a ticket or the repository. The verify token goes only into the `wrangler secret put` prompt ([deploy.md](deploy.md)); an app secret and an access token go only into the backoffice registration form ([backoffice.md](backoffice.md)), which seals them in the numbers registry. They are not Worker secrets and never go through wrangler.

1. **Check the AI-provider policy.** Open the current WhatsApp Business Solution Terms (`https://www.whatsapp.com/legal/business-solution-terms`) and the WhatsApp Business Messaging Policy (`https://business.whatsapp.com/policy`). Find the clause on AI providers. Secondary sources (TechCrunch, 2025-10-18; respond.io) report that from 2026-01-15 the terms bar general-purpose AI assistants from being distributed on the platform, while business uses such as notifications stay allowed, with reported exceptions for Italy and Brazil; the official text was not read when this was written. Decide in writing, in the go-live record, whether zapbip fits: every conversation is between one verified owner and that owner's own agents, no stranger can message an agent, and no agent is offered to the public. If the text is unclear, ask Meta support through the Business Support Home before registering the production number.

   Expect: a dated decision in the go-live record that cites the clause and its wording today.

   If it fails: if the terms bar the use, stop before step 3. Staging on the Meta test number may continue, but production does not go live until the owner accepts the risk in writing.

2. **Create the Business portfolio.** Open `https://business.facebook.com`, create a Business portfolio for the owner's company or name, and add the owner as admin.

   Expect: Business settings opens with the portfolio.

   If it fails: a personal Facebook account is required to create one; create or recover it first.

3. **Register the production number.** In WhatsApp Manager, Phone numbers, Add phone number, create the WhatsApp Business account and add the number zapbip will use. The number must be able to receive an SMS or a voice call and must not be registered in the WhatsApp or WhatsApp Business app; delete it there first. Enter the code Meta sends. Set the display name and wait for its review. Write the digits, country code first and no plus sign, in the go-live record.

   Then, in WhatsApp Manager, Payment settings, add a payment method: utility templates sent outside the 24-hour window are billed per message and Meta blocks sending without one. Finally open the number, Two-step verification, and set a six-digit PIN; write it in a password manager, because Meta asks for it whenever the number is moved or re-registered.

   Expect: the number shows Connected in WhatsApp Manager, its display name is Approved, a payment method is on file and two-step verification is on.

   If it fails: Meta rejects a card from a country it does not bill; try another card. A number still bound to the consumer app is the usual cause; delete that account in the app, wait, and retry. A rejected display name is edited and resubmitted.

4. **Create the staging app.** Open `https://developers.facebook.com/apps`, Create app, choose the Business type, name it `zapbip staging`, attach the Business portfolio and add the WhatsApp product. Open WhatsApp, API Setup. Meta creates a test WhatsApp Business account and a test number. Add the owner's phone under To, Manage phone number list, and enter the code it receives. Copy the test number's Phone number ID.

   Expect: API Setup shows the test number, its Phone number ID and the owner's phone as a recipient.

   If it fails: if the WhatsApp product is missing, Add product from the app dashboard; if the recipient code does not arrive, check that WhatsApp is installed on that phone.

5. **Create the production app.** Create a second app named `zapbip production` the same way. In WhatsApp, API Setup, select the production WhatsApp Business account and the production number from step 3. Copy that number's Phone number ID.

   Expect: API Setup lists the production number and its Phone number ID.

   If it fails: the app and the number must sit under the same Business portfolio; connect the app to the portfolio in App settings, Advanced.

6. **Copy each app secret.** In each app open App settings, Basic, App secret, Show, and keep the value for the backoffice registration form of that app ([backoffice.md](backoffice.md), step 2).

   Expect: a 32-character hexadecimal string per app.

   If it fails: Meta asks for the account password; enter it. If the secret was exposed, use Reset and replace the app secret in the backoffice ([backoffice.md](backoffice.md), step 5).

7. **Create the system user and the permanent token.** In Business settings, Users, System users, Add, name it `zapbip-staging` (then `zapbip-production`) with the Admin role. Add assets: the matching app with full control and the matching WhatsApp account with full control. Choose Generate token, select the matching app, set the expiry to Never and tick `whatsapp_business_messaging` and `whatsapp_business_management`. Keep the token for the backoffice registration form of that number ([backoffice.md](backoffice.md), step 2).

   Expect: a long token string that starts with `EAA`, shown once.

   If it fails: if the permissions are missing from the list, the app lacks the WhatsApp product or the asset assignment; fix those first. A lost token is replaced by generating a new one and replacing it in the backoffice ([backoffice.md](backoffice.md), step 5).

8. **Generate the verify token.** Run `openssl rand -hex 24` once per environment. Keep the value for `WHATSAPP_VERIFY_TOKEN` of that environment and for step 9.

   Expect: 48 hexadecimal characters.

   If it fails: install OpenSSL, or use any password manager to generate 48 hexadecimal characters.

9. **Subscribe the webhook.** Do this only after the Worker of that environment is deployed and the number is registered and active ([deploy.md](deploy.md), step 5; [backoffice.md](backoffice.md), steps 2 to 4). The callback URL is the same for every app and every number of the environment, and the verify token is the one shared token of step 8: do not generate one per app. In each app open WhatsApp, Configuration, Edit the callback URL: `https://mcp-staging.zapbip.com/webhooks/whatsapp` for staging, `https://mcp.zapbip.com/webhooks/whatsapp` for production, and the verify token of step 8. Choose Verify and save. Then Manage webhook fields and subscribe `messages` and `message_template_status_update`.

   Expect: Meta accepts the callback and shows both fields subscribed. Sending `novo agente smoke` from the owner's phone later reaches the Worker.

   If it fails: a rejection means the Worker answered with something other than the challenge. Check that the `WHATSAPP_VERIFY_TOKEN` secret of the Worker equals the token typed in Meta (`pnpm --filter @zapbip/api exec wrangler secret list --env staging` shows the name) and that `pnpm smoke:staging` passes its webhook verify check. Set the secret again if they differ.

10. **Go live and verify the business.** For the production app, fill App settings, Basic with a privacy policy URL and a category, then switch the app mode to Live. In Business settings, Security centre, start Business verification and upload the documents Meta asks for. Request Advanced Access for a permission only if the dashboard states it is needed for the number you use.

    Expect: the production app shows Live, and the verification shows In review or Verified. Unverified businesses have low messaging limits, which are enough to start with one owner.

    If it fails: the privacy policy page must be public. The privacy page is part of the docs site: use `https://docs.zapbip.com/help/privacy` (English) or `https://docs.zapbip.com/pt-BR/help/privacy`, and open it in a browser before pasting it, which needs [mintlify-publish.md](mintlify-publish.md) done first. A rejected verification lists what to correct.

11. **Submit and approve the templates.** In WhatsApp Manager, Message templates, Create template, once per row below in the production WhatsApp account (the staging test account too if you want templates in staging). Category Utility. The name is identical across languages; each language is its own template. Fill the sample values with the fictional text shown, add one Quick reply button and submit.

    | Name | Language | Body, exactly | Samples | Quick reply |
    |---|---|---|---|---|
    | `zapbip_agent_notice` | `pt_BR` | `Mensagem de {{1}}: {{2}} — toque em Abrir para ler.` | `Agente de teste`, `Mensagem de exemplo` | `Abrir` |
    | `zapbip_agent_notice` | `en_US` | `Message from {{1}}: {{2}} — tap Open to read it.` | `Test agent`, `Example message` | `Open` |
    | `zapbip_agent_question` | `pt_BR` | `Pergunta de {{1}}: {{2}} — toque em Responder para ver as opções.` | `Agente de teste`, `Pergunta de exemplo` | `Responder` |
    | `zapbip_agent_question` | `en_US` | `Question from {{1}}: {{2}} — tap Reply to see the options.` | `Test agent`, `Example question` | `Reply` |

    Expect: all four templates change from In review to Approved, usually within minutes to a day, with the category Utility.

    If it fails: if Meta recategorises one as Marketing, edit it to remove promotional wording or appeal in WhatsApp Manager; a Marketing template costs more and is not what the Worker sends. A template that stays rejected blocks production, because outside the 24-hour window zapbip can only reach the owner through these templates.
