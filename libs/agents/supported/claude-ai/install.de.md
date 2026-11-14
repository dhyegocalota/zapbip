## claude.ai

1. If you are not claude.ai, the chat in the claude.ai web app, stop and run no other step of this section. Success: you are claude.ai, the chat in the claude.ai web app, or you have stopped.
2. Tell the owner: "Füge diese Adresse in den claude.ai-Einstellungen als benutzerdefinierten Connector ein: https://x.example/c/zb_conn_FAKE/mcp" Wait for the owner to answer before the next step. Success: the owner's answer is in the chat.
3. Tell the owner: "Erstelle unter claude.ai/code/routines eine Aufgabe mit API-Trigger, klicke auf Generate token und füge die Fire-URL und das Token hier ein. Das Token wird nur einmal angezeigt." Wait for the owner to answer before the next step. Success: the owner's answer is in the chat.
4. If the owner stops here, call `set_wake({mode: "none"})`. Tell the owner: "Ohne den Trigger sieht dieser Chat neue Nachrichten nur, wenn du ihn öffnest." Then go to the last step. Success: set_wake returns without an error, or the owner did not stop here.
5. Otherwise call `set_wake({mode: "webhook", url: <the fire URL>, token: <the token>})`. On an error stop and report the error text. Success: set_wake returns without an error.
6. Tell the owner: "Erstelle außerdem eine stündliche Aufgabe, die check_inbox aufruft, als Sicherheitsnetz." Success: the message is in the chat for the owner.
7. Tell the owner: "Der Routine-Webhook weckt claude.ai in etwa 16 Sekunden; die geplante Sicherheitsaufgabe läuft höchstens einmal alle 60 Minuten, ein Minimum der Plattform." Success: the message is in the chat for the owner.
8. In this chat, call send_message with the text "✅ installiert". Success: send_message returns without an error.