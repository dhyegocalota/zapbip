## ChatGPT

1. If you are not ChatGPT, the chat in the ChatGPT web app, stop and run no other step of this section. Success: you are ChatGPT, the chat in the ChatGPT web app, or you have stopped.
2. Tell the owner: "ChatGPT 설정에서 개발자 모드를 켜고 URL https://x.example/c/zb_conn_FAKE/mcp(으)로 앱을 추가하세요. 인증은 `No authentication`으로 설정해요." Wait for the owner to answer before the next step. Success: the owner's answer is in the chat.
3. Tell the owner: "전용 채팅에서 `Run on this computer`로 1시간마다 실행되는 작업을 만들어 check_inbox를 호출하게 하고, 도구마다 한 번씩 `Always allow`를 선택하세요." Wait for the owner to answer before the next step. Success: the owner's answer is in the chat.
4. Call `set_wake({mode: "scheduled", interval_minutes: 60})`. Success: set_wake returns without an error.
5. Tell the owner: "ChatGPT는 1시간마다 예약 작업으로 깨어나요. 메시지는 최대 1시간 기다릴 수 있어요." Success: the message is in the chat for the owner.
6. In this chat, call send_message with the text "✅ 설치 완료". Success: send_message returns without an error.