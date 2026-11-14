## ChatGPT

1. If you are not ChatGPT, the chat in the ChatGPT web app, stop and run no other step of this section. Success: you are ChatGPT, the chat in the ChatGPT web app, or you have stopped.
2. Tell the owner: "Activez le mode développeur dans les réglages de ChatGPT et ajoutez une app avec l’URL https://x.example/c/zb_conn_FAKE/mcp avec `No authentication`." Wait for the owner to answer before the next step. Success: the owner's answer is in the chat.
3. Tell the owner: "Dans une conversation dédiée, créez une tâche horaire avec `Run on this computer` qui appelle check_inbox, et choisissez `Always allow` une fois par outil." Wait for the owner to answer before the next step. Success: the owner's answer is in the chat.
4. Call `set_wake({mode: "scheduled", interval_minutes: 60})`. Success: set_wake returns without an error.
5. Tell the owner: "ChatGPT est réveillé toutes les heures par une tâche planifiée : un message peut attendre jusqu’à une heure." Success: the message is in the chat for the owner.
6. In this chat, call send_message with the text "✅ installé". Success: send_message returns without an error.