## claude.ai

1. If you are not claude.ai, the chat in the claude.ai web app, stop and run no other step of this section. Success: you are claude.ai, the chat in the claude.ai web app, or you have stopped.
2. Tell the owner: "claude.ai की सेटिंग्स में यह पता कस्टम कनेक्टर के रूप में पेस्ट करें: https://x.example/c/zb_conn_FAKE/mcp" Wait for the owner to answer before the next step. Success: the owner's answer is in the chat.
3. Tell the owner: "claude.ai/code/routines पर API ट्रिगर वाला एक टास्क बनाएँ, Generate token पर क्लिक करें और fire URL और टोकन यहाँ पेस्ट करें। टोकन सिर्फ़ एक बार दिखता है।" Wait for the owner to answer before the next step. Success: the owner's answer is in the chat.
4. If the owner stops here, call `set_wake({mode: "none"})`. Tell the owner: "ट्रिगर के बिना यह चैट नए संदेश तभी देखती है जब आप इसे खोलते हैं।" Then go to the last step. Success: set_wake returns without an error, or the owner did not stop here.
5. Otherwise call `set_wake({mode: "webhook", url: <the fire URL>, token: <the token>})`. On an error stop and report the error text. Success: set_wake returns without an error.
6. Tell the owner: "सेफ़्टी नेट के तौर पर हर घंटे चलने वाला एक टास्क भी बनाएँ जो check_inbox कॉल करे।" Success: the message is in the chat for the owner.
7. Tell the owner: "रूटीन का webhook claude.ai को करीब 16 सेकंड में जगाता है; सेफ़्टी नेट वाला शेड्यूल्ड टास्क ज़्यादा से ज़्यादा हर 60 मिनट में एक बार चलता है, जो प्लेटफ़ॉर्म की न्यूनतम सीमा है।" Success: the message is in the chat for the owner.
8. In this chat, call send_message with the text "✅ इंस्टॉल हो गया". Success: send_message returns without an error.