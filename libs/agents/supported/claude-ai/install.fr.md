## claude.ai

1. If you are not claude.ai, the chat in the claude.ai web app, stop and run no other step of this section. Success: you are claude.ai, the chat in the claude.ai web app, or you have stopped.
2. Tell the owner: "Collez cette adresse comme connecteur personnalisé dans les réglages de claude.ai : https://x.example/c/zb_conn_FAKE/mcp" Wait for the owner to answer before the next step. Success: the owner's answer is in the chat.
3. Tell the owner: "Créez une tâche avec un déclencheur API sur claude.ai/code/routines, cliquez sur Generate token et collez ici l’URL de déclenchement et le jeton. Le jeton n’est affiché qu’une fois." Wait for the owner to answer before the next step. Success: the owner's answer is in the chat.
4. If the owner stops here, call `set_wake({mode: "none"})`. Tell the owner: "Sans le déclencheur, cette conversation ne voit les nouveaux messages que lorsque vous l’ouvrez." Then go to the last step. Success: set_wake returns without an error, or the owner did not stop here.
5. Otherwise call `set_wake({mode: "webhook", url: <the fire URL>, token: <the token>})`. On an error stop and report the error text. Success: set_wake returns without an error.
6. Tell the owner: "Créez aussi une tâche horaire qui appelle check_inbox, comme filet de sécurité." Success: the message is in the chat for the owner.
7. Tell the owner: "Le webhook de la routine réveille claude.ai en environ 16 secondes ; la tâche planifiée de secours s’exécute au plus une fois toutes les 60 minutes, un minimum de la plateforme." Success: the message is in the chat for the owner.
8. In this chat, call send_message with the text "✅ installé". Success: send_message returns without an error.