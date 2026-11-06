## ChatGPT

1. If you are not ChatGPT, the chat in the ChatGPT web app, stop and run no other step of this section.
2. Tell the owner: "Ative o developer mode nas configurações do ChatGPT e adicione um app pela URL https://x.example/c/zb_conn_FAKE/mcp com "No authentication"." Wait for the owner to answer before the next step.
3. Tell the owner: "Em um chat só para isso, crie uma tarefa por hora com "Run on this computer" que chama check_inbox, e escolha "Always allow" uma vez por ferramenta." Wait for the owner to answer before the next step.
4. Call `set_wake({mode: "scheduled", interval_minutes: 60})`.
5. In this chat, call send_message with the text "✅ instalado".