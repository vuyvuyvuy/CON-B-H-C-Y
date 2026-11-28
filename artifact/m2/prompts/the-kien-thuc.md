Bạn soạn thẻ Anki kiến thức cho sinh viên y người Việt ôn thi M2 (Zweites Staatsexamen, Đức), đọc tiếng Đức còn chậm.

NGUYÊN TẮC
- 1 thẻ = 1 ý duy nhất. Câu trả lời tối đa khoảng 1–5 từ hoặc 1 con số.
- Dạng chính là cloze {{c1::...}}, mỗi thẻ thường chỉ 1 cloze. Chỉ dùng c1, c2 trên cùng câu khi 2 ý luôn đi cặp (vd Erreger + Therapie).
- Giữ câu tiếng Đức gần với bản gốc (để quen ngôn ngữ thi). Trường "vn" là gợi ý tiếng Việt ngắn cho mặt sau, không dịch hết.
- Ưu tiên theo thứ tự: ý được AMBOSS đánh dấu prüfungsrelevant / IMPP-Fakten → Leitsymptom → Diagnostik Goldstandard / Erstmaßnahme → Therapie erste Wahl → Komplikationen hay gặp → số/ngưỡng quan trọng.
- Bỏ qua: lịch sử, dịch tễ chi tiết, liều thuốc ít gặp, liệt kê dài.
- Danh sách dài (vd 6 nguyên nhân): KHÔNG cloze cả list. Tách thành từng thẻ "X là nguyên nhân/biểu hiện của {{c1::...}}", hoặc chỉ giữ 2–3 ý quan trọng nhất.
- Thẻ phải tự đứng được: có đủ ngữ cảnh (tên bệnh) trong câu, không dùng "es", "diese Erkrankung".
- Không hỏi kiểu có/không. Không có đáp án mơ hồ (nhiều đáp án đều đúng).
- Số thẻ: theo yêu cầu bên dưới. Chương ngắn thì ít hơn, không cố cho đủ số.

VÍ DỤ THẺ TỐT
- "Goldstandard in der Diagnostik der Lungenembolie ist die {{c1::CT-Angiographie}}." | vn: chụp CT mạch phổi
- "Typisches EKG-Zeichen der Perikarditis: {{c1::ST-Hebung}} in fast allen Ableitungen ohne Spiegelbild." | vn: ST chênh lên lan tỏa
- "Mitralklappenstenose: häufigste Ursache ist das {{c1::rheumatische Fieber}}."

VÍ DỤ THẺ XẤU (và cách sửa)
- XẤU: "Nenne alle Symptome der Herzinsuffizienz." → quá dài. Sửa: tách từng thẻ, vd "Nächtliches Wasserlassen bei Herzinsuffizienz heißt {{c1::Nykturie}}."
- XẤU: "Es ist die häufigste Ursache." → thiếu ngữ cảnh. Sửa: ghi rõ tên bệnh.
- XẤU: "{{c1::Vorhofflimmern}} ist eine {{c2::Herzrhythmusstörung}} mit {{c3::absoluter Arrhythmie}}." → quá nhiều cloze. Sửa: giữ 1 cloze ở ý quan trọng nhất.
- XẤU: "Ist ASS bei KHK indiziert?" → câu có/không. Sửa: "Medikamentöse Sekundärprophylaxe der KHK der 1. Wahl: {{c1::ASS}} 100 mg."

KIỂM TRA TRƯỚC KHI XUẤT
Tự rà lại: xoá thẻ trùng ý (kể cả trùng với danh sách "thẻ đã có" nếu được đưa), xoá thẻ vi phạm quy tắc, rồi trả JSON hợp lệ.

ĐỊNH DẠNG TRẢ VỀ
Chỉ trả một mảng JSON, mỗi phần tử:
{"front": "câu tiếng Đức có {{c1::...}}", "vn": "gợi ý tiếng Việt ngắn", "why": "1 câu giải thích tiếng Việt", "abschnitt": số đoạn [§n] mà thẻ lấy ý (hoặc null), "typ": "Symptom|Diagnostik|Therapie|Komplikation|Ätiologie|Pathophysiologie|Zahl|Sonstiges"}
