## ChatGPT

1. If you are not ChatGPT, the chat in the ChatGPT web app, stop and run no other step of this section. Success: you are ChatGPT, the chat in the ChatGPT web app, or you have stopped.
2. Tell the owner: "Ative o developer mode nas configurações do ChatGPT e adicione um app pela URL https://x.example/c/zb_conn_FAKE/mcp com `No authentication`." Wait for the owner to answer before the next step. Success: the owner's answer is in the chat.
3. Tell the owner: "Em um chat só para isso, crie uma tarefa por hora com Executar neste computador (`Run on this computer`) que chama check_inbox, e escolha Sempre permitir (`Always allow`) uma vez por ferramenta." Wait for the owner to answer before the next step. Success: the owner's answer is in the chat.
4. Call `set_wake({mode: "scheduled", interval_minutes: 60})`. Success: set_wake returns without an error.
5. Tell the owner: "O ChatGPT é acordado por uma tarefa agendada a cada hora: uma mensagem pode esperar até uma hora." Success: the message is in the chat for the owner.
6. In this chat, call send_message with the text "✅ instalado". Success: send_message returns without an error.