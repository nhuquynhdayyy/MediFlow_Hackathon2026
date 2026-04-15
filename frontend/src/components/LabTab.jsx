/**
 * LabTab — Xét nghiệm & Chẩn đoán hình ảnh
 * - AI gợi ý danh sách xét nghiệm
 * - Tìm kiếm + gợi ý xét nghiệm theo bệnh (thủ công)
 * - Bác sĩ chọn từng cái hoặc "Chọn tất cả" / "Bỏ chọn tất cả"
 */
import React, { useState, useMemo, useRef, useEffect } from 'react'
import { useStore } from '../store'
import { aiLabSuggest } from '../services/api'
import { toast } from 'react-hot-toast'
import {
  Sparkles, Loader2, AlertTriangle, Circle, Camera,
  CheckSquare, Square, CheckCheck, X as XIcon,
  Search, Plus, Microscope, AlertCircle, Check,
} from 'lucide-react'

// ─── BỘ DATA XÉT NGHIỆM ĐẦY ĐỦ ─────────────────────────────────────────────
const LAB_DATABASE = [
  // ── Huyết học ──
  { test: 'Công thức máu toàn phần (CBC)', category: 'Huyết học', reason: 'Đánh giá tổng quát tình trạng máu', keywords: ['thiếu máu','nhiễm trùng','sốt','xuất huyết','mệt mỏi','ung thư máu','nhiễm khuẩn'] },
  { test: 'Công thức bạch cầu phân loại', category: 'Huyết học', reason: 'Phân loại bạch cầu, đánh giá nhiễm trùng', keywords: ['nhiễm khuẩn','nhiễm virus','dị ứng','ký sinh trùng'] },
  { test: 'Hematocrit (Hct)', category: 'Huyết học', reason: 'Đánh giá tỷ lệ hồng cầu', keywords: ['thiếu máu','mất nước','đa hồng cầu'] },
  { test: 'Tiểu cầu (Platelet)', category: 'Huyết học', reason: 'Đánh giá nguy cơ xuất huyết/huyết khối', keywords: ['xuất huyết','bầm tím','sốt xuất huyết','giảm tiểu cầu'] },
  { test: 'Tốc độ máu lắng (ESR)', category: 'Huyết học', reason: 'Đánh giá viêm mạn tính', keywords: ['viêm khớp dạng thấp','lao','viêm mạn tính','lupus'] },
  { test: 'CRP (C-Reactive Protein)', category: 'Sinh hóa', reason: 'Đánh giá viêm cấp tính', keywords: ['nhiễm khuẩn','viêm','sốt','viêm phổi','viêm khớp'] },
  { test: 'Procalcitonin (PCT)', category: 'Sinh hóa', reason: 'Phân biệt nhiễm khuẩn vi khuẩn vs virus', keywords: ['nhiễm khuẩn huyết','viêm phổi nặng','sepsis'] },
  { test: 'Nhóm máu ABO + Rh', category: 'Huyết học', reason: 'Xác định nhóm máu', keywords: ['phẫu thuật','truyền máu','thai kỳ'] },
  { test: 'Đông máu cơ bản (PT, APTT, INR)', category: 'Huyết học', reason: 'Đánh giá chức năng đông máu', keywords: ['xuất huyết','điều trị warfarin','trước phẫu thuật','gan','huyết khối'] },
  { test: 'D-Dimer', category: 'Huyết học', reason: 'Sàng lọc huyết khối/thuyên tắc phổi', keywords: ['huyết khối tĩnh mạch sâu','thuyên tắc phổi','DVT','PE','đông máu nội mạch'] },
  { test: 'Fibrinogen', category: 'Huyết học', reason: 'Đánh giá nguy cơ tim mạch và đông máu', keywords: ['đông máu','huyết khối','tim mạch','viêm'] },
  // ── Sinh hóa máu ──
  { test: 'Đường huyết lúc đói (FBS)', category: 'Sinh hóa', reason: 'Chẩn đoán và theo dõi đái tháo đường', keywords: ['đái tháo đường','tăng đường huyết','béo phì','kháng insulin'] },
  { test: 'Đường huyết bất kỳ (RBS)', category: 'Sinh hóa', reason: 'Kiểm tra đường huyết nhanh', keywords: ['đái tháo đường','tăng đường huyết','hạ đường huyết'] },
  { test: 'HbA1c', category: 'Sinh hóa', reason: 'Đánh giá kiểm soát đường huyết 3 tháng', keywords: ['đái tháo đường','theo dõi điều trị tiểu đường','tăng đường huyết'] },
  { test: 'Nghiệm pháp dung nạp glucose (OGTT)', category: 'Sinh hóa', reason: 'Chẩn đoán tiền đái tháo đường', keywords: ['tiền đái tháo đường','đái tháo đường thai kỳ','béo phì'] },
  { test: 'Urê máu (BUN)', category: 'Sinh hóa', reason: 'Đánh giá chức năng thận', keywords: ['suy thận','tăng urê máu','mất nước'] },
  { test: 'Creatinine máu', category: 'Sinh hóa', reason: 'Đánh giá chức năng thận', keywords: ['suy thận','theo dõi thận','tăng huyết áp','đái tháo đường'] },
  { test: 'eGFR (Mức lọc cầu thận ước tính)', category: 'Sinh hóa', reason: 'Phân giai đoạn bệnh thận mạn', keywords: ['suy thận mạn','bệnh thận mạn','đái tháo đường','tăng huyết áp'] },
  { test: 'Acid uric máu', category: 'Sinh hóa', reason: 'Chẩn đoán và theo dõi gout', keywords: ['gout','tăng acid uric','viêm khớp','sỏi thận'] },
  { test: 'Điện giải đồ (Na, K, Cl, CO2)', category: 'Sinh hóa', reason: 'Đánh giá cân bằng nước-điện giải', keywords: ['mất nước','nôn','tiêu chảy','suy thận','suy tim','tăng huyết áp'] },
  { test: 'Canxi máu toàn phần', category: 'Sinh hóa', reason: 'Đánh giá chuyển hóa canxi', keywords: ['loãng xương','cường giáp cận','suy giáp cận','thiếu vitamin D'] },
  { test: 'Phospho máu', category: 'Sinh hóa', reason: 'Đánh giá cân bằng phospho', keywords: ['suy thận','loãng xương','thiếu dinh dưỡng'] },
  { test: 'Magiê máu', category: 'Sinh hóa', reason: 'Phát hiện rối loạn magiê', keywords: ['chuột rút','loạn nhịp tim','suy thận','tiêu chảy mạn'] },
  { test: 'Protein toàn phần', category: 'Sinh hóa', reason: 'Đánh giá dinh dưỡng và chức năng gan', keywords: ['xơ gan','suy dinh dưỡng','phù','hội chứng thận hư'] },
  { test: 'Albumin máu', category: 'Sinh hóa', reason: 'Đánh giá tình trạng dinh dưỡng', keywords: ['xơ gan','suy dinh dưỡng','phù','hội chứng thận hư','viêm mạn'] },
  // ── Chức năng gan ──
  { test: 'AST (SGOT)', category: 'Chức năng gan', reason: 'Đánh giá tổn thương tế bào gan', keywords: ['viêm gan','xơ gan','nhồi máu cơ tim','rối loạn cơ','tổn thương gan'] },
  { test: 'ALT (SGPT)', category: 'Chức năng gan', reason: 'Đặc hiệu hơn cho tổn thương gan', keywords: ['viêm gan','xơ gan','viêm gan virus','tổn thương gan do thuốc'] },
  { test: 'GGT (Gamma-GT)', category: 'Chức năng gan', reason: 'Đánh giá bệnh gan-mật và lạm dụng rượu', keywords: ['bệnh gan','tắc mật','lạm dụng rượu','viêm gan'] },
  { test: 'Phosphatase kiềm (ALP)', category: 'Chức năng gan', reason: 'Đánh giá bệnh gan-mật và xương', keywords: ['bệnh gan','tắc mật','bệnh xương','cường giáp cận'] },
  { test: 'Bilirubin toàn phần', category: 'Chức năng gan', reason: 'Đánh giá vàng da', keywords: ['vàng da','viêm gan','tắc mật','thiếu máu tan huyết'] },
  { test: 'Bilirubin trực tiếp và gián tiếp', category: 'Chức năng gan', reason: 'Phân loại nguyên nhân vàng da', keywords: ['vàng da','viêm gan','tắc mật'] },
  { test: 'Chức năng gan toàn bộ (LFT)', category: 'Chức năng gan', reason: 'Đánh giá tổng quát chức năng gan', keywords: ['viêm gan','xơ gan','vàng da','theo dõi thuốc độc gan'] },
  // ── Tim mạch ──
  { test: 'Troponin I hoặc T', category: 'Tim mạch', reason: 'Chẩn đoán nhồi máu cơ tim', keywords: ['đau ngực','nhồi máu cơ tim','hội chứng mạch vành cấp','ACS'] },
  { test: 'CK-MB', category: 'Tim mạch', reason: 'Theo dõi nhồi máu cơ tim', keywords: ['nhồi máu cơ tim','đau ngực cấp','ACS'] },
  { test: 'BNP/NT-proBNP', category: 'Tim mạch', reason: 'Chẩn đoán và theo dõi suy tim', keywords: ['suy tim','khó thở','phù','suy tim cấp'] },
  { test: 'Lipid máu toàn phần (Cholesterol, LDL, HDL, TG)', category: 'Tim mạch', reason: 'Đánh giá nguy cơ tim mạch', keywords: ['rối loạn mỡ máu','tăng cholesterol','bệnh tim mạch','đái tháo đường','tăng huyết áp'] },
  { test: 'LDL Cholesterol', category: 'Tim mạch', reason: 'Theo dõi điều trị hạ mỡ máu', keywords: ['rối loạn mỡ máu','điều trị statin','bệnh tim mạch'] },
  { test: 'Homocysteine máu', category: 'Tim mạch', reason: 'Đánh giá nguy cơ tim mạch và đột quỵ', keywords: ['đột quỵ','bệnh tim mạch','huyết khối','thiếu vitamin B12'] },
  { test: 'Điện tâm đồ (ECG)', category: 'Chẩn đoán hình ảnh', reason: 'Đánh giá hoạt động điện học tim', keywords: ['đau ngực','nhồi máu cơ tim','loạn nhịp tim','rung nhĩ','hồi hộp','ngất'] },
  { test: 'Siêu âm tim (Echocardiography)', category: 'Chẩn đoán hình ảnh', reason: 'Đánh giá cấu trúc và chức năng tim', keywords: ['suy tim','van tim','bệnh tim bẩm sinh','tràn dịch màng tim','tiếng thổi tim'] },
  // ── Tuyến giáp ──
  { test: 'TSH', category: 'Nội tiết', reason: 'Sàng lọc rối loạn tuyến giáp', keywords: ['suy giáp','cường giáp','mệt mỏi','tăng cân','sụt cân','bướu cổ'] },
  { test: 'FT4 (Thyroxine tự do)', category: 'Nội tiết', reason: 'Đánh giá chức năng tuyến giáp', keywords: ['suy giáp','cường giáp','bướu cổ','Graves disease'] },
  { test: 'FT3 (Triiodothyronine tự do)', category: 'Nội tiết', reason: 'Đánh giá cường giáp và chuyển hóa', keywords: ['cường giáp','Graves disease','bướu cổ nhiễm độc'] },
  { test: 'Anti-TPO (Anti-thyroid peroxidase)', category: 'Nội tiết', reason: 'Chẩn đoán viêm giáp Hashimoto', keywords: ['viêm giáp Hashimoto','suy giáp tự miễn'] },
  // ── Nội tiết ──
  { test: 'Cortisol buổi sáng', category: 'Nội tiết', reason: 'Đánh giá chức năng thượng thận', keywords: ['suy thượng thận','hội chứng Cushing','mệt mỏi mạn','hạ huyết áp tư thế'] },
  { test: 'Insulin máu lúc đói', category: 'Nội tiết', reason: 'Đánh giá kháng insulin', keywords: ['kháng insulin','béo phì','tiền đái tháo đường','hội chứng buồng trứng đa nang'] },
  { test: 'Testosterone toàn phần', category: 'Nội tiết', reason: 'Đánh giá suy giảm hormone nam', keywords: ['suy giảm testosterone','rối loạn cương dương','loãng xương ở nam'] },
  { test: 'FSH và LH', category: 'Nội tiết', reason: 'Đánh giá chức năng sinh sản', keywords: ['vô sinh','rối loạn kinh nguyệt','mãn kinh','dậy thì'] },
  { test: 'Prolactin máu', category: 'Nội tiết', reason: 'Chẩn đoán tăng prolactin máu', keywords: ['rối loạn kinh nguyệt','tiết sữa không do thai','vô sinh','khối u tuyến yên'] },
  { test: 'Vitamin D (25-OH)', category: 'Nội tiết', reason: 'Đánh giá tình trạng vitamin D', keywords: ['loãng xương','thiếu vitamin D','mệt mỏi','đau xương','suy giảm miễn dịch'] },
  { test: 'Vitamin B12', category: 'Sinh hóa', reason: 'Đánh giá tình trạng vitamin B12', keywords: ['thiếu máu megaloblastic','đau thần kinh','thiếu vitamin B12','người ăn chay'] },
  { test: 'Ferritin máu', category: 'Sinh hóa', reason: 'Đánh giá dự trữ sắt', keywords: ['thiếu máu thiếu sắt','suy giảm sắt','mệt mỏi'] },
  { test: 'Sắt huyết thanh và TIBC', category: 'Sinh hóa', reason: 'Chẩn đoán thiếu máu thiếu sắt', keywords: ['thiếu máu thiếu sắt','thiếu máu'] },
  // ── Thận - Tiết niệu ──
  { test: 'Tổng phân tích nước tiểu (UA)', category: 'Tiết niệu', reason: 'Đánh giá tổng quát chức năng thận và nhiễm trùng đường tiết niệu', keywords: ['nhiễm khuẩn tiết niệu','suy thận','đái ra máu','đái ra protein','tiểu đường'] },
  { test: 'Cấy nước tiểu và kháng sinh đồ', category: 'Tiết niệu', reason: 'Chẩn đoán nhiễm trùng và chọn kháng sinh phù hợp', keywords: ['nhiễm khuẩn tiết niệu','viêm bàng quang','viêm bể thận'] },
  { test: 'Protein niệu 24 giờ', category: 'Tiết niệu', reason: 'Đánh giá tổn thương cầu thận', keywords: ['hội chứng thận hư','suy thận','đái tháo đường','tăng huyết áp'] },
  { test: 'Microalbumin niệu', category: 'Tiết niệu', reason: 'Phát hiện sớm bệnh thận do đái tháo đường', keywords: ['đái tháo đường','tăng huyết áp','bệnh thận sớm'] },
  { test: 'Siêu âm hệ tiết niệu', category: 'Chẩn đoán hình ảnh', reason: 'Đánh giá thận, niệu quản, bàng quang', keywords: ['sỏi thận','nhiễm khuẩn tiết niệu','thận to','u thận','suy thận'] },
  // ── Ký sinh trùng / Bệnh nhiễm ──
  { test: 'Sốt rét (Malaria smear / RDT)', category: 'Vi sinh', reason: 'Chẩn đoán sốt rét', keywords: ['sốt rét','sốt kéo dài từ vùng dịch tễ','sốt theo cơn'] },
  { test: 'Sốt xuất huyết NS1 + IgM/IgG Dengue', category: 'Vi sinh', reason: 'Chẩn đoán sốt xuất huyết Dengue', keywords: ['sốt xuất huyết','dengue','sốt','phát ban','giảm tiểu cầu'] },
  { test: 'HIV (Anti-HIV)', category: 'Vi sinh', reason: 'Tầm soát HIV', keywords: ['HIV','AIDS','nhiễm trùng cơ hội','tầm soát STI'] },
  { test: 'VDRL / RPR (Giang mai)', category: 'Vi sinh', reason: 'Sàng lọc giang mai', keywords: ['giang mai','STI','loét sinh dục','STD'] },
  { test: 'HBsAg (Viêm gan B)', category: 'Vi sinh', reason: 'Phát hiện nhiễm viêm gan B', keywords: ['viêm gan B','vàng da','xơ gan','ung thư gan'] },
  { test: 'Anti-HCV (Viêm gan C)', category: 'Vi sinh', reason: 'Phát hiện nhiễm viêm gan C', keywords: ['viêm gan C','xơ gan','ung thư gan'] },
  { test: 'HBsAb (Kháng thể viêm gan B)', category: 'Vi sinh', reason: 'Kiểm tra miễn dịch sau tiêm vaccine', keywords: ['tiêm vaccine viêm gan B','kiểm tra miễn dịch'] },
  { test: 'Cấy máu và kháng sinh đồ', category: 'Vi sinh', reason: 'Chẩn đoán nhiễm khuẩn huyết', keywords: ['nhiễm khuẩn huyết','sepsis','sốt cao kéo dài','nhiễm trùng nặng'] },
  { test: 'Cấy đờm và kháng sinh đồ', category: 'Vi sinh', reason: 'Xác định tác nhân gây viêm phổi', keywords: ['viêm phổi','ho có đờm mạn','lao phổi','COPD đợt cấp'] },
  { test: 'Test nhanh COVID-19 (Antigen)', category: 'Vi sinh', reason: 'Chẩn đoán nhanh COVID-19', keywords: ['COVID-19','sốt','ho','khó thở','mất khứu giác'] },
  { test: 'PCR COVID-19', category: 'Vi sinh', reason: 'Xác nhận COVID-19 với độ chính xác cao', keywords: ['COVID-19','nghi ngờ COVID'] },
  { test: 'Test H. pylori (hơi thở Urea / kháng nguyên phân)', category: 'Vi sinh', reason: 'Chẩn đoán nhiễm H. pylori', keywords: ['loét dạ dày','H. pylori','đau thượng vị','viêm dạ dày'] },
  // ── Hô hấp ──
  { test: 'SpO2 (Đo oxy máu qua da)', category: 'Hô hấp', reason: 'Đánh giá độ bão hòa oxy', keywords: ['khó thở','COPD','hen phế quản','viêm phổi','COVID-19'] },
  { test: 'Khí máu động mạch (ABG)', category: 'Hô hấp', reason: 'Đánh giá chức năng hô hấp và cân bằng acid-base', keywords: ['suy hô hấp','COPD nặng','hen nặng','toan kiềm'] },
  { test: 'Đo chức năng hô hấp (Spirometry)', category: 'Hô hấp', reason: 'Đánh giá chức năng phổi', keywords: ['COPD','hen phế quản','bệnh phổi kẽ','khó thở mạn'] },
  { test: 'Chụp X-quang ngực thẳng (CXR)', category: 'Chẩn đoán hình ảnh', reason: 'Đánh giá tổn thương phổi và tim', keywords: ['viêm phổi','lao phổi','COPD','suy tim','tràn khí màng phổi','ho ra máu'] },
  { test: 'CT scan ngực', category: 'Chẩn đoán hình ảnh', reason: 'Đánh giá chi tiết bệnh phổi', keywords: ['u phổi','lao phổi','thuyên tắc phổi','bệnh phổi kẽ','COPD nặng'] },
  { test: 'Test lao (Tuberculin / IGRA)', category: 'Vi sinh', reason: 'Sàng lọc bệnh lao', keywords: ['lao','tiếp xúc lao','ho kéo dài','sụt cân','sốt về chiều'] },
  { test: 'Soi đờm (AFB smear)', category: 'Vi sinh', reason: 'Phát hiện vi khuẩn lao trong đờm', keywords: ['lao phổi','ho ra máu','ho kéo dài'] },
  // ── Ung thư ──
  { test: 'PSA (Kháng nguyên đặc hiệu tiền liệt tuyến)', category: 'Dấu ấn ung thư', reason: 'Sàng lọc ung thư tiền liệt tuyến', keywords: ['ung thư tiền liệt tuyến','phì đại tiền liệt tuyến','BPH','nam > 50 tuổi'] },
  { test: 'AFP (Alpha-fetoprotein)', category: 'Dấu ấn ung thư', reason: 'Theo dõi ung thư gan', keywords: ['ung thư gan','xơ gan','viêm gan B/C','u gan'] },
  { test: 'CEA (Carcinoembryonic Antigen)', category: 'Dấu ấn ung thư', reason: 'Theo dõi ung thư đại trực tràng', keywords: ['ung thư đại trực tràng','ung thư phổi','theo dõi ung thư'] },
  { test: 'CA-125', category: 'Dấu ấn ung thư', reason: 'Theo dõi ung thư buồng trứng', keywords: ['ung thư buồng trứng','u buồng trứng','nữ'] },
  { test: 'CA 19-9', category: 'Dấu ấn ung thư', reason: 'Theo dõi ung thư tụy và đường mật', keywords: ['ung thư tụy','ung thư đường mật','ung thư dạ dày'] },
  { test: 'Soi đại tràng (Colonoscopy)', category: 'Nội soi', reason: 'Phát hiện polyp và ung thư đại trực tràng', keywords: ['ung thư đại trực tràng','đi cầu ra máu','táo bón mạn','đau bụng dưới','> 45 tuổi'] },
  // ── Tiêu hóa ──
  { test: 'Nội soi dạ dày (Gastroscopy)', category: 'Nội soi', reason: 'Đánh giá dạ dày và thực quản', keywords: ['loét dạ dày','trào ngược dạ dày','đau thượng vị','nôn ra máu','nuốt khó'] },
  { test: 'Siêu âm bụng tổng quát', category: 'Chẩn đoán hình ảnh', reason: 'Đánh giá các cơ quan trong bụng', keywords: ['đau bụng','gan to','lách to','sỏi mật','sỏi thận','u bụng','xơ gan'] },
  { test: 'Siêu âm gan-mật-tụy', category: 'Chẩn đoán hình ảnh', reason: 'Đánh giá gan, túi mật và tụy', keywords: ['viêm gan','xơ gan','sỏi mật','viêm tụy','u gan','vàng da'] },
  { test: 'Amylase và Lipase máu', category: 'Sinh hóa', reason: 'Chẩn đoán viêm tụy cấp', keywords: ['viêm tụy cấp','đau bụng thượng vị','nôn nhiều','sau uống rượu'] },
  { test: 'Xét nghiệm phân (tìm máu ẩn)', category: 'Tiêu hóa', reason: 'Sàng lọc xuất huyết tiêu hóa', keywords: ['xuất huyết tiêu hóa','ung thư đại trực tràng','sàng lọc'] },
  // ── Thần kinh ──
  { test: 'CT sọ não không cản quang', category: 'Chẩn đoán hình ảnh', reason: 'Chẩn đoán đột quỵ, chấn thương đầu', keywords: ['đột quỵ','chấn thương đầu','đau đầu đột ngột','co giật','liệt'] },
  { test: 'MRI não', category: 'Chẩn đoán hình ảnh', reason: 'Đánh giá chi tiết tổn thương não', keywords: ['đột quỵ thiếu máu','u não','đa xơ cứng','động kinh','đau đầu mạn'] },
  { test: 'Điện não đồ (EEG)', category: 'Thần kinh', reason: 'Đánh giá hoạt động điện não', keywords: ['động kinh','co giật','mất ý thức','rối loạn giấc ngủ'] },
  { test: 'Dịch não tủy (CSF analysis)', category: 'Thần kinh', reason: 'Chẩn đoán viêm màng não, xuất huyết dưới màng nhện', keywords: ['viêm màng não','xuất huyết dưới màng nhện','đau đầu nặng kèm sốt','cứng gáy'] },
  // ── Cơ xương khớp ──
  { test: 'X-quang khớp', category: 'Chẩn đoán hình ảnh', reason: 'Đánh giá tình trạng xương khớp', keywords: ['viêm khớp','thoái hóa khớp','gãy xương','gout','đau khớp'] },
  { test: 'MRI khớp', category: 'Chẩn đoán hình ảnh', reason: 'Đánh giá mô mềm và sụn khớp', keywords: ['đứt dây chằng','rách sụn chêm','tổn thương mô mềm','đau khớp không rõ'] },
  { test: 'Đo mật độ xương (DEXA)', category: 'Chẩn đoán hình ảnh', reason: 'Chẩn đoán loãng xương', keywords: ['loãng xương','gãy xương do loãng xương','mãn kinh','steroid dài hạn'] },
  { test: 'RF (Rheumatoid Factor)', category: 'Miễn dịch', reason: 'Hỗ trợ chẩn đoán viêm khớp dạng thấp', keywords: ['viêm khớp dạng thấp','đau khớp đối xứng','cứng khớp buổi sáng'] },
  { test: 'Anti-CCP (Anti-citrullinated protein antibody)', category: 'Miễn dịch', reason: 'Đặc hiệu cho viêm khớp dạng thấp', keywords: ['viêm khớp dạng thấp','sớm phát hiện viêm khớp dạng thấp'] },
  { test: 'ANA (Antinuclear Antibody)', category: 'Miễn dịch', reason: 'Sàng lọc bệnh tự miễn', keywords: ['lupus','bệnh tự miễn','viêm khớp dạng thấp','xơ cứng bì'] },
  { test: 'Anti-dsDNA', category: 'Miễn dịch', reason: 'Đặc hiệu cho lupus', keywords: ['lupus','viêm thận lupus'] },
  // ── Phụ khoa / Thai sản ──
  { test: 'Beta-hCG định lượng', category: 'Phụ khoa', reason: 'Xác nhận thai và theo dõi thai kỳ', keywords: ['thai kỳ','mang thai','thai ngoài tử cung','xét nghiệm thai'] },
  { test: 'Phết tế bào cổ tử cung (Pap smear)', category: 'Phụ khoa', reason: 'Sàng lọc ung thư cổ tử cung', keywords: ['ung thư cổ tử cung','sàng lọc phụ khoa','HPV'] },
  { test: 'HPV genotyping', category: 'Phụ khoa', reason: 'Phát hiện virus HPV nguy cơ cao', keywords: ['HPV','ung thư cổ tử cung','tổn thương cổ tử cung'] },
  { test: 'Siêu âm phụ khoa', category: 'Chẩn đoán hình ảnh', reason: 'Đánh giá tử cung và buồng trứng', keywords: ['rối loạn kinh nguyệt','u nang buồng trứng','u xơ tử cung','đau bụng dưới nữ'] },
  { test: 'Siêu âm thai', category: 'Chẩn đoán hình ảnh', reason: 'Theo dõi thai kỳ', keywords: ['thai kỳ','mang thai','theo dõi thai','siêu âm sản khoa'] },
]

