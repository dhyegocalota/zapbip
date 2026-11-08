## Grok web

1. If you are not Grok web, the chat in the Grok web app, stop and run no other step of this section. Success: you are Grok web, the chat in the Grok web app, or you have stopped.
2. Tell the owner: "Cole este endereço como conector nas configurações do Grok: https://x.example/c/zb_conn_FAKE/mcp" Wait for the owner to answer before the next step. Success: the owner's answer is in the chat.
3. Call `set_wake({mode: "none"})`. Success: set_wake returns without an error.
4. Tell the owner: "Sem um agente de prontidão, o Grok na web só vê mensagens novas quando você abre o chat dele." Success: the message is in the chat for the owner.
5. In this chat, call send_message with the text "✅ instalado". Success: send_message returns without an error.