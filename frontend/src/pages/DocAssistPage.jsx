import React from 'react'
import PatientQueue from '../components/PatientQueue'
import EMRForm from '../components/EMRForm'
import AIChatPanel from '../components/AIChatPanel'

export default function DocAssistPage() {
  return (
    <div className="flex flex-1 overflow-hidden">
      <PatientQueue />
      <EMRForm />
      <AIChatPanel />
    </div>
  )
}
