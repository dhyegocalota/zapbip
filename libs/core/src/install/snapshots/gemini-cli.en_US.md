## Gemini CLI

1. If you are not Gemini CLI, the agent started by the `gemini` command, stop and run no other step of this section.
2. Tell the owner: "I will add the zapbip MCP server to Gemini CLI. May I?" Wait for the owner to answer before the next step. If the owner does not say yes, stop.
3. Run `gemini mcp list`. If it lists zapbip, run `gemini mcp remove --scope user zapbip` (verify).
4. Run `gemini mcp add --transport http --scope user zapbip https://x.example/c/zb_conn_FAKE/mcp`.
5. In a background terminal run `ZAPBIP_CONNECTION_URL=https://x.example/c/zb_conn_FAKE/mcp npx zapbip@0.1.0 listen`. Watch it with Monitor and re-arm it on each timeout notice (a watch lasts at most 30 minutes).
6. Call `set_wake({mode: "local"})`.
7. Tell the owner: "Restart Gemini CLI to use zapbip."
8. In a fresh process run `gemini -p "Call send_message with the text '✅ installed'"`. On a non-zero exit stop and show the last 20 lines of its output.