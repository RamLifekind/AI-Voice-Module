# RAG Testing Instructions

## What's New in the Tester

The voice-backend-tester now has **full RAG testing capabilities**:

1. **Patient Context Sending** - Send patient ID to backend to load patient data
2. **AI Response Display** - Automatically captures and displays AI responses
3. **Test Questions List** - Pre-populated questions to test RAG functionality
4. **Audio Playback** - Auto-plays AI responses as audio

---

## How to Test RAG System

### Step 1: Start the Backend
Deploy your backend to Azure or run locally. The tester connects to:
```
wss://ai-speech-demo-hhhma9dyakhzh0e6.westus2-01.azurewebsites.net/meeting
```

### Step 2: Open the Tester
1. Navigate to `/Users/bhargav/voice-backend-tester`
2. Run: `npm start`
3. Open browser to `http://localhost:3000`

### Step 3: Connect to Meeting WebSocket
1. Click **"Connect Meeting"** button
2. WebSocket will connect and auto-start microphone recording
3. Green indicator shows "Connected - Streaming audio continuously"
4. Red "LIVE" indicator shows microphone is active

### Step 4: Send Patient Context
1. In the **"RAG Patient Context Testing"** section:
   - Enter Patient ID (default: 3103)
   - Click **"Send Patient Context"**
2. You'll see confirmation: ✅ "Patient context sent"
3. Backend now has access to patient data for this session

### Step 5: Ask Questions via Voice
Speak any of these test questions clearly into your microphone:

**Patient-Specific Questions:**
- "What imaging results do we have?"
- "What is the patient's diagnosis?"
- "What medications is the patient on?"
- "What are the health scores?"

**UTC Guidelines Questions:**
- "What are the UTC admission criteria?"
- "What treatment should we recommend?"
- "Tell me about behavioral health services"

### Step 6: Watch for AI Responses
The tester will automatically:
1. Capture AI responses (providerId === 0)
2. Display them in the "AI Responses" section
3. Play the audio response automatically
4. Log the full response text

---

## What You'll See

### In the Live Logs:
```
[10:30:45] ✅ Connected to /meeting - Ready to receive messages
[10:30:46] 🎤 Started recording PCM audio for meeting...
[10:30:50] ✅ Sent patient context: Patient ID 3103
[10:31:00] 📨 [transcript] {"type":"transcript"...}
[10:31:02] 🤖 AI Response: The patient has an MRI from December 10th showing disc degeneration...
[10:31:02] 🔊 TTS Audio received (45234 chars) - Auto-playing...
```

### In the AI Responses Panel:
```
🤖 AI Responses (3):

🤖 10:31:02 AM
The patient has an MRI from December 10th showing disc degeneration and a CT scan from December 15th.

🤖 10:31:45 AM
According to UTC Standard 4, admission criteria include medical necessity and appropriate level of care determination.

🤖 10:32:10 AM
The patient is currently on Gabapentin 300mg and Ibuprofen 800mg for pain management.
```

---

## Testing Checklist

### ✅ RAG System Initialization
- [ ] Backend shows `✅ RAG system initialized with UTC Standards` in logs
- [ ] Backend shows `[RAG] Created 2000 chunks` in startup logs

### ✅ Patient Context Loading
- [ ] Click "Send Patient Context" successfully
- [ ] Backend logs show `📝 Patient context set: 3103`
- [ ] No errors in backend logs

### ✅ Question Detection
- [ ] Ask "What imaging results do we have?"
- [ ] Backend detects it as a question (not a command)
- [ ] Receives AI response via `tts_audio` message

### ✅ RAG Content in Response
- [ ] AI response mentions specific patient data (imaging dates, diagnosis, etc.)
- [ ] AI response references UTC guidelines when asked about standards
- [ ] Response is concise (under 3 sentences as per prompt)

### ✅ Command vs Question Differentiation
**Test Commands (should NOT trigger RAG):**
- Say "Add office visit" → Should trigger function call, not AI response

**Test Questions (should trigger RAG):**
- Say "What imaging do we have?" → Should trigger AI response with audio

### ✅ Audio Playback
- [ ] AI responses play automatically as audio
- [ ] Audio is clear and matches the text response
- [ ] No audio playback errors in logs

### ✅ Performance
- [ ] RAG search completes in < 100ms (check backend logs)
- [ ] Total response time < 5 seconds
- [ ] No timeout errors

---

## Troubleshooting

### Issue: "WebSocket not connected"
**Fix:** Click "Connect Meeting" button first

### Issue: No AI responses appearing
**Check:**
1. Did you send patient context?
2. Are you asking questions (not commands)?
3. Check backend logs for errors
4. Verify RAG initialized on backend startup

### Issue: AI response but no audio
**Check:**
1. Browser audio permissions granted
2. Check console for audio playback errors
3. Verify `tts_audio` message contains `audio` field

### Issue: Wrong patient data in response
**Check:**
1. Verify correct patient ID sent
2. Check backend logs for patient data fetch
3. Try sending patient context again

---

## Expected Backend Logs

When testing RAG successfully, you should see:

```
🚀 Voice Recognition Server running on port 8080
[RAG] Initializing RAG system...
[RAG] Created 2000 chunks
[RAG] Generating embeddings for 2000 chunks...
[RAG] Processed 2000/2000 chunks
✅ RAG system initialized with UTC Standards

📝 Patient context set: 3103
📝 Fetching patient data for UserNum: 3103
✅ Patient data loaded: John Doe

📝 [guest1 → Dr. Smith (UserNum: 2179)]: What imaging results do we have?
🔍 Detected conversational query
[RAG] Searching for: "What imaging results do we have?"
[RAG] Found 3 relevant chunks
💬 AI Response: The patient has an MRI from December 10th showing disc degeneration and a CT scan from December 15th showing no acute findings.
🔊 Generating TTS for AI response...
✅ TTS audio sent via WebSocket
```

---

## Success Criteria

All of these should work:

✅ **Connection:** WebSocket connects and stays connected
✅ **Patient Context:** Successfully sends patient ID to backend
✅ **Voice Recording:** Microphone captures and streams audio
✅ **Question Detection:** Backend distinguishes questions from commands
✅ **RAG Retrieval:** AI responses include UTC guidelines content
✅ **Patient Data:** AI responses include specific patient information
✅ **Audio Responses:** TTS audio plays automatically
✅ **Response Display:** AI responses appear in the "AI Responses" panel
✅ **Performance:** Total response time under 5 seconds

**If all checks pass = RAG system is working perfectly! 🎉**

---

## Next Steps After Testing

1. If tests pass, deploy frontend with patient context changes
2. If tests fail, check backend logs for specific errors
3. Verify database stored procedures return correct patient data
4. Test with multiple different patient IDs (3103, 3110, etc.)
