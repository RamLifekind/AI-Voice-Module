/**
 * Configuration for FOCUS UTC Backend Tester
 * Manual OAuth flow (matches main app's Better Auth pattern)
 */

// OAuth configuration — uses the main app's Web-type app registration
export const OAUTH_CONFIG = {
  clientId: '9de823b8-9748-4461-a4ea-b06c6bffd13f',
  tenantId: '45296cf8-0a85-4f08-a78e-624bea2dee95',
  redirectUri: `${window.location.origin}/api/auth/callback/microsoft`,
  authorizeUrl: 'https://login.microsoftonline.com/45296cf8-0a85-4f08-a78e-624bea2dee95/oauth2/v2.0/authorize',
  scope: 'api://7cae726c-e76c-4abb-a584-0c053adad85a/access_as_user openid profile email offline_access',
};

// API endpoints configuration
export const API_BASE = 'https://ai-api-backend-eehacnhvendebpbu.westus2-01.azurewebsites.net';
export const VOICE_BACKEND = 'https://ai-speech-demo-hhhma9dyakhzh0e6.westus2-01.azurewebsites.net';

// Sample test data GUIDs (from tested endpoints)
export const TEST_DATA = {
  locationId: '15380B7E-379C-4E0A-805A-576EBC7929F8',
  unitId: 'A49AD52B-4E9E-4C4F-912C-3DC0D5ECC60F',
  patientId: '0025B8D7-8257-4967-B9F4-11B5D541D75C',
  patientId2: '4A4F88CC-746A-42B1-A827-00F32F92CB3A',
  actionId: 'E5261ADB-57ED-435A-91BB-6ADFE25ED899',
  slotId: '7EFD6095-7741-413C-9545-BFBAE6E1DF76',
  providerUserId: 'AC26D32E-7C56-4E3E-866D-0086936B1238',
};

// ============================================================
// SYNTHETIC PATIENTS (matches chat.repository.js placeholders)
// ============================================================
export const SYNTHETIC_PATIENTS = [
  { id: 3001, name: 'Gilian Negata',  diagnosis: 'Chronic lower back pain, lumbar radiculopathy' },
  { id: 3002, name: 'Maria Santos',   diagnosis: 'Fibromyalgia, anxiety disorder' },
  { id: 3003, name: 'James Wilson',   diagnosis: 'Cervical stenosis, hypertension' },
  { id: 3004, name: 'Anh Nguyen',     diagnosis: 'Knee osteoarthritis, substance use disorder' },
  { id: 3005, name: 'Robert Chen',    diagnosis: 'Scoliosis, depression' },
  { id: 3006, name: 'Lisa Thompson',  diagnosis: 'Sciatica, insomnia' },
  { id: 3007, name: 'Carlos Ramirez', diagnosis: 'Chronic pain syndrome, PTSD' },
  { id: 3008, name: 'Sarah Johnson',  diagnosis: 'Thoracic outlet syndrome' },
];

// ============================================================
// SUGGESTED QUESTIONS — mapped to actual synthetic data
// Each question targets a specific function in chat-tools
// ============================================================

