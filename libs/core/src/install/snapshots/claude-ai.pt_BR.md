## claude.ai

1. If you are not claude.ai, the chat in the claude.ai web app, stop and run no other step of this section.
2. Tell the owner: "Cole este endereço como conector personalizado nas configurações do claude.ai: https://x.example/c/zb_conn_FAKE/mcp" Wait for the owner to answer before the next step.
3. Tell the owner: "Crie uma tarefa com gatilho de API em claude.ai/code/routines, clique em Generate token e cole aqui a fire URL and token. O token aparece uma vez." Wait for the owner to answer before the next step.
4. If the owner stops here, call `set_wake({mode: "none"})`. Tell the owner: "Sem o gatilho, este chat só vê mensagens novas quando você o abrir." Then go to the last step.
5. Otherwise call `set_wake({mode: "webhook", url: <the fire URL>, token: <the token>})`. On an error stop and report the error text.
6. Tell the owner: "Crie também uma tarefa por hora que chama check_inbox, como rede de segurança."
7. In this chat, call send_message with the text "✅ instalado".