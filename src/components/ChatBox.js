import React, { useState, useRef, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react';
import { Send, Loader, Bot, User, AlertCircle, Mic, MicOff, Volume2, VolumeX, Radio } from 'lucide-react';
import { CHAT_ENDPOINT, API_BASE } from '../config';

// WebSocket URL (derive from API_BASE)
const WS_BASE = API_BASE.replace(/^http/, 'ws');

// Global audio manager — only one audio plays at a time across all ChatBox instances
let currentAudioElement = null;

function stopAllAudio() {
  if (currentAudioElement) {
    currentAudioElement.pause();
    currentAudioElement.currentTime = 0;
    currentAudioElement = null;
  }
}

function playAudioBase64(base64Data, format = 'ogg-opus', onEnd) {
  stopAllAudio();

  const mimeType = format === 'ogg-opus' ? 'audio/ogg; codecs=opus' : 'audio/wav';
  const byteChars = atob(base64Data);
  const byteArr = new Uint8Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) {
    byteArr[i] = byteChars.charCodeAt(i);
  }
  const blob = new Blob([byteArr], { type: mimeType });
  const url = URL.createObjectURL(blob);

  const audio = new Audio(url);
  audio.onended = () => {
    URL.revokeObjectURL(url);
    currentAudioElement = null;
    onEnd?.();
  };
  audio.onerror = () => {
    URL.revokeObjectURL(url);
    currentAudioElement = null;
    onEnd?.();
  };
  currentAudioElement = audio;
  audio.play().catch(() => onEnd?.());
}

/**
 * Reusable ChatBox component for FOCUS AI (Avery)
 *
 * Props:
 *  - token: JWT token for auth
 *  - context: 'welcome' | 'inside_scrum' | 'outside_scrum'
 *  - contextData: additional context (e.g., selected patient, unit info)
 *  - title: chat panel title
 *  - placeholder: input placeholder text
 *  - suggestedQuestions: array of quick-ask buttons
 *  - enableVoice: boolean — mic button, WebSocket STT/TTS through backend
 */
