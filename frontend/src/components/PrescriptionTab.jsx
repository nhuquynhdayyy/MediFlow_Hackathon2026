import React, { useState, useMemo, useRef, useEffect } from 'react'
import { useStore } from '../store'
import { aiPrescription, aiDrugSuggest } from '../services/api'
import { toast } from 'react-hot-toast'
import { Sparkles, Loader2, Plus, Trash2, Search, X, Pill, AlertCircle, Check } from 'lucide-react'

// ─── BỘ DATA THUỐC ĐẦY ĐỦ ────────────────────────────────────────────────────
const DRUG_DATABASE = [
  // ── KHÁNG SINH ──────────────────────────────────────────────────────────────
  { drug: 'Amoxicillin 250mg', generic: 'Amoxicillin', dose: '250mg', route: 'Uống', frequency: '3 lần/ngày', days: 7, instructions: 'Uống sau ăn, hoàn thành hết liệu trình', categories: ['kháng sinh'], keywords: ['viêm họng','nhiễm khuẩn','viêm tai giữa','trẻ em'] },
  { drug: 'Amoxicillin 500mg', generic: 'Amoxicillin', dose: '500mg', route: 'Uống', frequency: '3 lần/ngày', days: 7, instructions: 'Uống sau ăn, hoàn thành hết liệu trình', categories: ['kháng sinh'], keywords: ['viêm họng','viêm phổi','nhiễm khuẩn','viêm xoang'] },
  { drug: 'Amoxicillin-Clavulanate 375mg', generic: 'Co-amoxiclav', dose: '375mg', route: 'Uống', frequency: '3 lần/ngày', days: 7, instructions: 'Uống ngay trước bữa ăn để giảm khó chịu dạ dày', categories: ['kháng sinh'], keywords: ['viêm họng','viêm xoang','nhiễm khuẩn','kháng penicillin'] },
  { drug: 'Amoxicillin-Clavulanate 625mg', generic: 'Co-amoxiclav', dose: '625mg', route: 'Uống', frequency: '2-3 lần/ngày', days: 7, instructions: 'Uống ngay trước bữa ăn', categories: ['kháng sinh'], keywords: ['viêm họng','viêm xoang','nhiễm khuẩn','viêm phổi'] },
  { drug: 'Ampicillin 500mg', generic: 'Ampicillin', dose: '500mg', route: 'Uống', frequency: '4 lần/ngày', days: 7, instructions: 'Uống khi bụng đói (30-60 phút trước ăn)', categories: ['kháng sinh'], keywords: ['nhiễm khuẩn','viêm đường tiết niệu'] },
  { drug: 'Azithromycin 250mg', generic: 'Azithromycin', dose: '250mg', route: 'Uống', frequency: '1 lần/ngày', days: 3, instructions: 'Uống trước ăn 1 giờ hoặc sau ăn 2 giờ', categories: ['kháng sinh'], keywords: ['viêm họng','nhiễm khuẩn','viêm phổi không điển hình'] },
  { drug: 'Azithromycin 500mg', generic: 'Azithromycin', dose: '500mg', route: 'Uống', frequency: '1 lần/ngày', days: 3, instructions: 'Uống trước ăn 1 giờ hoặc sau ăn 2 giờ', categories: ['kháng sinh'], keywords: ['viêm phổi','viêm họng','nhiễm khuẩn','COPD'] },
  { drug: 'Clarithromycin 250mg', generic: 'Clarithromycin', dose: '250mg', route: 'Uống', frequency: '2 lần/ngày', days: 7, instructions: 'Có thể uống kèm hoặc không kèm thức ăn', categories: ['kháng sinh'], keywords: ['viêm họng','viêm phổi','loét dạ dày HP'] },
  { drug: 'Clarithromycin 500mg', generic: 'Clarithromycin', dose: '500mg', route: 'Uống', frequency: '2 lần/ngày', days: 7, instructions: 'Uống trong bữa ăn', categories: ['kháng sinh'], keywords: ['viêm phổi','nhiễm khuẩn','loét dạ dày HP'] },
  { drug: 'Ciprofloxacin 250mg', generic: 'Ciprofloxacin', dose: '250mg', route: 'Uống', frequency: '2 lần/ngày', days: 5, instructions: 'Uống nhiều nước, tránh uống cùng sữa/canxi', categories: ['kháng sinh'], keywords: ['nhiễm khuẩn tiết niệu','tiêu chảy nhiễm khuẩn'] },
  { drug: 'Ciprofloxacin 500mg', generic: 'Ciprofloxacin', dose: '500mg', route: 'Uống', frequency: '2 lần/ngày', days: 7, instructions: 'Uống nhiều nước, tránh các sản phẩm từ sữa khi uống thuốc', categories: ['kháng sinh'], keywords: ['nhiễm khuẩn tiết niệu','tiêu chảy','viêm phổi','nhiễm khuẩn nặng'] },
  { drug: 'Levofloxacin 250mg', generic: 'Levofloxacin', dose: '250mg', route: 'Uống', frequency: '1 lần/ngày', days: 7, instructions: 'Uống nhiều nước, tránh ánh nắng trực tiếp', categories: ['kháng sinh'], keywords: ['viêm phổi','nhiễm khuẩn tiết niệu','viêm xoang'] },
  { drug: 'Levofloxacin 500mg', generic: 'Levofloxacin', dose: '500mg', route: 'Uống', frequency: '1 lần/ngày', days: 7, instructions: 'Uống nhiều nước, hoàn thành liệu trình', categories: ['kháng sinh'], keywords: ['viêm phổi','nhiễm khuẩn nặng','lao'] },
  { drug: 'Moxifloxacin 400mg', generic: 'Moxifloxacin', dose: '400mg', route: 'Uống', frequency: '1 lần/ngày', days: 7, instructions: 'Không uống cùng các thuốc kháng acid (antacid)', categories: ['kháng sinh'], keywords: ['viêm phổi','viêm xoang','nhiễm khuẩn nặng'] },
  { drug: 'Doxycycline 100mg', generic: 'Doxycycline', dose: '100mg', route: 'Uống', frequency: '2 lần/ngày', days: 7, instructions: 'Uống với nhiều nước, không nằm ngay sau khi uống', categories: ['kháng sinh'], keywords: ['viêm phổi không điển hình','nhiễm khuẩn','mụn trứng cá','lyme'] },
  { drug: 'Metronidazole 250mg', generic: 'Metronidazole', dose: '250mg', route: 'Uống', frequency: '3 lần/ngày', days: 7, instructions: 'Tuyệt đối không uống rượu bia trong thời gian dùng thuốc', categories: ['kháng sinh'], keywords: ['nhiễm ký sinh trùng','tiêu chảy','loét dạ dày HP'] },
  { drug: 'Metronidazole 500mg', generic: 'Metronidazole', dose: '500mg', route: 'Uống', frequency: '2-3 lần/ngày', days: 7, instructions: 'Uống trong hoặc sau bữa ăn', categories: ['kháng sinh'], keywords: ['nhiễm ký sinh trùng','tiêu chảy nặng','loét dạ dày HP','viêm âm đạo'] },
  { drug: 'Tinidazole 500mg', generic: 'Tinidazole', dose: '500mg', route: 'Uống', frequency: '1 lần/ngày', days: 3, instructions: 'Uống trong hoặc sau bữa ăn', categories: ['kháng sinh'], keywords: ['nhiễm ký sinh trùng','loét dạ dày HP','viêm âm đạo'] },
  { drug: 'Trimethoprim-Sulfamethoxazole 480mg', generic: 'Co-trimoxazole', dose: '480mg', route: 'Uống', frequency: '2 lần/ngày', days: 7, instructions: 'Uống với nhiều nước', categories: ['kháng sinh'], keywords: ['nhiễm khuẩn tiết niệu','viêm phổi PCP'] },
  { drug: 'Cephalexin 250mg', generic: 'Cephalexin', dose: '250mg', route: 'Uống', frequency: '4 lần/ngày', days: 7, instructions: 'Uống cách xa bữa ăn', categories: ['kháng sinh'], keywords: ['nhiễm khuẩn da','viêm họng','trẻ em'] },
  { drug: 'Cephalexin 500mg', generic: 'Cephalexin', dose: '500mg', route: 'Uống', frequency: '3 lần/ngày', days: 7, instructions: 'Có thể uống cùng thức ăn nếu đau dạ dày', categories: ['kháng sinh'], keywords: ['nhiễm khuẩn da','viêm họng','nhiễm khuẩn xương khớp'] },
  { drug: 'Cefuroxime 250mg', generic: 'Cefuroxime', dose: '250mg', route: 'Uống', frequency: '2 lần/ngày', days: 7, instructions: 'Uống sau bữa ăn để hấp thu tốt nhất', categories: ['kháng sinh'], keywords: ['viêm xoang','viêm phổi','nhiễm khuẩn da'] },
  { drug: 'Cefuroxime 500mg', generic: 'Cefuroxime', dose: '500mg', route: 'Uống', frequency: '2 lần/ngày', days: 7, instructions: 'Uống ngay sau bữa ăn', categories: ['kháng sinh'], keywords: ['viêm phổi','nhiễm khuẩn nặng','viêm xoang'] },
  { drug: 'Cefpodoxime 100mg', generic: 'Cefpodoxime', dose: '100mg', route: 'Uống', frequency: '2 lần/ngày', days: 7, instructions: 'Uống cùng với thức ăn', categories: ['kháng sinh'], keywords: ['viêm họng','nhiễm khuẩn tiết niệu','viêm phổi'] },
  { drug: 'Clindamycin 150mg', generic: 'Clindamycin', dose: '150mg', route: 'Uống', frequency: '3-4 lần/ngày', days: 7, instructions: 'Uống với một ly nước đầy ở tư thế đứng', categories: ['kháng sinh'], keywords: ['nhiễm khuẩn da','viêm họng','dị ứng penicillin'] },
  { drug: 'Clindamycin 300mg', generic: 'Clindamycin', dose: '300mg', route: 'Uống', frequency: '3 lần/ngày', days: 7, instructions: 'Theo dõi nếu có tiêu chảy nặng', categories: ['kháng sinh'], keywords: ['nhiễm khuẩn da','nhiễm khuẩn nặng','dị ứng penicillin'] },
  { drug: 'Erythromycin 250mg', generic: 'Erythromycin', dose: '250mg', route: 'Uống', frequency: '4 lần/ngày', days: 7, instructions: 'Nên uống trước ăn 30 phút', categories: ['kháng sinh'], keywords: ['viêm họng','viêm phổi không điển hình','dị ứng penicillin'] },
  { drug: 'Tetracycline 250mg', generic: 'Tetracycline', dose: '250mg', route: 'Uống', frequency: '4 lần/ngày', days: 10, instructions: 'Không uống cùng sữa, sắt hoặc thuốc dạ dày', categories: ['kháng sinh'], keywords: ['mụn trứng cá','nhiễm khuẩn'] },
  { drug: 'Nitrofurantoin 50mg', generic: 'Nitrofurantoin', dose: '50mg', route: 'Uống', frequency: '4 lần/ngày', days: 5, instructions: 'Uống cùng thức ăn hoặc sữa', categories: ['kháng sinh'], keywords: ['nhiễm khuẩn tiết niệu','viêm bàng quang'] },
  { drug: 'Nitrofurantoin 100mg', generic: 'Nitrofurantoin', dose: '100mg', route: 'Uống', frequency: '2 lần/ngày', days: 5, instructions: 'Uống cùng thức ăn', categories: ['kháng sinh'], keywords: ['nhiễm khuẩn tiết niệu'] },
  { drug: 'Fosfomycin 3g gói', generic: 'Fosfomycin', dose: '3g', route: 'Uống', frequency: '1 liều duy nhất', days: 1, instructions: 'Hòa tan vào nước, uống khi bụng đói (trước ngủ 2-3h)', categories: ['kháng sinh'], keywords: ['nhiễm khuẩn tiết niệu','viêm bàng quang cấp'] },
  { drug: 'Rifampicin 150mg', generic: 'Rifampicin', dose: '150mg', route: 'Uống', frequency: '1 lần/ngày', days: 30, instructions: 'Uống trước ăn 1 giờ hoặc sau ăn 2 giờ. Thuốc làm nước tiểu màu cam.', categories: ['kháng sinh','lao'], keywords: ['lao','nhiễm khuẩn nặng'] },
  { drug: 'Isoniazid 300mg', generic: 'Isoniazid (INH)', dose: '300mg', route: 'Uống', frequency: '1 lần/ngày', days: 30, instructions: 'Uống khi bụng đói. Thường dùng kèm Vitamin B6.', categories: ['kháng sinh','lao'], keywords: ['lao'] },
  { drug: 'Ethambutol 400mg', generic: 'Ethambutol', dose: '400mg', route: 'Uống', frequency: '1 lần/ngày', days: 30, instructions: 'Theo dõi thị lực trong quá trình điều trị', categories: ['kháng sinh','lao'], keywords: ['lao'] },
  { drug: 'Pyrazinamide 500mg', generic: 'Pyrazinamide', dose: '500mg', route: 'Uống', frequency: '1 lần/ngày', days: 30, instructions: 'Theo dõi chức năng gan và nồng độ acid uric', categories: ['kháng sinh','lao'], keywords: ['lao'] },

  // ── GIẢM ĐAU / HẠ SỐT ──────────────────────────────────────────────────────
  { drug: 'Paracetamol 325mg', generic: 'Acetaminophen', dose: '325mg', route: 'Uống', frequency: 'Mỗi 4-6 giờ khi đau/sốt', days: 5, instructions: 'Không quá 8 viên/ngày', categories: ['giảm đau','hạ sốt'], keywords: ['đau','sốt','đau đầu','cảm cúm','trẻ em'] },
  { drug: 'Paracetamol 500mg', generic: 'Acetaminophen', dose: '500mg', route: 'Uống', frequency: 'Mỗi 4-6 giờ khi đau/sốt', days: 5, instructions: 'Uống sau ăn, tối đa 4g/ngày', categories: ['giảm đau','hạ sốt'], keywords: ['đau','sốt','đau đầu','cảm cúm'] },
  { drug: 'Paracetamol 650mg', generic: 'Acetaminophen', dose: '650mg', route: 'Uống', frequency: '3-4 lần/ngày', days: 5, instructions: 'Uống cách nhau ít nhất 4-6 tiếng', categories: ['giảm đau','hạ sốt'], keywords: ['đau vừa','sốt','đau đầu'] },
  { drug: 'Ibuprofen 200mg', generic: 'Ibuprofen', dose: '200mg', route: 'Uống', frequency: '3-4 lần/ngày', days: 5, instructions: 'Uống sau ăn no để bảo vệ dạ dày', categories: ['giảm đau','kháng viêm'], keywords: ['đau','sốt','đau đầu','đau răng','trẻ em'] },
  { drug: 'Ibuprofen 400mg', generic: 'Ibuprofen', dose: '400mg', route: 'Uống', frequency: '2-3 lần/ngày', days: 5, instructions: 'Uống ngay sau khi ăn', categories: ['giảm đau','kháng viêm'], keywords: ['đau','sốt','viêm khớp','đau răng','đau bụng kinh'] },
  { drug: 'Ibuprofen 600mg', generic: 'Ibuprofen', dose: '600mg', route: 'Uống', frequency: '2 lần/ngày', days: 7, instructions: 'Uống sau ăn no, uống nhiều nước', categories: ['giảm đau','kháng viêm'], keywords: ['đau nặng','viêm khớp','đau lưng'] },
  { drug: 'Diclofenac 25mg', generic: 'Diclofenac sodium', dose: '25mg', route: 'Uống', frequency: '3 lần/ngày', days: 7, instructions: 'Uống sau ăn no', categories: ['giảm đau','kháng viêm'], keywords: ['viêm khớp','đau nhẹ','đau lưng'] },
  { drug: 'Diclofenac 50mg', generic: 'Diclofenac sodium', dose: '50mg', route: 'Uống', frequency: '2 lần/ngày', days: 7, instructions: 'Uống sau ăn, không nhai nát viên thuốc', categories: ['giảm đau','kháng viêm'], keywords: ['viêm khớp','đau lưng','đau cơ','gout'] },
  { drug: 'Diclofenac 75mg', generic: 'Diclofenac sodium', dose: '75mg', route: 'Uống', frequency: '2 lần/ngày', days: 7, instructions: 'Uống sau ăn, theo dõi tình trạng dạ dày', categories: ['giảm đau','kháng viêm'], keywords: ['viêm khớp nặng','đau sau phẫu thuật'] },
  { drug: 'Naproxen 250mg', generic: 'Naproxen', dose: '250mg', route: 'Uống', frequency: '2-3 lần/ngày', days: 7, instructions: 'Uống sau ăn với một ly nước đầy', categories: ['giảm đau','kháng viêm'], keywords: ['viêm khớp','đau bụng kinh','gout','đau đầu'] },
  { drug: 'Naproxen 500mg', generic: 'Naproxen', dose: '500mg', route: 'Uống', frequency: '2 lần/ngày', days: 10, instructions: 'Uống sau ăn, tránh dùng cùng các NSAID khác', categories: ['giảm đau','kháng viêm'], keywords: ['viêm khớp','gout','đau nặng'] },
  { drug: 'Mefenamic acid 250mg', generic: 'Mefenamic acid', dose: '250mg', route: 'Uống', frequency: '3 lần/ngày', days: 5, instructions: 'Uống trong hoặc sau bữa ăn', categories: ['giảm đau'], keywords: ['đau bụng kinh','đau răng','đau đầu'] },
  { drug: 'Mefenamic acid 500mg', generic: 'Mefenamic acid', dose: '500mg', route: 'Uống', frequency: '3 lần/ngày', days: 3, instructions: 'Dùng ngắn ngày cho đau cấp tính', categories: ['giảm đau'], keywords: ['đau bụng kinh','đau vừa'] },
  { drug: 'Celecoxib 100mg', generic: 'Celecoxib', dose: '100mg', route: 'Uống', frequency: '2 lần/ngày', days: 14, instructions: 'Có thể uống lúc đói hoặc no', categories: ['giảm đau','kháng viêm'], keywords: ['viêm khớp','đau xương khớp','thoái hoá khớp'] },
  { drug: 'Celecoxib 200mg', generic: 'Celecoxib', dose: '200mg', route: 'Uống', frequency: '1 lần/ngày', days: 14, instructions: 'Uống sau ăn nếu có vấn đề về dạ dày', categories: ['giảm đau','kháng viêm'], keywords: ['viêm khớp dạng thấp','thoái hoá khớp','gout'] },
  { drug: 'Etoricoxib 60mg', generic: 'Etoricoxib', dose: '60mg', route: 'Uống', frequency: '1 lần/ngày', days: 14, instructions: 'Uống liều thấp nhất có hiệu quả', categories: ['giảm đau','kháng viêm'], keywords: ['viêm khớp','gout cấp','thoái hoá khớp'] },
  { drug: 'Etoricoxib 90mg', generic: 'Etoricoxib', dose: '90mg', route: 'Uống', frequency: '1 lần/ngày', days: 7, instructions: 'Chỉ dùng cho các đợt đau cấp tính', categories: ['giảm đau','kháng viêm'], keywords: ['gout cấp','viêm khớp dạng thấp'] },
  { drug: 'Meloxicam 7.5mg', generic: 'Meloxicam', dose: '7.5mg', route: 'Uống', frequency: '1 lần/ngày', days: 14, instructions: 'Uống sau ăn, không quá 15mg/ngày', categories: ['giảm đau','kháng viêm'], keywords: ['thoái hoá khớp','viêm khớp','đau lưng'] },
  { drug: 'Meloxicam 15mg', generic: 'Meloxicam', dose: '15mg', route: 'Uống', frequency: '1 lần/ngày', days: 14, instructions: 'Uống sau ăn sáng', categories: ['giảm đau','kháng viêm'], keywords: ['viêm khớp dạng thấp','đau nặng'] },
  { drug: 'Tramadol 50mg', generic: 'Tramadol HCl', dose: '50mg', route: 'Uống', frequency: 'Mỗi 6 giờ khi đau nặng', days: 5, instructions: 'Có thể gây buồn ngủ, tránh lái xe', categories: ['giảm đau','opioid'], keywords: ['đau vừa nặng','đau sau phẫu thuật','đau ung thư'] },
  { drug: 'Tramadol 100mg', generic: 'Tramadol HCl', dose: '100mg', route: 'Uống', frequency: '2 lần/ngày', days: 5, instructions: 'Thận trọng khi phối hợp thuốc an thần', categories: ['giảm đau','opioid'], keywords: ['đau nặng','đau mạn tính'] },
  { drug: 'Codeine 15mg', generic: 'Codeine phosphate', dose: '15mg', route: 'Uống', frequency: 'Mỗi 4-6 giờ khi cần', days: 3, instructions: 'Có thể gây táo bón', categories: ['giảm đau','ho'], keywords: ['đau vừa','ho khan','đau sau phẫu thuật'] },
  { drug: 'Ketorolac 10mg', generic: 'Ketorolac', dose: '10mg', route: 'Uống', frequency: 'Mỗi 6 giờ', days: 5, instructions: 'Không dùng quá 5 ngày liên tục', categories: ['giảm đau'], keywords: ['đau cấp','đau sau phẫu thuật','đau thận'] },

  // ── TIM MẠCH ────────────────────────────────────────────────────────────────
  { drug: 'Amlodipine 5mg', generic: 'Amlodipine besylate', dose: '5mg', route: 'Uống', frequency: '1 lần/ngày', days: 30, instructions: 'Nên uống vào buổi sáng', categories: ['tim mạch','huyết áp'], keywords: ['cao huyết áp','đau thắt ngực','tim mạch'] },
  { drug: 'Amlodipine 10mg', generic: 'Amlodipine besylate', dose: '10mg', route: 'Uống', frequency: '1 lần/ngày', days: 30, instructions: 'Theo dõi nếu có phù chân', categories: ['tim mạch','huyết áp'], keywords: ['cao huyết áp','đau thắt ngực'] },
  { drug: 'Lisinopril 5mg', generic: 'Lisinopril', dose: '5mg', route: 'Uống', frequency: '1 lần/ngày', days: 30, instructions: 'Theo dõi nếu có ho khan kéo dài', categories: ['tim mạch','huyết áp'], keywords: ['cao huyết áp','suy tim','tiểu đường'] },
  { drug: 'Lisinopril 10mg', generic: 'Lisinopril', dose: '10mg', route: 'Uống', frequency: '1 lần/ngày', days: 30, instructions: 'Uống cùng giờ mỗi ngày', categories: ['tim mạch','huyết áp'], keywords: ['cao huyết áp','suy tim','bảo vệ thận'] },
  { drug: 'Lisinopril 20mg', generic: 'Lisinopril', dose: '20mg', route: 'Uống', frequency: '1 lần/ngày', days: 30, instructions: 'Theo dõi chức năng thận định kỳ', categories: ['tim mạch','huyết áp'], keywords: ['cao huyết áp','suy tim nặng'] },
  { drug: 'Enalapril 5mg', generic: 'Enalapril maleate', dose: '5mg', route: 'Uống', frequency: '1-2 lần/ngày', days: 30, instructions: 'Có thể uống cùng hoặc ngoài bữa ăn', categories: ['tim mạch','huyết áp'], keywords: ['cao huyết áp','suy tim'] },
  { drug: 'Enalapril 10mg', generic: 'Enalapril maleate', dose: '10mg', route: 'Uống', frequency: '1-2 lần/ngày', days: 30, instructions: 'Theo dõi huyết áp khi mới bắt đầu', categories: ['tim mạch','huyết áp'], keywords: ['cao huyết áp','suy tim'] },
  { drug: 'Ramipril 2.5mg', generic: 'Ramipril', dose: '2.5mg', route: 'Uống', frequency: '1 lần/ngày', days: 30, instructions: 'Uống nguyên viên, không nhai', categories: ['tim mạch','huyết áp'], keywords: ['cao huyết áp','suy tim','bảo vệ thận','sau nhồi máu'] },
  { drug: 'Ramipril 5mg', generic: 'Ramipril', dose: '5mg', route: 'Uống', frequency: '1 lần/ngày', days: 30, instructions: 'Uống vào buổi tối nếu gây chóng mặt ban ngày', categories: ['tim mạch','huyết áp'], keywords: ['cao huyết áp','suy tim'] },
  { drug: 'Losartan 25mg', generic: 'Losartan potassium', dose: '25mg', route: 'Uống', frequency: '1 lần/ngày', days: 30, instructions: 'Có thể uống cùng hoặc ngoài bữa ăn', categories: ['tim mạch','huyết áp'], keywords: ['cao huyết áp','bảo vệ thận','tiểu đường'] },
  { drug: 'Losartan 50mg', generic: 'Losartan potassium', dose: '50mg', route: 'Uống', frequency: '1 lần/ngày', days: 30, instructions: 'Uống định kỳ vào cùng một thời điểm', categories: ['tim mạch','huyết áp'], keywords: ['cao huyết áp','tiểu đường'] },
  { drug: 'Losartan 100mg', generic: 'Losartan potassium', dose: '100mg', route: 'Uống', frequency: '1 lần/ngày', days: 30, instructions: 'Theo dõi nồng độ Kali máu', categories: ['tim mạch','huyết áp'], keywords: ['cao huyết áp','suy tim'] },
  { drug: 'Valsartan 80mg', generic: 'Valsartan', dose: '80mg', route: 'Uống', frequency: '1 lần/ngày', days: 30, instructions: 'Không dùng cho phụ nữ có thai', categories: ['tim mạch','huyết áp'], keywords: ['cao huyết áp','suy tim','sau nhồi máu'] },
  { drug: 'Valsartan 160mg', generic: 'Valsartan', dose: '160mg', route: 'Uống', frequency: '1 lần/ngày', days: 30, instructions: 'Thường dùng cho bệnh nhân suy tim', categories: ['tim mạch','huyết áp'], keywords: ['cao huyết áp','suy tim'] },
  { drug: 'Telmisartan 40mg', generic: 'Telmisartan', dose: '40mg', route: 'Uống', frequency: '1 lần/ngày', days: 30, instructions: 'Uống ngay sau khi lấy ra khỏi vỉ', categories: ['tim mạch','huyết áp'], keywords: ['cao huyết áp','bảo vệ tim mạch'] },
  { drug: 'Telmisartan 80mg', generic: 'Telmisartan', dose: '80mg', route: 'Uống', frequency: '1 lần/ngày', days: 30, instructions: 'Uống định kỳ hàng ngày', categories: ['tim mạch','huyết áp'], keywords: ['cao huyết áp'] },
  { drug: 'Metoprolol succinate 25mg', generic: 'Metoprolol succinate', dose: '25mg', route: 'Uống', frequency: '1 lần/ngày', days: 30, instructions: 'Uống cùng hoặc ngay sau bữa ăn', categories: ['tim mạch'], keywords: ['cao huyết áp','loạn nhịp tim','suy tim','đau thắt ngực'] },
  { drug: 'Metoprolol succinate 50mg', generic: 'Metoprolol succinate', dose: '50mg', route: 'Uống', frequency: '1 lần/ngày', days: 30, instructions: 'Không được ngưng thuốc đột ngột', categories: ['tim mạch'], keywords: ['cao huyết áp','suy tim','nhịp nhanh'] },
  { drug: 'Bisoprolol 2.5mg', generic: 'Bisoprolol fumarate', dose: '2.5mg', route: 'Uống', frequency: '1 lần/ngày sáng', days: 30, instructions: 'Uống vào buổi sáng khi đói hoặc kèm thức ăn nhẹ', categories: ['tim mạch'], keywords: ['cao huyết áp','suy tim','loạn nhịp'] },
  { drug: 'Bisoprolol 5mg', generic: 'Bisoprolol fumarate', dose: '5mg', route: 'Uống', frequency: '1 lần/ngày sáng', days: 30, instructions: 'Theo dõi nhịp tim hàng ngày', categories: ['tim mạch'], keywords: ['cao huyết áp','suy tim','rung nhĩ'] },
  { drug: 'Carvedilol 6.25mg', generic: 'Carvedilol', dose: '6.25mg', route: 'Uống', frequency: '2 lần/ngày', days: 30, instructions: 'Uống cùng với thức ăn để giảm hạ huyết áp tư thế', categories: ['tim mạch'], keywords: ['suy tim','cao huyết áp','sau nhồi máu'] },
  { drug: 'Carvedilol 12.5mg', generic: 'Carvedilol', dose: '12.5mg', route: 'Uống', frequency: '2 lần/ngày', days: 30, instructions: 'Uống trong bữa ăn', categories: ['tim mạch'], keywords: ['suy tim nặng','cao huyết áp'] },
  { drug: 'Atorvastatin 10mg', generic: 'Atorvastatin calcium', dose: '10mg', route: 'Uống', frequency: '1 lần/ngày tối', days: 30, instructions: 'Nên uống vào buổi tối', categories: ['tim mạch','mỡ máu'], keywords: ['mỡ máu cao','tim mạch','dự phòng đột quỵ'] },
  { drug: 'Atorvastatin 20mg', generic: 'Atorvastatin calcium', dose: '20mg', route: 'Uống', frequency: '1 lần/ngày tối', days: 30, instructions: 'Hạn chế ăn bưởi chùm khi dùng thuốc', categories: ['tim mạch','mỡ máu'], keywords: ['mỡ máu cao','tim mạch','cao huyết áp'] },
  { drug: 'Atorvastatin 40mg', generic: 'Atorvastatin calcium', dose: '40mg', route: 'Uống', frequency: '1 lần/ngày tối', days: 30, instructions: 'Báo bác sĩ nếu có đau cơ bất thường', categories: ['tim mạch','mỡ máu'], keywords: ['mỡ máu cao','nguy cơ cao tim mạch'] },
  { drug: 'Rosuvastatin 5mg', generic: 'Rosuvastatin calcium', dose: '5mg', route: 'Uống', frequency: '1 lần/ngày tối', days: 30, instructions: 'Có thể uống bất cứ lúc nào nhưng nên cố định giờ', categories: ['tim mạch','mỡ máu'], keywords: ['mỡ máu cao','tim mạch'] },
  { drug: 'Rosuvastatin 10mg', generic: 'Rosuvastatin calcium', dose: '10mg', route: 'Uống', frequency: '1 lần/ngày tối', days: 30, instructions: 'Thường dùng cho bệnh nhân mỡ máu cao mức trung bình', categories: ['tim mạch','mỡ máu'], keywords: ['mỡ máu cao','tim mạch','dự phòng đột quỵ'] },
  { drug: 'Rosuvastatin 20mg', generic: 'Rosuvastatin calcium', dose: '20mg', route: 'Uống', frequency: '1 lần/ngày tối', days: 30, instructions: 'Liều cao cho nguy cơ tim mạch rất cao', categories: ['tim mạch','mỡ máu'], keywords: ['mỡ máu cao cao','nguy cơ cao'] },
  { drug: 'Simvastatin 20mg', generic: 'Simvastatin', dose: '20mg', route: 'Uống', frequency: '1 lần/ngày tối', days: 30, instructions: 'Bắt buộc uống vào buổi tối', categories: ['tim mạch','mỡ máu'], keywords: ['mỡ máu cao','tim mạch'] },
  { drug: 'Aspirin 81mg (bao tan)', generic: 'Aspirin', dose: '81mg', route: 'Uống', frequency: '1 lần/ngày', days: 30, instructions: 'Uống sau bữa ăn no, không nhai/nghiền viên thuốc', categories: ['tim mạch','chống đông'], keywords: ['tim mạch','dự phòng huyết khối','sau nhồi máu','đột quỵ'] },
  { drug: 'Aspirin 100mg (bao tan)', generic: 'Aspirin', dose: '100mg', route: 'Uống', frequency: '1 lần/ngày', days: 30, instructions: 'Uống sau ăn để giảm kích ứng dạ dày', categories: ['tim mạch','chống đông'], keywords: ['tim mạch','dự phòng huyết khối','rung nhĩ'] },
  { drug: 'Clopidogrel 75mg', generic: 'Clopidogrel bisulfate', dose: '75mg', route: 'Uống', frequency: '1 lần/ngày', days: 30, instructions: 'Thông báo cho bác sĩ nếu chuẩn bị phẫu thuật', categories: ['tim mạch','chống đông'], keywords: ['tim mạch','huyết khối','sau stent','đột quỵ'] },
  { drug: 'Ticagrelor 90mg', generic: 'Ticagrelor', dose: '90mg', route: 'Uống', frequency: '2 lần/ngày', days: 30, instructions: 'Theo dõi nếu có tình trạng khó thở', categories: ['tim mạch','chống đông'], keywords: ['hội chứng vành cấp','sau stent'] },
  { drug: 'Warfarin 2mg', generic: 'Warfarin sodium', dose: '2mg', route: 'Uống', frequency: '1 lần/ngày', days: 30, instructions: 'Cần xét nghiệm máu (INR) định kỳ theo chỉ dẫn', categories: ['tim mạch','chống đông'], keywords: ['chống đông','rung nhĩ','huyết khối','van tim cơ học'] },
  { drug: 'Warfarin 5mg', generic: 'Warfarin sodium', dose: '5mg', route: 'Uống', frequency: '1 lần/ngày', days: 30, instructions: 'Hạn chế thay đổi lượng rau xanh trong chế độ ăn', categories: ['tim mạch','chống đông'], keywords: ['chống đông','rung nhĩ','huyết khối'] },
  { drug: 'Rivaroxaban 10mg', generic: 'Rivaroxaban', dose: '10mg', route: 'Uống', frequency: '1 lần/ngày', days: 14, instructions: 'Uống ngay sau bữa ăn', categories: ['tim mạch','chống đông'], keywords: ['chống đông','huyết khối tĩnh mạch','dự phòng'] },
  { drug: 'Rivaroxaban 15mg', generic: 'Rivaroxaban', dose: '15mg', route: 'Uống', frequency: '1 lần/ngày', days: 30, instructions: 'Uống cùng với thức ăn', categories: ['tim mạch','chống đông'], keywords: ['rung nhĩ','huyết khối'] },
  { drug: 'Rivaroxaban 20mg', generic: 'Rivaroxaban', dose: '20mg', route: 'Uống', frequency: '1 lần/ngày', days: 30, instructions: 'Uống trong bữa ăn tối', categories: ['tim mạch','chống đông'], keywords: ['rung nhĩ không do van tim','thuyên tắc'] },
  { drug: 'Apixaban 2.5mg', generic: 'Apixaban', dose: '2.5mg', route: 'Uống', frequency: '2 lần/ngày', days: 30, instructions: 'Có thể uống kèm hoặc không kèm thức ăn', categories: ['tim mạch','chống đông'], keywords: ['dự phòng huyết khối','rung nhĩ người cao tuổi'] },
  { drug: 'Apixaban 5mg', generic: 'Apixaban', dose: '5mg', route: 'Uống', frequency: '2 lần/ngày', days: 30, instructions: 'Uống đều đặn vào cùng một thời điểm', categories: ['tim mạch','chống đông'], keywords: ['rung nhĩ','huyết khối tĩnh mạch'] },
  { drug: 'Digoxin 0.25mg', generic: 'Digoxin', dose: '0.25mg', route: 'Uống', frequency: '1 lần/ngày', days: 30, instructions: 'Báo bác sĩ nếu thấy nhìn mờ hoặc quầng vàng', categories: ['tim mạch'], keywords: ['suy tim','rung nhĩ','kiểm soát nhịp'] },
  { drug: 'Furosemide 40mg', generic: 'Furosemide', dose: '40mg', route: 'Uống', frequency: '1 lần/ngày sáng', days: 14, instructions: 'Nên uống vào buổi sáng để tránh đi tiểu đêm', categories: ['tim mạch','lợi tiểu'], keywords: ['phù','suy tim','cao huyết áp','xơ gan'] },
  { drug: 'Spironolactone 25mg', generic: 'Spironolactone', dose: '25mg', route: 'Uống', frequency: '1 lần/ngày', days: 30, instructions: 'Uống sau bữa ăn', categories: ['tim mạch','lợi tiểu'], keywords: ['suy tim','phù','cao huyết áp','xơ gan'] },
  { drug: 'Hydrochlorothiazide 12.5mg', generic: 'Hydrochlorothiazide', dose: '12.5mg', route: 'Uống', frequency: '1 lần/ngày sáng', days: 30, instructions: 'Nên uống sau bữa ăn sáng', categories: ['tim mạch','huyết áp','lợi tiểu'], keywords: ['cao huyết áp','phù'] },
  { drug: 'Hydrochlorothiazide 25mg', generic: 'Hydrochlorothiazide', dose: '25mg', route: 'Uống', frequency: '1 lần/ngày sáng', days: 30, instructions: 'Uống vào buổi sáng', categories: ['tim mạch','huyết áp','lợi tiểu'], keywords: ['cao huyết áp','phù'] },
  { drug: 'Indapamide 1.5mg', generic: 'Indapamide', dose: '1.5mg', route: 'Uống', frequency: '1 lần/ngày sáng', days: 30, instructions: 'Uống nguyên viên với nước', categories: ['tim mạch','huyết áp'], keywords: ['cao huyết áp','phù nhẹ'] },
  { drug: 'Isosorbide mononitrate 20mg', generic: 'Isosorbide mononitrate', dose: '20mg', route: 'Uống', frequency: '2 lần/ngày', days: 30, instructions: 'Các liều nên cách nhau 7 giờ (VD: 8h sáng và 3h chiều)', categories: ['tim mạch'], keywords: ['đau thắt ngực','phòng ngừa cơn đau thắt ngực'] },
  { drug: 'Isosorbide dinitrate 5mg (ngậm dưới lưỡi)', generic: 'Isosorbide dinitrate', dose: '5mg', route: 'Ngậm dưới lưỡi', frequency: 'Khi có cơn đau cấp', days: 30, instructions: 'Ngồi hoặc nằm khi ngậm thuốc để tránh chóng mặt', categories: ['tim mạch'], keywords: ['cơn đau thắt ngực cấp'] },
  { drug: 'Nicorandil 10mg', generic: 'Nicorandil', dose: '10mg', route: 'Uống', frequency: '2 lần/ngày', days: 30, instructions: 'Uống cùng hoặc ngoài bữa ăn', categories: ['tim mạch'], keywords: ['đau thắt ngực','phòng ngừa'] },
  { drug: 'Ivabradine 5mg', generic: 'Ivabradine', dose: '5mg', route: 'Uống', frequency: '2 lần/ngày', days: 30, instructions: 'Uống trong bữa ăn', categories: ['tim mạch'], keywords: ['suy tim','nhịp nhanh xoang'] },
  { drug: 'Trimetazidine 35mg MR', generic: 'Trimetazidine', dose: '35mg', route: 'Uống', frequency: '2 lần/ngày', days: 30, instructions: 'Uống vào bữa ăn sáng và tối', categories: ['tim mạch'], keywords: ['đau thắt ngực ổn định','thiếu máu cơ tim'] },
  { drug: 'Amlodipine-Valsartan 5/80mg', generic: 'Amlodipine + Valsartan', dose: '1 viên', route: 'Uống', frequency: '1 lần/ngày', days: 30, instructions: 'Uống vào cùng một thời điểm mỗi ngày', categories: ['tim mạch','huyết áp'], keywords: ['cao huyết áp','phối hợp thuốc'] },
  { drug: 'Sacubitril-Valsartan 50mg (Entresto)', generic: 'Sacubitril/Valsartan', dose: '50mg', route: 'Uống', frequency: '2 lần/ngày', days: 30, instructions: 'Theo dõi huyết áp và kali máu', categories: ['tim mạch'], keywords: ['suy tim giảm EF','suy tim mạn'] },
  { drug: 'Fenofibrate 145mg', generic: 'Fenofibrate', dose: '145mg', route: 'Uống', frequency: '1 lần/ngày', days: 30, instructions: 'Có thể uống bất kỳ lúc nào trong ngày', categories: ['tim mạch','mỡ máu'], keywords: ['mỡ máu cao','triglyceride cao'] },
  { drug: 'Gemfibrozil 600mg', generic: 'Gemfibrozil', dose: '600mg', route: 'Uống', frequency: '2 lần/ngày', days: 30, instructions: 'Uống 30 phút trước bữa ăn sáng và tối', categories: ['tim mạch','mỡ máu'], keywords: ['triglyceride cao','mỡ máu'] },

  // ── TIỂU ĐƯỜNG ──────────────────────────────────────────────────────────────
  { drug: 'Metformin 500mg', generic: 'Metformin HCl', dose: '500mg', route: 'Uống', frequency: '2 lần/ngày', days: 30, instructions: 'Uống ngay sau khi ăn để giảm tác dụng phụ tiêu hóa', categories: ['tiểu đường'], keywords: ['tiểu đường type 2','đái tháo đường','đường huyết cao'] },
  { drug: 'Metformin 850mg', generic: 'Metformin HCl', dose: '850mg', route: 'Uống', frequency: '2 lần/ngày', days: 30, instructions: 'Uống trong bữa ăn', categories: ['tiểu đường'], keywords: ['tiểu đường type 2','đái tháo đường'] },
  { drug: 'Metformin 1000mg', generic: 'Metformin HCl', dose: '1000mg', route: 'Uống', frequency: '2 lần/ngày', days: 30, instructions: 'Nên dùng kèm thức ăn', categories: ['tiểu đường'], keywords: ['tiểu đường type 2','đái tháo đường','béo phì'] },
  { drug: 'Glibenclamide 2.5mg', generic: 'Glibenclamide', dose: '2.5mg', route: 'Uống', frequency: '1-2 lần/ngày', days: 30, instructions: 'Uống 30 phút trước bữa ăn chính', categories: ['tiểu đường'], keywords: ['tiểu đường type 2','đái tháo đường'] },
  { drug: 'Glibenclamide 5mg', generic: 'Glibenclamide', dose: '5mg', route: 'Uống', frequency: '1 lần/ngày', days: 30, instructions: 'Uống ngay trước bữa ăn sáng', categories: ['tiểu đường'], keywords: ['tiểu đường type 2'] },
  { drug: 'Gliclazide 30mg MR', generic: 'Gliclazide', dose: '30mg', route: 'Uống', frequency: '1 lần/ngày', days: 30, instructions: 'Uống vào bữa ăn sáng, không nhai viên thuốc', categories: ['tiểu đường'], keywords: ['tiểu đường type 2','đái tháo đường'] },
  { drug: 'Gliclazide 60mg MR', generic: 'Gliclazide', dose: '60mg', route: 'Uống', frequency: '1 lần/ngày', days: 30, instructions: 'Uống 1 lần duy nhất vào buổi sáng', categories: ['tiểu đường'], keywords: ['tiểu đường type 2'] },
  { drug: 'Glimepiride 1mg', generic: 'Glimepiride', dose: '1mg', route: 'Uống', frequency: '1 lần/ngày', days: 30, instructions: 'Uống ngay trước bữa ăn sáng', categories: ['tiểu đường'], keywords: ['tiểu đường type 2'] },
  { drug: 'Glimepiride 2mg', generic: 'Glimepiride', dose: '2mg', route: 'Uống', frequency: '1 lần/ngày', days: 30, instructions: 'Theo dõi dấu hiệu hạ đường huyết', categories: ['tiểu đường'], keywords: ['tiểu đường type 2','đái tháo đường'] },
  { drug: 'Sitagliptin 50mg', generic: 'Sitagliptin', dose: '50mg', route: 'Uống', frequency: '1 lần/ngày', days: 30, instructions: 'Có thể uống lúc đói hoặc no', categories: ['tiểu đường'], keywords: ['tiểu đường type 2','bệnh thận mạn'] },
  { drug: 'Sitagliptin 100mg', generic: 'Sitagliptin', dose: '100mg', route: 'Uống', frequency: '1 lần/ngày', days: 30, instructions: 'Uống đều đặn hàng ngày', categories: ['tiểu đường'], keywords: ['tiểu đường type 2'] },
  { drug: 'Vildagliptin 50mg', generic: 'Vildagliptin', dose: '50mg', route: 'Uống', frequency: '2 lần/ngày', days: 30, instructions: 'Uống vào buổi sáng và buổi tối', categories: ['tiểu đường'], keywords: ['tiểu đường type 2'] },
  { drug: 'Saxagliptin 5mg', generic: 'Saxagliptin', dose: '5mg', route: 'Uống', frequency: '1 lần/ngày', days: 30, instructions: 'Nuốt nguyên viên thuốc', categories: ['tiểu đường'], keywords: ['tiểu đường type 2'] },
  { drug: 'Empagliflozin 10mg', generic: 'Empagliflozin', dose: '10mg', route: 'Uống', frequency: '1 lần/ngày sáng', days: 30, instructions: 'Uống vào buổi sáng khi bụng đói hoặc no', categories: ['tiểu đường','tim mạch'], keywords: ['tiểu đường type 2','suy tim','bảo vệ tim mạch','bảo vệ thận'] },
  { drug: 'Empagliflozin 25mg', generic: 'Empagliflozin', dose: '25mg', route: 'Uống', frequency: '1 lần/ngày sáng', days: 30, instructions: 'Nên uống vào buổi sáng', categories: ['tiểu đường','tim mạch'], keywords: ['tiểu đường type 2','suy tim'] },
  { drug: 'Dapagliflozin 10mg', generic: 'Dapagliflozin', dose: '10mg', route: 'Uống', frequency: '1 lần/ngày sáng', days: 30, instructions: 'Uống nguyên viên thuốc', categories: ['tiểu đường','tim mạch'], keywords: ['tiểu đường type 2','suy tim','bảo vệ thận'] },
  { drug: 'Canagliflozin 100mg', generic: 'Canagliflozin', dose: '100mg', route: 'Uống', frequency: '1 lần/ngày sáng', days: 30, instructions: 'Nên uống trước bữa ăn sáng', categories: ['tiểu đường','tim mạch'], keywords: ['tiểu đường type 2','suy tim','bảo vệ thận'] },
  { drug: 'Pioglitazone 15mg', generic: 'Pioglitazone', dose: '15mg', route: 'Uống', frequency: '1 lần/ngày', days: 30, instructions: 'Uống kèm hoặc không kèm thức ăn', categories: ['tiểu đường'], keywords: ['tiểu đường type 2','đề kháng insulin'] },
  { drug: 'Pioglitazone 30mg', generic: 'Pioglitazone', dose: '30mg', route: 'Uống', frequency: '1 lần/ngày', days: 30, instructions: 'Theo dõi nếu có tình trạng phù nề', categories: ['tiểu đường'], keywords: ['tiểu đường type 2'] },
  { drug: 'Acarbose 50mg', generic: 'Acarbose', dose: '50mg', route: 'Uống', frequency: '3 lần/ngày', days: 30, instructions: 'Uống ngay trước bữa ăn hoặc nhai cùng miếng ăn đầu tiên', categories: ['tiểu đường'], keywords: ['tiểu đường type 2','đường sau ăn cao'] },
  { drug: 'Insulin Glargine 100UI/mL', generic: 'Insulin glargine', dose: 'Theo chỉ định', route: 'Tiêm dưới da', frequency: '1 lần/ngày', days: 30, instructions: 'Tiêm vào cùng một thời điểm cố định mỗi ngày', categories: ['tiểu đường'], keywords: ['tiểu đường type 1','tiểu đường type 2','insulin nền'] },
  { drug: 'Insulin Aspart 100UI/mL', generic: 'Insulin aspart', dose: 'Theo chỉ chỉ định', route: 'Tiêm dưới da', frequency: '3 lần/ngày trước ăn', days: 30, instructions: 'Tiêm ngay trước bữa ăn (5-10 phút)', categories: ['tiểu đường'], keywords: ['tiểu đường type 1','tiểu đường type 2','insulin nhanh'] },
  { drug: 'Insulin Mixtard 30/70', generic: 'Insulin hỗn hợp', dose: 'Theo chỉ định', route: 'Tiêm dưới da', frequency: '2 lần/ngày', days: 30, instructions: 'Tiêm 30 phút trước bữa ăn sáng và tối', categories: ['tiểu đường'], keywords: ['tiểu đường type 2','insulin hỗn hợp'] },

  // ── DẠ DÀY / TIÊU HÓA ──────────────────────────────────────────────────────
  { drug: 'Omeprazole 20mg', generic: 'Omeprazole', dose: '20mg', route: 'Uống', frequency: '1-2 lần/ngày', days: 14, instructions: 'Uống trước ăn sáng 30-60 phút', categories: ['dạ dày'], keywords: ['loét dạ dày','trào ngược','đau dạ dày','HP'] },
  { drug: 'Omeprazole 40mg', generic: 'Omeprazole', dose: '40mg', route: 'Uống', frequency: '1 lần/ngày', days: 28, instructions: 'Uống khi bụng đói vào buổi sáng', categories: ['dạ dày'], keywords: ['loét dạ dày nặng','xuất huyết tiêu hóa'] },
  { drug: 'Pantoprazole 20mg', generic: 'Pantoprazole', dose: '20mg', route: 'Uống', frequency: '1 lần/ngày', days: 14, instructions: 'Uống 30-60 phút trước ăn sáng', categories: ['dạ dày'], keywords: ['loét dạ dày','trào ngược','đau dạ dày'] },
  { drug: 'Pantoprazole 40mg', generic: 'Pantoprazole', dose: '40mg', route: 'Uống', frequency: '1 lần/ngày', days: 28, instructions: 'Uống nguyên viên, không nhai nát', categories: ['dạ dày'], keywords: ['loét dạ dày','trào ngược nặng','HP'] },
  { drug: 'Esomeprazole 20mg', generic: 'Esomeprazole', dose: '20mg', route: 'Uống', frequency: '1 lần/ngày', days: 14, instructions: 'Nên uống trước bữa ăn 1 giờ', categories: ['dạ dày'], keywords: ['trào ngược','loét dạ dày','GERD'] },
  { drug: 'Esomeprazole 40mg', generic: 'Esomeprazole', dose: '40mg', route: 'Uống', frequency: '1 lần/ngày', days: 28, instructions: 'Uống trước ăn sáng hoặc tối trước khi ngủ 2h', categories: ['dạ dày'], keywords: ['trào ngược nặng','loét dạ dày','HP'] },
  { drug: 'Lansoprazole 15mg', generic: 'Lansoprazole', dose: '15mg', route: 'Uống', frequency: '1 lần/ngày', days: 14, instructions: 'Uống trước ăn sáng', categories: ['dạ dày'], keywords: ['loét dạ dày','trào ngược'] },
  { drug: 'Lansoprazole 30mg', generic: 'Lansoprazole', dose: '30mg', route: 'Uống', frequency: '1 lần/ngày', days: 28, instructions: 'Uống khi bụng đói', categories: ['dạ dày'], keywords: ['loét dạ dày','HP','trào ngược'] },
  { drug: 'Rabeprazole 10mg', generic: 'Rabeprazole', dose: '10mg', route: 'Uống', frequency: '1 lần/ngày', days: 14, instructions: 'Uống buổi sáng trước ăn', categories: ['dạ dày'], keywords: ['loét dạ dày','trào ngược'] },
  { drug: 'Rabeprazole 20mg', generic: 'Rabeprazole', dose: '20mg', route: 'Uống', frequency: '1 lần/ngày', days: 28, instructions: 'Nuốt nguyên viên thuốc', categories: ['dạ dày'], keywords: ['loét dạ dày','HP','trào ngược'] },
  { drug: 'Famotidine 20mg', generic: 'Famotidine', dose: '20mg', route: 'Uống', frequency: '2 lần/ngày', days: 14, instructions: 'Uống buổi sáng và trước khi đi ngủ', categories: ['dạ dày'], keywords: ['loét dạ dày','trào ngược','đau dạ dày'] },
  { drug: 'Ranitidine 150mg', generic: 'Ranitidine', dose: '150mg', route: 'Uống', frequency: '2 lần/ngày', days: 14, instructions: 'Uống buổi sáng và tối', categories: ['dạ dày'], keywords: ['loét dạ dày','trào ngược'] },
  { drug: 'Sucralfate 1g', generic: 'Sucralfate', dose: '1g', route: 'Uống', frequency: '4 lần/ngày', days: 28, instructions: 'Uống khi bụng đói (1h trước ăn hoặc 2h sau ăn)', categories: ['dạ dày'], keywords: ['loét dạ dày','bảo vệ niêm mạc'] },
  { drug: 'Bismuth subcitrate 120mg', generic: 'Bismuth subcitrate', dose: '120mg', route: 'Uống', frequency: '4 lần/ngày', days: 14, instructions: 'Có thể làm phân có màu đen', categories: ['dạ dày'], keywords: ['loét dạ dày','HP','viêm dạ dày'] },
  { drug: 'Domperidone 10mg', generic: 'Domperidone', dose: '10mg', route: 'Uống', frequency: '3 lần/ngày', days: 7, instructions: 'Uống trước bữa ăn 15-30 phút', categories: ['dạ dày','tiêu hóa'], keywords: ['buồn nôn','nôn','đầy bụng','chậm tiêu'] },
  { drug: 'Metoclopramide 10mg', generic: 'Metoclopramide', dose: '10mg', route: 'Uống', frequency: '3 lần/ngày', days: 5, instructions: 'Uống 30 phút trước ăn chính', categories: ['dạ dày','tiêu hóa'], keywords: ['buồn nôn','nôn','đầy bụng','liệt dạ dày'] },
  { drug: 'Ondansetron 4mg', generic: 'Ondansetron', dose: '4mg', route: 'Uống', frequency: '2 lần/ngày', days: 3, instructions: 'Dùng theo chỉ dẫn của bác sĩ', categories: ['dạ dày','tiêu hóa'], keywords: ['nôn nặng','buồn nôn sau hoá trị','nôn sau phẫu thuật'] },
  { drug: 'Ondansetron 8mg', generic: 'Ondansetron', dose: '8mg', route: 'Uống', frequency: '2 lần/ngày', days: 3, instructions: 'Dùng cho các trường hợp nôn mửa nặng', categories: ['dạ dày','tiêu hóa'], keywords: ['nôn nặng','nôn sau hoá trị'] },
  { drug: 'Smecta gói 3g', generic: 'Diosmectite', dose: '3g', route: 'Uống', frequency: '3 lần/ngày', days: 3, instructions: 'Pha với nước hoặc trộn thức ăn sệt', categories: ['dạ dày','tiêu hóa'], keywords: ['tiêu chảy','đau bụng','viêm đại tràng','trẻ em'] },
  { drug: 'Loperamide 2mg', generic: 'Loperamide', dose: '2mg', route: 'Uống', frequency: 'Sau mỗi lần đi ngoài phân lỏng', days: 3, instructions: 'Không dùng quá 8mg/ngày', categories: ['dạ dày','tiêu hóa'], keywords: ['tiêu chảy cấp','hội chứng ruột kích thích'] },
  { drug: 'Oresol gói', generic: 'Oral rehydration salts', dose: '1 gói', route: 'Uống', frequency: 'Uống thay nước khi khát', days: 3, instructions: 'Pha đúng lượng nước ghi trên bao bì', categories: ['dạ dày','tiêu hóa'], keywords: ['tiêu chảy','mất nước','nôn'] },
  { drug: 'Simethicone 80mg', generic: 'Simethicone', dose: '80mg', route: 'Uống', frequency: '3-4 lần/ngày', days: 7, instructions: 'Uống sau bữa ăn và trước khi đi ngủ', categories: ['dạ dày','tiêu hóa'], keywords: ['đầy hơi','chướng bụng','đau bụng do hơi'] },
  { drug: 'Trimebutine 100mg', generic: 'Trimebutine', dose: '100mg', route: 'Uống', frequency: '3 lần/ngày', days: 14, instructions: 'Uống trước khi ăn', categories: ['dạ dày','tiêu hóa'], keywords: ['hội chứng ruột kích thích','co thắt đại tràng','đau bụng'] },
  { drug: 'Mebeverine 135mg', generic: 'Mebeverine', dose: '135mg', route: 'Uống', frequency: '3 lần/ngày', days: 14, instructions: 'Uống 20 phút trước bữa ăn', categories: ['dạ dày','tiêu hóa'], keywords: ['hội chứng ruột kích thích','co thắt đại tràng'] },
  { drug: 'Lactulose 10g/15mL', generic: 'Lactulose', dose: '15mL', route: 'Uống', frequency: '1-2 lần/ngày', days: 14, instructions: 'Có thể pha loãng với nước hoặc nước trái cây', categories: ['dạ dày','tiêu hóa'], keywords: ['táo bón','táo bón mạn tính','xơ gan','bệnh não gan'] },
  { drug: 'Bisacodyl 5mg', generic: 'Bisacodyl', dose: '5mg', route: 'Uống', frequency: '1-2 viên/ngày tối', days: 5, instructions: 'Nên uống vào buổi tối trước khi ngủ', categories: ['dạ dày','tiêu hóa'], keywords: ['táo bón','làm sạch đại tràng'] },
  { drug: 'Polyethylene glycol 17g gói', generic: 'PEG 3350', dose: '17g', route: 'Uống', frequency: '1 lần/ngày', days: 7, instructions: 'Hòa tan vào 120-240ml nước', categories: ['dạ dày','tiêu hóa'], keywords: ['táo bón','làm sạch ruột'] },
  { drug: 'Ursodeoxycholic acid 250mg', generic: 'UDCA', dose: '250mg', route: 'Uống', frequency: '2-3 lần/ngày', days: 30, instructions: 'Uống trong bữa ăn', categories: ['dạ dày','gan mật'], keywords: ['sỏi mật cholesterol','xơ gan mật nguyên phát','bệnh gan mạn'] },
  { drug: 'Silymarin 140mg', generic: 'Silymarin', dose: '140mg', route: 'Uống', frequency: '2-3 lần/ngày', days: 30, instructions: 'Uống sau bữa ăn', categories: ['gan mật'], keywords: ['bảo vệ gan','viêm gan','mỡ gan','tăng men gan'] },
  { drug: 'Ademetionine 400mg (SAMe)', generic: 'S-Adenosyl methionine', dose: '400mg', route: 'Uống', frequency: '2 lần/ngày', days: 30, instructions: 'Nên uống giữa các bữa ăn', categories: ['gan mật'], keywords: ['bệnh gan','ứ mật','trầm cảm'] },
  { drug: 'Adefovir dipivoxil 10mg', generic: 'Adefovir', dose: '10mg', route: 'Uống', frequency: '1 lần/ngày', days: 30, instructions: 'Uống vào cùng một thời điểm hàng ngày', categories: ['gan mật','kháng virus'], keywords: ['viêm gan B mạn'] },
  { drug: 'Tenofovir 300mg', generic: 'Tenofovir disoproxil', dose: '300mg', route: 'Uống', frequency: '1 lần/ngày', days: 30, instructions: 'Uống kèm với thức ăn để hấp thu tốt hơn', categories: ['gan mật','kháng virus'], keywords: ['viêm gan B mạn','HIV'] },
  { drug: 'Entecavir 0.5mg', generic: 'Entecavir', dose: '0.5mg', route: 'Uống', frequency: '1 lần/ngày', days: 30, instructions: 'Uống khi bụng đói (ít nhất 2h trước hoặc sau ăn)', categories: ['gan mật','kháng virus'], keywords: ['viêm gan B mạn'] },

  // ── HÔ HẤP ──────────────────────────────────────────────────────────────────
  { drug: 'Salbutamol 2mg', generic: 'Salbutamol', dose: '2mg', route: 'Uống', frequency: '3-4 lần/ngày', days: 7, instructions: 'Theo dõi nếu có tình trạng run tay hoặc nhịp tim nhanh', categories: ['hô hấp'], keywords: ['hen suyễn','khó thở','co thắt phế quản','trẻ em'] },
  { drug: 'Salbutamol 4mg', generic: 'Salbutamol', dose: '4mg', route: 'Uống', frequency: '3-4 lần/ngày', days: 7, instructions: 'Thường dùng cho người lớn', categories: ['hô hấp'], keywords: ['hen suyễn','khó thở','COPD'] },
  { drug: 'Salbutamol MDI 100mcg/nhát', generic: 'Salbutamol', dose: '1-2 nhát', route: 'Hít', frequency: 'Khi có cơn khó thở', days: 30, instructions: 'Lắc đều trước khi xịt, hít sâu và nín thở 10s', categories: ['hô hấp'], keywords: ['hen suyễn','khó thở cấp','COPD','co thắt phế quản'] },
  { drug: 'Terbutaline 2.5mg', generic: 'Terbutaline', dose: '2.5mg', route: 'Uống', frequency: '3 lần/ngày', days: 7, instructions: 'Có thể gây hồi hộp, đánh trống ngực', categories: ['hô hấp'], keywords: ['hen suyễn','co thắt phế quản','khó thở'] },
  { drug: 'Ipratropium MDI 20mcg/nhát', generic: 'Ipratropium bromide', dose: '2 nhát', route: 'Hít', frequency: '3-4 lần/ngày', days: 30, instructions: 'Xịt định kỳ để kiểm soát triệu chứng', categories: ['hô hấp'], keywords: ['COPD','hen suyễn','khó thở mạn'] },
  { drug: 'Tiotropium 18mcg (Spiriva HandiHaler)', generic: 'Tiotropium', dose: '18mcg', route: 'Hít', frequency: '1 lần/ngày', days: 30, instructions: 'Chỉ dùng để hít qua dụng cụ, không được nuốt viên nang', categories: ['hô hấp'], keywords: ['COPD','khó thở mạn tính'] },
  { drug: 'Formoterol 12mcg', generic: 'Formoterol', dose: '12mcg', route: 'Hít', frequency: '2 lần/ngày', days: 30, instructions: 'Tác dụng kéo dài 12 giờ', categories: ['hô hấp'], keywords: ['COPD','hen suyễn mạn','dự phòng'] },
  { drug: 'Salmeterol 25mcg MDI', generic: 'Salmeterol', dose: '25mcg', route: 'Hít', frequency: '2 lần/ngày', days: 30, instructions: 'Không dùng để cắt cơn khó thở cấp', categories: ['hô hấp'], keywords: ['COPD','hen suyễn mạn'] },
  { drug: 'Budesonide MDI 200mcg/nhát', generic: 'Budesonide', dose: '1-2 nhát', route: 'Hít', frequency: '2 lần/ngày', days: 30, instructions: 'Súc miệng sạch bằng nước sau khi hít', categories: ['hô hấp','corticoid'], keywords: ['hen suyễn','COPD','dự phòng'] },
  { drug: 'Fluticasone MDI 125mcg/nhát', generic: 'Fluticasone', dose: '1-2 nhát', route: 'Hít', frequency: '2 lần/ngày', days: 30, instructions: 'Dùng đều đặn hàng ngày, súc miệng sau dùng', categories: ['hô hấp','corticoid'], keywords: ['hen suyễn','COPD','dự phòng'] },
  { drug: 'Budesonide+Formoterol MDI (Symbicort)', generic: 'Budesonide/Formoterol', dose: '1-2 nhát', route: 'Hít', frequency: '2 lần/ngày', days: 30, instructions: 'Súc miệng kỹ sau khi dùng thuốc', categories: ['hô hấp'], keywords: ['hen suyễn','COPD','phối hợp ICS-LABA'] },
  { drug: 'Fluticasone+Salmeterol Diskus (Seretide)', generic: 'Fluticasone/Salmeterol', dose: '1 nhát hít', route: 'Hít', frequency: '2 lần/ngày', days: 30, instructions: 'Hít nhanh và mạnh, súc miệng sau khi dùng', categories: ['hô hấp'], keywords: ['hen suyễn','COPD','phối hợp ICS-LABA'] },
  { drug: 'Montelukast 4mg nhai', generic: 'Montelukast', dose: '4mg', route: 'Uống', frequency: '1 lần/ngày tối', days: 30, instructions: 'Nên dùng vào buổi tối', categories: ['hô hấp','dị ứng'], keywords: ['hen suyễn','dị ứng','viêm mũi dị ứng','trẻ em'] },
  { drug: 'Montelukast 5mg nhai', generic: 'Montelukast', dose: '5mg', route: 'Uống', frequency: '1 lần/ngày tối', days: 30, instructions: 'Viên nhai, dùng buổi tối', categories: ['hô hấp','dị ứng'], keywords: ['hen suyễn','dị ứng','viêm mũi dị ứng'] },
  { drug: 'Montelukast 10mg', generic: 'Montelukast', dose: '10mg', route: 'Uống', frequency: '1 lần/ngày tối', days: 30, instructions: 'Uống vào buổi tối trước khi ngủ', categories: ['hô hấp','dị ứng'], keywords: ['hen suyễn','dị ứng','viêm mũi dị ứng'] },
  { drug: 'N-Acetylcysteine 200mg', generic: 'NAC', dose: '200mg', route: 'Uống', frequency: '3 lần/ngày', days: 7, instructions: 'Uống với nhiều nước để giúp loãng đờm', categories: ['hô hấp'], keywords: ['ho có đờm','viêm phế quản','COPD','bệnh phổi mạn'] },
  { drug: 'N-Acetylcysteine 600mg sủi', generic: 'NAC', dose: '600mg', route: 'Uống', frequency: '1 lần/ngày sáng', days: 7, instructions: 'Hòa tan viên sủi vào 1 ly nước', categories: ['hô hấp'], keywords: ['ho có đờm nhiều','COPD'] },
  { drug: 'Erdosteine 150mg', generic: 'Erdosteine', dose: '150mg', route: 'Uống', frequency: '2 lần/ngày', days: 7, instructions: 'Uống sau bữa ăn', categories: ['hô hấp'], keywords: ['ho có đờm','COPD','viêm phế quản mạn','trẻ em'] },
  { drug: 'Erdosteine 300mg', generic: 'Erdosteine', dose: '300mg', route: 'Uống', frequency: '2 lần/ngày', days: 7, instructions: 'Thường dùng cho đợt cấp viêm phế quản', categories: ['hô hấp'], keywords: ['ho có đờm','COPD','viêm phế quản mạn'] },
  { drug: 'Ambroxol 30mg', generic: 'Ambroxol', dose: '30mg', route: 'Uống', frequency: '3 lần/ngày', days: 7, instructions: 'Uống sau bữa ăn', categories: ['hô hấp'], keywords: ['ho có đờm','viêm phế quản','long đờm'] },
  { drug: 'Bromhexine 8mg', generic: 'Bromhexine', dose: '8mg', route: 'Uống', frequency: '3 lần/ngày', days: 7, instructions: 'Nên uống kèm nhiều nước', categories: ['hô hấp'], keywords: ['ho có đờm','long đờm'] },
  { drug: 'Guaifenesin 200mg', generic: 'Guaifenesin', dose: '200mg', route: 'Uống', frequency: 'Mỗi 4 giờ', days: 5, instructions: 'Không dùng quá 2.4g/ngày', categories: ['hô hấp'], keywords: ['ho có đờm','long đờm','cảm cúm'] },
  { drug: 'Dextromethorphan 15mg', generic: 'Dextromethorphan', dose: '15mg', route: 'Uống', frequency: '3-4 lần/ngày', days: 5, instructions: 'Không dùng cho ho có đờm nhiều', categories: ['hô hấp'], keywords: ['ho khan','ho khan kéo dài','cảm cúm'] },
  { drug: 'Theophylline 100mg', generic: 'Theophylline', dose: '100mg', route: 'Uống', frequency: '2-3 lần/ngày', days: 14, instructions: 'Uống sau bữa ăn, tránh dùng caffein quá mức', categories: ['hô hấp'], keywords: ['hen suyễn','khó thở','COPD'] },
  { drug: 'Theophylline SR 200mg', generic: 'Theophylline', dose: '200mg', route: 'Uống', frequency: '2 lần/ngày', days: 14, instructions: 'Nuốt nguyên viên thuốc giải phóng chậm', categories: ['hô hấp'], keywords: ['hen suyễn mạn','COPD'] },

  // ── THẦN KINH / TÂM THẦN ────────────────────────────────────────────────────
  { drug: 'Gabapentin 100mg', generic: 'Gabapentin', dose: '100mg', route: 'Uống', frequency: '3 lần/ngày', days: 30, instructions: 'Nên bắt đầu liều thấp vào buổi tối', categories: ['thần kinh'], keywords: ['đau thần kinh','động kinh','đau sau zona'] },
  { drug: 'Gabapentin 300mg', generic: 'Gabapentin', dose: '300mg', route: 'Uống', frequency: '3 lần/ngày', days: 30, instructions: 'Theo dõi nếu có chóng mặt, buồn ngủ', categories: ['thần kinh'], keywords: ['đau thần kinh','động kinh','đau mạn tính'] },
  { drug: 'Gabapentin 600mg', generic: 'Gabapentin', dose: '600mg', route: 'Uống', frequency: '2-3 lần/ngày', days: 30, instructions: 'Dùng theo chỉ định nghiêm ngặt', categories: ['thần kinh'], keywords: ['đau thần kinh nặng','động kinh','bất an chân'] },
  { drug: 'Pregabalin 75mg', generic: 'Pregabalin', dose: '75mg', route: 'Uống', frequency: '2 lần/ngày', days: 30, instructions: 'Có thể uống kèm hoặc không kèm thức ăn', categories: ['thần kinh'], keywords: ['đau thần kinh','lo âu','đau sợi cơ'] },
  { drug: 'Pregabalin 150mg', generic: 'Pregabalin', dose: '150mg', route: 'Uống', frequency: '2 lần/ngày', days: 30, instructions: 'Theo dõi tình trạng sưng phù ở chi', categories: ['thần kinh'], keywords: ['đau thần kinh','đau tiểu đường','lo âu'] },
  { drug: 'Carbamazepine 200mg', generic: 'Carbamazepine', dose: '200mg', route: 'Uống', frequency: '2 lần/ngày', days: 30, instructions: 'Uống trong bữa ăn. Hạn chế dùng bưởi chùm.', categories: ['thần kinh'], keywords: ['động kinh','đau dây thần kinh 5','rối loạn lưỡng cực'] },
  { drug: 'Valproate 200mg', generic: 'Sodium valproate', dose: '200mg', route: 'Uống', frequency: '2 lần/ngày', days: 30, instructions: 'Theo dõi chức năng gan định kỳ', categories: ['thần kinh'], keywords: ['động kinh','đau nửa đầu dự phòng','rối loạn lưỡng cực'] },
  { drug: 'Valproate 500mg', generic: 'Sodium valproate', dose: '500mg', route: 'Uống', frequency: '2 lần/ngày', days: 30, instructions: 'Không bẻ hoặc nhai viên thuốc', categories: ['thần kinh'], keywords: ['động kinh','rối loạn lưỡng cực'] },
  { drug: 'Levetiracetam 250mg', generic: 'Levetiracetam', dose: '250mg', route: 'Uống', frequency: '2 lần/ngày', days: 30, instructions: 'Uống cách nhau 12 giờ', categories: ['thần kinh'], keywords: ['động kinh'] },
  { drug: 'Levetiracetam 500mg', generic: 'Levetiracetam', dose: '500mg', route: 'Uống', frequency: '2 lần/ngày', days: 30, instructions: 'Uống đều đặn hàng ngày', categories: ['thần kinh'], keywords: ['động kinh'] },
  { drug: 'Phenytoin 100mg', generic: 'Phenytoin', dose: '100mg', route: 'Uống', frequency: '2-3 lần/ngày', days: 30, instructions: 'Vệ sinh răng miệng kỹ để tránh phì đại nướu', categories: ['thần kinh'], keywords: ['động kinh','loạn nhịp tim'] },
  { drug: 'Betahistine 8mg', generic: 'Betahistine', dose: '8mg', route: 'Uống', frequency: '3 lần/ngày', days: 14, instructions: 'Nên uống thuốc cùng bữa ăn', categories: ['thần kinh'], keywords: ['chóng mặt','ù tai','Meniere','thiểu năng tuần hoàn não'] },
  { drug: 'Betahistine 16mg', generic: 'Betahistine', dose: '16mg', route: 'Uống', frequency: '3 lần/ngày', days: 14, instructions: 'Nên uống sau ăn', categories: ['thần kinh'], keywords: ['chóng mặt','ù tai','Meniere'] },
  { drug: 'Betahistine 24mg', generic: 'Betahistine', dose: '24mg', route: 'Uống', frequency: '2 lần/ngày', days: 14, instructions: 'Dành cho chóng mặt mức độ nặng', categories: ['thần kinh'], keywords: ['chóng mặt nặng','Meniere'] },
  { drug: 'Flunarizine 5mg', generic: 'Flunarizine', dose: '5mg', route: 'Uống', frequency: '1 lần/ngày tối', days: 30, instructions: 'Nên uống vào buổi tối trước khi ngủ', categories: ['thần kinh'], keywords: ['chóng mặt','đau nửa đầu dự phòng','thiểu năng tuần hoàn não'] },
  { drug: 'Cinnarizine 25mg', generic: 'Cinnarizine', dose: '25mg', route: 'Uống', frequency: '3 lần/ngày', days: 7, instructions: 'Uống sau bữa ăn', categories: ['thần kinh'], keywords: ['chóng mặt','say tàu xe','thiểu năng tuần hoàn não'] },
  { drug: 'Sumatriptan 50mg', generic: 'Sumatriptan', dose: '50mg', route: 'Uống', frequency: 'Uống ngay khi đau', days: 1, instructions: 'Dùng ngay khi có triệu chứng đau đầu Migraine', categories: ['thần kinh'], keywords: ['đau nửa đầu Migraine cấp'] },
  { drug: 'Zolmitriptan 2.5mg', generic: 'Zolmitriptan', dose: '2.5mg', route: 'Uống', frequency: 'Khi có cơn đau', days: 1, instructions: 'Có thể dùng liều thứ 2 sau 2 giờ nếu chưa đỡ', categories: ['thần kinh'], keywords: ['đau nửa đầu Migraine cấp'] },
  { drug: 'Topiramate 25mg', generic: 'Topiramate', dose: '25mg', route: 'Uống', frequency: '2 lần/ngày', days: 30, instructions: 'Uống nhiều nước để tránh sỏi thận', categories: ['thần kinh'], keywords: ['đau nửa đầu dự phòng','động kinh'] },
  { drug: 'Piracetam 400mg', generic: 'Piracetam', dose: '400mg', route: 'Uống', frequency: '3 lần/ngày', days: 30, instructions: 'Theo dõi nếu có tình trạng kích thích, bồn chồn', categories: ['thần kinh'], keywords: ['suy giảm nhận thức','sau đột quỵ','chóng mặt'] },
  { drug: 'Piracetam 800mg', generic: 'Piracetam', dose: '800mg', route: 'Uống', frequency: '2-3 lần/ngày', days: 30, instructions: 'Dùng cho bệnh nhân cần liều cao', categories: ['thần kinh'], keywords: ['suy giảm nhận thức','sau đột quỵ'] },
  { drug: 'Ginkgo biloba 40mg', generic: 'Ginkgo biloba extract', dose: '40mg', route: 'Uống', frequency: '3 lần/ngày', days: 30, instructions: 'Uống trong hoặc sau bữa ăn', categories: ['thần kinh'], keywords: ['suy giảm nhận thức','rối loạn tuần hoàn não','chóng mặt','ù tai'] },
  { drug: 'Donepezil 5mg', generic: 'Donepezil', dose: '5mg', route: 'Uống', frequency: '1 lần/ngày tối', days: 30, instructions: 'Uống ngay trước khi đi ngủ', categories: ['thần kinh'], keywords: ['Alzheimer','sa sút trí tuệ'] },
  { drug: 'Donepezil 10mg', generic: 'Donepezil', dose: '10mg', route: 'Uống', frequency: '1 lần/ngày tối', days: 30, instructions: 'Thường tăng liều sau 4-6 tuần dùng liều 5mg', categories: ['thần kinh'], keywords: ['Alzheimer','sa sút trí tuệ nặng'] },
  { drug: 'Rivastigmine 1.5mg', generic: 'Rivastigmine', dose: '1.5mg', route: 'Uống', frequency: '2 lần/ngày', days: 30, instructions: 'Uống trong bữa ăn sáng và tối', categories: ['thần kinh'], keywords: ['Alzheimer','sa sút trí tuệ Parkinson'] },
  { drug: 'Memantine 10mg', generic: 'Memantine', dose: '10mg', route: 'Uống', frequency: '1-2 lần/ngày', days: 30, instructions: 'Có thể uống kèm hoặc không kèm thức ăn', categories: ['thần kinh'], keywords: ['Alzheimer giai đoạn trung bình-nặng'] },
  { drug: 'Levodopa-Carbidopa 250/25mg', generic: 'Levodopa + Carbidopa', dose: '1 viên', route: 'Uống', frequency: '3 lần/ngày', days: 30, instructions: 'Uống trước ăn 30p hoặc sau ăn 1h. Tránh ăn nhiều đạm gần lúc uống.', categories: ['thần kinh'], keywords: ['Parkinson'] },
  { drug: 'Pramipexole 0.25mg', generic: 'Pramipexole', dose: '0.25mg', route: 'Uống', frequency: '3 lần/ngày', days: 30, instructions: 'Dùng theo liều tăng dần của bác sĩ', categories: ['thần kinh'], keywords: ['Parkinson','bất an chân'] },
  { drug: 'Sertraline 50mg', generic: 'Sertraline', dose: '50mg', route: 'Uống', frequency: '1 lần/ngày sáng', days: 30, instructions: 'Nên uống vào buổi sáng', categories: ['tâm thần'], keywords: ['trầm cảm','lo âu','OCD','PTSD'] },
  { drug: 'Sertraline 100mg', generic: 'Sertraline', dose: '100mg', route: 'Uống', frequency: '1 lần/ngày sáng', days: 30, instructions: 'Dùng cho các trường hợp nặng theo chỉ định', categories: ['tâm thần'], keywords: ['trầm cảm nặng','lo âu'] },
  { drug: 'Fluoxetine 20mg', generic: 'Fluoxetine', dose: '20mg', route: 'Uống', frequency: '1 lần/ngày sáng', days: 30, instructions: 'Uống vào buổi sáng để tránh mất ngủ', categories: ['tâm thần'], keywords: ['trầm cảm','OCD','rối loạn ăn uống','lo âu'] },
  { drug: 'Escitalopram 10mg', generic: 'Escitalopram', dose: '10mg', route: 'Uống', frequency: '1 lần/ngày', days: 30, instructions: 'Có thể uống sáng hoặc tối', categories: ['tâm thần'], keywords: ['trầm cảm','lo âu','rối loạn hoảng sợ'] },
  { drug: 'Escitalopram 20mg', generic: 'Escitalopram', dose: '20mg', route: 'Uống', frequency: '1 lần/ngày', days: 30, instructions: 'Theo dõi nếu có tình trạng buồn nôn lúc mới bắt đầu', categories: ['tâm thần'], keywords: ['trầm cảm nặng','lo âu'] },
  { drug: 'Paroxetine 20mg', generic: 'Paroxetine', dose: '20mg', route: 'Uống', frequency: '1 lần/ngày sáng', days: 30, instructions: 'Uống vào buổi sáng cùng thức ăn', categories: ['tâm thần'], keywords: ['trầm cảm','lo âu','OCD'] },
  { drug: 'Venlafaxine 75mg', generic: 'Venlafaxine', dose: '75mg', route: 'Uống', frequency: '1 lần/ngày', days: 30, instructions: 'Uống trong bữa ăn', categories: ['tâm thần'], keywords: ['trầm cảm','lo âu','đau thần kinh','mãn kinh'] },
  { drug: 'Duloxetine 30mg', generic: 'Duloxetine', dose: '30mg', route: 'Uống', frequency: '1 lần/ngày', days: 30, instructions: 'Nên nuốt nguyên viên thuốc', categories: ['tâm thần','giảm đau'], keywords: ['trầm cảm','lo âu','đau thần kinh tiểu đường','đau sợi cơ'] },
  { drug: 'Duloxetine 60mg', generic: 'Duloxetine', dose: '60mg', route: 'Uống', frequency: '1 lần/ngày', days: 30, instructions: 'Dùng cho giảm đau thần kinh mạn tính', categories: ['tâm thần','giảm đau'], keywords: ['trầm cảm','đau thần kinh'] },
  { drug: 'Mirtazapine 15mg', generic: 'Mirtazapine', dose: '15mg', route: 'Uống', frequency: '1 lần/ngày tối', days: 30, instructions: 'Uống ngay trước khi đi ngủ', categories: ['tâm thần'], keywords: ['trầm cảm','mất ngủ','chán ăn'] },
  { drug: 'Mirtazapine 30mg', generic: 'Mirtazapine', dose: '30mg', route: 'Uống', frequency: '1 lần/ngày tối', days: 30, instructions: 'Uống buổi tối vì thuốc gây buồn ngủ mạnh', categories: ['tâm thần'], keywords: ['trầm cảm nặng'] },
  { drug: 'Alprazolam 0.25mg', generic: 'Alprazolam', dose: '0.25mg', route: 'Uống', frequency: '2-3 lần/ngày', days: 14, instructions: 'Tránh dùng thuốc trong thời gian dài vì dễ gây nghiện', categories: ['tâm thần'], keywords: ['lo âu','hoảng sợ','mất ngủ'] },
  { drug: 'Alprazolam 0.5mg', generic: 'Alprazolam', dose: '0.5mg', route: 'Uống', frequency: '2 lần/ngày', days: 14, instructions: 'Dùng liều thấp nhất có hiệu quả', categories: ['tâm thần'], keywords: ['lo âu','hoảng sợ'] },
  { drug: 'Diazepam 5mg', generic: 'Diazepam', dose: '5mg', route: 'Uống', frequency: '1-2 lần/ngày', days: 10, instructions: 'Tránh uống rượu khi dùng thuốc', categories: ['tâm thần'], keywords: ['lo âu','co giật','co thắt cơ','mất ngủ'] },
  { drug: 'Clonazepam 0.5mg', generic: 'Clonazepam', dose: '0.5mg', route: 'Uống', frequency: '2 lần/ngày', days: 30, instructions: 'Không được ngưng thuốc đột ngột', categories: ['tâm thần'], keywords: ['lo âu','động kinh','hoảng sợ'] },
  { drug: 'Zolpidem 5mg', generic: 'Zolpidem', dose: '5mg', route: 'Uống', frequency: '1 lần/ngày tối', days: 14, instructions: 'Uống ngay trước khi đi ngủ, chỉ khi có 7-8h để ngủ', categories: ['tâm thần'], keywords: ['mất ngủ'] },
  { drug: 'Zolpidem 10mg', generic: 'Zolpidem', dose: '10mg', route: 'Uống', frequency: '1 lần/ngày tối', days: 7, instructions: 'Dành cho trường hợp mất ngủ nặng', categories: ['tâm thần'], keywords: ['mất ngủ nặng'] },
  { drug: 'Quetiapine 25mg', generic: 'Quetiapine', dose: '25mg', route: 'Uống', frequency: '1 lần/ngày tối', days: 30, instructions: 'Thường dùng liều thấp hỗ trợ giấc ngủ', categories: ['tâm thần'], keywords: ['tâm thần phân liệt','rối loạn lưỡng cực','mất ngủ'] },
  { drug: 'Haloperidol 1.5mg', generic: 'Haloperidol', dose: '1.5mg', route: 'Uống', frequency: '2 lần/ngày', days: 30, instructions: 'Theo dõi nếu có tình trạng cứng cơ, run rẩy', categories: ['tâm thần'], keywords: ['tâm thần phân liệt','ảo giác','kích động'] },
  { drug: 'Risperidone 1mg', generic: 'Risperidone', dose: '1mg', route: 'Uống', frequency: '1-2 lần/ngày', days: 30, instructions: 'Có thể uống kèm hoặc ngoài bữa ăn', categories: ['tâm thần'], keywords: ['tâm thần phân liệt','rối loạn lưỡng cực'] },

  // ── NỘI TIẾT / TUYẾN GIÁP ───────────────────────────────────────────────────
  { drug: 'Levothyroxine 25mcg', generic: 'Levothyroxine', dose: '25mcg', route: 'Uống', frequency: '1 lần/ngày sáng', days: 30, instructions: 'Uống khi bụng đói, 30-60 phút trước ăn sáng', categories: ['nội tiết'], keywords: ['suy giáp','nhân giáp','sau cắt tuyến giáp'] },
  { drug: 'Levothyroxine 50mcg', generic: 'Levothyroxine', dose: '50mcg', route: 'Uống', frequency: '1 lần/ngày sáng', days: 30, instructions: 'Uống với nước lọc, không uống cùng cà phê hay sữa', categories: ['nội tiết'], keywords: ['suy giáp','suy giáp dưới lâm sàng'] },
  { drug: 'Levothyroxine 100mcg', generic: 'Levothyroxine', dose: '100mcg', route: 'Uống', frequency: '1 lần/ngày sáng', days: 30, instructions: 'Uống ngay khi thức dậy', categories: ['nội tiết'], keywords: ['suy giáp nặng','sau cắt tuyến giáp','ung thư tuyến giáp'] },
  { drug: 'Propylthiouracil (PTU) 50mg', generic: 'Propylthiouracil', dose: '50mg', route: 'Uống', frequency: '3 lần/ngày', days: 30, instructions: 'Uống cách nhau 8 giờ. Báo bác sĩ nếu sốt, đau họng.', categories: ['nội tiết'], keywords: ['cường giáp','Basedow','bão giáp'] },
  { drug: 'Methimazole 5mg (Carbimazole)', generic: 'Methimazole', dose: '5mg', route: 'Uống', frequency: '1-2 lần/ngày', days: 30, instructions: 'Uống cùng giờ mỗi ngày', categories: ['nội tiết'], keywords: ['cường giáp','Basedow'] },
  { drug: 'Prednisolone 5mg', generic: 'Prednisolone', dose: '5mg', route: 'Uống', frequency: '1 lần/ngày sáng', days: 7, instructions: 'Nên uống vào buổi sáng sau khi ăn no', categories: ['corticoid'], keywords: ['dị ứng nặng','hen suyễn','viêm khớp','lupus','IBD'] },
  { drug: 'Prednisolone 10mg', generic: 'Prednisolone', dose: '10mg', route: 'Uống', frequency: '1 lần/ngày sáng', days: 7, instructions: 'Không nên ngưng thuốc đột ngột nếu dùng dài ngày', categories: ['corticoid'], keywords: ['viêm nặng','dị ứng nặng'] },
  { drug: 'Prednisolone 20mg', generic: 'Prednisolone', dose: '20mg', route: 'Uống', frequency: '1 lần/ngày sáng', days: 5, instructions: 'Uống sau bữa ăn sáng', categories: ['corticoid'], keywords: ['viêm nặng','đợt cấp hen','viêm khớp dạng thấp'] },
  { drug: 'Methylprednisolone 4mg', generic: 'Methylprednisolone', dose: '4mg', route: 'Uống', frequency: '1-2 lần/ngày', days: 7, instructions: 'Uống sau bữa ăn', categories: ['corticoid'], keywords: ['dị ứng','viêm khớp','viêm nặng'] },
  { drug: 'Methylprednisolone 16mg', generic: 'Methylprednisolone', dose: '16mg', route: 'Uống', frequency: '1 lần/ngày sáng', days: 5, instructions: 'Uống 1 lần duy nhất vào buổi sáng sau ăn', categories: ['corticoid'], keywords: ['viêm nặng','đợt cấp COPD','viêm khớp dạng thấp'] },
  { drug: 'Dexamethasone 0.5mg', generic: 'Dexamethasone', dose: '0.5mg', route: 'Uống', frequency: '2-3 lần/ngày', days: 5, instructions: 'Dùng theo chỉ định nghiêm ngặt', categories: ['corticoid'], keywords: ['viêm nặng','phù não','buồn nôn do hoá trị'] },
  { drug: 'Fludrocortisone 0.1mg', generic: 'Fludrocortisone', dose: '0.1mg', route: 'Uống', frequency: '1 lần/ngày', days: 30, instructions: 'Uống vào buổi sáng', categories: ['corticoid'], keywords: ['suy thượng thận','hạ huyết áp tư thế'] },
  { drug: 'Allopurinol 100mg', generic: 'Allopurinol', dose: '100mg', route: 'Uống', frequency: '1 lần/ngày', days: 30, instructions: 'Uống sau ăn, uống nhiều nước (2-3 lít/ngày)', categories: ['gout'], keywords: ['gout','tăng acid uric','dự phòng cơn gout'] },
  { drug: 'Allopurinol 300mg', generic: 'Allopurinol', dose: '300mg', route: 'Uống', frequency: '1 lần/ngày', days: 30, instructions: 'Báo bác sĩ nếu có phát ban da', categories: ['gout'], keywords: ['gout mạn','tăng acid uric nặng'] },
  { drug: 'Febuxostat 40mg', generic: 'Febuxostat', dose: '40mg', route: 'Uống', frequency: '1 lần/ngày', days: 30, instructions: 'Có thể dùng kèm hoặc không kèm thức ăn', categories: ['gout'], keywords: ['gout','tăng acid uric','dị ứng allopurinol'] },
  { drug: 'Febuxostat 80mg', generic: 'Febuxostat', dose: '80mg', route: 'Uống', frequency: '1 lần/ngày', days: 30, instructions: 'Dành cho bệnh nhân Gout mạn tính nặng', categories: ['gout'], keywords: ['gout mạn','hạt tophi'] },
  { drug: 'Colchicine 0.5mg', generic: 'Colchicine', dose: '0.5mg', route: 'Uống', frequency: '1-3 lần/ngày', days: 5, instructions: 'Uống ngay khi có dấu hiệu cơn Gout cấp', categories: ['gout','giảm đau'], keywords: ['cơn gout cấp','dự phòng gout','sốt Địa Trung Hải'] },
  { drug: 'Probenecid 500mg', generic: 'Probenecid', dose: '500mg', route: 'Uống', frequency: '2 lần/ngày', days: 30, instructions: 'Nên uống kèm nhiều nước', categories: ['gout'], keywords: ['gout','tăng thải acid uric'] },

  // ── DỊ ỨNG / DA ─────────────────────────────────────────────────────────────
  { drug: 'Loratadine 10mg', generic: 'Loratadine', dose: '10mg', route: 'Uống', frequency: '1 lần/ngày', days: 10, instructions: 'Thường không gây buồn ngủ', categories: ['dị ứng'], keywords: ['dị ứng','viêm mũi dị ứng','mề đay','ngứa'] },
  { drug: 'Cetirizine 5mg', generic: 'Cetirizine', dose: '5mg', route: 'Uống', frequency: '1 lần/ngày', days: 7, instructions: 'Có thể gây buồn ngủ nhẹ', categories: ['dị ứng'], keywords: ['dị ứng','viêm mũi dị ứng','mề đay','trẻ em'] },
  { drug: 'Cetirizine 10mg', generic: 'Cetirizine', dose: '10mg', route: 'Uống', frequency: '1 lần/ngày tối', days: 10, instructions: 'Nên uống vào buổi tối', categories: ['dị ứng'], keywords: ['dị ứng','viêm mũi dị ứng','mề đay','ngứa'] },
  { drug: 'Fexofenadine 60mg', generic: 'Fexofenadine', dose: '60mg', route: 'Uống', frequency: '2 lần/ngày', days: 10, instructions: 'Không uống cùng nước trái cây (cam, bưởi, táo)', categories: ['dị ứng'], keywords: ['dị ứng','mề đay','viêm mũi dị ứng','trẻ em'] },
  { drug: 'Fexofenadine 120mg', generic: 'Fexofenadine', dose: '120mg', route: 'Uống', frequency: '1 lần/ngày', days: 10, instructions: 'Uống với nước lọc', categories: ['dị ứng'], keywords: ['dị ứng','mề đay','viêm mũi dị ứng'] },
  { drug: 'Fexofenadine 180mg', generic: 'Fexofenadine', dose: '180mg', route: 'Uống', frequency: '1 lần/ngày', days: 10, instructions: 'Dành cho dị ứng hoặc mề đay mạn tính', categories: ['dị ứng'], keywords: ['dị ứng nặng','mề đay mạn tính'] },
  { drug: 'Desloratadine 5mg', generic: 'Desloratadine', dose: '5mg', route: 'Uống', frequency: '1 lần/ngày', days: 10, instructions: 'Có thể uống lúc no hoặc đói', categories: ['dị ứng'], keywords: ['dị ứng','viêm mũi dị ứng','mề đay'] },
  { drug: 'Levocetirizine 5mg', generic: 'Levocetirizine', dose: '5mg', route: 'Uống', frequency: '1 lần/ngày', days: 10, instructions: 'Thường dùng vào buổi tối', categories: ['dị ứng'], keywords: ['dị ứng','viêm mũi dị ứng','mề đay'] },
  { drug: 'Chlorphenamine 4mg', generic: 'Chlorpheniramine', dose: '4mg', route: 'Uống', frequency: '3-4 lần/ngày', days: 5, instructions: 'Gây buồn ngủ mạnh, không lái xe khi dùng thuốc', categories: ['dị ứng'], keywords: ['dị ứng','ngứa','cảm cúm','mề đay cấp'] },
  { drug: 'Hydroxyzine 25mg', generic: 'Hydroxyzine', dose: '25mg', route: 'Uống', frequency: '1-3 lần/ngày', days: 7, instructions: 'Tác dụng an thần và giảm ngứa mạnh', categories: ['dị ứng'], keywords: ['ngứa nặng','lo âu','mề đay'] },
  { drug: 'Betamethasone cream 0.1%', generic: 'Betamethasone', dose: 'Thoa mỏng', route: 'Dùng ngoài', frequency: '2 lần/ngày', days: 14, instructions: 'Chỉ thoa vùng da bệnh, tránh vùng da mỏng/mặt', categories: ['da liễu'], keywords: ['viêm da','ngứa','eczema','vảy nến'] },
  { drug: 'Hydrocortisone cream 1%', generic: 'Hydrocortisone', dose: 'Thoa mỏng', route: 'Dùng ngoài', frequency: '2-3 lần/ngày', days: 7, instructions: 'Dùng được cho trẻ em vùng da nhạy cảm', categories: ['da liễu'], keywords: ['viêm da nhẹ','ngứa','hăm tã','trẻ em'] },
  { drug: 'Clobetasol cream 0.05%', generic: 'Clobetasol propionate', dose: 'Thoa mỏng', route: 'Dùng ngoài', frequency: '1-2 lần/ngày', days: 14, instructions: 'Corticoid rất mạnh, không dùng quá 2 tuần', categories: ['da liễu'], keywords: ['vảy nến','lichen','viêm da nặng'] },
  { drug: 'Mupirocin cream 2%', generic: 'Mupirocin', dose: 'Thoa mỏng', route: 'Dùng ngoài', frequency: '3 lần/ngày', days: 10, instructions: 'Làm sạch vùng da trước khi thoa', categories: ['da liễu','kháng sinh'], keywords: ['nhiễm khuẩn da','chốc lở','impetigo'] },
  { drug: 'Clotrimazole cream 1%', generic: 'Clotrimazole', dose: 'Thoa mỏng', route: 'Dùng ngoài', frequency: '2 lần/ngày', days: 14, instructions: 'Dùng tiếp tục 2 tuần sau khi triệu chứng hết', categories: ['da liễu','kháng nấm'], keywords: ['nấm da','hắc lào','lang ben','nấm kẽ chân'] },
  { drug: 'Terbinafine cream 1%', generic: 'Terbinafine', dose: 'Thoa mỏng', route: 'Dùng ngoài', frequency: '1-2 lần/ngày', days: 14, instructions: 'Giữ vùng da khô ráo sạch sẽ', categories: ['da liễu','kháng nấm'], keywords: ['nấm da','nấm móng','hắc lào'] },
  { drug: 'Terbinafine 250mg viên', generic: 'Terbinafine', dose: '250mg', route: 'Uống', frequency: '1 lần/ngày', days: 30, instructions: 'Theo dõi chức năng gan khi dùng dài ngày', categories: ['da liễu','kháng nấm'], keywords: ['nấm móng','nấm da lan rộng'] },
  { drug: 'Fluconazole 150mg', generic: 'Fluconazole', dose: '150mg', route: 'Uống', frequency: '1 liều duy nhất', days: 1, instructions: 'Uống 1 viên duy nhất', categories: ['kháng nấm'], keywords: ['nấm âm đạo','nấm miệng','nấm thực quản'] },
  { drug: 'Fluconazole 200mg', generic: 'Fluconazole', dose: '200mg', route: 'Uống', frequency: '1 lần/ngày', days: 14, instructions: 'Dùng theo chỉ định điều trị nấm hệ thống', categories: ['kháng nấm'], keywords: ['nấm hệ thống','nấm màng não'] },
  { drug: 'Itraconazole 100mg', generic: 'Itraconazole', dose: '100mg', route: 'Uống', frequency: '2 lần/ngày', days: 7, instructions: 'Uống ngay sau khi ăn no', categories: ['kháng nấm'], keywords: ['nấm móng','nấm da','nấm phổi'] },
  { drug: 'Acyclovir 200mg', generic: 'Acyclovir', dose: '200mg', route: 'Uống', frequency: '5 lần/ngày', days: 5, instructions: 'Các liều cách nhau 4 giờ (bỏ qua liều đêm)', categories: ['kháng virus'], keywords: ['herpes simplex','herpes môi'] },
  { drug: 'Acyclovir 400mg', generic: 'Acyclovir', dose: '400mg', route: 'Uống', frequency: '3 lần/ngày', days: 7, instructions: 'Uống nhiều nước trong ngày', categories: ['kháng virus'], keywords: ['herpes sinh dục','dự phòng tái phát herpes'] },
  { drug: 'Valacyclovir 500mg', generic: 'Valacyclovir', dose: '500mg', route: 'Uống', frequency: '2 lần/ngày', days: 7, instructions: 'Bắt đầu dùng ngay khi có dấu hiệu bệnh', categories: ['kháng virus'], keywords: ['herpes zoster (zona)','herpes simplex','thủy đậu'] },
  { drug: 'Valacyclovir 1000mg', generic: 'Valacyclovir', dose: '1000mg', route: 'Uống', frequency: '3 lần/ngày', days: 7, instructions: 'Dành cho điều trị Zona thần kinh', categories: ['kháng virus'], keywords: ['zona','herpes simplex nặng'] },
  { drug: 'Oseltamivir 75mg (Tamiflu)', generic: 'Oseltamivir', dose: '75mg', route: 'Uống', frequency: '2 lần/ngày', days: 5, instructions: 'Uống trong vòng 48 giờ kể từ khi có triệu chứng', categories: ['kháng virus'], keywords: ['cúm A','cúm B','H1N1','dự phòng cúm'] },
  { drug: 'Isotretinoin 10mg', generic: 'Isotretinoin', dose: '10mg', route: 'Uống', frequency: '1-2 lần/ngày', days: 30, instructions: 'Tuyệt đối không có thai khi dùng thuốc. Uống trong bữa ăn.', categories: ['da liễu'], keywords: ['mụn trứng cá nặng','mụn nang'] },
  { drug: 'Tretinoin cream 0.025%', generic: 'Tretinoin', dose: 'Thoa mỏng', route: 'Dùng ngoài', frequency: '1 lần/ngày tối', days: 30, instructions: 'Thoa vào buổi tối, chống nắng kỹ vào ban ngày', categories: ['da liễu'], keywords: ['mụn trứng cá','lão hoá da'] },

  // ── MẮT / TAI MŨI HỌNG ──────────────────────────────────────────────────────
  { drug: 'Ciprofloxacin nhỏ mắt 0.3%', generic: 'Ciprofloxacin', dose: '1-2 giọt', route: 'Nhỏ mắt', frequency: 'Mỗi 4 giờ', days: 7, instructions: 'Tránh để đầu ống nhỏ tiếp xúc với mắt', categories: ['mắt','kháng sinh'], keywords: ['viêm kết mạc nhiễm khuẩn','loét giác mạc'] },
  { drug: 'Tobramycin nhỏ mắt 0.3%', generic: 'Tobramycin', dose: '1-2 giọt', route: 'Nhỏ mắt', frequency: 'Mỗi 4-6 giờ', days: 7, instructions: 'Sử dụng theo chỉ định cho nhiễm khuẩn mắt', categories: ['mắt','kháng sinh'], keywords: ['viêm kết mạc','nhiễm khuẩn mắt'] },
  { drug: 'Chloramphenicol nhỏ mắt 0.4%', generic: 'Chloramphenicol', dose: '1-2 giọt', route: 'Nhỏ mắt', frequency: '3-4 lần/ngày', days: 7, instructions: 'Bảo quản nơi thoáng mát', categories: ['mắt','kháng sinh'], keywords: ['viêm kết mạc','đau mắt đỏ'] },
  { drug: 'Dexamethasone nhỏ mắt 0.1%', generic: 'Dexamethasone', dose: '1 giọt', route: 'Nhỏ mắt', frequency: '3-4 lần/ngày', days: 7, instructions: 'Không dùng dài ngày nếu không có chỉ định chuyên khoa', categories: ['mắt','corticoid'], keywords: ['viêm mắt dị ứng','viêm màng bồ đào','sau phẫu thuật mắt'] },
  { drug: 'Timolol nhỏ mắt 0.5%', generic: 'Timolol', dose: '1 giọt', route: 'Nhỏ mắt', frequency: '2 lần/ngày', days: 30, instructions: 'Ấn nhẹ góc mắt sau khi nhỏ để giảm hấp thu toàn thân', categories: ['mắt'], keywords: ['tăng nhãn áp','glaucoma'] },
  { drug: 'Latanoprost nhỏ mắt 0.005%', generic: 'Latanoprost', dose: '1 giọt', route: 'Nhỏ mắt', frequency: '1 lần/ngày tối', days: 30, instructions: 'Nhỏ thuốc vào buổi tối', categories: ['mắt'], keywords: ['tăng nhãn áp','glaucoma'] },
  { drug: 'Nước muối nhỏ mắt 0.9%', generic: 'Natri clorid', dose: '1-3 giọt', route: 'Nhỏ mắt', frequency: 'Khi cần', days: 30, instructions: 'Dùng để rửa mắt, làm dịu kích ứng', categories: ['mắt'], keywords: ['khô mắt','kích ứng mắt','rửa mắt'] },
  { drug: 'Mometasone xịt mũi 50mcg', generic: 'Mometasone', dose: '2 nhát/mỗi lỗ mũi', route: 'Xịt mũi', frequency: '1 lần/ngày', days: 30, instructions: 'Lắc kỹ trước khi dùng, dùng đều đặn hàng ngày', categories: ['tai mũi họng'], keywords: ['viêm mũi dị ứng','polip mũi','viêm xoang mạn'] },
  { drug: 'Fluticasone xịt mũi 50mcg', generic: 'Fluticasone', dose: '2 nhát/mỗi lỗ mũi', route: 'Xịt mũi', frequency: '1 lần/ngày', days: 30, instructions: 'Vệ sinh đầu xịt sau khi dùng', categories: ['tai mũi họng'], keywords: ['viêm mũi dị ứng','nghẹt mũi mạn'] },
  { drug: 'Budesonide xịt mũi 64mcg', generic: 'Budesonide', dose: '1-2 nhát/mỗi lỗ mũi', route: 'Xịt mũi', frequency: '2 lần/ngày', days: 30, instructions: 'Xịt vào buổi sáng và tối', categories: ['tai mũi họng'], keywords: ['viêm mũi dị ứng','viêm xoang'] },
  { drug: 'Oxymetazoline xịt mũi 0.05%', generic: 'Oxymetazoline', dose: '2-3 nhát', route: 'Xịt mũi', frequency: '2 lần/ngày', days: 3, instructions: 'Không dùng quá 3 ngày để tránh nghẹt mũi dội ngược', categories: ['tai mũi họng'], keywords: ['nghẹt mũi cấp','viêm mũi','cảm lạnh'] },
  { drug: 'Xylometazoline 0.05% nhỏ mũi', generic: 'Xylometazoline', dose: '1-2 giọt', route: 'Nhỏ mũi', frequency: '2-3 lần/ngày', days: 3, instructions: 'Chỉ dùng cho điều trị ngắn hạn nghẹt mũi', categories: ['tai mũi họng'], keywords: ['nghẹt mũi','viêm mũi cấp','trẻ em'] },
  { drug: 'Ciprofloxacin nhỏ tai 0.2%', generic: 'Ciprofloxacin', dose: '3-4 giọt', route: 'Nhỏ tai', frequency: '2 lần/ngày', days: 7, instructions: 'Nằm nghiêng tai sau khi nhỏ khoảng 5 phút', categories: ['tai mũi họng','kháng sinh'], keywords: ['viêm tai ngoài','viêm tai giữa có thủng màng nhĩ'] },
  { drug: 'Dexamethasone-Neomycin nhỏ tai', generic: 'Dexamethasone + Neomycin', dose: '1-5 giọt', route: 'Nhỏ tai', frequency: '2 lần/ngày', days: 7, instructions: 'Không dùng nếu màng nhĩ bị thủng', categories: ['tai mũi họng'], keywords: ['viêm tai ngoài','viêm tai có mủ'] },

  // ── VITAMIN & KHOÁNG CHẤT ────────────────────────────────────────────────────
  { drug: 'Vitamin C 500mg', generic: 'Ascorbic acid', dose: '500mg', route: 'Uống', frequency: '1-2 lần/ngày', days: 30, instructions: 'Uống sau bữa ăn, tránh uống tối muộn', categories: ['vitamin'], keywords: ['tăng đề kháng','cảm cúm','thiếu Vitamin C'] },
  { drug: 'Vitamin C 1000mg sủi', generic: 'Ascorbic acid', dose: '1000mg', route: 'Uống', frequency: '1 lần/ngày sáng', days: 14, instructions: 'Hòa tan vào 1 ly nước lọc', categories: ['vitamin'], keywords: ['tăng đề kháng','hỗ trợ điều trị'] },
  { drug: 'Vitamin B1 (Thiamine) 100mg', generic: 'Thiamine', dose: '100mg', route: 'Uống', frequency: '1-3 lần/ngày', days: 30, instructions: 'Uống trong hoặc sau bữa ăn', categories: ['vitamin'], keywords: ['thiếu B1','viêm thần kinh ngoại vi','Beriberi','rượu'] },
  { drug: 'Vitamin B6 (Pyridoxine) 25mg', generic: 'Pyridoxine', dose: '25mg', route: 'Uống', frequency: '1-2 lần/ngày', days: 30, instructions: 'Dùng theo chỉ định bổ sung', categories: ['vitamin'], keywords: ['thiếu B6','buồn nôn thai kỳ','viêm thần kinh do INH'] },
  { drug: 'Vitamin B12 (Mecobalamin) 500mcg', generic: 'Mecobalamin', dose: '500mcg', route: 'Uống', frequency: '3 lần/ngày', days: 30, instructions: 'Dùng cho các tình trạng đau thần kinh', categories: ['vitamin'], keywords: ['thiếu B12','đau thần kinh','thiếu máu hồng cầu khổng lồ'] },
  { drug: 'Vitamin B-Complex (B1+B6+B12)', generic: 'Vitamin B tổng hợp', dose: '1 viên', route: 'Uống', frequency: '2 lần/ngày', days: 30, instructions: 'Uống sau bữa ăn', categories: ['vitamin'], keywords: ['mệt mỏi','thiếu vitamin nhóm B','viêm thần kinh ngoại vi'] },
  { drug: 'Vitamin D3 1000IU', generic: 'Cholecalciferol', dose: '1000IU', route: 'Uống', frequency: '1 lần/ngày sáng', days: 90, instructions: 'Uống cùng với bữa ăn có chất béo', categories: ['vitamin'], keywords: ['thiếu Vitamin D','loãng xương','còi xương','trẻ em'] },
  { drug: 'Vitamin D3 4000IU', generic: 'Cholecalciferol', dose: '4000IU', route: 'Uống', frequency: '1 lần/ngày sáng', days: 90, instructions: 'Dùng cho trường hợp thiếu hụt Vitamin D nặng', categories: ['vitamin'], keywords: ['thiếu Vitamin D nặng','loãng xương'] },
  { drug: 'Vitamin E 400IU', generic: 'Tocopherol', dose: '400IU', route: 'Uống', frequency: '1 lần/ngày', days: 30, instructions: 'Uống ngay sau bữa ăn', categories: ['vitamin'], keywords: ['chống oxy hoá','thiếu Vitamin E'] },
  { drug: 'Vitamin A 5000IU', generic: 'Retinol', dose: '5000IU', route: 'Uống', frequency: '1 lần/ngày', days: 30, instructions: 'Không dùng quá liều quy định', categories: ['vitamin'], keywords: ['thiếu Vitamin A','quáng gà','trẻ em'] },
  { drug: 'Calci carbonate 500mg + D3', generic: 'Calcium carbonate + Vitamin D3', dose: '1 viên', route: 'Uống', frequency: '2 lần/ngày', days: 30, instructions: 'Uống trong hoặc sau bữa ăn', categories: ['vitamin','khoáng chất'], keywords: ['loãng xương','thiếu canxi','phụ nữ mãn kinh','trẻ em'] },
  { drug: 'Calci carbonate 1000mg', generic: 'Calcium carbonate', dose: '1000mg', route: 'Uống', frequency: '1 lần/ngày sáng', days: 30, instructions: 'Uống vào buổi sáng sau ăn', categories: ['vitamin','khoáng chất'], keywords: ['loãng xương','thiếu canxi'] },
  { drug: 'Sắt (II) sulfate 325mg', generic: 'Ferrous sulfate', dose: '325mg', route: 'Uống', frequency: '1-2 lần/ngày', days: 30, instructions: 'Nên uống khi đói hoặc kèm Vitamin C. Tránh uống cùng trà/cà phê.', categories: ['vitamin','khoáng chất'], keywords: ['thiếu máu thiếu sắt','thiếu sắt','thai kỳ'] },
  { drug: 'Sắt (III) hydroxide polymaltose 100mg', generic: 'Ferric hydroxide polymaltose', dose: '100mg', route: 'Uống', frequency: '1 lần/ngày', days: 30, instructions: 'Có thể uống trong hoặc sau bữa ăn', categories: ['vitamin','khoáng chất'], keywords: ['thiếu máu thiếu sắt','trẻ em','không dung nạp sắt thường'] },
  { drug: 'Acid folic 5mg', generic: 'Folic acid', dose: '5mg', route: 'Uống', frequency: '1 lần/ngày', days: 30, instructions: 'Bổ sung cho phụ nữ mang thai hoặc thiếu máu', categories: ['vitamin'], keywords: ['thiếu máu hồng cầu khổng lồ','thai kỳ','dự phòng dị tật ống thần kinh'] },
  { drug: 'Acid folic 0.4mg', generic: 'Folic acid', dose: '0.4mg', route: 'Uống', frequency: '1 lần/ngày', days: 30, instructions: 'Dự phòng dị tật ống thần kinh trước khi mang thai', categories: ['vitamin'], keywords: ['dự phòng trước thai kỳ'] },
  { drug: 'Kẽm gluconate 10mg', generic: 'Zinc gluconate', dose: '10mg', route: 'Uống', frequency: '1 lần/ngày', days: 14, instructions: 'Uống sau bữa ăn 1 giờ', categories: ['vitamin','khoáng chất'], keywords: ['thiếu kẽm','tiêu chảy','miễn dịch','trẻ em'] },
  { drug: 'Magie citrate 150mg', generic: 'Magnesium citrate', dose: '150mg', route: 'Uống', frequency: '1-2 lần/ngày', days: 30, instructions: 'Uống sau bữa ăn', categories: ['vitamin','khoáng chất'], keywords: ['chuột rút','thiếu magie','táo bón','mệt mỏi'] },
  { drug: 'Omega-3 (EPA+DHA) 1000mg', generic: 'Omega-3 fatty acids', dose: '1000mg', route: 'Uống', frequency: '1-2 lần/ngày', days: 30, instructions: 'Uống ngay sau khi ăn', categories: ['vitamin'], keywords: ['mỡ máu cao','triglyceride cao','tim mạch'] },
  { drug: 'Multivitamin & Khoáng chất', generic: 'Multivitamin', dose: '1 viên', route: 'Uống', frequency: '1 lần/ngày sáng', days: 30, instructions: 'Uống sau bữa ăn sáng', categories: ['vitamin'], keywords: ['mệt mỏi','dinh dưỡng','bổ sung vi chất','người cao tuổi'] },

  // ── CƠ XƯƠNG KHỚP ──────────────────────────────────────────────────────────
  { drug: 'Glucosamine sulfate 1500mg', generic: 'Glucosamine sulfate', dose: '1500mg', route: 'Uống', frequency: '1 lần/ngày sáng', days: 90, instructions: 'Dùng đều đặn hàng ngày, thường sau 2-3 tháng mới có hiệu quả rõ', categories: ['cơ xương khớp'], keywords: ['thoái hoá khớp','đau khớp','đau gối'] },
  { drug: 'Chondroitin sulfate 400mg', generic: 'Chondroitin sulfate', dose: '400mg', route: 'Uống', frequency: '3 lần/ngày', days: 90, instructions: 'Uống trong hoặc sau bữa ăn', categories: ['cơ xương khớp'], keywords: ['thoái hoá khớp','đau khớp'] },
  { drug: 'Glucosamine + Chondroitin', generic: 'Glucosamine + Chondroitin', dose: '1 viên', route: 'Uống', frequency: '2-3 lần/ngày', days: 90, instructions: 'Sử dụng lâu dài cho thoái hóa khớp', categories: ['cơ xương khớp'], keywords: ['thoái hoá khớp','đau khớp gối','viêm khớp'] },
  { drug: 'Alendronate 70mg', generic: 'Alendronate sodium', dose: '70mg', route: 'Uống', frequency: '1 lần/tuần', days: 28, instructions: 'Uống ngay khi thức dậy với nước lọc, không nằm trong 30p sau uống', categories: ['cơ xương khớp'], keywords: ['loãng xương','gãy xương','phụ nữ mãn kinh'] },
  { drug: 'Risedronate 35mg', generic: 'Risedronate sodium', dose: '35mg', route: 'Uống', frequency: '1 lần/tuần', days: 28, instructions: 'Uống cố định 1 ngày trong tuần, cách xa bữa ăn 30p', categories: ['cơ xương khớp'], keywords: ['loãng xương','corticosteroid gây loãng xương'] },
  { drug: 'Methotrexate 2.5mg', generic: 'Methotrexate', dose: '2.5mg', route: 'Uống', frequency: '1 lần/tuần', days: 28, instructions: 'Chỉ dùng liều duy nhất trong 1 ngày mỗi tuần. Thường dùng kèm Acid Folic.', categories: ['cơ xương khớp','miễn dịch'], keywords: ['viêm khớp dạng thấp','vảy nến','lupus'] },
  { drug: 'Hydroxychloroquine 200mg', generic: 'Hydroxychloroquine', dose: '200mg', route: 'Uống', frequency: '1-2 lần/ngày', days: 30, instructions: 'Nên uống trong bữa ăn hoặc kèm sữa. Theo dõi thị lực.', categories: ['cơ xương khớp','miễn dịch'], keywords: ['lupus','viêm khớp dạng thấp','sốt rét'] },
  { drug: 'Sulfasalazine 500mg', generic: 'Sulfasalazine', dose: '500mg', route: 'Uống', frequency: '2-3 lần/ngày', days: 30, instructions: 'Uống sau bữa ăn, uống nhiều nước', categories: ['cơ xương khớp'], keywords: ['viêm khớp dạng thấp','viêm loét đại tràng','bệnh Crohn'] },
  { drug: 'Methocarbamol 750mg', generic: 'Methocarbamol', dose: '750mg', route: 'Uống', frequency: '3 lần/ngày', days: 7, instructions: 'Có thể gây buồn ngủ, tránh lái xe', categories: ['cơ xương khớp'], keywords: ['co thắt cơ','đau lưng cấp','đau cơ'] },
  { drug: 'Cyclobenzaprine 5mg', generic: 'Cyclobenzaprine', dose: '5mg', route: 'Uống', frequency: '3 lần/ngày', days: 7, instructions: 'Dùng ngắn hạn cho các triệu chứng co thắt cơ cấp', categories: ['cơ xương khớp'], keywords: ['co thắt cơ','đau lưng cấp'] },
  { drug: 'Tolperisone 50mg', generic: 'Tolperisone', dose: '50mg', route: 'Uống', frequency: '3 lần/ngày', days: 10, instructions: 'Uống sau bữa ăn', categories: ['cơ xương khớp'], keywords: ['co cứng cơ','đau sau đột quỵ','xơ cứng rải rác'] },
  { drug: 'Tolperisone 150mg', generic: 'Tolperisone', dose: '150mg', route: 'Uống', frequency: '3 lần/ngày', days: 10, instructions: 'Dùng cho các trường hợp co cứng cơ nặng', categories: ['cơ xương khớp'], keywords: ['co cứng cơ','đau cơ xương','sau chấn thương'] },
  { drug: 'Eperisone 50mg', generic: 'Eperisone', dose: '50mg', route: 'Uống', frequency: '3 lần/ngày', days: 10, instructions: 'Uống sau bữa ăn', categories: ['cơ xương khớp'], keywords: ['co cứng cơ','đau cổ vai gáy','đau lưng'] },

  // ── THẬN / TIẾT NIỆU ────────────────────────────────────────────────────────
  { drug: 'Tamsulosin 0.4mg', generic: 'Tamsulosin', dose: '0.4mg', route: 'Uống', frequency: '1 lần/ngày tối', days: 30, instructions: 'Uống sau bữa ăn tối 30 phút', categories: ['tiết niệu'], keywords: ['phì đại tuyến tiền liệt','tiểu khó','sỏi niệu quản'] },
  { drug: 'Doxazosin 2mg', generic: 'Doxazosin', dose: '2mg', route: 'Uống', frequency: '1 lần/ngày tối', days: 30, instructions: 'Thận trọng với tình trạng hạ huyết áp tư thế', categories: ['tiết niệu','huyết áp'], keywords: ['phì đại tuyến tiền liệt','cao huyết áp'] },
  { drug: 'Finasteride 5mg', generic: 'Finasteride', dose: '5mg', route: 'Uống', frequency: '1 lần/ngày', days: 30, instructions: 'Có thể dùng kèm hoặc không kèm thức ăn', categories: ['tiết niệu'], keywords: ['phì đại tuyến tiền liệt','rụng tóc nam'] },
  { drug: 'Sildenafil 50mg', generic: 'Sildenafil', dose: '50mg', route: 'Uống', frequency: '1 lần/ngày trước khi quan hệ', days: 1, instructions: 'Uống trước 30p-1h. Không dùng chung với thuốc nhóm Nitrate.', categories: ['tiết niệu','nam khoa'], keywords: ['rối loạn cương dương','tăng áp phổi'] },
  { drug: 'Tadalafil 5mg', generic: 'Tadalafil', dose: '5mg', route: 'Uống', frequency: '1 lần/ngày', days: 30, instructions: 'Uống vào cùng một thời điểm hàng ngày', categories: ['tiết niệu','nam khoa'], keywords: ['rối loạn cương dương','phì đại tuyến tiền liệt'] },
  { drug: 'Solifenacin 5mg', generic: 'Solifenacin', dose: '5mg', route: 'Uống', frequency: '1 lần/ngày', days: 30, instructions: 'Nuốt nguyên viên với nước', categories: ['tiết niệu'], keywords: ['bàng quang tăng hoạt','tiểu không kiểm soát','tiểu nhiều lần'] },
  { drug: 'Tolterodine 2mg', generic: 'Tolterodine', dose: '2mg', route: 'Uống', frequency: '2 lần/ngày', days: 30, instructions: 'Dùng cho chứng tiểu gấp, tiểu nhiều lần', categories: ['tiết niệu'], keywords: ['bàng quang tăng hoạt','tiểu không kiểm soát'] },
  { drug: 'Desmopressin 0.1mg', generic: 'Desmopressin', dose: '0.1mg', route: 'Uống', frequency: '1 lần/ngày tối', days: 30, instructions: 'Hạn chế uống nước 1h trước và 8h sau khi uống thuốc', categories: ['tiết niệu'], keywords: ['tiểu đêm nhiều','đái tháo nhạt','đái dầm trẻ em'] },

  // ── PHỤ KHOA ───────────────────────────────────────────────────────────────
  { drug: 'Progesterone 100mg', generic: 'Progesterone', dose: '100mg', route: 'Uống', frequency: '1-2 lần/ngày tối', days: 10, instructions: 'Nên uống vào buổi tối hoặc trước khi đi ngủ', categories: ['phụ khoa'], keywords: ['thiếu progesterone','dọa sảy thai','rối loạn kinh nguyệt'] },
  { drug: 'Medroxyprogesterone 5mg', generic: 'Medroxyprogesterone', dose: '5mg', route: 'Uống', frequency: '1-2 lần/ngày', days: 10, instructions: 'Dùng theo chu kỳ kinh nguyệt chỉ định', categories: ['phụ khoa'], keywords: ['rối loạn kinh nguyệt','lạc nội mạc tử cung','tránh thai'] },
  { drug: 'Clomiphene 50mg', generic: 'Clomiphene citrate', dose: '50mg', route: 'Uống', frequency: '1 lần/ngày', days: 5, instructions: 'Bắt đầu dùng từ ngày thứ 2 đến ngày thứ 5 của chu kỳ kinh', categories: ['phụ khoa'], keywords: ['vô sinh','kích trứng','PCOS'] },
  { drug: 'Fluconazole 150mg đơn liều', generic: 'Fluconazole', dose: '150mg', route: 'Uống', frequency: '1 liều duy nhất', days: 1, instructions: 'Uống 1 viên duy nhất để điều trị nấm âm đạo', categories: ['phụ khoa','kháng nấm'], keywords: ['nấm âm đạo candida','viêm âm đạo nấm'] },
  { drug: 'Metronidazole 500mg (viêm âm đạo)', generic: 'Metronidazole', dose: '500mg', route: 'Uống', frequency: '2 lần/ngày', days: 7, instructions: 'Điều trị cho cả bạn tình nếu cần thiết', categories: ['phụ khoa','kháng sinh'], keywords: ['viêm âm đạo do vi khuẩn','trichomonas'] },
  { drug: 'Tranexamic acid 250mg', generic: 'Tranexamic acid', dose: '250mg', route: 'Uống', frequency: '3 lần/ngày', days: 5, instructions: 'Dùng trong những ngày hành kinh nhiều', categories: ['phụ khoa'], keywords: ['kinh nguyệt nhiều','rong kinh','chảy máu'] },
  { drug: 'Primolut-N 5mg', generic: 'Norethisterone', dose: '5mg', route: 'Uống', frequency: '3 lần/ngày', days: 10, instructions: 'Dùng theo chỉ định của bác sĩ phụ khoa', categories: ['phụ khoa'], keywords: ['rối loạn kinh nguyệt','hoãn kinh','lạc nội mạc'] },
  { drug: 'Calcium D-glucarate 500mg', generic: 'Calcium D-glucarate', dose: '500mg', route: 'Uống', frequency: '1 lần/ngày', days: 30, instructions: 'Hỗ trợ chuyển hóa Estrogen', categories: ['phụ khoa'], keywords: ['estrogen cao','hỗ trợ thải độc'] },

  // ── CHỐNG KÝ SINH TRÙNG ──────────────────────────────────────────────────────
  { drug: 'Albendazole 400mg', generic: 'Albendazole', dose: '400mg', route: 'Uống', frequency: '1 liều duy nhất', days: 1, instructions: 'Có thể nhai viên thuốc hoặc uống với nước', categories: ['ký sinh trùng'], keywords: ['giun','sán','nhiễm ký sinh trùng','giun đũa'] },
  { drug: 'Mebendazole 100mg', generic: 'Mebendazole', dose: '100mg', route: 'Uống', frequency: '2 lần/ngày', days: 3, instructions: 'Có thể dùng cho trẻ em trên 2 tuổi', categories: ['ký sinh trùng'], keywords: ['giun','giun kim','giun đũa','giun móc'] },
  { drug: 'Ivermectin 3mg', generic: 'Ivermectin', dose: 'Theo cân nặng', route: 'Uống', frequency: '1 liều duy nhất', days: 1, instructions: 'Uống khi bụng đói với nước lọc', categories: ['ký sinh trùng'], keywords: ['ghẻ','giun chỉ','strongyloides'] },
  { drug: 'Praziquantel 600mg', generic: 'Praziquantel', dose: 'Theo cân nặng', route: 'Uống', frequency: 'Theo liều chỉ định', days: 1, instructions: 'Uống trong bữa ăn, không nhai viên thuốc', categories: ['ký sinh trùng'], keywords: ['sán','sán lá gan','sán máng'] },
  { drug: 'Artesunate + Amodiaquine', generic: 'Artesunate/Amodiaquine', dose: 'Theo phác đồ', route: 'Uống', frequency: '1 lần/ngày', days: 3, instructions: 'Sử dụng theo phác đồ điều trị sốt rét', categories: ['ký sinh trùng'], keywords: ['sốt rét falciparum'] },
  { drug: 'Artemether-Lumefantrine (Coartem)', generic: 'Artemether + Lumefantrine', dose: 'Theo phác đồ', route: 'Uống', frequency: '2 lần/ngày', days: 3, instructions: 'Nên uống kèm thức ăn có chất béo để tăng hấp thu', categories: ['ký sinh trùng'], keywords: ['sốt rét falciparum','sốt rét'] },
  { drug: 'Chloroquine 250mg', generic: 'Chloroquine phosphate', dose: '250mg', route: 'Uống', frequency: 'Theo phác đồ', days: 3, instructions: 'Uống sau bữa ăn', categories: ['ký sinh trùng'], keywords: ['sốt rét vivax','dự phòng sốt rét'] },
  { drug: 'Primaquine 15mg', generic: 'Primaquine', dose: '15mg', route: 'Uống', frequency: '1 lần/ngày', days: 14, instructions: 'Cần kiểm tra men G6PD trước khi dùng', categories: ['ký sinh trùng'], keywords: ['sốt rét vivax','diệt giao bào'] },
]

