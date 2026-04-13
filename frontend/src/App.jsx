import React, { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useStore } from './store'
import { fetchPatients } from './services/api'
import DocAssistPage from './pages/DocAssistPage'
import SettingsBar from './components/SettingsBar'

export default function App() {
  const setPatients = useStore(s => s.setPatients)
  const setActivePatient = useStore(s => s.setActivePatient)
  const setEmr = useStore(s => s.setEmr)

  useEffect(() => {
    fetchPatients()
      .then(list => {
        setPatients(list)
        if (list.length > 0) {
          setActivePatient(list[0])
          setEmr({
            chief_complaint: list[0].chief_complaint,
            symptoms: list[0].symptoms,
            history: list[0].history,
            diagnosis: list[0].diagnosis || '',
            treatment_plan: list[0].treatment_plan || '',
          })
        }
      })
      .catch(() => {
        // Fallback mock nếu backend chưa chạy
        const mock = [
          {
            id: 'P001', name: 'Nguyễn Văn An', age: 65, gender: 'Nam',
            room: 'K1', visit_no: '2847', triage_severity: 'high',
            arrived_at: new Date().toISOString(),
            chief_complaint: 'Đau ngực kèm khó thở từ 2 ngày nay',
            history: 'THA độ II, ĐTĐ type 2',
            symptoms: 'Đau ngực trái lan vai trái, mức 7/10. SpO2: 96%. HA: 155/95. Nhịp tim: 92.',
            current_medications: ['Amlodipine 5mg', 'Metformin 500mg'],
            allergies: '', diagnosis: '', treatment_plan: '',
          },
          {
            id: 'P002', name: 'Trần Thị Bích', age: 42, gender: 'Nữ',
            room: 'K2', visit_no: '2848', triage_severity: 'medium',
            arrived_at: new Date().toISOString(),
            chief_complaint: 'Đau đầu, chóng mặt',
            history: 'Không có tiền sử',
            symptoms: 'Đau đầu âm ỉ 3/10. HA: 110/70. Không sốt.',
            current_medications: [], allergies: '', diagnosis: '', treatment_plan: '',
          },
          {
            id: 'P003', name: 'Lê Hoàng Minh', age: 28, gender: 'Nam',
            room: 'K1', visit_no: '2849', triage_severity: 'low',
            arrived_at: new Date().toISOString(),
            chief_complaint: 'Ho lâu ngày, sốt nhẹ',
            history: 'Không có tiền sử',
            symptoms: 'Ho khan 3 tuần. Sốt 37.8°C buổi chiều. Gầy 2kg/tháng.',
            current_medications: [], allergies: '', diagnosis: '', treatment_plan: '',
          },
        ]
        setPatients(mock)
        setActivePatient(mock[0])
        setEmr({
          chief_complaint: mock[0].chief_complaint,
          symptoms: mock[0].symptoms,
          history: mock[0].history,
          diagnosis: '', treatment_plan: '',
        })
      })
  }, [])

  return (
    <BrowserRouter>
      <div className="flex flex-col h-screen bg-gray-50 overflow-hidden">
        <SettingsBar />
        <Routes>
          <Route path="/" element={<DocAssistPage />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}