const ChatBox = forwardRef(function ChatBox({ token, context, contextData = {}, title, placeholder, suggestedQuestions = [], enableVoice = false }, ref) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [listening, setListening] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(enableVoice);
  const [speaking, setSpeaking] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [wsConnected, setWsConnected] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const wsRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const audioContextRef = useRef(null);
  const processorRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      _disconnectWs();
      _stopMic();
    };
  }, []);

  // Update WS context when contextData changes
  useEffect(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'context',
        context,
        contextData,
      }));
    }
  }, [context, contextData]);

  // ---- Fetch a single-use ticket for WebSocket auth ----
  const _getWsTicket = async () => {
    console.log('[ChatBox] Fetching WS ticket from:', `${API_BASE}/api/auth/ws-ticket`);
    const res = await fetch(`${API_BASE}/api/auth/ws-ticket`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    console.log('[ChatBox] Ticket response status:', res.status);
    const text = await res.text();
    console.log('[ChatBox] Ticket response body:', text);
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(`Ticket endpoint returned non-JSON (${res.status}): ${text.substring(0, 200)}`);
    }
    if (!data.success || !data.ticket) {
      throw new Error(data.message || `Ticket failed (${res.status}): ${text.substring(0, 200)}`);
    }
    return data.ticket;
  };

  // ---- WebSocket connection ----
  const _connectWs = useCallback(async () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      return;
    }

    // Get single-use ticket first
    let ticket;
    try {
      ticket = await _getWsTicket();
    } catch (err) {
      console.error('[ChatBox] Failed to get WS ticket:', err);
      setError('Failed to authenticate WebSocket');
      throw err;
    }

    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`${WS_BASE}/ws/chat?ticket=${ticket}`);

      ws.onopen = () => {
        console.log('[ChatBox] WS connected');
        setWsConnected(true);
        // Send context immediately
        ws.send(JSON.stringify({ type: 'context', context, contextData }));
        // Send conversation history
        const history = messages.map(m => ({ role: m.role, content: m.content }));
        if (history.length > 0) {
          ws.send(JSON.stringify({ type: 'history', data: history }));
        }
        resolve();
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          _handleWsMessage(msg);
        } catch (e) {
          console.error('[ChatBox] WS parse error:', e);
        }
      };

      ws.onerror = (err) => {
        console.error('[ChatBox] WS error:', err);
        setError('Voice connection error');
        reject(err);
      };

      ws.onclose = () => {
        console.log('[ChatBox] WS disconnected');
        setWsConnected(false);
        setListening(false);
        wsRef.current = null;
      };

      wsRef.current = ws;
    });
  }, [token, context, contextData, messages]);

  const _disconnectWs = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setWsConnected(false);
  };

  // ---- Handle incoming WS messages ----
  const _handleWsMessage = useCallback((msg) => {
    switch (msg.type) {
      case 'interim':
        setInterimText(msg.text);
        break;

      case 'transcript':
        setInterimText('');
        // Add user message to chat
        setMessages(prev => [...prev, { role: 'user', content: msg.text }]);
        setLoading(true);
        break;

      case 'response':
        setLoading(false);
        setMessages(prev => [
          ...prev,
          {
            role: 'assistant',
            content: msg.text,
            sources: msg.sources,
            isDraft: msg.isDraft,
          },
        ]);
        break;

      case 'audio':
        if (ttsEnabled) {
          setSpeaking(true);
          playAudioBase64(msg.data, msg.format || 'ogg-opus', () => setSpeaking(false));
        }
        break;

      case 'error':
        setLoading(false);
        setError(msg.message);
        setMessages(prev => [
          ...prev,
          { role: 'assistant', content: `Error: ${msg.message}`, isError: true },
        ]);
        break;

      case 'status':
        console.log('[ChatBox] WS status:', msg.status);
        if (msg.status === 'listening') setListening(true);
        if (msg.status === 'stopped') setListening(false);
        break;

      default:
        break;
    }
  }, [ttsEnabled]);

  // ---- Microphone capture → PCM 16kHz 16-bit mono → WS ----
  const _startMic = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true, noiseSuppression: true }
      });
      mediaStreamRef.current = stream;

      const audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
      audioContextRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);

      // ScriptProcessor to capture raw PCM and send to WS
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          const float32 = e.inputBuffer.getChannelData(0);
          // Convert Float32 → Int16 PCM
          const int16 = new Int16Array(float32.length);
          for (let i = 0; i < float32.length; i++) {
            const s = Math.max(-1, Math.min(1, float32[i]));
            int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
          }
          wsRef.current.send(int16.buffer);
        }
      };

      source.connect(processor);
      processor.connect(audioCtx.destination);
    } catch (err) {
      console.error('[ChatBox] Mic error:', err);
      setError(`Microphone error: ${err.message}`);
      throw err;
    }
  };

  const _stopMic = () => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop());
      mediaStreamRef.current = null;
    }
  };

  // ---- Toggle voice listening ----
  const toggleListening = useCallback(async () => {
    if (listening) {
      // Stop
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'stop' }));
      }
      _stopMic();
      setListening(false);
      return;
    }

    // Stop any playing audio
    stopAllAudio();
    setSpeaking(false);
    setError(null);

    try {
      // Connect WS if not connected
      await _connectWs();
      // Start mic capture
      await _startMic();
      // Tell server to start STT
      wsRef.current.send(JSON.stringify({
        type: 'start',
        context,
        contextData,
      }));
    } catch (err) {
      console.error('[ChatBox] Start voice error:', err);
      _stopMic();
    }
  }, [listening, _connectWs, context, contextData]);

  // ---- Text-based send (REST, same as before) ----
  const sendMessage = useCallback(async (text = input) => {
    const msgText = typeof text === 'string' ? text : input;
    if (!msgText.trim() || loading) return;

    const userMessage = { role: 'user', content: msgText.trim() };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setInterimText('');
    setLoading(true);
    setError(null);

    let contextPrefix = '';
    if (context === 'inside_scrum' && contextData.patientName) {
      contextPrefix = `[Context: Inside scrum session. Current patient: ${contextData.patientName} (ID: ${contextData.patientId}). Unit: ${contextData.unitId}] `;
    } else if (context === 'outside_scrum' && contextData.patientName) {
      contextPrefix = `[Context: Outside scrum, 1-on-1 with patient. Current patient: ${contextData.patientName} (ID: ${contextData.patientId}). Unit: ${contextData.unitId}] `;
    } else if (context === 'welcome') {
      contextPrefix = `[Context: Welcome/Dashboard screen. Provider just logged in.] `;
    }

    try {
      const conversationHistory = messages.map(m => ({ role: m.role, content: m.content }));

      const response = await fetch(CHAT_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: contextPrefix + msgText.trim(),
          conversationHistory,
          locationId: contextData.locationId || null,
        }),
      });

      const data = await response.json();

      if (data.success) {
        const replyText = data.data.reply;
        setMessages(prev => [
          ...prev,
          {
            role: 'assistant',
            content: replyText,
            sources: data.data.sources,
            isDraft: data.data.isDraft,
          },
        ]);
      } else {
        setError(data.message || 'Failed to get response');
        setMessages(prev => [
          ...prev,
          { role: 'assistant', content: `Error: ${data.message || 'Failed to get response'}`, isError: true },
        ]);
      }
    } catch (err) {
      setError(err.message);
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: `Network error: ${err.message}`, isError: true },
      ]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }, [input, loading, messages, context, contextData, token]);

  // Expose sendMessage to parent via ref
  useImperativeHandle(ref, () => ({
    sendMessage: (text) => sendMessage(text),
  }), [sendMessage]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    setMessages([]);
    setError(null);
    stopAllAudio();
    setSpeaking(false);
    _disconnectWs();
    _stopMic();
    setListening(false);
  };

  const toggleTts = () => {
    if (ttsEnabled) {
      stopAllAudio();
      setSpeaking(false);
    }
    setTtsEnabled(!ttsEnabled);
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-xl shadow-lg border border-gray-200">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-t-xl">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-blue-600" />
          <h3 className="font-semibold text-gray-800">{title}</h3>
          {enableVoice && (
            <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-medium">VOICE</span>
          )}
          {enableVoice && wsConnected && (
            <Radio className="w-3 h-3 text-green-500" />
          )}
        </div>
        <div className="flex items-center gap-1">
          {enableVoice && (
            <button
              onClick={toggleTts}
              title={ttsEnabled ? 'Mute Avery voice' : 'Enable Avery voice'}
              className={`p-1.5 rounded transition-colors ${
                ttsEnabled ? 'text-blue-600 hover:bg-blue-50' : 'text-gray-400 hover:bg-gray-100'
              }`}
            >
              {ttsEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
          )}
          <button
            onClick={clearChat}
            className="text-xs text-gray-500 hover:text-red-500 px-2 py-1 rounded hover:bg-red-50 transition-colors"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[300px] max-h-[500px]">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 py-8">
            <Bot className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-sm">
              {enableVoice
                ? 'Hi, I\'m Avery. Tap the mic to speak or type your question below.'
                : 'Ask Avery anything about patients, schedules, or clinical data.'}
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'assistant' && (
              <div className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center">
                {msg.isError ? (
                  <AlertCircle className="w-4 h-4 text-red-500" />
                ) : (
                  <Bot className="w-4 h-4 text-blue-600" />
                )}
              </div>
            )}
            <div
              className={`max-w-[80%] rounded-lg px-4 py-2.5 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : msg.isError
                  ? 'bg-red-50 text-red-700 border border-red-200'
                  : 'bg-gray-100 text-gray-800'
              }`}
            >
              {msg.isDraft && (
                <span className="inline-block bg-yellow-200 text-yellow-800 text-xs px-2 py-0.5 rounded mb-1 font-medium">
                  DRAFT
                </span>
              )}
              <div className="whitespace-pre-wrap">{msg.content}</div>
              {msg.sources && msg.sources.length > 0 && (
                <div className="mt-2 pt-2 border-t border-gray-200 text-xs text-gray-500">
                  Sources: {msg.sources.map(s => s.type).join(', ')}
                </div>
              )}
            </div>
            {msg.role === 'user' && (
              <div className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center">
                <User className="w-4 h-4 text-white" />
              </div>
            )}
          </div>
        ))}

        {/* Interim STT text while user is speaking */}
        {interimText && (
          <div className="flex gap-3 justify-end">
            <div className="max-w-[80%] rounded-lg px-4 py-2.5 text-sm bg-blue-200 text-blue-800 italic">
              {interimText}...
            </div>
            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-400 flex items-center justify-center">
              <Mic className="w-4 h-4 text-white animate-pulse" />
            </div>
          </div>
        )}

        {loading && (
          <div className="flex gap-3 items-center">
            <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center">
              <Loader className="w-4 h-4 text-blue-600 animate-spin" />
            </div>
            <div className="bg-gray-100 rounded-lg px-4 py-2.5 text-sm text-gray-500">
              Avery is thinking...
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-gray-200 p-3">
        {/* Listening indicator */}
        {listening && (
          <div className="flex items-center gap-2 mb-2 px-2">
            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            <span className="text-xs text-red-600 font-medium">Listening... speak now</span>
          </div>
        )}
        {/* Speaking indicator */}
        {speaking && (
          <div className="flex items-center gap-2 mb-2 px-2">
            <Volume2 className="w-3 h-3 text-blue-500 animate-pulse" />
            <span className="text-xs text-blue-600 font-medium">Avery speaking...</span>
            <button
              onClick={() => { stopAllAudio(); setSpeaking(false); }}
              className="text-[10px] text-red-500 hover:text-red-700 underline"
            >
              Stop
            </button>
          </div>
        )}
        <div className="flex gap-2">
          {enableVoice && (
            <button
              onClick={toggleListening}
              disabled={loading || !token}
              className={`px-3 py-2.5 rounded-lg transition-colors ${
                listening
                  ? 'bg-red-500 text-white hover:bg-red-600 animate-pulse'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              } disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed`}
              title={listening ? 'Stop listening' : 'Start voice (Azure STT via backend)'}
            >
              {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
          )}
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder || 'Ask Avery...'}
            disabled={loading || !token}
            className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:text-gray-400"
          />
          <button
            onClick={() => sendMessage()}
            disabled={loading || !input.trim() || !token}
            className="px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        {!token && (
          <p className="text-xs text-red-500 mt-1">Please sign in to use the chatbot.</p>
        )}
      </div>
    </div>
  );
});

export default ChatBox;
