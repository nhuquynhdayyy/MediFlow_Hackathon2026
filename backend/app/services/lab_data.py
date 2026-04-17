from typing import Dict, List, Any

LAB_DATABASE = [
    # ── Huyết học ──
    { 'test': 'Công thức máu toàn phần (CBC)', 'category': 'Huyết học', 'reason': 'Đánh giá tổng quát tình trạng máu', 'keywords': ['thiếu máu','nhiễm trùng','sốt','xuất huyết','mệt mỏi','ung thư máu','nhiễm khuẩn'] },
    { 'test': 'Công thức bạch cầu phân loại', 'category': 'Huyết học', 'reason': 'Phân loại bạch cầu, đánh giá nhiễm trùng', 'keywords': ['nhiễm khuẩn','nhiễm virus','dị ứng','ký sinh trùng'] },
    { 'test': 'Hematocrit (Hct)', 'category': 'Huyết học', 'reason': 'Đánh giá tỷ lệ hồng cầu', 'keywords': ['thiếu máu','mất nước','đa hồng cầu'] },
    { 'test': 'Tiểu cầu (Platelet)', 'category': 'Huyết học', 'reason': 'Đánh giá nguy cơ xuất huyết/huyết khối', 'keywords': ['xuất huyết','bầm tím','sốt xuất huyết','giảm tiểu cầu'] },
    { 'test': 'Tốc độ máu lắng (ESR)', 'category': 'Huyết học', 'reason': 'Đánh giá viêm mạn tính', 'keywords': ['viêm khớp dạng thấp','lao','viêm mạn tính','lupus'] },
    { 'test': 'Nhóm máu ABO + Rh', 'category': 'Huyết học', 'reason': 'Xác định nhóm máu', 'keywords': ['phẫu thuật','truyền máu','thai kỳ'] },
    { 'test': 'Đông máu cơ bản (PT, APTT, INR)', 'category': 'Huyết học', 'reason': 'Đánh giá chức năng đông máu', 'keywords': ['xuất huyết','điều trị warfarin','trước phẫu thuật','gan','huyết khối'] },
    { 'test': 'D-Dimer', 'category': 'Huyết học', 'reason': 'Sàng lọc huyết khối/thuyên tắc phổi', 'keywords': ['huyết khối tĩnh mạch sâu','thuyên tắc phổi','DVT','PE','đông máu nội mạch'] },
    { 'test': 'Fibrinogen', 'category': 'Huyết học', 'reason': 'Đánh giá nguy cơ tim mạch và đông máu', 'keywords': ['đông máu','huyết khối','tim mạch','viêm'] },
    
    # ── Sinh hóa máu ──
    { 'test': 'CRP (C-Reactive Protein)', 'category': 'Sinh hóa', 'reason': 'Đánh giá viêm cấp tính', 'keywords': ['nhiễm khuẩn','viêm','sốt','viêm phổi','viêm khớp'] },
    { 'test': 'Procalcitonin (PCT)', 'category': 'Sinh hóa', 'reason': 'Phân biệt nhiễm khuẩn vi khuẩn vs virus', 'keywords': ['nhiễm khuẩn huyết','viêm phổi nặng','sepsis'] },
    { 'test': 'Đường huyết lúc đói (FBS)', 'category': 'Sinh hóa', 'reason': 'Chẩn đoán và theo dõi đái tháo đường', 'keywords': ['đái tháo đường','tăng đường huyết','béo phì','kháng insulin'] },
    { 'test': 'Đường huyết bất kỳ (RBS)', 'category': 'Sinh hóa', 'reason': 'Kiểm tra đường huyết nhanh', 'keywords': ['đái tháo đường','tăng đường huyết','hạ đường huyết'] },
    { 'test': 'HbA1c', 'category': 'Sinh hóa', 'reason': 'Đánh giá kiểm soát đường huyết 3 tháng', 'keywords': ['đái tháo đường','theo dõi điều trị tiểu đường','tăng đường huyết'] },
    { 'test': 'Nghiệm pháp dung nạp glucose (OGTT)', 'category': 'Sinh hóa', 'reason': 'Chẩn đoán tiền đái tháo đường', 'keywords': ['tiền đái tháo đường','đái tháo đường thai kỳ','béo phì'] },
    { 'test': 'Urê máu (BUN)', 'category': 'Sinh hóa', 'reason': 'Đánh giá chức năng thận', 'keywords': ['suy thận','tăng urê máu','mất nước'] },
    { 'test': 'Creatinine máu', 'category': 'Sinh hóa', 'reason': 'Đánh giá chức năng thận', 'keywords': ['suy thận','theo dõi thận','tăng huyết áp','đái tháo đường'] },
    { 'test': 'eGFR (Mức lọc cầu thận ước tính)', 'category': 'Sinh hóa', 'reason': 'Phân giai đoạn bệnh thận mạn', 'keywords': ['suy thận mạn','bệnh thận mạn','đái tháo đường','tăng huyết áp'] },
    { 'test': 'Acid uric máu', 'category': 'Sinh hóa', 'reason': 'Chẩn đoán và theo dõi gout', 'keywords': ['gout','tăng acid uric','viêm khớp','sỏi thận'] },
    { 'test': 'Điện giải đồ (Na, K, Cl, CO2)', 'category': 'Sinh hóa', 'reason': 'Đánh giá cân bằng nước-điện giải', 'keywords': ['mất nước','nôn','tiêu chảy','suy thận','suy tim','tăng huyết áp'] },
    { 'test': 'Canxi máu toàn phần', 'category': 'Sinh hóa', 'reason': 'Đánh giá chuyển hóa canxi', 'keywords': ['loãng xương','cường giáp cận','suy giáp cận','thiếu vitamin D'] },
    { 'test': 'Phospho máu', 'category': 'Sinh hóa', 'reason': 'Đánh giá cân bằng phospho', 'keywords': ['suy thận','loãng xương','thiếu dinh dưỡng'] },
    { 'test': 'Magiê máu', 'category': 'Sinh hóa', 'reason': 'Phát hiện rối loạn magiê', 'keywords': ['chuột rút','loạn nhịp tim','suy thận','tiêu chảy mạn'] },
    { 'test': 'Protein toàn phần', 'category': 'Sinh hóa', 'reason': 'Đánh giá dinh dưỡng và chức năng gan', 'keywords': ['xơ gan','suy dinh dưỡng','phù','hội chứng thận hư'] },
    { 'test': 'Albumin máu', 'category': 'Sinh hóa', 'reason': 'Đánh giá tình trạng dinh dưỡng', 'keywords': ['xơ gan','suy dinh dưỡng','phù','hội chứng thận hư','viêm mạn'] },
    { 'test': 'Vitamin B12', 'category': 'Sinh hóa', 'reason': 'Đánh giá tình trạng vitamin B12', 'keywords': ['thiếu máu megaloblastic','đau thần kinh','thiếu vitamin B12','người ăn chay'] },
    { 'test': 'Ferritin máu', 'category': 'Sinh hóa', 'reason': 'Đánh giá dự trữ sắt', 'keywords': ['thiếu máu thiếu sắt','suy giảm sắt','mệt mỏi'] },
    { 'test': 'Sắt huyết thanh và TIBC', 'category': 'Sinh hóa', 'reason': 'Chẩn đoán thiếu máu thiếu sắt', 'keywords': ['thiếu máu thiếu sắt','thiếu máu'] },
    { 'test': 'Amylase và Lipase máu', 'category': 'Sinh hóa', 'reason': 'Chẩn đoán viêm tụy cấp', 'keywords': ['viêm tụy cấp','đau bụng thượng vị','nôn nhiều','sau uống rượu'] },
    
    # ── Chức năng gan ──
    { 'test': 'AST (SGOT)', 'category': 'Chức năng gan', 'reason': 'Đánh giá tổn thương tế bào gan', 'keywords': ['viêm gan','xơ gan','nhồi máu cơ tim','rối loạn cơ','tổn thương gan'] },
    { 'test': 'ALT (SGPT)', 'category': 'Chức năng gan', 'reason': 'Đặc hiệu hơn cho tổn thương gan', 'keywords': ['viêm gan','xơ gan','viêm gan virus','tổn thương gan do thuốc'] },
    { 'test': 'GGT (Gamma-GT)', 'category': 'Chức năng gan', 'reason': 'Đánh giá bệnh gan-mật và lạm dụng rượu', 'keywords': ['bệnh gan','tắc mật','lạm dụng rượu','viêm gan'] },
    { 'test': 'Phosphatase kiềm (ALP)', 'category': 'Chức năng gan', 'reason': 'Đánh giá bệnh gan-mật và xương', 'keywords': ['bệnh gan','tắc mật','bệnh xương','cường giáp cận'] },
    { 'test': 'Bilirubin toàn phần', 'category': 'Chức năng gan', 'reason': 'Đánh giá vàng da', 'keywords': ['vàng da','viêm gan','tắc mật','thiếu máu tan huyết'] },
    { 'test': 'Bilirubin trực tiếp và gián tiếp', 'category': 'Chức năng gan', 'reason': 'Phân loại nguyên nhân vàng da', 'keywords': ['vàng da','viêm gan','tắc mật'] },
    { 'test': 'Chức năng gan toàn bộ (LFT)', 'category': 'Chức năng gan', 'reason': 'Đánh giá tổng quát chức năng gan', 'keywords': ['viêm gan','xơ gan','vàng da','theo dõi thuốc độc gan'] },
    
    # ── Tim mạch ──
    { 'test': 'Troponin I hoặc T', 'category': 'Tim mạch', 'reason': 'Chẩn đoán nhồi máu cơ tim', 'keywords': ['đau ngực','nhồi máu cơ tim','hội chứng mạch vành cấp','ACS'] },
    { 'test': 'CK-MB', 'category': 'Tim mạch', 'reason': 'Theo dõi nhồi máu cơ tim', 'keywords': ['nhồi máu cơ tim','đau ngực cấp','ACS'] },
    { 'test': 'BNP/NT-proBNP', 'category': 'Tim mạch', 'reason': 'Chẩn đoán và theo dõi suy tim', 'keywords': ['suy tim','khó thở','phù','suy tim cấp'] },
    { 'test': 'Lipid máu toàn phần (Cholesterol, LDL, HDL, TG)', 'category': 'Tim mạch', 'reason': 'Đánh giá nguy cơ tim mạch', 'keywords': ['rối loạn mỡ máu','tăng cholesterol','bệnh tim mạch','đái tháo đường','tăng huyết áp'] },
    { 'test': 'LDL Cholesterol', 'category': 'Tim mạch', 'reason': 'Theo dõi điều trị hạ mỡ máu', 'keywords': ['rối loạn mỡ máu','điều trị statin','bệnh tim mạch'] },
    { 'test': 'Homocysteine máu', 'category': 'Tim mạch', 'reason': 'Đánh giá nguy cơ tim mạch và đột quỵ', 'keywords': ['đột quỵ','bệnh tim mạch','huyết khối','thiếu vitamin B12'] },
    
    # ── Chẩn đoán hình ảnh ──
    { 'test': 'Điện tâm đồ (ECG)', 'category': 'Chẩn đoán hình ảnh', 'reason': 'Đánh giá hoạt động điện học tim', 'keywords': ['đau ngực','nhồi máu cơ tim','loạn nhịp tim','rung nhĩ','hồi hộp','ngất'] },
    { 'test': 'Siêu âm tim (Echocardiography)', 'category': 'Chẩn đoán hình ảnh', 'reason': 'Đánh giá cấu trúc và chức năng tim', 'keywords': ['suy tim','van tim','bệnh tim bẩm sinh','tràn dịch màng tim','tiếng thổi tim'] },
    { 'test': 'Siêu âm hệ tiết niệu', 'category': 'Chẩn đoán hình ảnh', 'reason': 'Đánh giá thận, niệu quản, bàng quang', 'keywords': ['sỏi thận','nhiễm khuẩn tiết niệu','thận to','u thận','suy thận'] },
    { 'test': 'Chụp X-quang ngực thẳng (CXR)', 'category': 'Chẩn đoán hình ảnh', 'reason': 'Đánh giá tổn thương phổi và tim', 'keywords': ['viêm phổi','lao phổi','COPD','suy tim','tràn khí màng phổi','ho ra máu'] },
    { 'test': 'CT scan ngực', 'category': 'Chẩn đoán hình ảnh', 'reason': 'Đánh giá chi tiết bệnh phổi', 'keywords': ['u phổi','lao phổi','thuyên tắc phổi','bệnh phổi kẽ','COPD nặng'] },
    { 'test': 'Siêu âm bụng tổng quát', 'category': 'Chẩn đoán hình ảnh', 'reason': 'Đánh giá các cơ quan trong bụng', 'keywords': ['đau bụng','gan to','lách to','sỏi mật','sỏi thận','u bụng','xơ gan'] },
    { 'test': 'Siêu âm gan-mật-tụy', 'category': 'Chẩn đoán hình ảnh', 'reason': 'Đánh giá gan, túi mật và tụy', 'keywords': ['viêm gan','xơ gan','sỏi mật','viêm tụy','u gan','vàng da'] },
    { 'test': 'CT sọ não không cản quang', 'category': 'Chẩn đoán hình ảnh', 'reason': 'Chẩn đoán đột quỵ, chấn thương đầu', 'keywords': ['đột quỵ','chấn thương đầu','đau đầu đột ngột','co giật','liệt'] },
    { 'test': 'MRI não', 'category': 'Chẩn đoán hình ảnh', 'reason': 'Đánh giá chi tiết tổn thương não', 'keywords': ['đột quỵ thiếu máu','u não','đa xơ cứng','động kinh','đau đầu mạn'] },
    { 'test': 'X-quang khớp', 'category': 'Chẩn đoán hình ảnh', 'reason': 'Đánh giá tình trạng xương khớp', 'keywords': ['viêm khớp','thoái hóa khớp','gãy xương','gout','đau khớp'] },
    { 'test': 'MRI khớp', 'category': 'Chẩn đoán hình ảnh', 'reason': 'Đánh giá mô mềm và sụn khớp', 'keywords': ['đứt dây chằng','rách sụn chêm','tổn thương mô mềm','đau khớp không rõ'] },
    { 'test': 'Đo mật độ xương (DEXA)', 'category': 'Chẩn đoán hình ảnh', 'reason': 'Chẩn đoán loãng xương', 'keywords': ['loãng xương','gãy xương do loãng xương','mãn kinh','steroid dài hạn'] },
    { 'test': 'Siêu âm phụ khoa', 'category': 'Chẩn đoán hình ảnh', 'reason': 'Đánh giá tử cung và buồng trứng', 'keywords': ['rối loạn kinh nguyệt','u nang buồng trứng','u xơ tử cung','đau bụng dưới nữ'] },
    { 'test': 'Siêu âm thai', 'category': 'Chẩn đoán hình ảnh', 'reason': 'Theo dõi thai kỳ', 'keywords': ['thai kỳ','mang thai','theo dõi thai','siêu âm sản khoa'] },

    # ── Tuyến giáp / Nội tiết ──
    { 'test': 'TSH', 'category': 'Nội tiết', 'reason': 'Sàng lọc rối loạn tuyến giáp', 'keywords': ['suy giáp','cường giáp','mệt mỏi','tăng cân','sụt cân','bướu cổ'] },
    { 'test': 'FT4 (Thyroxine tự do)', 'category': 'Nội tiết', 'reason': 'Đánh giá chức năng tuyến giáp', 'keywords': ['suy giáp','cường giáp','bướu cổ','Graves disease'] },
    { 'test': 'FT3 (Triiodothyronine tự do)', 'category': 'Nội tiết', 'reason': 'Đánh giá cường giáp và chuyển hóa', 'keywords': ['cường giáp','Graves disease','bướu cổ nhiễm độc'] },
    { 'test': 'Anti-TPO (Anti-thyroid peroxidase)', 'category': 'Nội tiết', 'reason': 'Chẩn đoán viêm giáp Hashimoto', 'keywords': ['viêm giáp Hashimoto','suy giáp tự miễn'] },
    { 'test': 'Cortisol buổi sáng', 'category': 'Nội tiết', 'reason': 'Đánh giá chức năng thượng thận', 'keywords': ['suy thượng thận','hội chứng Cushing','mệt mỏi mạn','hạ huyết áp tư thế'] },
    { 'test': 'Insulin máu lúc đói', 'category': 'Nội tiết', 'reason': 'Đánh giá kháng insulin', 'keywords': ['kháng insulin','béo phì','tiền đái tháo đường','hội chứng buồng trứng đa nang'] },
    { 'test': 'Testosterone toàn phần', 'category': 'Nội tiết', 'reason': 'Đánh giá suy giảm hormone nam', 'keywords': ['suy giảm testosterone','rối loạn cương dương','loãng xương ở nam'] },
    { 'test': 'FSH và LH', 'category': 'Nội tiết', 'reason': 'Đánh giá chức năng sinh sản', 'keywords': ['vô sinh','rối loạn kinh nguyệt','mãn kinh','dậy thì'] },
    { 'test': 'Prolactin máu', 'category': 'Nội tiết', 'reason': 'Chẩn đoán tăng prolactin máu', 'keywords': ['rối loạn kinh nguyệt','tiết sữa không do thai','vô sinh','khối u tuyến yên'] },
    { 'test': 'Vitamin D (25-OH)', 'category': 'Nội tiết', 'reason': 'Đánh giá tình trạng vitamin D', 'keywords': ['loãng xương','thiếu vitamin D','mệt mỏi','đau xương','suy giảm miễn dịch'] },
    
    # ── Thận - Tiết niệu ──
    { 'test': 'Tổng phân tích nước tiểu (UA)', 'category': 'Tiết niệu', 'reason': 'Đánh giá tổng quát chức năng thận và nhiễm trùng đường tiết niệu', 'keywords': ['nhiễm khuẩn tiết niệu','suy thận','đái ra máu','đái ra protein','tiểu đường'] },
    { 'test': 'Cấy nước tiểu và kháng sinh đồ', 'category': 'Tiết niệu', 'reason': 'Chẩn đoán nhiễm trùng và chọn kháng sinh phù hợp', 'keywords': ['nhiễm khuẩn tiết niệu','viêm bàng quang','viêm bể thận'] },
    { 'test': 'Protein niệu 24 giờ', 'category': 'Tiết niệu', 'reason': 'Đánh giá tổn thương cầu thận', 'keywords': ['hội chứng thận hư','suy thận','đái tháo đường','tăng huyết áp'] },
    { 'test': 'Microalbumin niệu', 'category': 'Tiết niệu', 'reason': 'Phát hiện sớm bệnh thận do đái tháo đường', 'keywords': ['đái tháo đường','tăng huyết áp','bệnh thận sớm'] },
    
    # ── Ký sinh trùng / Bệnh nhiễm (Vi sinh) ──
    { 'test': 'Sốt rét (Malaria smear / RDT)', 'category': 'Vi sinh', 'reason': 'Chẩn đoán sốt rét', 'keywords': ['sốt rét','sốt kéo dài từ vùng dịch tễ','sốt theo cơn'] },
    { 'test': 'Sốt xuất huyết NS1 + IgM/IgG Dengue', 'category': 'Vi sinh', 'reason': 'Chẩn đoán sốt xuất huyết Dengue', 'keywords': ['sốt xuất huyết','dengue','sốt','phát ban','giảm tiểu cầu'] },
    { 'test': 'HIV (Anti-HIV)', 'category': 'Vi sinh', 'reason': 'Tầm soát HIV', 'keywords': ['HIV','AIDS','nhiễm trùng cơ hội','tầm soát STI'] },
    { 'test': 'VDRL / RPR (Giang mai)', 'category': 'Vi sinh', 'reason': 'Sàng lọc giang mai', 'keywords': ['giang mai','STI','loét sinh dục','STD'] },
    { 'test': 'HBsAg (Viêm gan B)', 'category': 'Vi sinh', 'reason': 'Phát hiện nhiễm viêm gan B', 'keywords': ['viêm gan B','vàng da','xơ gan','ung thư gan'] },
    { 'test': 'Anti-HCV (Viêm gan C)', 'category': 'Vi sinh', 'reason': 'Phát hiện nhiễm viêm gan C', 'keywords': ['viêm gan C','xơ gan','ung thư gan'] },
    { 'test': 'HBsAb (Kháng thể viêm gan B)', 'category': 'Vi sinh', 'reason': 'Kiểm tra miễn dịch sau tiêm vaccine', 'keywords': ['tiêm vaccine viêm gan B','kiểm tra miễn dịch'] },
    { 'test': 'Cấy máu và kháng sinh đồ', 'category': 'Vi sinh', 'reason': 'Chẩn đoán nhiễm khuẩn huyết', 'keywords': ['nhiễm khuẩn huyết','sepsis','sốt cao kéo dài','nhiễm trùng nặng'] },
    { 'test': 'Cấy đờm và kháng sinh đồ', 'category': 'Vi sinh', 'reason': 'Xác định tác nhân gây viêm phổi', 'keywords': ['viêm phổi','ho có đờm mạn','lao phổi','COPD đợt cấp'] },
    { 'test': 'Test nhanh COVID-19 (Antigen)', 'category': 'Vi sinh', 'reason': 'Chẩn đoán nhanh COVID-19', 'keywords': ['COVID-19','sốt','ho','khó thở','mất khứu giác'] },
    { 'test': 'PCR COVID-19', 'category': 'Vi sinh', 'reason': 'Xác nhận COVID-19 với độ chính xác cao', 'keywords': ['COVID-19','nghi ngờ COVID'] },
    { 'test': 'Test H. pylori (hơi thở Urea / kháng nguyên phân)', 'category': 'Vi sinh', 'reason': 'Chẩn đoán nhiễm H. pylori', 'keywords': ['loét dạ dày','H. pylori','đau thượng vị','viêm dạ dày'] },
    { 'test': 'Test lao (Tuberculin / IGRA)', 'category': 'Vi sinh', 'reason': 'Sàng lọc bệnh lao', 'keywords': ['lao','tiếp xúc lao','ho kéo dài','sụt cân','sốt về chiều'] },
    { 'test': 'Soi đờm (AFB smear)', 'category': 'Vi sinh', 'reason': 'Phát hiện vi khuẩn lao trong đờm', 'keywords': ['lao phổi','ho ra máu','ho kéo dài'] },
    
    # ── Hô hấp ──
    { 'test': 'SpO2 (Đo oxy máu qua da)', 'category': 'Hô hấp', 'reason': 'Đánh giá độ bão hòa oxy', 'keywords': ['khó thở','COPD','hen phế quản','viêm phổi','COVID-19'] },
    { 'test': 'Khí máu động mạch (ABG)', 'category': 'Hô hấp', 'reason': 'Đánh giá chức năng hô hấp và cân bằng acid-base', 'keywords': ['suy hô hấp','COPD nặng','hen nặng','toan kiềm'] },
    { 'test': 'Đo chức năng hô hấp (Spirometry)', 'category': 'Hô hấp', 'reason': 'Đánh giá chức năng phổi', 'keywords': ['COPD','hen phế quản','bệnh phổi kẽ','khó thở mạn'] },
    
    # ── Ung thư (Dấu ấn ung thư) ──
    { 'test': 'PSA (Kháng nguyên đặc hiệu tiền liệt tuyến)', 'category': 'Dấu ấn ung thư', 'reason': 'Sàng lọc ung thư tiền liệt tuyến', 'keywords': ['ung thư tiền liệt tuyến','phì đại tiền liệt tuyến','BPH','nam > 50 tuổi'] },
    { 'test': 'AFP (Alpha-fetoprotein)', 'category': 'Dấu ấn ung thư', 'reason': 'Theo dõi ung thư gan', 'keywords': ['ung thư gan','xơ gan','viêm gan B/C','u gan'] },
    { 'test': 'CEA (Carcinoembryonic Antigen)', 'category': 'Dấu ấn ung thư', 'reason': 'Theo dõi ung thư đại trực tràng', 'keywords': ['ung thư đại trực tràng','ung thư phổi','theo dõi ung thư'] },
    { 'test': 'CA-125', 'category': 'Dấu ấn ung thư', 'reason': 'Theo dõi ung thư buồng trứng', 'keywords': ['ung thư buồng trứng','u buồng trứng','nữ'] },
    { 'test': 'CA 19-9', 'category': 'Dấu ấn ung thư', 'reason': 'Theo dõi ung thư tụy và đường mật', 'keywords': ['ung thư tụy','ung thư đường mật','ung thư dạ dày'] },
    
    # ── Tiêu hóa / Nội soi ──
    { 'test': 'Soi đại tràng (Colonoscopy)', 'category': 'Nội soi', 'reason': 'Phát hiện polyp và ung thư đại trực tràng', 'keywords': ['ung thư đại trực tràng','đi cầu ra máu','táo bón mạn','đau bụng dưới','> 45 tuổi'] },
    { 'test': 'Nội soi dạ dày (Gastroscopy)', 'category': 'Nội soi', 'reason': 'Đánh giá dạ dày và thực quản', 'keywords': ['loét dạ dày','trào ngược dạ dày','đau thượng vị','nôn ra máu','nuốt khó'] },
    { 'test': 'Xét nghiệm phân (tìm máu ẩn)', 'category': 'Tiêu hóa', 'reason': 'Sàng lọc xuất huyết tiêu hóa', 'keywords': ['xuất huyết tiêu hóa','ung thư đại trực tràng','sàng lọc'] },
    
    # ── Thần kinh ──
    { 'test': 'Điện não đồ (EEG)', 'category': 'Thần kinh', 'reason': 'Đánh giá hoạt động điện não', 'keywords': ['động kinh','co giật','mất ý thức','rối loạn giấc ngủ'] },
    { 'test': 'Dịch não tủy (CSF analysis)', 'category': 'Thần kinh', 'reason': 'Chẩn đoán viêm màng não, xuất huyết dưới màng nhện', 'keywords': ['viêm màng não','xuất huyết dưới màng nhện','đau đầu nặng kèm sốt','cứng gáy'] },
    
    # ── Miễn dịch (Cơ xương khớp) ──
    { 'test': 'RF (Rheumatoid Factor)', 'category': 'Miễn dịch', 'reason': 'Hỗ trợ chẩn đoán viêm khớp dạng thấp', 'keywords': ['viêm khớp dạng thấp','đau khớp đối xứng','cứng khớp buổi sáng'] },
    { 'test': 'Anti-CCP (Anti-citrullinated protein antibody)', 'category': 'Miễn dịch', 'reason': 'Đặc hiệu cho viêm khớp dạng thấp', 'keywords': ['viêm khớp dạng thấp','sớm phát hiện viêm khớp dạng thấp'] },
    { 'test': 'ANA (Antinuclear Antibody)', 'category': 'Miễn dịch', 'reason': 'Sàng lọc bệnh tự miễn', 'keywords': ['lupus','bệnh tự miễn','viêm khớp dạng thấp','xơ cứng bì'] },
    { 'test': 'Anti-dsDNA', 'category': 'Miễn dịch', 'reason': 'Đặc hiệu cho lupus', 'keywords': ['lupus','viêm thận lupus'] },
    
    # ── Phụ khoa / Thai sản ──
    { 'test': 'Beta-hCG định lượng', 'category': 'Phụ khoa', 'reason': 'Xác nhận thai và theo dõi thai kỳ', 'keywords': ['thai kỳ','mang thai','thai ngoài tử cung','xét nghiệm thai'] },
    { 'test': 'Phết tế bào cổ tử cung (Pap smear)', 'category': 'Phụ khoa', 'reason': 'Sàng lọc ung thư cổ tử cung', 'keywords': ['ung thư cổ tử cung','sàng lọc phụ khoa','HPV'] },
    { 'test': 'HPV genotyping', 'category': 'Phụ khoa', 'reason': 'Phát hiện virus HPV nguy cơ cao', 'keywords': ['HPV','ung thư cổ tử cung','tổn thương cổ tử cung'] }
]

