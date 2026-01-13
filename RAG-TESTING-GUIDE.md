# RAG Testing Guide

## Quick Test Commands

### 1. Test Backend Health
```bash
curl https://ai-speech-demo-hhhma9dyakhzh0e6.westus2-01.azurewebsites.net/health
```

Expected: `{"status":"ok","timestamp":...}`

---

### 2. Test RAG Initialization

Check backend logs after deployment:
```
✅ Configuration loaded
🚀 Voice Recognition Server running on port 8080
[RAG] Initializing RAG system...
[RAG] Created 2000 chunks
[RAG] Generating embeddings for 2000 chunks...
[RAG] Processed 2000/2000 chunks
✅ RAG system initialized with UTC Standards
```

---

### 3. Test Patient Context + RAG Questions

**Using Browser Console:**

1. Open patient page: `https://your-app/scrum-unit/patient/3103`
2. Open DevTools Console
3. Send patient context:
```javascript
// WebSocket should auto-send patient context when page loads
// Check console for: "[BackendWebSocket] Sent patient context: 3103"
```

4. Ask a question via voice:
   - **Question:** "What imaging results do we have?"
   - **Expected:** AI responds with audio mentioning MRI, CT scans from patient 3103

5. Try more questions:
   - "What are the UTC admission criteria?"
   - "What treatment options should we consider?"
   - "Tell me about the patient's diagnosis"

---

### 4. Test Commands vs Questions

**Commands (Should trigger function calls):**
- "Add office visit" → ✅ Adds to care actions
- "Confirm behavioral health" → ✅ Adds to care actions
- "Update mind to poor" → ✅ Updates GHS

**Questions (Should trigger RAG responses):**
- "What is the patient's diagnosis?" → ✅ AI reads diagnosis
- "What imaging do we have?" → ✅ AI lists MRI/CT scans
- "What are the UTC standards for treatment?" → ✅ AI quotes guidelines

---

### 5. Test WebSocket Messages

**Send Patient Context Manually:**
```javascript
// In browser console on patient page
const ws = new WebSocket('wss://ai-speech-demo-hhhma9dyakhzh0e6.westus2-01.azurewebsites.net/meeting');

ws.onopen = () => {
  console.log('Connected!');

  // Send patient context
  ws.send(JSON.stringify({
    type: "set_patient",
    patientId: 3103
  }));

  console.log('Sent patient context');
};

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  console.log('Received:', msg);

  if (msg.type === 'tts_audio' && msg.providerId === 0) {
    console.log('🎙️ AI Response:', msg.text);
    // Play audio
    const audio = new Audio('data:audio/wav;base64,' + msg.audio);
    audio.play();
  }
};
```

---

### 6. Expected WebSocket Messages

**Backend sends `tts_audio` for AI responses:**
```json
{
  "type": "tts_audio",
  "providerId": 0,
  "providerName": "AI Assistant",
  "audio": "base64audiodata...",
  "text": "The patient has an MRI from December 10th showing disc degeneration...",
  "timestamp": 1234567890
}
```

---

### 7. Check Backend Logs

**Azure Portal → App Service → Log Stream**

Look for:
```
📝 [guest1 → Dr. Smith (UserNum: 2179)]: What imaging results do we have?
💬 AI Response: The patient has an MRI from December 10th and a CT scan...
🔊 Generating TTS for AI response...
```

---

### 8. Test Different Patients

```javascript
// Change patient
ws.send(JSON.stringify({
  type: "set_patient",
  patientId: 3110  // Different patient
}));

// Ask same question - should get different results
```

---

### 9. Common Test Questions

| Question | Expected Response |
|----------|-------------------|
| "What imaging results do we have?" | Lists MRI, CT scans with dates |
| "What is the diagnosis?" | Reads patient diagnosis from case presentation |
| "What medications is the patient on?" | Lists prescriptions |
| "What are the health scores?" | Reads body/mind/motivation scores |
| "What are UTC admission criteria?" | Quotes UTC Standard 4 about admissions |
| "What treatment should we recommend?" | References UTC treatment standards |

---

### 10. Verify Data Flow

**Full Flow:**
1. Patient page loads
2. ✅ Frontend sends `set_patient` message
3. ✅ Backend fetches patient data (demographics + reports)
4. ✅ User asks question
5. ✅ Backend detects it's a question (not command)
6. ✅ RAG searches UTC guidelines
7. ✅ Combines guidelines + patient data
8. ✅ Sends to GPT-4
9. ✅ Converts response to TTS
10. ✅ Frontend plays audio

**Check each step in logs!**

---

### 11. Performance Metrics

- RAG search: <100ms
- Patient data fetch: <200ms
- OpenAI response: 1-3 seconds
- TTS generation: 1-2 seconds
- **Total response time: 2-5 seconds**

---

### 12. Troubleshooting

**No AI response:**
- Check backend logs for errors
- Verify patient context was sent
- Check if question was detected (vs command)

**Wrong patient data:**
- Check patient ID sent matches URL
- Verify stored procedures return data

**Slow responses:**
- Check if RAG initialized (startup logs)
- Monitor OpenAI API latency

---

## Quick Testing Script

Save as `test-rag.html`:

```html
<!DOCTYPE html>
<html>
<head><title>RAG Tester</title></head>
<body>
  <h1>RAG Testing Console</h1>
  <div>
    <label>Patient ID: <input id="patientId" value="3103" /></label>
    <button onclick="sendPatient()">Send Patient Context</button>
  </div>
  <div>
    <label>Question: <input id="question" value="What imaging results do we have?" size="50" /></label>
    <button onclick="askQuestion()">Ask (Simulated)</button>
  </div>
  <div>
    <h3>Messages:</h3>
    <div id="log" style="height: 400px; overflow-y: scroll; border: 1px solid #ccc; padding: 10px;"></div>
  </div>

  <script>
    let ws;

    function connect() {
      ws = new WebSocket('wss://ai-speech-demo-hhhma9dyakhzh0e6.westus2-01.azurewebsites.net/meeting');

      ws.onopen = () => log('✅ Connected');
      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data);
        log(`📨 ${msg.type}: ${JSON.stringify(msg, null, 2)}`);

        if (msg.type === 'tts_audio' && msg.providerId === 0) {
          log(`🎙️ AI: ${msg.text}`);
        }
      };
      ws.onerror = (e) => log('❌ Error: ' + e);
      ws.onclose = () => log('⚪ Disconnected');
    }

    function sendPatient() {
      const pid = document.getElementById('patientId').value;
      ws.send(JSON.stringify({
        type: "set_patient",
        patientId: Number(pid)
      }));
      log(`➡️ Sent patient context: ${pid}`);
    }

    function askQuestion() {
      const q = document.getElementById('question').value;
      log(`❓ Question: ${q}`);
      log('⚠️ Note: Voice recording needed for real test');
    }

    function log(msg) {
      const div = document.getElementById('log');
      div.innerHTML += `<div>${new Date().toLocaleTimeString()} - ${msg}</div>`;
      div.scrollTop = div.scrollHeight;
    }

    connect();
  </script>
</body>
</html>
```

Open in browser to test WebSocket connection and patient context!

---

## Success Criteria

✅ RAG initializes on startup (<60s)
✅ Patient context sends when page loads
✅ Questions get RAG responses (not function calls)
✅ Commands get function calls (not RAG responses)
✅ AI responses include patient data
✅ AI responses include UTC guidelines
✅ Audio plays for AI responses
✅ Response time <5 seconds

**All checks pass = RAG system working! 🎉**
