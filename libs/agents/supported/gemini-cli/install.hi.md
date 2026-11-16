## Gemini CLI

1. If you are not Gemini CLI, the agent started by the `gemini` command, stop and run no other step of this section. Success: you are Gemini CLI, the agent started by the `gemini` command, or you have stopped.
2. Tell the owner: "zapbip का MCP सर्वर Gemini CLI में जोड़ना है। क्या मैं आगे बढ़ूँ?" Wait for the owner to answer before the next step. If the owner does not say yes, stop. Success: the owner said yes in the chat.
3. Run `gemini mcp list`. If it lists zapbip, run `gemini mcp remove --scope user zapbip`. Success: `gemini mcp list` no longer lists zapbip.
4. Run `gemini mcp add --transport http --scope user zapbip https://x.example/c/zb_conn_FAKE/mcp`. Success: `gemini mcp list` shows zapbip.
5. In a background terminal run `ZAPBIP_CONNECTION_URL=https://x.example/c/zb_conn_FAKE/mcp npx zapbip@0.2.0 listen` and keep that terminal running, with no time limit. Whenever a new line appears there, call check_inbox and answer. Success: the background terminal is running and prints no error.
6. Tell the owner: "zapbip इस्तेमाल करने के लिए Gemini CLI को फिर से शुरू करें।" Success: the message is in the chat for the owner.
7. Tell the owner: "Gemini CLI बैकग्राउंड टर्मिनल के ज़रिए सुनता है और उसके चलते रहने तक कुछ ही सेकंड में जवाब देता है, बिना किसी समय-सीमा के।" Success: the message is in the chat for the owner.
8. In a fresh process run `gemini -p "Call send_message with the text '✅ इंस्टॉल हो गया'"`. On a non-zero exit stop and show the last 20 lines of its output. Success: the command exits with zero.