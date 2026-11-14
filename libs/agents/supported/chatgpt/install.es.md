## ChatGPT

1. If you are not ChatGPT, the chat in the ChatGPT web app, stop and run no other step of this section. Success: you are ChatGPT, the chat in the ChatGPT web app, or you have stopped.
2. Tell the owner: "Activa el modo desarrollador en los ajustes de ChatGPT y añade una app con la URL https://x.example/c/zb_conn_FAKE/mcp con `No authentication`." Wait for the owner to answer before the next step. Success: the owner's answer is in the chat.
3. Tell the owner: "En un chat dedicado, crea una tarea cada hora con `Run on this computer` que llame a check_inbox, y elige `Always allow` una vez por herramienta." Wait for the owner to answer before the next step. Success: the owner's answer is in the chat.
4. Call `set_wake({mode: "scheduled", interval_minutes: 60})`. Success: set_wake returns without an error.
5. Tell the owner: "ChatGPT se despierta con una tarea programada cada hora: un mensaje puede esperar hasta una hora." Success: the message is in the chat for the owner.
6. In this chat, call send_message with the text "✅ listo". Success: send_message returns without an error.