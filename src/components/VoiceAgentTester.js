import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Activity, CheckCircle, XCircle, Loader, Radio, Send, Mic, Volume2, Users, MessageSquare, StopCircle, VolumeX } from 'lucide-react';
import { VOICE_BACKEND } from '../config';

const config = {
  backendUrl: VOICE_BACKEND,
  backendHttp: VOICE_BACKEND,
  backendWs: VOICE_BACKEND.replace('https://', 'wss://'),
  pythonUrl: 'https://ai-python-backend-cqdpf4f7a7h0d3en.westus2-01.azurewebsites.net'
};

// Fetch a single-use ticket for voice backend WebSocket auth
async function getVoiceWsTicket(token) {
  console.log('[VoiceWS] Fetching ticket from:', `${VOICE_BACKEND}/api/ws/ticket`);
  const res = await fetch(`${VOICE_BACKEND}/api/ws/ticket`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log('[VoiceWS] Ticket response status:', res.status);
  const text = await res.text();
  console.log('[VoiceWS] Ticket response body:', text);
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Ticket endpoint returned non-JSON (${res.status}): ${text.substring(0, 200)}`);
  }
  if (!data.ticket) {
    throw new Error(data.message || `Ticket failed (${res.status}): ${text.substring(0, 200)}`);
  }
  return data.ticket;
}

const TestStatus = ({ status, children }) => {
  const icons = {
    idle: <Activity className="w-4 h-4 text-gray-400" />,
    running: <Loader className="w-4 h-4 text-blue-500 animate-spin" />,
    success: <CheckCircle className="w-4 h-4 text-green-500" />,
    error: <XCircle className="w-4 h-4 text-red-500" />
  };
  
  return (
    <div className="flex items-center gap-2">
      {icons[status]}
      <span className={status === 'error' ? 'text-red-600' : ''}>{children}</span>
    </div>
  );
};

export default function VoiceAgentTester({ token }) {
  const [tests, setTests] = useState({
    health: { status: 'idle', result: null },
    meetingWs: { status: 'idle', result: null, messages: [] },
    enrollWs: { status: 'idle', result: null, messages: [] },
    tts: { status: 'idle', result: null },
    python: { status: 'idle', result: null },
    fullFlow: { status: 'idle', result: null, events: [] }
  });
  
  const [wsLogs, setWsLogs] = useState([]);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [customTTSText, setCustomTTSText] = useState("Patient shows good progress. Recommended massage therapy and continue current treatment plan.");
  
  // Enrollment states
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [enrollmentUserNum, setEnrollmentUserNum] = useState('');
  const [isRecordingEnroll, setIsRecordingEnroll] = useState(false);
  
  // Meeting states
  const [isMeetingConnected, setIsMeetingConnected] = useState(false);
  const [isRecordingMeeting, setIsRecordingMeeting] = useState(false);

  // RAG testing states
  const [patientId, setPatientId] = useState('3103');
  const [patientContextSent, setPatientContextSent] = useState(false);
  const [aiResponses, setAiResponses] = useState([]);

  const wsRef = useRef(null);
  const enrollWsRef = useRef(null);
  const meetingMediaRecorderRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const logsContainerRef = useRef(null);

  useEffect(() => {
  if (logsContainerRef.current) {
    logsContainerRef.current.scrollTop =
      logsContainerRef.current.scrollHeight;
  }
}, [wsLogs]);



  const updateTest = (testName, updates) => {
    setTests(prev => ({
      ...prev,
      [testName]: { ...prev[testName], ...updates }
    }));
  };

  const addLog = (message, type = 'info') => {
    setWsLogs(prev => [...prev.slice(-50), { 
      time: new Date().toLocaleTimeString(), 
      message, 
      type 
    }]);
  };

  // Helper function to convert base64 to Blob
  const base64ToBlob = (base64, mimeType) => {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
  };

  // Play Audio from WebSocket
  const playWebSocketAudio = (base64Audio, source = 'WebSocket') => {
    try {
      const audioBlob = base64ToBlob(base64Audio, 'audio/wav');
      const audioUrl = URL.createObjectURL(audioBlob);
      
      const wsAudio = new Audio(audioUrl);
      wsAudio.play();
      addLog(`🔊 Auto-playing ${source} audio...`, 'success');
      
      wsAudio.onended = () => {
        addLog(`⚪ ${source} audio finished`, 'info');
        URL.revokeObjectURL(audioUrl);
      };
      
      wsAudio.onerror = () => {
        addLog(`❌ ${source} audio playback error`, 'error');
        URL.revokeObjectURL(audioUrl);
      };
      
    } catch (error) {
      addLog(`❌ Failed to play ${source} audio: ${error.message}`, 'error');
    }
  };

  // Test 1: Health Check
  const testHealthCheck = useCallback(async () => {
    updateTest('health', { status: 'running', result: null });
    addLog('Testing health endpoint...', 'info');
    
    try {
      const response = await fetch(`${config.backendUrl}/health`);
      const data = await response.json();
      updateTest('health', { status: 'success', result: data });
      addLog('✅ Health check passed', 'success');
    } catch (error) {
      updateTest('health', { status: 'error', result: error.message });
      addLog(`❌ Health check failed: ${error.message}`, 'error');
    }
  }, []);

  // Test 2: Meeting WebSocket - Persistent connection (ticket-based auth)
  const connectMeetingWebSocket = async () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      addLog('⚠️ Meeting WebSocket already connected', 'info');
      return;
    }

    updateTest('meetingWs', { status: 'running', messages: [] });
    addLog('Connecting to /meeting WebSocket...', 'info');
    
    if (wsRef.current) {
      wsRef.current.close();
    }
    
    let wsUrl;
    try {
      if (token) {
        const ticket = await getVoiceWsTicket(token);
        wsUrl = `${config.backendWs}/meeting?ticket=${ticket}`;
      } else {
        wsUrl = `${config.backendWs}/meeting`;
      }
    } catch (err) {
      updateTest('meetingWs', { status: 'error', result: err.message });
      addLog(`❌ Failed to get WS ticket: ${err.message}`, 'error');
      return;
    }
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      updateTest('meetingWs', { status: 'success', result: 'Connected' });
      setIsMeetingConnected(true);
      setPatientContextSent(false);
      addLog('✅ Connected to /meeting via ticket - Ready to receive messages', 'success');

      // Auto-start recording after connection established
      setTimeout(() => {
        startMeetingRecording();
      }, 100);
    };
    
    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        updateTest('meetingWs', prev => ({
          ...prev,
          messages: [...prev.messages, message].slice(-20)
        }));
        
        // Log ALL messages with full data for debugging
        addLog(`📨 [${message.type}] ${JSON.stringify(message).substring(0, 200)}`, 'ws');
        
        // Handle different message types and auto-play audio
        // Backend sends "audio" field, not "audioBase64"
        if (message.type === 'tts_audio') {
          if (message.audio || message.audioBase64) {
            const audioData = message.audio || message.audioBase64;

            // Check if this is an AI response (providerId === 0)
            if (message.providerId === 0) {
              addLog(`🤖 AI Response: ${message.text}`, 'success');
              setAiResponses(prev => [...prev, {
                text: message.text,
                timestamp: Date.now(),
                providerName: message.providerName || 'AI Assistant'
              }].slice(-10)); // Keep last 10 responses
            }

            addLog(`🔊 TTS Audio received (${audioData.length} chars) - Auto-playing...`, 'success');
            playWebSocketAudio(audioData, 'TTS Response');
          } else {
            addLog(`⚠️ TTS Audio message but no audio field`, 'error');
          }
        } else if (message.type === 'tts_summary') {
          if (message.audio || message.audioBase64) {
            const audioData = message.audio || message.audioBase64;
            addLog(`🔊 TTS Summary audio received (${audioData.length} chars) - Auto-playing...`, 'success');
            playWebSocketAudio(audioData, 'Summary');
          } else {
            addLog(`⚠️ TTS Summary message but no audio field`, 'error');
            addLog(`📋 Message keys: ${Object.keys(message).join(', ')}`, 'info');
          }
        } else if (message.type === 'transcript') {
          addLog(`📝 Transcript: ${message.speaker}: ${message.text}`, 'ws');
        } else if (message.type === 'speaker_verified') {
          addLog(`🗣️ Speaker verified: ${message.firstName || 'Unknown'}`, 'ws');
        } else if (message.type === 'attendance_marked') {
          addLog(`✅ Attendance: ${message.firstName || 'Unknown'}`, 'ws');
        } else if (message.type === 'function_call') {
          addLog(`🔧 Function: ${message.functionName}`, 'ws');
        }
      } catch (error) {
        addLog(`📨 Received (parse error): ${event.data.substring(0, 100)}`, 'ws');
      }
    };
    
    ws.onerror = (error) => {
      updateTest('meetingWs', { status: 'error', result: 'Connection failed' });
      setIsMeetingConnected(false);
      addLog('❌ Meeting WebSocket error', 'error');
    };
    
    ws.onclose = () => {
      setIsMeetingConnected(false);
      stopMeetingRecording();
      addLog('⚪ Meeting WebSocket closed', 'info');
    };
  };

  const disconnectMeetingWebSocket = () => {
    // Stop recording first
    stopMeetingRecording();

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
      setIsMeetingConnected(false);
      setPatientContextSent(false);
      updateTest('meetingWs', { status: 'idle', result: 'Disconnected' });
      addLog('⚪ Meeting WebSocket disconnected', 'info');
    }
  };

  // Send Patient Context via HTTP (like TTS)
  const sendPatientContext = async () => {
    try {
      addLog(`📤 Sending patient context via HTTP...`, 'info');

      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const response = await fetch(`${config.backendHttp}/api/meeting/patient`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          patientId: patientId
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      setPatientContextSent(true);
      addLog(`✅ Patient context set: ${result.message}`, 'success');

    } catch (error) {
      addLog(`❌ Failed to send patient context: ${error.message}`, 'error');
    }
  };

  // Start/Stop Recording for Meeting
  const startMeetingRecording = async () => {
    if (isRecordingMeeting) {
      addLog('⚠️ Already recording', 'info');
      return;
    }
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true
        }
      });
      
      mediaStreamRef.current = stream;
      
      // Use AudioContext for proper PCM like production frontend
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const audioContext = new AudioContext({ sampleRate: 16000 });
      
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }
      
      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      
      processor.onaudioprocess = (e) => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
        
        const input = e.inputBuffer.getChannelData(0);
        // Convert Float32 [-1, 1] to Int16 (same as production)
        const pcm16 = new Int16Array(input.length);
        for (let i = 0; i < input.length; i++) {
          let s = Math.max(-1, Math.min(1, input[i]));
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }
        
        // Send raw binary (same as production frontend)
        wsRef.current.send(pcm16.buffer);
      };
      
      source.connect(processor);
      processor.connect(audioContext.destination);
      
      meetingMediaRecorderRef.current = { processor, audioContext, source };
      setIsRecordingMeeting(true);
      addLog('🎤 Started recording PCM audio for meeting...', 'success');
      
    } catch (error) {
      addLog(`❌ Microphone access denied: ${error.message}`, 'error');
    }
  };

  const stopMeetingRecording = () => {
    if (meetingMediaRecorderRef.current && isRecordingMeeting) {
      const { processor, audioContext, source } = meetingMediaRecorderRef.current;
      
      if (processor) processor.disconnect();
      if (source) source.disconnect();
      if (audioContext) audioContext.close();
      
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
      }
      
      meetingMediaRecorderRef.current = null;
      setIsRecordingMeeting(false);
      addLog('⏹️ Stopped meeting recording', 'info');
    }
  };

  // Test 3: Enrollment WebSocket with Audio Streaming
  const startEnrollment = async () => {
    updateTest('enrollWs', { status: 'running', messages: [] });
    addLog(`Starting enrollment for User ${enrollmentUserNum}...`, 'info');
    
    if (enrollWsRef.current) {
      enrollWsRef.current.close();
    }
    
    let enrollWsUrl;
    try {
      if (token) {
        const ticket = await getVoiceWsTicket(token);
        enrollWsUrl = `${config.backendWs}/enroll?ticket=${ticket}`;
      } else {
        enrollWsUrl = `${config.backendWs}/enroll`;
      }
    } catch (err) {
      updateTest('enrollWs', { status: 'error', result: err.message });
      addLog(`❌ Failed to get WS ticket: ${err.message}`, 'error');
      return;
    }
    const ws = new WebSocket(enrollWsUrl);
    enrollWsRef.current = ws;

    ws.onopen = () => {
      updateTest('enrollWs', { status: 'success', result: 'Connected' });
      setIsEnrolling(true);
      addLog('✅ Connected to /enroll via ticket', 'success');
      
      // Send enrollment start
      ws.send(JSON.stringify({ 
        type: 'start', 
        userNum: enrollmentUserNum 
      }));
      addLog(`📤 Sent enrollment start (userNum=${enrollmentUserNum})`, 'info');
      
      // Start recording audio
      startEnrollmentRecording();
    };
    
    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        updateTest('enrollWs', prev => ({
          ...prev,
          messages: [...prev.messages, message].slice(-20)
        }));
        
        if (message.type === 'enrollment_complete' || message.type === 'success') {
          addLog(`✅ Enrollment successful!`, 'success');
          stopEnrollment();
        } else if (message.type === 'error') {
          addLog(`❌ Enrollment error: ${message.message}`, 'error');
        } else {
          addLog(`📨 Enrollment: ${JSON.stringify(message)}`, 'ws');
        }
      } catch (error) {
        addLog(`📨 Received: ${event.data.substring(0, 50)}`, 'ws');
      }
    };
    
    ws.onerror = () => {
      updateTest('enrollWs', { status: 'error', result: 'Connection failed' });
      addLog('❌ Enrollment WebSocket error', 'error');
      stopEnrollment();
    };
    
    ws.onclose = () => {
      addLog('⚪ Enrollment WebSocket closed', 'info');
      setIsEnrolling(false);
    };
  };

  const enrollmentAudioCtxRef = useRef(null);
const enrollmentProcessorRef = useRef(null);
const enrollmentStreamRef = useRef(null);

const startEnrollmentRecording = async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    enrollmentStreamRef.current = stream;

    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const audioCtx = new AudioCtx({ sampleRate: 16000 });
    enrollmentAudioCtxRef.current = audioCtx;

    if (audioCtx.state === 'suspended') {
      await audioCtx.resume();
    }

    const source = audioCtx.createMediaStreamSource(stream);
    const processor = audioCtx.createScriptProcessor(4096, 1, 1);
    enrollmentProcessorRef.current = processor;

    processor.onaudioprocess = (e) => {
      if (!enrollWsRef.current || enrollWsRef.current.readyState !== WebSocket.OPEN) return;

      const input = e.inputBuffer.getChannelData(0);

      const pcm16 = new Int16Array(input.length);
      for (let i = 0; i < input.length; i++) {
        let s = Math.max(-1, Math.min(1, input[i]));
        pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
      }

      // 🔑 THIS is what Eagle expects
      enrollWsRef.current.send(pcm16.buffer);
    };

    source.connect(processor);
    processor.connect(audioCtx.destination);

    setIsRecordingEnroll(true);
    addLog('🎤 Recording PCM audio for enrollment...', 'success');

  } catch (err) {
    addLog(`❌ Enrollment mic error: ${err.message}`, 'error');
  }
};


  const stopEnrollment = () => {
  // 🔹 Stop PCM audio pipeline
  if (enrollmentProcessorRef.current) {
    enrollmentProcessorRef.current.disconnect();
    enrollmentProcessorRef.current = null;
  }

  if (enrollmentAudioCtxRef.current) {
    enrollmentAudioCtxRef.current.close();
    enrollmentAudioCtxRef.current = null;
  }

  if (enrollmentStreamRef.current) {
    enrollmentStreamRef.current.getTracks().forEach(t => t.stop());
    enrollmentStreamRef.current = null;
  }

  // 🔹 Close WebSocket
  if (enrollWsRef.current) {
    enrollWsRef.current.send(JSON.stringify({ type: 'stop' }));
    enrollWsRef.current.close();
    enrollWsRef.current = null;
  }

  setIsRecordingEnroll(false);
  setIsEnrolling(false);
  addLog('⏹️ Enrollment stopped', 'info');
};


  // Test 4: TTS Summary - Sends via HTTP, receives via Meeting WebSocket
  const testTTSSummary = async () => {
    if (!isMeetingConnected) {
      addLog('⚠️ Meeting WebSocket not connected. Connect first to receive TTS audio!', 'error');
      return;
    }

    updateTest('tts', { status: 'running', result: null });
    addLog('Sending TTS request (audio will arrive via Meeting WebSocket)...', 'info');
    
    const testData = {
      summary: customTTSText,
      providerId: 1,
      providerName: "Dr. Test"
    };
    
    try {
      const ttsHeaders = { 'Content-Type': 'application/json' };
      if (token) ttsHeaders['Authorization'] = `Bearer ${token}`;

      const response = await fetch(`${config.backendUrl}/api/tts/summary`, {
        method: 'POST',
        headers: ttsHeaders,
        body: JSON.stringify(testData)
      });
      
      const data = await response.json();
      
      updateTest('tts', { 
        status: 'success', 
        result: { message: data.message }
      });
      
      addLog(`✅ TTS request sent: ${data.message}`, 'success');
      addLog(`⏳ Waiting for audio via Meeting WebSocket...`, 'info');
      
    } catch (error) {
      updateTest('tts', { status: 'error', result: error.message });
      addLog(`❌ TTS API failed: ${error.message}`, 'error');
    }
  };

  // Test 5: Python Service
  const testPythonService = useCallback(async () => {
    updateTest('python', { status: 'running', result: null });
    addLog('Testing Python Eagle Service...', 'info');
    
    try {
      // Test health endpoint with ngrok-skip-browser-warning header
      const healthResponse = await fetch(`${config.pythonUrl}/health`, {
        method: 'GET',
        headers: {
          'ngrok-skip-browser-warning': 'true',
          'User-Agent': 'VoiceBackendTester/1.0'
        },
        mode: 'cors'
      });
      
      addLog(`✅ Response received: ${healthResponse.status} ${healthResponse.statusText}`, 'success');
      
      // Check if response is actually JSON
      const contentType = healthResponse.headers.get('content-type');
      addLog(`📋 Content-Type: ${contentType}`, 'info');
      
      if (!contentType || !contentType.includes('application/json')) {
        const textResponse = await healthResponse.text();
        addLog(`📄 Response text (first 200 chars): ${textResponse.substring(0, 200)}`, 'info');
        throw new Error(`Python service returned non-JSON response`);
      }
      
      const healthData = await healthResponse.json();
      
      // Python service uses different response structure
      const profileCount = healthData.profiles_loaded || 0;
      const providerIds = healthData.provider_ids || [];
      
      updateTest('python', { 
        status: 'success', 
        result: { 
          health: healthData, 
          profileCount: profileCount,
          providerIds: providerIds
        }
      });
      addLog(`✅ Python service: ${healthData.status}`, 'success');
      addLog(`✅ Loaded profiles: ${profileCount}`, 'success');
      if (providerIds.length > 0) {
        addLog(`✅ Provider IDs: ${providerIds.join(', ')}`, 'success');
      }
    } catch (error) {
      updateTest('python', { status: 'error', result: error.message });
      addLog(`❌ Python service error: ${error.message}`, 'error');
      addLog(`❌ Error type: ${error.name}`, 'error');
      addLog(`❌ Full error: ${JSON.stringify(error, Object.getOwnPropertyNames(error))}`, 'error');
      addLog(`ℹ️  This might be a CORS or network issue`, 'info');
      addLog(`ℹ️  curl works: ${config.pythonUrl}/health`, 'info');
    }
  }, []);

  // Run all tests
  const runAllTests = async () => {
    addLog('🧪 Starting comprehensive test suite...', 'info');
    await testHealthCheck();
    await new Promise(r => setTimeout(r, 500));
    connectMeetingWebSocket();
    await new Promise(r => setTimeout(r, 1000));
    await testPythonService();
  };

  // Auto-refresh
  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(() => {
        testHealthCheck();
        testPythonService();
      }, 10000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, testHealthCheck, testPythonService]);

  // Cleanup on unmount
useEffect(() => {
  return () => {
    // Close meeting websocket
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    // Close enrollment websocket
    if (enrollWsRef.current) {
      enrollWsRef.current.close();
      enrollWsRef.current = null;
    }

    // Stop meeting audio (PCM AudioContext model)
    if (meetingMediaRecorderRef.current) {
      const { processor, source, audioContext } = meetingMediaRecorderRef.current;

      if (processor) processor.disconnect();
      if (source) source.disconnect();
      if (audioContext) audioContext.close();

      meetingMediaRecorderRef.current = null;
    }

    // Stop mic stream
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop());
      mediaStreamRef.current = null;
    }
  };
}, []);


  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }
        
        .animate-spin {
          animation: spin 1s linear infinite;
        }
        
        .animate-pulse {
          animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            Voice Recognition Backend Tester
          </h1>
          <p className="text-slate-400">Live testing with real-time audio streaming</p>
        </div>

        {/* Control Panel */}
        <div className="bg-slate-800/50 backdrop-blur rounded-lg p-4 mb-6 border border-slate-700">
          <div className="flex flex-wrap gap-3">
            <button
              onClick={runAllTests}
              className="px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg hover:from-blue-600 hover:to-purple-600 transition flex items-center gap-2"
            >
              <Activity className="w-4 h-4" />
              Run All Tests
            </button>
            <button
              onClick={testHealthCheck}
              className="px-4 py-2 bg-slate-700 rounded-lg hover:bg-slate-600 transition flex items-center gap-2"
            >
              <Activity className="w-4 h-4" />
              Health
            </button>
            <button
              onClick={testPythonService}
              className="px-4 py-2 bg-slate-700 rounded-lg hover:bg-slate-600 transition flex items-center gap-2"
            >
              <Send className="w-4 h-4" />
              Python
            </button>
            <label className="flex items-center gap-2 px-4 py-2 bg-slate-700 rounded-lg cursor-pointer hover:bg-slate-600 transition">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded"
              />
              Auto-refresh (10s)
            </label>
          </div>
        </div>

        {/* Meeting WebSocket Section */}
        <div className="bg-gradient-to-r from-green-500/10 to-blue-500/10 backdrop-blur rounded-lg p-6 mb-6 border border-green-500/30">
          <h3 className="font-semibold mb-4 flex items-center gap-2 text-xl">
            <Radio className="w-6 h-6 text-green-400" />
            Meeting WebSocket (Persistent Connection)
          </h3>

          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${isMeetingConnected ? 'bg-green-500 animate-pulse' : 'bg-slate-600'}`} />
              <span className="text-sm text-slate-300">
                {isMeetingConnected ? 'Connected - Streaming audio continuously' : 'Not connected'}
              </span>
              {isRecordingMeeting && (
                <div className="flex items-center gap-2 text-red-400 animate-pulse">
                  <Mic className="w-4 h-4" />
                  <span className="text-xs">LIVE</span>
                </div>
              )}
              {patientContextSent && (
                <div className="flex items-center gap-2 text-cyan-400">
                  <Users className="w-4 h-4" />
                  <span className="text-xs">Patient: {patientId}</span>
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-3">
              {!isMeetingConnected ? (
                <button
                  onClick={connectMeetingWebSocket}
                  className="px-4 py-2 bg-green-600 rounded-lg hover:bg-green-700 transition flex items-center gap-2"
                >
                  <Radio className="w-4 h-4" />
                  Connect Meeting
                </button>
              ) : (
                <>
                  <button
                    onClick={disconnectMeetingWebSocket}
                    className="px-4 py-2 bg-red-600 rounded-lg hover:bg-red-700 transition flex items-center gap-2"
                  >
                    <StopCircle className="w-4 h-4" />
                    Disconnect
                  </button>

                  {!isRecordingMeeting ? (
                    <button
                      onClick={startMeetingRecording}
                      className="px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
                    >
                      <Mic className="w-4 h-4" />
                      Start Recording
                    </button>
                  ) : (
                    <button
                      onClick={stopMeetingRecording}
                      className="px-4 py-2 bg-red-600 rounded-lg hover:bg-red-700 transition flex items-center gap-2 animate-pulse"
                    >
                      <StopCircle className="w-4 h-4" />
                      Stop Recording
                    </button>
                  )}
                </>
              )}
            </div>

            <div className="text-sm text-slate-400">
              <TestStatus status={tests.meetingWs.status}>
                Messages received: {tests.meetingWs.messages.length}
              </TestStatus>
            </div>
          </div>
        </div>

        {/* RAG Testing Section */}
        <div className="bg-gradient-to-r from-cyan-500/10 to-blue-500/10 backdrop-blur rounded-lg p-6 mb-6 border border-cyan-500/30">
          <h3 className="font-semibold mb-4 flex items-center gap-2 text-xl">
            <Users className="w-6 h-6 text-cyan-400" />
            RAG Patient Context Testing
          </h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm text-slate-300 mb-2">Patient ID:</label>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={patientId}
                  onChange={(e) => setPatientId(e.target.value)}
                  disabled={!isMeetingConnected}
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500 disabled:opacity-50"
                  placeholder="Enter patient ID (e.g., 3103 or GUID)"
                />
                <button
                  onClick={sendPatientContext}
                  className="px-4 py-2 bg-cyan-600 rounded-lg hover:bg-cyan-700 transition flex items-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  Send Patient Context (HTTP)
                </button>
              </div>
              <div className="text-xs text-slate-400 mt-1">
                Uses HTTP POST to /api/meeting/patient (simpler than WebSocket)
              </div>
            </div>

            {patientContextSent && (
              <div className="text-sm text-cyan-400 flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                Patient context sent. Now ask questions via voice:
              </div>
            )}

            <div className="bg-slate-900 rounded-lg p-4 border border-slate-700">
              <h4 className="text-sm font-semibold text-slate-300 mb-2">Test Questions to Ask via Voice:</h4>
              <div className="text-xs text-slate-400 space-y-1">
                <div>• "What imaging results do we have?"</div>
                <div>• "What is the patient's diagnosis?"</div>
                <div>• "What are the UTC admission criteria?"</div>
                <div>• "What medications is the patient on?"</div>
                <div>• "What are the health scores?"</div>
              </div>
            </div>

            {aiResponses.length > 0 && (
              <div className="bg-slate-900 rounded-lg p-4 border border-cyan-700">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="text-sm font-semibold text-cyan-400">AI Responses ({aiResponses.length}):</h4>
                  <button
                    onClick={() => setAiResponses([])}
                    className="text-xs px-2 py-1 bg-slate-700 rounded hover:bg-slate-600 transition"
                  >
                    Clear
                  </button>
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {aiResponses.map((response, idx) => (
                    <div key={idx} className="bg-slate-800 rounded p-3 border border-slate-700">
                      <div className="flex items-start gap-2">
                        <div className="text-cyan-400 text-xs font-semibold mt-1">🤖</div>
                        <div className="flex-1">
                          <div className="text-xs text-slate-400 mb-1">
                            {new Date(response.timestamp).toLocaleTimeString()}
                          </div>
                          <div className="text-sm text-slate-200">{response.text}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* TTS Test Section */}
        <div className="bg-gradient-to-r from-yellow-500/10 to-orange-500/10 backdrop-blur rounded-lg p-6 mb-6 border border-yellow-500/30">
          <h3 className="font-semibold mb-4 flex items-center gap-2 text-xl">
            <Volume2 className="w-6 h-6 text-yellow-400" />
            Text-to-Speech (via Meeting WebSocket)
          </h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-slate-300 mb-2">Enter text to convert:</label>
              <textarea
                value={customTTSText}
                onChange={(e) => setCustomTTSText(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white resize-none focus:outline-none focus:border-yellow-500"
                rows="3"
                placeholder="Enter text to convert to speech..."
              />
            </div>
            
            <div className="flex flex-wrap gap-3">
              <button
                onClick={testTTSSummary}
                disabled={tests.tts.status === 'running' || !isMeetingConnected}
                className="px-4 py-2 bg-yellow-600 rounded-lg hover:bg-yellow-700 transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {tests.tts.status === 'running' ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Send TTS Request
                  </>
                )}
              </button>
            </div>
            
            {!isMeetingConnected && (
              <div className="text-sm text-orange-400 flex items-center gap-2">
                <Activity className="w-4 h-4" />
                Connect Meeting WebSocket first to receive audio responses
              </div>
            )}
            
            <div className="text-sm text-slate-400">
              <TestStatus status={tests.tts.status}>
                {tests.tts.result?.message || 'Ready to send TTS request'}
              </TestStatus>
            </div>
          </div>
        </div>

        {/* Enrollment Section */}
        <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 backdrop-blur rounded-lg p-6 mb-6 border border-purple-500/30">
          <h3 className="font-semibold mb-4 flex items-center gap-2 text-xl">
            <Users className="w-6 h-6 text-purple-400" />
            Voice Enrollment (Audio Streaming)
          </h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-slate-300 mb-2">Provider UserNum (numeric ID from sGetWelcomeData):</label>
              <input
                type="text"
                value={enrollmentUserNum}
                onChange={(e) => setEnrollmentUserNum(e.target.value)}
                disabled={isEnrolling}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500 disabled:opacity-50"
                placeholder="e.g. 12345 (provider numeric ID)"
              />
              <div className="text-xs text-slate-400 mt-1">
                The backend parses this as parseInt(). Use the numeric UserNum, not the GUID.
              </div>
            </div>
            
            <div className="flex flex-wrap gap-3">
              {!isEnrolling ? (
                <button
                  onClick={startEnrollment}
                  className="px-4 py-2 bg-purple-600 rounded-lg hover:bg-purple-700 transition flex items-center gap-2"
                >
                  <Mic className="w-4 h-4" />
                  Start Enrollment
                </button>
              ) : (
                <button
                  onClick={stopEnrollment}
                  className="px-4 py-2 bg-red-600 rounded-lg hover:bg-red-700 transition flex items-center gap-2 animate-pulse"
                >
                  <StopCircle className="w-4 h-4" />
                  Stop Enrollment
                </button>
              )}
            </div>
            
            {isRecordingEnroll && (
              <div className="text-sm text-purple-400 flex items-center gap-2">
                <Mic className="w-4 h-4 animate-pulse" />
                Recording and streaming audio...
              </div>
            )}
            
            <div className="text-sm text-slate-400">
              <TestStatus status={tests.enrollWs.status}>
                Messages: {tests.enrollWs.messages.length}
              </TestStatus>
            </div>
          </div>
        </div>

        {/* Test Results Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {/* Health Check */}
          <div className="bg-slate-800/50 backdrop-blur rounded-lg p-4 border border-slate-700">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-400" />
              Health Check
            </h3>
            <TestStatus status={tests.health.status}>
              {tests.health.result ? JSON.stringify(tests.health.result) : 'Not tested'}
            </TestStatus>
          </div>

          {/* Python Service */}
          <div className="bg-slate-800/50 backdrop-blur rounded-lg p-4 border border-slate-700">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Send className="w-5 h-5 text-orange-400" />
              Python Eagle Service
            </h3>
            <TestStatus status={tests.python.status}>
              {tests.python.result?.health?.status || 'Not tested'}
            </TestStatus>
            {tests.python.result?.profileCount !== undefined && (
              <div className="mt-2 text-xs text-slate-400">
                Profiles: {tests.python.result.profileCount}
                {tests.python.result?.providerIds?.length > 0 && (
                  <div className="mt-1">IDs: {tests.python.result.providerIds.join(', ')}</div>
                )}
              </div>
            )}
            <button
              onClick={async () => {
                addLog('🔄 Reloading Python profiles from blob storage...', 'info');
                try {
                  const res = await fetch(`${config.pythonUrl}/reload_profiles`, {
                    method: 'POST',
                    headers: { 'ngrok-skip-browser-warning': 'true' },
                  });
                  const data = await res.json();
                  addLog(`✅ Reloaded: ${data.profiles_loaded} profiles — [${(data.provider_ids || []).join(', ')}]`, 'success');
                  updateTest('python', {
                    status: 'success',
                    result: { health: { status: 'ok' }, profileCount: data.profiles_loaded, providerIds: data.provider_ids || [] },
                  });
                } catch (err) {
                  addLog(`❌ Reload failed: ${err.message}`, 'error');
                }
              }}
              className="mt-2 w-full text-xs px-3 py-1.5 bg-orange-600 hover:bg-orange-500 rounded transition text-white"
            >
              🔄 Reload Profiles from Blob
            </button>
          </div>
        </div>

        {/* Live Logs */}
        <div className="bg-slate-800/50 backdrop-blur rounded-lg p-4 border border-slate-700">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-semibold flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-cyan-400" />
              Live Logs
            </h3>
            <button
              onClick={() => setWsLogs([])}
              className="text-xs px-3 py-1 bg-slate-700 rounded hover:bg-slate-600 transition"
            >
              Clear
            </button>
          </div>
          <div ref={logsContainerRef}
 className="bg-slate-900 rounded p-3 h-64 overflow-y-auto font-mono text-xs space-y-1">
            {wsLogs.length === 0 ? (
              <div className="text-slate-500 text-center py-8">No logs yet. Run a test to see activity.</div>
            ) : (
              wsLogs.map((log, i) => (
                <div key={i} className={`${
                  log.type === 'error' ? 'text-red-400' :
                  log.type === 'success' ? 'text-green-400' :
                  log.type === 'ws' ? 'text-blue-400' :
                  'text-slate-300'
                }`}>
                  <span className="text-slate-500">[{log.time}]</span> {log.message}
                </div>
              ))
            )}

          </div>
        </div>

        {/* Configuration */}
        <div className="mt-6 bg-slate-800/50 backdrop-blur rounded-lg p-4 border border-slate-700">
          <h3 className="font-semibold mb-3 text-sm text-slate-400">Configuration</h3>
          <div className="grid md:grid-cols-3 gap-3 text-xs font-mono">
            <div>
              <div className="text-slate-500">Backend HTTP:</div>
              <div className="text-slate-300 break-all">{config.backendUrl}</div>
            </div>
            <div>
              <div className="text-slate-500">Backend WS:</div>
              <div className="text-slate-300 break-all">{config.backendWs}</div>
            </div>
            <div>
              <div className="text-slate-500">Python Service:</div>
              <div className="text-slate-300 break-all">{config.pythonUrl}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}