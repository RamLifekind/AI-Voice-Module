import React, { useState } from 'react';
import { Play, CheckCircle, XCircle, Loader, ChevronDown, ChevronUp, Copy } from 'lucide-react';
import { ENDPOINTS } from '../config';

const METHOD_COLORS = {
  GET: 'bg-green-100 text-green-700',
  POST: 'bg-blue-100 text-blue-700',
  PUT: 'bg-yellow-100 text-yellow-700',
  PATCH: 'bg-purple-100 text-purple-700',
  DELETE: 'bg-red-100 text-red-700',
};

function EndpointCard({ endpoint, token, onResult }) {
  const [status, setStatus] = useState('idle'); // idle | running | success | error
  const [response, setResponse] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [editableBody, setEditableBody] = useState(
    endpoint.body ? JSON.stringify(endpoint.body, null, 2) : ''
  );

  const runTest = async () => {
    if (!token) return;
    setStatus('running');
    setResponse(null);

    try {
      const url = endpoint.url();
      const options = {
        method: endpoint.method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      };

      if (['POST', 'PUT', 'PATCH'].includes(endpoint.method) && editableBody) {
        try {
          options.body = editableBody;
        } catch (e) {
          setStatus('error');
          setResponse({ error: 'Invalid JSON body' });
          return;
        }
      }

      const startTime = Date.now();
      const res = await fetch(url, options);
      const duration = Date.now() - startTime;
      const data = await res.json();

      setStatus(data.success ? 'success' : 'error');
      setResponse({ ...data, _duration: duration, _status: res.status });
      setExpanded(true);
      onResult?.(endpoint.id, data.success ? 'success' : 'error');
    } catch (err) {
      setStatus('error');
      setResponse({ error: err.message });
      onResult?.(endpoint.id, 'error');
    }
  };

  const copyResponse = () => {
    navigator.clipboard.writeText(JSON.stringify(response, null, 2));
  };

  const copyUrl = () => {
    navigator.clipboard.writeText(endpoint.url());
  };

  return (
    <div className={`border rounded-lg overflow-hidden transition-all ${
      status === 'success' ? 'border-green-300' :
      status === 'error' ? 'border-red-300' :
      'border-gray-200'
    }`}>
      {/* Header */}
      <div className="flex items-center gap-3 p-3 bg-gray-50">
        <span className={`text-xs font-mono font-bold px-2 py-1 rounded ${METHOD_COLORS[endpoint.method]}`}>
          {endpoint.method}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm text-gray-800">#{endpoint.id} {endpoint.name}</span>
            {status === 'success' && <CheckCircle className="w-4 h-4 text-green-500" />}
            {status === 'error' && <XCircle className="w-4 h-4 text-red-500" />}
            {status === 'running' && <Loader className="w-4 h-4 text-blue-500 animate-spin" />}
          </div>
          <p className="text-xs text-gray-500 truncate">{endpoint.path}</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={copyUrl}
            title="Copy URL"
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded transition-colors"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={runTest}
            disabled={!token || status === 'running'}
            className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            <Play className="w-3 h-3" />
            Test
          </button>
          {response && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded transition-colors"
            >
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>

      {/* Description */}
      <div className="px-3 py-1.5 text-xs text-gray-500 bg-white border-t border-gray-100">
        {endpoint.description}
      </div>

      {/* URL */}
      <div className="px-3 py-1 bg-gray-800 text-xs text-green-400 font-mono overflow-x-auto">
        {endpoint.method} {endpoint.url()}
      </div>

      {/* Request Body (editable) */}
      {endpoint.body && (
        <div className="border-t border-gray-200">
          <div className="px-3 py-1 text-xs font-medium text-gray-500 bg-gray-50">Request Body:</div>
          <textarea
            value={editableBody}
            onChange={(e) => setEditableBody(e.target.value)}
            className="w-full px-3 py-2 text-xs font-mono bg-gray-900 text-yellow-300 resize-y min-h-[60px]"
            rows={Math.min(editableBody.split('\n').length, 8)}
          />
        </div>
      )}

      {/* Response */}
      {expanded && response && (
        <div className="border-t border-gray-200">
          <div className="flex items-center justify-between px-3 py-1 bg-gray-50">
            <span className="text-xs font-medium text-gray-500">
              Response {response._status && `(${response._status})`} {response._duration && `- ${response._duration}ms`}
            </span>
            <button onClick={copyResponse} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
              <Copy className="w-3 h-3" /> Copy
            </button>
          </div>
          <pre className="px-3 py-2 text-xs font-mono bg-gray-900 text-gray-300 overflow-auto max-h-[300px] whitespace-pre-wrap">
            {JSON.stringify(response, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

export default function EndpointTester({ token }) {
  const [results, setResults] = useState({});
  const [runningAll, setRunningAll] = useState(false);

  const handleResult = (id, status) => {
    setResults(prev => ({ ...prev, [id]: status }));
  };

  const successCount = Object.values(results).filter(r => r === 'success').length;
  const errorCount = Object.values(results).filter(r => r === 'error').length;

  return (
    <div className="space-y-4">
      {/* Summary Bar */}
      <div className="flex items-center justify-between bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div>
          <h3 className="font-semibold text-gray-800">API Endpoint Tester</h3>
          <p className="text-xs text-gray-500">19 endpoints across providers, units, patients, care actions, and flow schedule</p>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-green-600 font-medium">{successCount} passed</span>
          <span className="text-red-600 font-medium">{errorCount} failed</span>
          <span className="text-gray-400">{19 - successCount - errorCount} pending</span>
        </div>
      </div>

      {!token && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-700">
          Please sign in first to test endpoints. The JWT token will be automatically used.
        </div>
      )}

      {/* Endpoint Groups */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-1">Provider & Units (#1-#3)</h4>
        {ENDPOINTS.filter(e => e.id <= 3).map(ep => (
          <EndpointCard key={ep.id} endpoint={ep} token={token} onResult={handleResult} />
        ))}
      </div>

      <div className="space-y-2">
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-1">Scrum Session (#4-#6)</h4>
        {ENDPOINTS.filter(e => e.id >= 4 && e.id <= 6).map(ep => (
          <EndpointCard key={ep.id} endpoint={ep} token={token} onResult={handleResult} />
        ))}
      </div>

      <div className="space-y-2">
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-1">Patient Search (#7-#8)</h4>
        {ENDPOINTS.filter(e => e.id >= 7 && e.id <= 8).map(ep => (
          <EndpointCard key={ep.id} endpoint={ep} token={token} onResult={handleResult} />
        ))}
      </div>

      <div className="space-y-2">
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-1">Care Actions (#9-#15)</h4>
        {ENDPOINTS.filter(e => e.id >= 9 && e.id <= 15).map(ep => (
          <EndpointCard key={ep.id} endpoint={ep} token={token} onResult={handleResult} />
        ))}
      </div>

      <div className="space-y-2">
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-1">Flow Schedule (#16-#19)</h4>
        {ENDPOINTS.filter(e => e.id >= 16 && e.id <= 19).map(ep => (
          <EndpointCard key={ep.id} endpoint={ep} token={token} onResult={handleResult} />
        ))}
      </div>
    </div>
  );
}