function normText(s) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
}

function tokenize(s) {
  return normText(s)
    .split(/[^a-z0-9]+/g)
    .filter(Boolean)
    .filter(t => t.length >= 2)
}

function suggestDrugsByCondition(diagnosis, treatmentPlan) {
  if (!diagnosis && !treatmentPlan) return DRUG_DATABASE.slice(0, 10)
  const raw = `${diagnosis || ''} ${treatmentPlan || ''}`
  const n = normText(raw)
  const tokens = tokenize(raw)
  // Nối thêm một số cách diễn đạt hay gặp để giảm trượt match
  const expanded = `${n} ${n.includes('tang huyet ap') ? ' cao huyet ap ' : ''} ${n.includes('dai thao duong') ? ' tieu duong ' : ''} ${n.includes('viem hong') ? ' dau hong ' : ''}`

  const scored = DRUG_DATABASE.map(d => {
    const kwScore = (d.keywords || []).reduce((acc, kw) => {
      const k = normText(kw)
      if (!k) return acc
      // match cụm keyword ưu tiên cao hơn match token rời
      if (expanded.includes(k)) return acc + 3
      // token overlap: "tieu duong", "cao huyet ap", ...
      const kTokens = k.split(/[^a-z0-9]+/g).filter(Boolean)
      const overlap = kTokens.filter(t => tokens.includes(t)).length
      return acc + Math.min(2, overlap)
    }, 0)

    const catScore = (d.categories || []).reduce((acc, cat) => {
      const c = normText(cat)
      if (!c) return acc
      if (expanded.includes(c)) return acc + 2
      const overlap = c.split(/[^a-z0-9]+/g).filter(Boolean).filter(t => tokens.includes(t)).length
      return acc + Math.min(1, overlap)
    }, 0)

    const nameScore =
      (expanded.includes(normText(d.generic)) ? 1 : 0) +
      (expanded.includes(normText(d.drug)) ? 1 : 0)

    const score = kwScore + catScore + nameScore
    return { ...d, score }
  }).filter(d => d.score > 0)
  scored.sort((a, b) => b.score - a.score)
  return scored.length > 0 ? scored.slice(0, 15) : DRUG_DATABASE.slice(0, 10)
}

