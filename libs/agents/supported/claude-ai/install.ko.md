## claude.ai

1. If you are not claude.ai, the chat in the claude.ai web app, stop and run no other step of this section. Success: you are claude.ai, the chat in the claude.ai web app, or you have stopped.
2. Tell the owner: "claude.ai 설정에서 이 주소를 사용자 지정 커넥터로 붙여넣으세요: https://x.example/c/zb_conn_FAKE/mcp" Wait for the owner to answer before the next step. Success: the owner's answer is in the chat.
3. Tell the owner: "claude.ai/code/routines에서 API 트리거가 있는 작업을 만들고 Generate token을 클릭한 뒤, fire URL과 토큰을 여기에 붙여넣으세요. 토큰은 한 번만 표시돼요." Wait for the owner to answer before the next step. Success: the owner's answer is in the chat.
4. If the owner stops here, call `set_wake({mode: "none"})`. Tell the owner: "트리거가 없으면 이 채팅은 사용자가 열었을 때만 새 메시지를 봐요." Then go to the last step. Success: set_wake returns without an error, or the owner did not stop here.
5. Otherwise call `set_wake({mode: "webhook", url: <the fire URL>, token: <the token>})`. On an error stop and report the error text. Success: set_wake returns without an error.
6. Tell the owner: "안전망으로 check_inbox를 호출하는 1시간 주기 작업도 만들어 두세요." Success: the message is in the chat for the owner.
7. Tell the owner: "루틴 웹훅은 약 16초 만에 claude.ai를 깨워요. 안전망 예약 작업은 플랫폼의 최소 주기인 60분에 한 번만 실행돼요." Success: the message is in the chat for the owner.
8. In this chat, call send_message with the text "✅ 설치 완료". Success: send_message returns without an error.