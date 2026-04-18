export const DEPT_META = {
  Registration: { vi: 'Tiếp nhận', group: 'Hành chính', roomCode: 'P101', side: 'Cánh trái', note: 'Ngay sảnh vào' },
  Lab: { vi: 'Xét nghiệm', group: 'Cận lâm sàng', roomCode: 'P201', side: 'Cánh phải', note: 'Sau quầy thuốc' },
  Imaging: { vi: 'Chẩn đoán hình ảnh', group: 'Cận lâm sàng', roomCode: 'P202', side: 'Cánh phải', note: 'Đối diện khu xét nghiệm' },
  Pharmacy: { vi: 'Quầy thuốc', group: 'Cận lâm sàng', roomCode: 'P203', side: 'Cánh phải', note: 'Gần lối ra' },
  Internal: { vi: 'Nội tổng quát', group: 'Nội khoa', roomCode: 'P301', side: 'Trung tâm', note: 'Cuối hành lang chính' },
  Cardiology: { vi: 'Tim mạch', group: 'Nội khoa', roomCode: 'P302', side: 'Cánh phải', note: 'Sau khu nội tổng quát' },
  Neurology: { vi: 'Thần kinh', group: 'Nội khoa', roomCode: 'P303', side: 'Cánh trái', note: 'Bên trái nội tổng quát' },
  Gastroenterology: { vi: 'Tiêu hóa', group: 'Nội khoa', roomCode: 'P304', side: 'Cánh trái', note: 'Cuối hành lang trái' },
  Pulmonology: { vi: 'Hô hấp', group: 'Nội khoa', roomCode: 'P305', side: 'Trung tâm', note: 'Cạnh thang máy' },
  Endocrinology: { vi: 'Nội tiết', group: 'Nội khoa', roomCode: 'P306', side: 'Trung tâm', note: 'Gần phòng nội tổng quát' },
  Nephrology: { vi: 'Thận', group: 'Nội khoa', roomCode: 'P307', side: 'Cánh phải', note: 'Bên cạnh tim mạch' },
  Oncology: { vi: 'Ung bướu', group: 'Nội khoa', roomCode: 'P308', side: 'Cánh phải', note: 'Cuối hành lang phải' },
  Orthopedics: { vi: 'Chấn thương chỉnh hình', group: 'Ngoại khoa', roomCode: 'P401', side: 'Cánh trái', note: 'Gần khu cấp cứu' },
  Rehabilitation: { vi: 'Phục hồi chức năng', group: 'Ngoại khoa', roomCode: 'P402', side: 'Cánh trái', note: 'Sau phòng chấn thương' },
  ENT: { vi: 'Tai Mũi Họng', group: 'TMH', roomCode: 'P501', side: 'Cánh phải', note: 'Đầu hành lang phải' },
  Pediatrics: { vi: 'Nhi', group: 'Sản - Nhi', roomCode: 'P601', side: 'Cánh trái', note: 'Gần khu vui chơi trẻ em' },
  OBGYN: { vi: 'Sản phụ khoa', group: 'Sản - Nhi', roomCode: 'P602', side: 'Cánh trái', note: 'Tầng trên khu nhi' },
  Dermatology: { vi: 'Da liễu', group: 'Khác', roomCode: 'P701', side: 'Trung tâm', note: 'Gần quầy hướng dẫn' },
}

export const viName = (department) => DEPT_META[department]?.vi || department
export const groupName = (department) => DEPT_META[department]?.group || 'Khác'
export const roomCode = (department) => DEPT_META[department]?.roomCode || 'N/A'
export const roomSide = (department) => DEPT_META[department]?.side || 'Khu trung tâm'