const PRIORITY_CONFIG = {
  urgent:  { label: 'Cấp thiết',  cls: 'bg-red-50 text-red-700 border-red-200',      dot: 'bg-red-400'    },
  imaging: { label: 'Hình ảnh',   cls: 'bg-blue-50 text-blue-700 border-blue-200',    dot: 'bg-blue-400'   },
  routine: { label: 'Cần thiết',  cls: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-400'  },
  optional:{ label: 'Tùy chọn',   cls: 'bg-gray-50 text-gray-600 border-gray-200',    dot: 'bg-gray-300'   },
}
const PRIORITY_ORDER = ['urgent', 'imaging', 'routine', 'optional']

// Gợi ý xét nghiệm theo chẩn đoán
function suggestLabsByCondition(diagnosis, symptoms) {
  if (!diagnosis && !symptoms) return LAB_DATABASE.slice(0, 12)
  const text = `${diagnosis || ''} ${symptoms || ''}`.toLowerCase()
  const scored = LAB_DATABASE.map(d => {
    const score = d.keywords.reduce((acc, kw) => acc + (text.includes(kw.toLowerCase()) ? 2 : 0), 0)
    return { ...d, score }
  }).filter(d => d.score > 0)
  scored.sort((a, b) => b.score - a.score)
  return scored.length > 0 ? scored.slice(0, 15) : LAB_DATABASE.slice(0, 12)
}

export default function LabTab() {
  const { emr, setEmrField, loading, setLoading } = useStore()
  const [suggestedLabs, setSuggestedLabs] = useState(emr._labData || [])
  const [selected, setSelected] = useState(new Set(emr.lab_orders || []))
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [pendingItems, setPendingItems] = useState(new Set())
  const searchRef = useRef(null)

  useEffect(() => {
    if (showSearch && searchRef.current) searchRef.current.focus()
  }, [showSearch])

  // Reset pending khi mở popup
  useEffect(() => {
    if (showSearch) setPendingItems(new Set(selected))
  }, [showSearch])

  const handleAI = async () => {
    setLoading('lab', true)
    try {
      const res = await aiLabSuggest({
        symptoms: emr.symptoms, diagnosis: emr.diagnosis,
        history: emr.history, existing_labs: [],
      })
      const d = res.data
      const all = [
        ...(d.urgent  || []).map(x => ({ ...x, priority: 'urgent'   })),
        ...(d.routine || []).map(x => ({ ...x, priority: 'routine'  })),
        ...(d.optional|| []).map(x => ({ ...x, priority: 'optional' })),
        ...(d.imaging || []).map(x => ({ ...x, priority: 'imaging'  })),
      ]
      setSuggestedLabs(all)
      setEmrField('_labData', all)
      const autoSelect = new Set(
        all.filter(x => x.priority === 'urgent' || x.priority === 'imaging').map(x => x.test)
      )
      setSelected(autoSelect)
      syncToEMR(autoSelect)
      toast.success(`Gợi ý ${all.length} xét nghiệm — đã tự chọn ${autoSelect.size} ưu tiên cao`)
    } catch { toast.error('Lỗi gợi ý xét nghiệm') }
    finally { setLoading('lab', false) }
  }

  const syncToEMR = (sel) => setEmrField('lab_orders', [...sel])

  const toggle = (test) => {
    const next = new Set(selected)
    if (next.has(test)) next.delete(test)
    else next.add(test)
    setSelected(next); syncToEMR(next)
  }

  const selectAll = () => {
    const next = new Set(suggestedLabs.map(x => x.test))
    setSelected(next); syncToEMR(next)
  }

  const clearAll = () => { setSelected(new Set()); syncToEMR(new Set()) }

  const selectGroup = (priority) => {
    const tests = suggestedLabs.filter(x => x.priority === priority).map(x => x.test)
    const next = new Set(selected)
    const allIn = tests.every(t => next.has(t))
    if (allIn) tests.forEach(t => next.delete(t))
    else tests.forEach(t => next.add(t))
    setSelected(next); syncToEMR(next)
  }

  const grouped = useMemo(() => {
    const g = {}
    PRIORITY_ORDER.forEach(p => { g[p] = suggestedLabs.filter(x => x.priority === p) })
    return g
  }, [suggestedLabs])

  // Gợi ý từ database theo chẩn đoán
  const dbSuggestions = useMemo(
    () => suggestLabsByCondition(emr.diagnosis, emr.symptoms),
    [emr.diagnosis, emr.symptoms]
  )

  // Tìm kiếm trong database
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return dbSuggestions
    const q = searchQuery.toLowerCase()
    return LAB_DATABASE.filter(d =>
      d.test.toLowerCase().includes(q) ||
      d.category.toLowerCase().includes(q) ||
      d.reason.toLowerCase().includes(q) ||
      d.keywords.some(k => k.includes(q))
    ).slice(0, 20)
  }, [searchQuery, dbSuggestions])

  const isAlreadySelected = (test) => selected.has(test)

  const togglePending = (item) => {
    const next = new Set(pendingItems)
    if (next.has(item.test)) next.delete(item.test)
    else next.add(item.test)
    setPendingItems(next)
  }

  const confirmSearch = () => {
    // Thêm các item mới vào suggestedLabs nếu chưa có
    let updated = [...suggestedLabs]
    pendingItems.forEach(testName => {
      if (!updated.some(l => l.test === testName)) {
        const dbItem = LAB_DATABASE.find(d => d.test === testName)
        if (dbItem) updated.push({ test: testName, reason: dbItem.reason, priority: 'optional', expected_result: '' })
      }
    })
    setSuggestedLabs(updated)
    setEmrField('_labData', updated)
    setSelected(pendingItems)
    syncToEMR(pendingItems)
    const added = pendingItems.size - selected.size
    if (added > 0) toast.success(`Đã thêm ${added} xét nghiệm`)
    setShowSearch(false)
    setSearchQuery('')
  }

  const totalSelected = selected.size

  return (
    <div className="space-y-3">
      {/* Top bar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <span className="text-xs text-gray-500">
          Xét nghiệm & Chẩn đoán hình ảnh
          {totalSelected > 0 && (
            <span className="ml-2 bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full text-xs font-medium">
              Đã chọn: {totalSelected}
            </span>
          )}
        </span>
        <button onClick={handleAI} disabled={!!loading.lab}
          className="flex items-center gap-1.5 text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-100 rounded-lg px-3 py-1.5 transition disabled:opacity-50">
          {loading.lab ? <Loader2 size={12} className="spin" /> : <Sparkles size={12} />}
          AI gợi ý xét nghiệm
        </button>
      </div>

      {!emr.diagnosis && !emr.symptoms && (
        <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          <AlertCircle size={13} />
          Nhập triệu chứng hoặc chẩn đoán để xem gợi ý xét nghiệm phù hợp
        </div>
      )}

      {/* Select all / clear */}
      {suggestedLabs.length > 0 && (
        <div className="flex items-center gap-2 pb-1 border-b border-gray-100">
          <button onClick={selectAll}
            className="flex items-center gap-1 text-xs px-2.5 py-1.5 border border-teal-200 bg-teal-50 text-teal-700 rounded-lg hover:bg-teal-100 transition">
            <CheckCheck size={12} /> Chọn tất cả
          </button>
          <button onClick={clearAll}
            className="flex items-center gap-1 text-xs px-2.5 py-1.5 border border-gray-200 bg-white text-gray-600 rounded-lg hover:bg-gray-50 transition">
            <XIcon size={12} /> Bỏ chọn
          </button>
          <span className="text-xs text-gray-400 ml-auto">{totalSelected}/{suggestedLabs.length} được chọn</span>
        </div>
      )}

      {/* Empty state */}
      {suggestedLabs.length === 0 && (
        <div className="text-center py-8 text-gray-300 text-sm">
          Nhấn "AI gợi ý xét nghiệm" để phân tích<br />
          <span className="text-xs">hoặc tìm và thêm thủ công bên dưới</span>
        </div>
      )}

      {/* Groups */}
      {PRIORITY_ORDER.map(priority => {
        const items = grouped[priority]
        if (!items?.length) return null
        const cfg = PRIORITY_CONFIG[priority]
        const allGroupSelected = items.every(x => selected.has(x.test))
        const someGroupSelected = items.some(x => selected.has(x.test))
        return (
          <div key={priority}>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${cfg.cls}`}>{cfg.label}</span>
                <span className="text-xs text-gray-400">{items.length} xét nghiệm</span>
              </div>
              <button onClick={() => selectGroup(priority)}
                className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 transition">
                {allGroupSelected
                  ? <CheckSquare size={13} className="text-teal-500" />
                  : someGroupSelected
                  ? <CheckSquare size={13} className="text-gray-300" />
                  : <Square size={13} />
                }
                {allGroupSelected ? 'Bỏ nhóm' : 'Chọn nhóm'}
              </button>
            </div>
            <div className="space-y-1.5">
              {items.map((item, i) => {
                const isChecked = selected.has(item.test)
                return (
                  <label key={i}
                    className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                      isChecked ? 'border-teal-300 bg-teal-50/60' : 'border-gray-100 bg-white hover:border-gray-200 hover:bg-gray-50'
                    }`}>
                    <div className="mt-0.5 shrink-0">
                      {isChecked ? <CheckSquare size={15} className="text-teal-500" /> : <Square size={15} className="text-gray-300" />}
                    </div>
                    <input type="checkbox" className="hidden" checked={isChecked} onChange={() => toggle(item.test)} />
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-medium ${isChecked ? 'text-teal-800' : 'text-gray-800'}`}>{item.test}</div>
                      {item.reason && <div className="text-xs text-gray-500 mt-0.5 leading-relaxed">{item.reason}</div>}
                      {item.expected_result && (
                        <div className="text-xs text-blue-500 mt-1 flex items-center gap-1">
                          <span className="w-1 h-1 rounded-full bg-blue-400 inline-block" />
                          Dự kiến: {item.expected_result}
                        </div>
                      )}
                    </div>
                    <span className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${cfg.dot}`} />
                  </label>
                )
              })}
            </div>
          </div>
        )
      })}

      {/* Selected summary */}
      {totalSelected > 0 && (
        <div className="bg-teal-50 border border-teal-200 rounded-xl p-3">
          <div className="text-xs font-medium text-teal-800 mb-2 flex items-center gap-1">
            <CheckCheck size={12} /> Xét nghiệm đã chọn ({totalSelected})
          </div>
          <div className="flex flex-wrap gap-1.5">
            {[...selected].map(test => (
              <span key={test}
                className="inline-flex items-center gap-1 text-xs bg-white border border-teal-200 text-teal-700 px-2 py-0.5 rounded-full">
                {test}
                <button onClick={() => toggle(test)} className="hover:text-red-400 transition"><XIcon size={10} /></button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Nút mở popup tìm kiếm */}
      <button
        onClick={() => setShowSearch(true)}
        className="flex items-center gap-1.5 text-xs text-teal-600 hover:text-teal-700 border border-dashed border-teal-200 bg-teal-50/50 hover:bg-teal-50 rounded-xl px-3 py-2 w-full justify-center transition"
      >
        <Search size={13} /> Tìm & thêm xét nghiệm thủ công
        <Plus size={12} />
      </button>

      {/* POPUP tìm kiếm xét nghiệm */}
      {showSearch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{backgroundColor:'rgba(0,0,0,0.45)'}}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden" style={{maxHeight:'85vh'}}>
            {/* Header popup */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-teal-50">
              <div className="flex items-center gap-2">
                <Microscope size={16} className="text-teal-600" />
                <span className="text-sm font-semibold text-teal-800">Thêm xét nghiệm</span>
                {pendingItems.size > 0 && (
                  <span className="bg-teal-600 text-white text-xs px-2 py-0.5 rounded-full font-medium">
                    {pendingItems.size} đã chọn
                  </span>
                )}
              </div>
              <button onClick={() => { setShowSearch(false); setSearchQuery('') }} className="text-gray-400 hover:text-gray-600 transition">
                <XIcon size={18} />
              </button>
            </div>

            {/* Search input */}
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-100 bg-gray-50">
              <Search size={14} className="text-gray-400 shrink-0" />
              <input
                ref={searchRef}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={emr.diagnosis ? `Gợi ý theo: ${emr.diagnosis.slice(0,25)}... hoặc nhập tên xét nghiệm` : 'Nhập tên xét nghiệm hoặc tên bệnh...'}
                className="flex-1 text-sm outline-none bg-transparent"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="text-gray-300 hover:text-gray-500"><XIcon size={14} /></button>
              )}
            </div>

            {/* Label */}
            <div className="px-4 pt-2 pb-1 flex items-center justify-between">
              <span className="text-xs text-gray-400 font-medium">
                {searchQuery ? `Kết quả (${searchResults.length})` : emr.diagnosis || emr.symptoms ? '✨ Gợi ý theo chẩn đoán / triệu chứng' : 'Xét nghiệm phổ biến'}
              </span>
              {searchResults.length > 0 && (
                <button
                  onClick={() => {
                    const allTests = searchResults.map(r => r.test)
                    const allIn = allTests.every(t => pendingItems.has(t))
                    const next = new Set(pendingItems)
                    if (allIn) allTests.forEach(t => next.delete(t))
                    else allTests.forEach(t => next.add(t))
                    setPendingItems(next)
                  }}
                  className="text-xs text-teal-600 hover:text-teal-700 transition"
                >
                  {searchResults.every(r => pendingItems.has(r.test)) ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                </button>
              )}
            </div>

            {/* Danh sách kết quả có checkbox */}
            <div className="overflow-y-auto flex-1 divide-y divide-gray-50">
              {searchResults.length === 0 ? (
                <div className="text-center py-8 text-gray-300 text-sm">Không tìm thấy xét nghiệm phù hợp</div>
              ) : searchResults.map((item, i) => {
                const isChecked = pendingItems.has(item.test)
                return (
                  <label
                    key={i}
                    className={`flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors ${isChecked ? 'bg-teal-50' : 'hover:bg-gray-50'}`}
                  >
                    {/* Checkbox đẹp */}
                    <div className={`mt-0.5 shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                      isChecked ? 'bg-teal-500 border-teal-500' : 'border-gray-300 bg-white'
                    }`}>
                      {isChecked && <Check size={12} className="text-white" strokeWidth={3} />}
                    </div>
                    <input type="checkbox" className="hidden" checked={isChecked} onChange={() => togglePending(item)} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`text-sm font-medium ${isChecked ? 'text-teal-800' : 'text-gray-800'}`}>{item.test}</span>
                        <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{item.category}</span>
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5 italic">{item.reason}</div>
                    </div>
                  </label>
                )
              })}
            </div>

            {/* Footer action buttons */}
            <div className="flex items-center gap-2 px-4 py-3 border-t border-gray-100 bg-gray-50">
              <button
                onClick={() => { setShowSearch(false); setSearchQuery('') }}
                className="flex-1 text-sm text-gray-500 border border-gray-200 rounded-xl py-2 hover:bg-gray-100 transition"
              >
                Hủy
              </button>
              <button
                onClick={confirmSearch}
                className="flex-1 text-sm font-medium bg-teal-500 hover:bg-teal-600 text-white rounded-xl py-2 transition flex items-center justify-center gap-1.5"
              >
                <CheckCheck size={14} />
                Xác nhận{pendingItems.size > 0 ? ` (${pendingItems.size})` : ''}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