export default function PrescriptionTab() {
  const { activePatient, emr, setEmrField, loading, setLoading } = useStore()
  const prescriptions = emr.prescriptions || []
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [editingIdx, setEditingIdx] = useState(null)
  const [pendingDrugs, setPendingDrugs] = useState(new Set())
  const [aiSuggestedDrugs, setAiSuggestedDrugs] = useState([]) // subset of DRUG_DATABASE (mapped)
  const [aiSuggestedSet, setAiSuggestedSet] = useState(new Set()) // drug names in aiSuggestedDrugs
  const [aiSuggestLoading, setAiSuggestLoading] = useState(false)
  const [aiPanel, setAiPanel] = useState({ items: [], warnings: [] })
  const [aiPanelLoading, setAiPanelLoading] = useState(false)
  const searchRef = useRef(null)

  useEffect(() => {
    if (showSearch && searchRef.current) searchRef.current.focus()
  }, [showSearch])

  useEffect(() => {
    if (showSearch) {
      setPendingDrugs(new Set(prescriptions.map(rx => rx.drug || rx.name)))
    }
  }, [showSearch])

  useEffect(() => {
    // Fetch AI suggestions for the search popup (when opening / when query cleared)
    const run = async () => {
      if (!showSearch) return
      if (searchQuery.trim()) return
      if (!emr.diagnosis && !emr.treatment_plan && !emr.symptoms) return
      setAiSuggestLoading(true)
      try {
        const res = await aiDrugSuggest({
          diagnosis: emr.diagnosis || '',
          chief_complaint: emr.chief_complaint || '',
          symptoms: emr.symptoms || '',
          treatment_plan: emr.treatment_plan || '',
          patient_info: `${activePatient?.age || ''} tuổi, ${activePatient?.gender || ''}`,
          history: emr.history || '',
          current_medications: activePatient?.current_medications || [],
          allergies: activePatient?.allergies || '',
        })
        const list = res?.data?.suggestions || []

        // Map AI "name" to our local DRUG_DATABASE entries (best-effort, no crash if not found)
        const mapped = []
        for (const s of list) {
          const name = (s?.name || '').trim()
          if (!name) continue
          const nn = normText(name)
          // Try exact-ish match on drug/generic (contains either direction)
          const found =
            DRUG_DATABASE.find(d => normText(d.drug) === nn) ||
            DRUG_DATABASE.find(d => normText(d.drug).includes(nn) || nn.includes(normText(d.drug))) ||
            DRUG_DATABASE.find(d => normText(d.generic).includes(nn) || nn.includes(normText(d.generic)))
          if (found) mapped.push(found)
        }
        // de-dup by drug name
        const uniq = []
        const seen = new Set()
        for (const d of mapped) {
          if (seen.has(d.drug)) continue
          seen.add(d.drug)
          uniq.push(d)
        }
        setAiSuggestedDrugs(uniq.slice(0, 10))
        setAiSuggestedSet(new Set(uniq.map(d => d.drug)))
      } catch {
        setAiSuggestedDrugs([])
        setAiSuggestedSet(new Set())
      } finally {
        setAiSuggestLoading(false)
      }
    }
    run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showSearch, searchQuery, emr.diagnosis, emr.treatment_plan, emr.symptoms])

  useEffect(() => {
    // Main panel: AI gợi ý thuốc hiển thị trực tiếp trong tab Đơn thuốc
    const run = async () => {
      if (!activePatient) return
      if (!emr.diagnosis && !emr.treatment_plan && !emr.symptoms) { setAiPanel({ items: [], warnings: [] }); return }
      setAiPanelLoading(true)
      try {
        const res = await aiDrugSuggest({
          diagnosis: emr.diagnosis || '',
          chief_complaint: emr.chief_complaint || '',
          symptoms: emr.symptoms || '',
          treatment_plan: emr.treatment_plan || '',
          patient_info: `${activePatient?.age || ''} tuổi, ${activePatient?.gender || ''}`,
          history: emr.history || '',
          current_medications: activePatient?.current_medications || [],
          allergies: activePatient?.allergies || '',
        })
        const suggestions = res?.data?.suggestions || []
        const warnings = res?.data?.warnings || []

        const items = []
        for (const s of suggestions) {
          const name = (s?.name || '').trim()
          if (!name) continue
          const nn = normText(name)
          const found =
            DRUG_DATABASE.find(d => normText(d.drug) === nn) ||
            DRUG_DATABASE.find(d => normText(d.drug).includes(nn) || nn.includes(normText(d.drug))) ||
            DRUG_DATABASE.find(d => normText(d.generic).includes(nn) || nn.includes(normText(d.generic)))
          if (!found) continue
          items.push({
            drug: found,
            meta: {
              name,
              class: s?.class || '',
              reason: s?.reason || '',
              priority: s?.priority || '',
              cautions: Array.isArray(s?.cautions) ? s.cautions : [],
            },
          })
        }
        // de-dup by drug name and keep order
        const uniq = []
        const seen = new Set()
        for (const it of items) {
          if (seen.has(it.drug.drug)) continue
          seen.add(it.drug.drug)
          uniq.push(it)
        }
        setAiPanel({ items: uniq.slice(0, 8), warnings })
      } catch {
        setAiPanel({ items: [], warnings: [] })
      } finally {
        setAiPanelLoading(false)
      }
    }
    run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePatient?.id, emr.diagnosis, emr.treatment_plan, emr.symptoms, emr.chief_complaint])

  const mergedSuggestions = useMemo(() => {
    if (!aiSuggestedDrugs.length) return suggestDrugsByCondition(emr.diagnosis, emr.treatment_plan)
    const base = suggestDrugsByCondition(emr.diagnosis, emr.treatment_plan)
    const seen = new Set(aiSuggestedDrugs.map(d => d.drug))
    const rest = base.filter(d => !seen.has(d.drug))
    return [...aiSuggestedDrugs, ...rest].slice(0, 15)
  }, [aiSuggestedDrugs, emr.diagnosis, emr.treatment_plan])

  const suggestions = useMemo(
    () => mergedSuggestions,
    [mergedSuggestions]
  )

  const suggestedDrugSet = useMemo(
    () => new Set(suggestions.map(d => d.drug)),
    [suggestions]
  )

  const searchResults = useMemo(() => {
    const base = !searchQuery.trim()
      ? suggestions
      : (() => {
          const qn = normText(searchQuery)
          return DRUG_DATABASE.filter(d =>
            normText(d.drug).includes(qn) ||
            normText(d.generic).includes(qn) ||
            (d.categories || []).some(c => normText(c).includes(qn)) ||
            (d.keywords || []).some(k => normText(k).includes(qn))
          ).slice(0, 20)
        })()

    // Ưu tiên các thuốc đã chọn trước để dễ nhận ra khi tìm kiếm
    const arr = base.map((d, idx) => ({
      d,
      idx,
      picked: pendingDrugs.has(d.drug),
      suggested: suggestedDrugSet.has(d.drug),
    }))
    arr.sort((a, b) => {
      if (a.picked !== b.picked) return a.picked ? -1 : 1
      if (a.suggested !== b.suggested) return a.suggested ? -1 : 1
      return a.idx - b.idx
    })
    return arr.map(x => x.d)
  }, [searchQuery, suggestions, pendingDrugs, suggestedDrugSet])

  const isAlreadyAdded = (drugName) => prescriptions.some(rx => (rx.drug || rx.name) === drugName)

  const addDrug = (d) => {
    if (isAlreadyAdded(d.drug)) { toast('Thuốc đã có trong đơn', { icon: 'ℹ️' }); return }
    setEmrField('prescriptions', [...prescriptions, {
      drug: d.drug, generic: d.generic, dose: d.dose,
      route: d.route, frequency: d.frequency, days: d.days, instructions: d.instructions
    }])
    toast.success(`Đã thêm ${d.drug}`)
  }

  const removeDrug = (i) => setEmrField('prescriptions', prescriptions.filter((_, idx) => idx !== i))

  const updateRx = (i, field, val) => {
    setEmrField('prescriptions', prescriptions.map((rx, idx) => idx === i ? { ...rx, [field]: val } : rx))
  }

  const handleAI = async () => {
    if (!emr.diagnosis) { toast.error('Vui lòng nhập chẩn đoán trước'); return }
    setLoading('prescription', true)
    try {
      // Ưu tiên đồng bộ đơn thuốc theo đúng AI panel gợi ý nếu đã có
      const panelList = (aiPanel?.items || []).map(it => it.drug).filter(Boolean)
      if (panelList.length > 0) {
        const synced = panelList.map(d => ({
          drug: d.drug,
          generic: d.generic,
          dose: d.dose,
          route: d.route,
          frequency: d.frequency,
          days: d.days,
          instructions: d.instructions,
        }))
        setEmrField('prescriptions', synced)
        toast.success(`Đã đồng bộ ${synced.length} thuốc theo AI gợi ý`)
        return
      }

      const res = await aiPrescription({
        diagnosis: emr.diagnosis,
        chief_complaint: emr.chief_complaint || '',
        symptoms: emr.symptoms || '',
        treatment_plan: emr.treatment_plan || '',
        patient_info: `${activePatient?.age || ''} tuổi, ${activePatient?.gender || ''}`,
        history: emr.history,
        current_medications: activePatient?.current_medications || [],
        allergies: activePatient?.allergies || '',
      })
      const list = res.data?.prescriptions || []
      setEmrField('prescriptions', list)
      if (res.data?.interactions?.length)
        toast(`⚠️ Tương tác: ${res.data.interactions.join(', ')}`, { icon: '⚠️' })
      else
        toast.success(`Đã tạo ${list.length} thuốc`)
    } catch { toast.error('Lỗi AI đơn thuốc') }
    finally { setLoading('prescription', false) }
  }

  const togglePendingDrug = (d) => {
    const next = new Set(pendingDrugs)
    if (next.has(d.drug)) next.delete(d.drug)
    else next.add(d.drug)
    setPendingDrugs(next)
  }

  const confirmDrugSearch = () => {
    const currentNames = new Set(prescriptions.map(rx => rx.drug || rx.name))
    const toAdd = [...pendingDrugs].filter(name => !currentNames.has(name))
    const toRemove = [...currentNames].filter(name => !pendingDrugs.has(name))
    let updated = prescriptions.filter(rx => !toRemove.includes(rx.drug || rx.name))
    toAdd.forEach(name => {
      const d = DRUG_DATABASE.find(x => x.drug === name)
      if (d) updated.push({ drug: d.drug, generic: d.generic, dose: d.dose, route: d.route, frequency: d.frequency, days: d.days, instructions: d.instructions })
    })
    setEmrField('prescriptions', updated)
    if (toAdd.length > 0) toast.success(`Đã thêm ${toAdd.length} thuốc`)
    setShowSearch(false)
    setSearchQuery('')
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500">
          Đơn thuốc lần khám này
          {prescriptions.length > 0 && (
            <span className="ml-2 bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs font-medium">
              {prescriptions.length} thuốc
            </span>
          )}
        </span>
        <button onClick={handleAI} disabled={!!loading.prescription} className="btn-ai text-xs">
          {loading.prescription ? <Loader2 size={12} className="spin" /> : <Sparkles size={12} />}
          AI tạo đơn thuốc
        </button>
      </div>

      {(aiPanelLoading || aiPanel.items.length > 0 || aiPanel.warnings.length > 0) && (
        <div className="bg-white border border-gray-100 rounded-xl p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs font-medium text-gray-700 flex items-center gap-1.5">
              <Sparkles size={12} className="text-purple-600" />
              AI gợi ý thuốc (bấm để thêm)
            </div>
            {aiPanelLoading && <span className="text-xs text-gray-400 flex items-center gap-1"><Loader2 size={11} className="spin" />Đang gợi ý...</span>}
          </div>

          {aiPanel.warnings?.length > 0 && (
            <div className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-2">
              <div className="font-medium mb-1">Lưu ý</div>
              <div className="space-y-0.5">
                {aiPanel.warnings.slice(0, 3).map((w, i) => <div key={i}>- {w}</div>)}
              </div>
            </div>
          )}

          {aiPanel.items.length === 0 && !aiPanelLoading ? (
            <div className="text-xs text-gray-400 mt-2">Nhập chẩn đoán/triệu chứng để AI gợi ý thuốc phù hợp.</div>
          ) : (
            <div className="mt-2 grid grid-cols-1 gap-2">
              {aiPanel.items.map((it, idx) => {
                const already = isAlreadyAdded(it.drug.drug)
                return (
                  <button
                    key={`${it.drug.drug}-${idx}`}
                    onClick={() => addDrug(it.drug)}
                    disabled={already}
                    className={`text-left border rounded-xl px-3 py-2 transition ${
                      already ? 'border-gray-100 bg-gray-50 opacity-70 cursor-not-allowed' : 'border-purple-100 bg-purple-50/40 hover:bg-purple-50'
                    }`}
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-gray-900">{it.drug.drug}</span>
                      <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">AI gợi ý</span>
                      {it.meta?.priority && (
                        <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{it.meta.priority}</span>
                      )}
                      {already && <span className="text-xs text-gray-400">(đã có)</span>}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">{it.drug.generic} · {it.drug.dose} · {it.drug.route}</div>
                    {it.meta?.reason && <div className="text-xs text-gray-600 mt-1">{it.meta.reason}</div>}
                    {it.meta?.cautions?.length > 0 && (
                      <div className="text-xs text-amber-700 mt-1">Thận trọng: {it.meta.cautions.slice(0, 2).join(', ')}</div>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {!emr.diagnosis && (
        <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          <AlertCircle size={13} />
          Nhập chẩn đoán để xem gợi ý thuốc phù hợp với bệnh
        </div>
      )}

      {prescriptions.length === 0
        ? <div className="text-center py-6 text-gray-300 text-sm">Nhấn "AI tạo đơn thuốc" hoặc tìm và thêm thuốc bên dưới</div>
        : <div className="space-y-2">
            {prescriptions.map((rx, i) => (
              <div key={i} className="bg-white border border-gray-100 rounded-xl p-3">
                {editingIdx === i ? (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <input value={rx.drug || rx.name || ''} onChange={e => updateRx(i, 'drug', e.target.value)}
                        className="flex-1 text-sm border border-gray-200 rounded-lg px-2 py-1 outline-none focus:border-blue-300" placeholder="Tên thuốc" />
                      <button onClick={() => setEditingIdx(null)} className="text-green-500 hover:text-green-600"><Check size={16} /></button>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {[['dose','Liều'],['frequency','Tần suất'],['route','Đường dùng']].map(([field, label]) => (
                        <input key={field} value={rx[field] || ''} onChange={e => updateRx(i, field, e.target.value)}
                          className="text-xs border border-gray-200 rounded px-2 py-1 outline-none focus:border-blue-300" placeholder={label} />
                      ))}
                    </div>
                    <div className="flex gap-1.5">
                      <input type="number" value={rx.days || ''} onChange={e => updateRx(i, 'days', e.target.value)}
                        className="w-20 text-xs border border-gray-200 rounded px-2 py-1 outline-none focus:border-blue-300" placeholder="Số ngày" />
                      <input value={rx.instructions || ''} onChange={e => updateRx(i, 'instructions', e.target.value)}
                        className="flex-1 text-xs border border-gray-200 rounded px-2 py-1 outline-none focus:border-blue-300" placeholder="Hướng dẫn" />
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-3">
                    <div onClick={() => setEditingIdx(i)} className="cursor-pointer flex-1">
                      <div className="text-sm font-medium text-gray-900 flex items-center gap-1.5">
                        <Pill size={13} className="text-blue-400 shrink-0" />
                        {rx.drug || rx.name}
                      </div>
                      {rx.generic && <div className="text-xs text-gray-400 ml-5">{rx.generic}</div>}
                      <div className="text-xs text-gray-600 mt-1 ml-5">{rx.dose} · {rx.route || 'Uống'} · {rx.frequency} · {rx.days} ngày</div>
                      {rx.instructions && <div className="text-xs text-blue-600 mt-0.5 ml-5">{rx.instructions}</div>}
                    </div>
                    <button onClick={() => removeDrug(i)} className="text-gray-300 hover:text-red-400 transition shrink-0"><Trash2 size={14} /></button>
                  </div>
                )}
              </div>
            ))}
          </div>
      }

      {/* Nút mở popup tìm thuốc */}
      <button
        onClick={() => setShowSearch(true)}
        className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 border border-dashed border-blue-200 bg-blue-50/50 hover:bg-blue-50 rounded-xl px-3 py-2 w-full justify-center transition"
      >
        <Search size={13} /> Tìm & thêm thuốc
        <Plus size={12} />
      </button>

      {/* POPUP tìm kiếm thuốc */}
      {showSearch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{backgroundColor:'rgba(0,0,0,0.45)'}}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden" style={{maxHeight:'85vh'}}>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-blue-50">
              <div className="flex items-center gap-2">
                <Pill size={16} className="text-blue-600" />
                <span className="text-sm font-semibold text-blue-800">Tìm & thêm thuốc</span>
                {pendingDrugs.size > 0 && (
                  <span className="bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full font-medium">
                    {pendingDrugs.size} đã chọn
                  </span>
                )}
              </div>
              <button onClick={() => { setShowSearch(false); setSearchQuery('') }} className="text-gray-400 hover:text-gray-600 transition">
                <X size={18} />
              </button>
            </div>

            {/* Search input */}
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-100 bg-gray-50">
              <Search size={14} className="text-gray-400 shrink-0" />
              <input
                ref={searchRef}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={emr.diagnosis ? `Gợi ý theo: ${emr.diagnosis.slice(0,25)}... hoặc nhập tên thuốc` : 'Nhập tên thuốc hoặc tên bệnh...'}
                className="flex-1 text-sm outline-none bg-transparent"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="text-gray-300 hover:text-gray-500"><X size={14} /></button>
              )}
            </div>

            {/* Label + chọn tất cả */}
            <div className="px-4 pt-2 pb-1 flex items-center justify-between">
              <span className="text-xs text-gray-400 font-medium">
                {searchQuery
                  ? `Kết quả (${searchResults.length})`
                  : (aiSuggestLoading
                      ? '✨ AI đang gợi ý theo chẩn đoán...'
                      : (emr.diagnosis ? '✨ AI gợi ý theo chẩn đoán & kế hoạch điều trị' : 'Thuốc phổ biến')
                    )
                }
              </span>
              {searchResults.length > 0 && (
                <button
                  onClick={() => {
                    const allDrugs = searchResults.map(r => r.drug)
                    const allIn = allDrugs.every(d => pendingDrugs.has(d))
                    const next = new Set(pendingDrugs)
                    if (allIn) allDrugs.forEach(d => next.delete(d))
                    else allDrugs.forEach(d => next.add(d))
                    setPendingDrugs(next)
                  }}
                  className="text-xs text-blue-600 hover:text-blue-700 transition"
                >
                  {searchResults.every(r => pendingDrugs.has(r.drug)) ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                </button>
              )}
            </div>

            {/* Danh sách thuốc có checkbox */}
            <div className="overflow-y-auto flex-1 divide-y divide-gray-50">
              {searchResults.length === 0 ? (
                <div className="text-center py-8 text-gray-300 text-sm">Không tìm thấy thuốc phù hợp</div>
              ) : searchResults.map((d, i) => {
                const isChecked = pendingDrugs.has(d.drug)
                const isSuggested = suggestedDrugSet.has(d.drug)
                const isAiSuggested = aiSuggestedSet.has(d.drug)
                return (
                  <label
                    key={i}
                    className={`flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors ${isChecked ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                  >
                    {/* Checkbox đẹp */}
                    <div className={`mt-0.5 shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                      isChecked ? 'bg-blue-500 border-blue-500' : 'border-gray-300 bg-white'
                    }`}>
                      {isChecked && <Check size={12} className="text-white" strokeWidth={3} />}
                    </div>
                    <input type="checkbox" className="hidden" checked={isChecked} onChange={() => togglePendingDrug(d)} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`text-sm font-medium ${isChecked ? 'text-blue-800' : 'text-gray-800'}`}>{d.drug}</span>
                        {isAiSuggested && (
                          <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">
                            AI gợi ý
                          </span>
                        )}
                        {isSuggested && (
                          <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                            Gợi ý theo chẩn đoán
                          </span>
                        )}
                        {d.categories.slice(0,2).map(cat => (
                          <span key={cat} className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{cat}</span>
                        ))}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">{d.generic} · {d.dose} · {d.route}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{d.frequency} · {d.days} ngày</div>
                      {d.instructions && <div className="text-xs text-blue-500 mt-0.5 italic">{d.instructions}</div>}
                    </div>
                  </label>
                )
              })}
            </div>

            {/* Footer buttons */}
            <div className="flex items-center gap-2 px-4 py-3 border-t border-gray-100 bg-gray-50">
              <button
                onClick={() => { setShowSearch(false); setSearchQuery('') }}
                className="flex-1 text-sm text-gray-500 border border-gray-200 rounded-xl py-2 hover:bg-gray-100 transition"
              >
                Hủy
              </button>
              <button
                onClick={confirmDrugSearch}
                className="flex-1 text-sm font-medium bg-blue-500 hover:bg-blue-600 text-white rounded-xl py-2 transition flex items-center justify-center gap-1.5"
              >
                <Check size={14} />
                Xác nhận{pendingDrugs.size > 0 ? ` (${pendingDrugs.size})` : ''}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}