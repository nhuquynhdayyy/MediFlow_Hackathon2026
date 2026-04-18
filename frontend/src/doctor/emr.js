export function normalizeDoctorPrescription(item = {}) {
  const drug = item?.drug || item?.name || item?.generic || ''
  const generic = item?.generic || item?.name || ''
  const dose = item?.dose || item?.dosage || item?.quantity || ''
  const route = item?.route || ''
  const frequency = item?.frequency || ''
  const days = item?.days ?? ''
  const instructions = item?.instructions || item?.usage || item?.note || item?.notes || ''

  if (!drug && !dose && !instructions) return null

  return {
    drug,
    generic,
    dose,
    route,
    frequency,
    days,
    instructions,
  }
}

export function buildInitialDoctorEmr(patient = {}) {
  return {
    chief_complaint: patient.chief_complaint || '',
    symptoms: patient.symptoms || '',
    history: patient.history || '',
    diagnosis: patient.diagnosis || '',
    treatment_plan: patient.treatment_plan || '',
    current_date: patient.current_date || '',
    follow_up_date: patient.follow_up_date || '',
    notes: patient.notes || '',
    prescriptions: (patient.prescriptions || [])
      .map(normalizeDoctorPrescription)
      .filter(Boolean),
    lab_orders: Array.isArray(patient.lab_orders) ? patient.lab_orders : [],
    _labData: [],
    soap: patient.soap || null,
  }
}