// Welcome screen — schedule overview, cross-patient queries
export const WELCOME_QUESTIONS = [
  // get_daily_schedule
  { q: "Who's on the schedule today?", fn: 'get_daily_schedule', expect: '8 patients across 2 units' },
  { q: "Show me Unit 1 patients for today", fn: 'get_daily_schedule(unit_id=1)', expect: 'Gilian, Maria, James, Anh' },
  { q: "Show me Unit 2 patients for today", fn: 'get_daily_schedule(unit_id=2)', expect: 'Robert, Lisa, Carlos, Sarah' },
  // get_patients_by_filter
  { q: "How many new intakes today?", fn: 'get_patients_by_filter(new_intake)', expect: 'Maria Santos, Anh Nguyen, Carlos Ramirez' },
  { q: "Any non-English speaking patients today?", fn: 'get_patients_by_filter(language)', expect: 'Maria (Spanish), Anh (Vietnamese), Carlos (Spanish)' },
  { q: "Which patients are at risk based on PHQ-9?", fn: 'get_patients_by_filter(risk_phq9)', expect: 'Maria (15), Robert (22), Carlos (12)' },
  // get_unreviewed_items
  { q: "Any unreviewed labs or imaging?", fn: 'get_unreviewed_items(all)', expect: 'HbA1c for Gilian, Lipid for James, X-Ray for Gilian, MRI for James' },
  { q: "Show unreviewed imaging only", fn: 'get_unreviewed_items(imaging)', expect: 'X-Ray Lower Back (Gilian), CT Scan (Gilian), MRI Cervical (James)' },
  { q: "Any unreviewed lab results?", fn: 'get_unreviewed_items(labs)', expect: 'HbA1c 6.8% for Gilian, Lipid Panel for James' },
  // get_procedures_today
  { q: "What procedures are planned for today?", fn: 'get_procedures_today', expect: '5 procedures: CMT, Exercise, Visit, Psychotherapy, Acupuncture' },
  // search_patient
  { q: "Find patient Gilian", fn: 'search_patient', expect: 'Gilian Negata, ID 3001' },
  { q: "Search for patient Santos", fn: 'search_patient', expect: 'Maria Santos, ID 3002' },
];

// Inside scrum — single patient deep dive (uses selected patient from dropdown)
export const INSIDE_SCRUM_QUESTIONS = [
  { q: "Give me a 30-second synopsis of this patient", fn: 'get_patient_detail', expect: 'Patient overview with diagnosis and GHS' },
  { q: "What is the diagnosis?", fn: 'get_patient_detail', expect: 'Patient diagnosis' },
  { q: "What are the current care actions?", fn: 'get_patient_detail', expect: 'Care actions list' },
  { q: "Global Health Score breakdown", fn: 'get_patient_detail', expect: 'GHS scores' },
  { q: "Show UDS results", fn: 'get_patient_uds', expect: 'UDS results for selected patient' },
  { q: "Show lab results", fn: 'get_patient_labs', expect: 'Lab results for selected patient' },
  { q: "What is the PHQ-9 score?", fn: 'get_patient_phq9', expect: 'PHQ-9 score' },
  { q: "Show imaging reports", fn: 'get_patient_reports', expect: 'Imaging reports' },
  { q: "What does the latest MRI show?", fn: 'get_patient_reports', expect: 'MRI findings' },
  { q: "Draft a patient education note about exercises", fn: 'none (DRAFT)', expect: 'AI-generated DRAFT content' },
];

// Outside scrum — single patient context (same as inside scrum, but with voice chat)
// Provider is with a patient outside the scrum meeting (1-on-1 session)
export const OUTSIDE_SCRUM_QUESTIONS = [
  // get_patient_detail
  { q: "Give me a synopsis of this patient", fn: 'get_patient_detail', expect: 'Depends on selected patient' },
  { q: "What is the diagnosis?", fn: 'get_patient_detail', expect: 'Patient diagnosis from synthetic data' },
  { q: "What are the current care actions?", fn: 'get_patient_detail', expect: 'Care actions list from patient data' },
  { q: "Global Health Score breakdown", fn: 'get_patient_detail', expect: 'GHS scores for selected patient' },
  // get_patient_uds
  { q: "Show UDS results", fn: 'get_patient_uds', expect: 'UDS results for selected patient' },
  // get_patient_labs
  { q: "Show lab results", fn: 'get_patient_labs', expect: 'Lab results for selected patient' },
  // get_patient_phq9
  { q: "What is the PHQ-9 score?", fn: 'get_patient_phq9', expect: 'PHQ-9 score for selected patient' },
  // get_patient_reports
  { q: "Show imaging reports", fn: 'get_patient_reports', expect: 'Imaging reports for selected patient' },
  { q: "What does the latest MRI show?", fn: 'get_patient_reports', expect: 'MRI findings for selected patient' },
  // Draft content
  { q: "Draft a patient education note about exercises", fn: 'none (DRAFT)', expect: 'AI-generated DRAFT content' },
];

