## claude.ai

1. If you are not claude.ai, the chat in the claude.ai web app, stop and run no other step of this section. Success: you are claude.ai, the chat in the claude.ai web app, or you have stopped.
2. Tell the owner: "Pega esta dirección como conector personalizado en los ajustes de claude.ai: https://x.example/c/zb_conn_FAKE/mcp" Wait for the owner to answer before the next step. Success: the owner's answer is in the chat.
3. Tell the owner: "Crea una tarea con un disparador de API en claude.ai/code/routines, haz clic en Generate token y pega aquí la URL de disparo y el token. El token se muestra una sola vez." Wait for the owner to answer before the next step. Success: the owner's answer is in the chat.
4. If the owner stops here, call `set_wake({mode: "none"})`. Tell the owner: "Sin el disparador, este chat ve los mensajes nuevos solo cuando lo abres." Then go to the last step. Success: set_wake returns without an error, or the owner did not stop here.
5. Otherwise call `set_wake({mode: "webhook", url: <the fire URL>, token: <the token>})`. On an error stop and report the error text. Success: set_wake returns without an error.
6. Tell the owner: "Crea también una tarea cada hora que llame a check_inbox, como red de seguridad." Success: the message is in the chat for the owner.
7. Tell the owner: "El webhook de la rutina despierta a claude.ai en unos 16 segundos; la tarea programada de respaldo se ejecuta como máximo una vez cada 60 minutos, un mínimo de la plataforma." Success: the message is in the chat for the owner.
8. In this chat, call send_message with the text "✅ listo". Success: send_message returns without an error.