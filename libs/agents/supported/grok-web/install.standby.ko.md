## Grok web

1. If you are not Grok web, the chat in the Grok web app, stop and run no other step of this section. Success: you are Grok web, the chat in the Grok web app, or you have stopped.
2. Tell the owner: "Grok 설정에서 이 주소를 커넥터로 붙여넣으세요: https://x.example/c/zb_conn_FAKE/mcp" Wait for the owner to answer before the next step. Success: the owner's answer is in the chat.
3. Call `set_wake({mode: "standby", standby_agent: "Ana Bot"})`. Success: set_wake returns without an error.
4. Tell the owner: "웹의 Grok은 외부에서 깨울 수 없습니다. 선택한 대기 에이전트가 몇 초 안에 대신 답합니다." Success: the message is in the chat for the owner.
5. In this chat, call send_message with the text "✅ 설치 완료". Success: send_message returns without an error.