// All 19 API endpoints + chat endpoint (#20)
export const ENDPOINTS = [
  {
    id: 1,
    method: 'GET',
    name: 'Get Provider Profile',
    path: '/api/providers/me',
    description: 'Returns the logged-in provider profile. No params needed - uses JWT.',
    url: () => `${API_BASE}/api/providers/me`,
  },
  {
    id: 2,
    method: 'GET',
    name: 'Get Units for Today',
    path: '/api/units?locationId=<GUID>',
    description: 'Get all units scheduled for today at a given location.',
    url: () => `${API_BASE}/api/units?locationId=${TEST_DATA.locationId}`,
  },
  {
    id: 3,
    method: 'GET',
    name: 'Get Patient Queue',
    path: '/api/units/:unitId/patients',
    description: 'Get the patient queue for a specific unit.',
    url: () => `${API_BASE}/api/units/${TEST_DATA.unitId}/patients`,
  },
  {
    id: 4,
    method: 'POST',
    name: 'Initiate Scrum',
    path: '/api/units/:unitId/scrum/initiate',
    description: 'Initiate a scrum session for a unit.',
    url: () => `${API_BASE}/api/units/${TEST_DATA.unitId}/scrum/initiate`,
  },
  {
    id: 5,
    method: 'POST',
    name: 'Start Scrum',
    path: '/api/units/:unitId/scrum/start',
    description: 'Start the scrum session (transition to in_progress).',
    url: () => `${API_BASE}/api/units/${TEST_DATA.unitId}/scrum/start`,
  },
  {
    id: 6,
    method: 'PUT',
    name: 'Complete Patient Scrum',
    path: '/api/units/:unitId/patients/:patientId/complete',
    description: 'Mark a patient scrum discussion as complete.',
    url: () => `${API_BASE}/api/units/${TEST_DATA.unitId}/patients/${TEST_DATA.patientId2}/complete`,
  },
  {
    id: 7,
    method: 'GET',
    name: 'Get Patients Paged',
    path: '/api/patients?page=1&limit=20',
    description: 'Get a paginated list of all patients.',
    url: () => `${API_BASE}/api/patients?page=1&limit=20`,
  },
  {
    id: 8,
    method: 'GET',
    name: 'Search Patients',
    path: '/api/patients/search?q=<term>',
    description: 'Search patients by name.',
    url: () => `${API_BASE}/api/patients/search?q=John`,
  },
  {
    id: 9,
    method: 'GET',
    name: 'Search Care Actions',
    path: '/api/care-actions/search?q=<term>&topN=10',
    description: 'Search CPT codes / service catalog.',
    url: () => `${API_BASE}/api/care-actions/search?q=yoga&topN=10`,
  },
  {
    id: 10,
    method: 'POST',
    name: 'Create Care Action',
    path: '/api/units/:unitId/patients/:patientId/care-actions',
    description: 'Add a new care action to a patient during scrum.',
    url: () => `${API_BASE}/api/units/${TEST_DATA.unitId}/patients/${TEST_DATA.patientId}/care-actions`,
    body: { serviceCode: '99215', serviceName: 'Medication Management', disciplineCode: 'behavioral' },
  },
  {
    id: 11,
    method: 'PUT',
    name: 'Update Care Action',
    path: '/api/units/:unitId/patients/:patientId/care-actions/:actionId',
    description: 'Update an existing care action. Use actionId from create (#10).',
    url: () => `${API_BASE}/api/units/${TEST_DATA.unitId}/patients/${TEST_DATA.patientId}/care-actions/${TEST_DATA.actionId}`,
    body: { serviceCode: '97110', serviceName: 'Therapeutic Exercise', disciplineCode: 'physical_therapy' },
  },
  {
    id: 12,
    method: 'DELETE',
    name: 'Delete Care Action',
    path: '/api/units/:unitId/patients/:patientId/care-actions/:actionId',
    description: 'Delete a care action from a patient.',
    url: () => `${API_BASE}/api/units/${TEST_DATA.unitId}/patients/${TEST_DATA.patientId}/care-actions/${TEST_DATA.actionId}`,
  },
  {
    id: 13,
    method: 'PUT',
    name: 'Approve Care Action',
    path: '/api/units/:unitId/patients/:patientId/care-actions/:actionId/approve',
    description: 'Approve a care action. Approver from JWT.',
    url: () => `${API_BASE}/api/units/${TEST_DATA.unitId}/patients/${TEST_DATA.patientId}/care-actions/${TEST_DATA.actionId}/approve`,
  },
  {
    id: 14,
    method: 'PATCH',
    name: 'Mark Attendance',
    path: '/api/units/:unitId/patients/:patientId/care-actions/:actionId/attendance',
    description: 'Mark patient attendance for a care action (present/absent).',
    url: () => `${API_BASE}/api/units/${TEST_DATA.unitId}/patients/${TEST_DATA.patientId}/care-actions/${TEST_DATA.actionId}/attendance`,
    body: { attendance: 'present' },
  },
  {
    id: 15,
    method: 'PATCH',
    name: 'Record Outcome',
    path: '/api/units/:unitId/patients/:patientId/care-actions/:actionId/outcome',
    description: 'Record the outcome of a care action after session.',
    url: () => `${API_BASE}/api/units/${TEST_DATA.unitId}/patients/${TEST_DATA.patientId}/care-actions/${TEST_DATA.actionId}/outcome`,
    body: { outcome: 'completed', outcomeNotes: 'Patient tolerated treatment well. Range of motion improved.' },
  },
  {
    id: 16,
    method: 'POST',
    name: 'Create Flow Plan',
    path: '/api/units/:unitId/flow-plan',
    description: 'Create the flow coordination plan for a unit after scrum.',
    url: () => `${API_BASE}/api/units/${TEST_DATA.unitId}/flow-plan`,
  },
  {
    id: 17,
    method: 'GET',
    name: 'Get Flow Schedule',
    path: '/api/units/:unitId/flow-schedule',
    description: 'Get the flow schedule for a unit.',
    url: () => `${API_BASE}/api/units/${TEST_DATA.unitId}/flow-schedule`,
  },
  {
    id: 18,
    method: 'PATCH',
    name: 'Assign Slot Provider',
    path: '/api/units/:unitId/flow-schedule/slots/:slotId/provider',
    description: 'Assign a provider to a flow slot.',
    url: () => `${API_BASE}/api/units/${TEST_DATA.unitId}/flow-schedule/slots/${TEST_DATA.slotId}/provider`,
    body: { disciplineCode: 'medical', providerUserId: TEST_DATA.providerUserId },
  },
  {
    id: 19,
    method: 'PATCH',
    name: 'Assign Slot Patient',
    path: '/api/units/:unitId/flow-schedule/slots/:slotId/patient',
    description: 'Assign a patient to a flow slot.',
    url: () => `${API_BASE}/api/units/${TEST_DATA.unitId}/flow-schedule/slots/${TEST_DATA.slotId}/patient`,
    body: { patientId: '3C707AC9-85AA-4778-849E-385100E323B9' },
  },
  {
    id: 20,
    method: 'POST',
    name: 'AI Chat',
    path: '/api/chat',
    description: 'Send a message to FOCUS AI chatbot. Uses function calling with synthetic data.',
    url: () => `${API_BASE}/api/chat`,
    body: { message: "Who's on the schedule today?", conversationHistory: [] },
  },
  {
    id: 21,
    method: 'POST',
    name: 'AI Batch Test (Single Patient)',
    path: '/api/admin/ai-batch/test',
    description: 'Generate AI scrum content for a single synthetic patient. Returns: presentation, encounter prep, last visit summary, trends, care action suggestions.',
    url: () => `${API_BASE}/api/admin/ai-batch/test`,
    body: { patientId: 3001 },
  },
  {
    id: 22,
    method: 'POST',
    name: 'AI Batch Test (All Patients)',
    path: '/api/admin/ai-batch/test-all',
    description: 'Generate AI scrum content for ALL synthetic patients (3001, 3002, 3003, 3005). Takes ~30s.',
    url: () => `${API_BASE}/api/admin/ai-batch/test-all`,
  },
];

// Chat endpoint
export const CHAT_ENDPOINT = `${API_BASE}/api/chat`;