CATEGORY_TO_BLOCK = {
    'Huyết học': 'B (Cận lâm sàng)',
    'Sinh hóa': 'B (Cận lâm sàng)',
    'Chức năng gan': 'B (Cận lâm sàng)',
    'Vi sinh': 'B (Cận lâm sàng)',
    'Chẩn đoán hình ảnh': 'B (Cận lâm sàng)',
    'Dấu ấn ung thư': 'B (Cận lâm sàng)',
    'Nội soi': 'B (Cận lâm sàng)',
    
    'Tim mạch': 'A (Nội tổng quát)',
    'Nội tiết': 'A (Nội tổng quát)',
    'Hô hấp': 'A (Nội tổng quát)',
    'Tiêu hóa': 'A (Nội tổng quát)',
    'Thần kinh': 'A (Nội tổng quát)',
    'Miễn dịch': 'A (Nội tổng quát)',
    
    'Phụ khoa': 'C (Sản/Nhi/Khác)',
    'Tiết niệu': 'C (Sản/Nhi/Khác)',
}

def build_location_map() -> Dict[str, Dict[str, Any]]:
    """Phân bổ các khoa/phòng xét nghiệm:
    - Khu (Block): Theo nhóm chuyên khoa lớn (A, B, C). Mỗi Block chứa nhiều Toà (Khu A1, Khu A2,...)
    - Tầng (Floor): Mỗi tầng thuộc MỘT VÀ CHỈ MỘT chuyên khoa.
    - Phòng (Room): Tối đa 6 phòng 1 tầng.
    - Tòa nhà: Tối đa 5 tầng một tòa.
    """
    max_rooms_per_floor = 6
    max_floors_per_building = 5
    
    # Gom nhóm dữ liệu theo Block và Category
    blocks_data: Dict[str, Dict[str, List[str]]] = {
        'A (Nội tổng quát)': {},
        'B (Cận lâm sàng)': {},
        'C (Sản/Nhi/Khác)': {}
    }
    
    for entry in LAB_DATABASE:
        cat = entry['category']
        test = entry['test']
        block = CATEGORY_TO_BLOCK.get(cat, 'A (Khác)')
        if block not in blocks_data:
            blocks_data[block] = {}
        if cat not in blocks_data[block]:
            blocks_data[block][cat] = []
        blocks_data[block][cat].append(test)
        
    location_map = {}
    
    for main_block, categories in blocks_data.items():
        building_index = 1
        current_floor = 1
        
        # Tách chữ cái đầu (VD: 'A') và phần mô tả (VD: '(Nội tổng quát)')
        block_letter = main_block.split(' ')[0]
        block_desc = ' '.join(main_block.split(' ')[1:])
        
        for cat, tests in categories.items():
            current_room_count = 0
            
            for test in tests:
                if current_room_count >= max_rooms_per_floor:
                    current_floor += 1
                    current_room_count = 0
                
                if current_floor > max_floors_per_building:
                    building_index += 1
                    current_floor = 1
                
                actual_block_name = f"{block_letter}{building_index} {block_desc}"
                
                location_map[test] = {
                    "block": actual_block_name,
                    "floor": current_floor,
                    "category": cat
                }
                current_room_count += 1
                
            # Đã xong 1 chuyên khoa, bắt buộc chuyên khoa tiếp theo phải nằm ở tầng mới (vì mỗi tầng chỉ 1 chuyên khoa)
            current_floor += 1
            if current_floor > max_floors_per_building:
                building_index += 1
                current_floor = 1
            
    return location_map

LOCATION_MAP = build_location_map()

TEST_DB: Dict[str, Dict[str, Any]] = {}
for entry in LAB_DATABASE:
    loc = LOCATION_MAP.get(entry["test"], {"block": "A1 (Khác)", "floor": 1})
    TEST_DB[entry["test"]] = {
        **entry,
        "floor": loc["floor"],
        "block": loc["block"]
    }

def get_test_info(test_name: str) -> Dict[str, Any]:
    """Tra cứu thông tin một xét nghiệm bất kỳ, trả về chuyên khoa, tòa, và tầng."""
    if test_name in TEST_DB:
        return TEST_DB[test_name]
    
    test_lower = test_name.lower()
    for test, info in TEST_DB.items():
        if test_lower in test.lower() or test.lower() in test_lower:
            return info
    return {}
