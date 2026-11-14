## ChatGPT

1. If you are not ChatGPT, the chat in the ChatGPT web app, stop and run no other step of this section. Success: you are ChatGPT, the chat in the ChatGPT web app, or you have stopped.
2. Tell the owner: "Aktiviere den Entwicklermodus in den ChatGPT-Einstellungen und füge eine App mit der URL https://x.example/c/zb_conn_FAKE/mcp hinzu, mit `No authentication`." Wait for the owner to answer before the next step. Success: the owner's answer is in the chat.
3. Tell the owner: "Erstelle in einem eigenen Chat eine stündliche Aufgabe mit `Run on this computer`, die check_inbox aufruft, und wähle `Always allow` einmal pro Werkzeug." Wait for the owner to answer before the next step. Success: the owner's answer is in the chat.
4. Call `set_wake({mode: "scheduled", interval_minutes: 60})`. Success: set_wake returns without an error.
5. Tell the owner: "ChatGPT wird jede Stunde von einer geplanten Aufgabe geweckt: Eine Nachricht kann bis zu einer Stunde warten." Success: the message is in the chat for the owner.
6. In this chat, call send_message with the text "✅ installiert". Success: send_message returns without an error.