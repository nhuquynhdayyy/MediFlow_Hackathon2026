import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 60000,
  headers: { 'Content-Type': 'application/json' },
})

const unwrap = (promise) => promise.then((response) => response.data?.data ?? response.data)

export const fetchDepartments = () => unwrap(api.get('/departments'))
export const fetchDepartmentLoad = () => unwrap(api.get('/department-load'))
export const fetchPredictLoad = () => unwrap(api.get('/predict-load'))
export const fetchOverloadAnalysis = () => unwrap(api.get('/overload-analysis'))

export const fetchPatientOrders = (patientId) => unwrap(api.get(`/patient/${patientId}/orders`))
export const fetchPatientState = (patientId) => unwrap(api.get(`/patient/${patientId}/state`))
export const optimizeRouteAPI = (payload) => unwrap(api.post('/optimize-route', payload))
export const suggestTimeAPI = (payload) => unwrap(api.post('/suggest-time', payload))
export const nowVsLaterAPI = (departments, compareAfterHours = 2) =>
  unwrap(
    api.get('/now-vs-later', {
      params: {
        departments: departments.join(','),
        compare_after_hours: compareAfterHours,
      },
    })
  )
export const updatePatientProgressAPI = (patientId, payload) =>
  unwrap(api.post(`/patient/${patientId}/progress`, payload))
export const patientChatAPI = (patientId, payload) =>
  unwrap(api.post(`/patient/${patientId}/chat`, payload))

export const hospitalOpsChatAPI = (payload) => unwrap(api.post('/hospital/chat', payload))
export const fetchHospitalDashboard = () => unwrap(api.get('/hospital/dashboard'))
export const fetchHospitalPatientFlows = () => unwrap(api.get('/hospital/patient-flows'))
export const updateHospitalPatientFlowStatus = (appointmentId, payload) =>
  unwrap(api.post(`/hospital/patient-flows/${appointmentId}/status`, payload))
export const fetchHospitalStaff = () => unwrap(api.get('/hospital/staff'))
export const createHospitalStaff = (payload) => unwrap(api.post('/hospital/staff', payload))
export const updateHospitalStaff = (staffId, payload) => unwrap(api.put(`/hospital/staff/${staffId}`, payload))
export const deleteHospitalStaff = (staffId) => unwrap(api.delete(`/hospital/staff/${staffId}`))
export const fetchHospitalRooms = () => unwrap(api.get('/hospital/rooms'))
export const createHospitalRoom = (payload) => unwrap(api.post('/hospital/rooms', payload))
export const updateHospitalRoom = (roomId, payload) => unwrap(api.put(`/hospital/rooms/${roomId}`, payload))
export const deleteHospitalRoom = (roomId) => unwrap(api.delete(`/hospital/rooms/${roomId}`))
export const fetchHospitalSystemMetrics = (limit = 20) =>
  unwrap(api.get('/hospital/system-metrics', { params: { limit } }))
export const fetchHospitalMap = () => unwrap(api.get('/hospital/map'))

