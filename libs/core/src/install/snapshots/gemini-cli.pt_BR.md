## Gemini CLI

1. If you are not Gemini CLI, the agent started by the `gemini` command, stop and run no other step of this section.
2. Tell the owner: "Vou adicionar o servidor MCP zapbip ao Gemini CLI. Posso?" Wait for the owner to answer before the next step. If the owner does not say yes, stop.
3. Run `gemini mcp list`. If it lists zapbip, run `gemini mcp remove --scope user zapbip`.
4. Run `gemini mcp add --transport http --scope user zapbip https://x.example/c/zb_conn_FAKE/mcp`.
5. In a background terminal run `ZAPBIP_CONNECTION_URL=https://x.example/c/zb_conn_FAKE/mcp npx zapbip@0.1.0 listen` and keep that terminal running, with no time limit. Whenever a new line appears there, call check_inbox and answer.
6. Tell the owner: "Reinicie o Gemini CLI para usar o zapbip."
7. Tell the owner: "O Gemini CLI escuta pelo terminal em segundo plano e responde em segundos enquanto ele estiver rodando, sem limite de tempo."
8. In a fresh process run `gemini --yolo -p "Call send_message with the text '✅ instalado'"`. On a non-zero exit stop and show the last 20 lines of its output.