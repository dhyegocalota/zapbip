## ChatGPT

1. If you are not ChatGPT, the chat in the ChatGPT web app, stop and run no other step of this section. Success: you are ChatGPT, the chat in the ChatGPT web app, or you have stopped.
2. Tell the owner: "ChatGPT की सेटिंग्स में डेवलपर मोड चालू करें और URL https://x.example/c/zb_conn_FAKE/mcp से एक ऐप जोड़ें, `No authentication` के साथ।" Wait for the owner to answer before the next step. Success: the owner's answer is in the chat.
3. Tell the owner: "एक अलग चैट में `Run on this computer` के साथ हर घंटे चलने वाला एक टास्क बनाएँ जो check_inbox कॉल करे, और हर टूल के लिए एक बार `Always allow` चुनें।" Wait for the owner to answer before the next step. Success: the owner's answer is in the chat.
4. Call `set_wake({mode: "scheduled", interval_minutes: 60})`. Success: set_wake returns without an error.
5. Tell the owner: "ChatGPT को हर घंटे एक शेड्यूल्ड टास्क जगाता है: किसी संदेश को एक घंटे तक इंतज़ार करना पड़ सकता है।" Success: the message is in the chat for the owner.
6. In this chat, call send_message with the text "✅ इंस्टॉल हो गया". Success: send_message returns without an error.