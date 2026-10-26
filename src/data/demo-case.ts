import type { ClinicalCase } from "@/lib/types";

/**
 * Ca mẫu — đúng định dạng mà pipeline AI trả về (xem lib/ai/prompts.ts).
 * Môn: Tai Mũi Họng (thi 06/11). card_ids trỏ tới thẻ Anki gốc.
 */
export const DEMO_CASE: ClinicalCase = {
  id: "demo-epiglottitis",
  title: "Giọng ngậm khoai lúc 2 giờ sáng",
  topic: "Viêm thanh thiệt cấp",
  max_hp: 100,
  patient: {
    name: "Anh Tuấn",
    age: 34,
    sex: "Nam",
    history: "Đau họng 1 ngày, tăng nhanh, nuốt đau dữ dội, không uống được nước.",
    vitals: { hr: 118, bp: "130/80", spo2: 94, rr: 26, temp: 39.2 },
  },
  opening:
    "2:07 sáng. Anh Tuấn ngồi chồm người ra trước, hai tay chống gối, nước bọt chảy ròng ròng vì không dám nuốt. " +
    "Giọng nói nghe như đang ngậm củ khoai nóng. Có tiếng rít nhẹ khi hít vào. Điều dưỡng nhìn bạn. Cả khoa nhìn bạn.",
  steps: [
    {
      id: "s1",
      step_order: 0,
      narrative: "Bạn liếc qua họng từ xa: amidan không sưng nhiều, không lệch lưỡi gà. Nhưng bệnh nhân đau tới mức không nuốt nổi nước bọt.",
      question: "Chẩn đoán nghĩ đến nhiều nhất?",
      hp_penalty: 20,
      card_ids: ["card-tmh-012", "card-tmh-013"],
      options: [
        { id: "a", text: "Viêm họng cấp do liên cầu", is_correct: false, rationale: "Viêm họng liên cầu không gây chảy dãi, tư thế tripod và stridor; khám họng sẽ thấy amidan viêm rõ." },
        { id: "b", text: "Viêm thanh thiệt cấp", is_correct: true, rationale: "Bộ 4D (Drooling, Dysphagia, Dysphonia, Distress) + tư thế tripod + giọng ngậm khoai, mà họng khám gần như bình thường => thanh thiệt." },
        { id: "c", text: "Áp xe quanh amidan", is_correct: false, rationale: "Áp xe quanh amidan thường có khít hàm, phồng màn hầu một bên, lưỡi gà lệch sang bên đối diện." },
        { id: "d", text: "Cơn hen phế quản", is_correct: false, rationale: "Hen gây khò khè thì thở ra, không gây nuốt đau, chảy dãi hay giọng ngậm khoai." },
      ],
    },
    {
      id: "s2",
      step_order: 1,
      narrative: "Tiếng rít rõ hơn. SpO2 tụt 91%. Bệnh nhân cố ngồi thẳng, bấu chặt thành giường.",
      question: "Việc cần làm NGAY bây giờ?",
      hp_penalty: 35,
      vitals: { hr: 126, bp: "135/85", spo2: 91, rr: 30, temp: 39.3 },
      card_ids: ["card-tmh-014", "card-tmh-015"],
      options: [
        { id: "a", text: "Dùng đè lưỡi khám họng thật kỹ để xác định", is_correct: false, rationale: "Kích thích vùng hầu có thể gây co thắt thanh quản và tắc nghẽn hoàn toàn." },
        { id: "b", text: "Cho nằm ngửa, đẩy đi chụp CT cổ", is_correct: false, rationale: "Nằm ngửa làm thanh thiệt phù đổ ra sau, bít đường thở. Không rời bệnh nhân đi xa khi đường thở chưa an toàn." },
        { id: "c", text: "Để bệnh nhân ngồi theo tư thế dễ chịu, thở oxy, gọi ngay ekip đường thở (gây mê + TMH), chuẩn bị đặt NKQ / mở khí quản", is_correct: true, rationale: "Ưu tiên số 1 là bảo vệ đường thở trong môi trường kiểm soát, sẵn phương án đường thở ngoại khoa." },
        { id: "d", text: "Kê kháng sinh uống, hẹn tái khám sáng mai", is_correct: false, rationale: "Đây là cấp cứu đường thở. 'Sáng mai' bệnh nhân có thể không còn để tái khám." },
      ],
    },
    {
      id: "s3",
      step_order: 2,
      narrative: "Đường thở tạm ổn với oxy. Ekip gây mê đang tới. Một phim X-quang cổ nghiêng tại giường được chụp.",
      question: "Dấu hiệu kinh điển trên phim cổ nghiêng của viêm thanh thiệt?",
      hp_penalty: 20,
      card_ids: ["card-tmh-016"],
      options: [
        { id: "a", text: "Dấu tháp chuông (steeple sign)", is_correct: false, rationale: "Steeple sign là hẹp hạ thanh môn trên phim thẳng — gợi ý viêm thanh khí phế quản (croup)." },
        { id: "b", text: "Dấu ngón tay cái (thumb sign)", is_correct: true, rationale: "Thanh thiệt phù to tròn như đốt ngón cái trên phim cổ nghiêng." },
        { id: "c", text: "Dấu cánh buồm", is_correct: false, rationale: "Dấu cánh buồm là bóng tuyến ức ở trẻ nhỏ trên X-quang ngực." },
        { id: "d", text: "Dấu liềm hơi dưới hoành", is_correct: false, rationale: "Đó là thủng tạng rỗng. Sai chuyên khoa, sai luôn vùng cơ thể." },
      ],
    },
    {
      id: "s4",
      step_order: 3,
      narrative: "Đặt nội khí quản thành công bằng ống nhỏ hơn bình thường. Bạn vừa thở phào thì điều dưỡng hỏi: 'Kháng sinh gì bác sĩ?'",
      question: "Kháng sinh kinh nghiệm phù hợp?",
      hp_penalty: 25,
      vitals: { hr: 104, bp: "125/80", spo2: 98, rr: 16, temp: 38.9 },
      card_ids: ["card-tmh-017"],
      options: [
        { id: "a", text: "Amoxicillin uống", is_correct: false, rationale: "Bệnh nặng, bệnh nhân đang đặt NKQ — cần đường tĩnh mạch, phổ phủ H. influenzae tiết β-lactamase." },
        { id: "b", text: "Cephalosporin thế hệ 3 tĩnh mạch (Ceftriaxone/Cefotaxime), cân nhắc thêm thuốc phủ MRSA nếu có yếu tố nguy cơ", is_correct: true, rationale: "Phủ H. influenzae, Streptococcus, Staphylococcus; thêm Vancomycin khi nghi MRSA." },
        { id: "c", text: "Không cần kháng sinh vì do virus", is_correct: false, rationale: "Viêm thanh thiệt chủ yếu do vi khuẩn. Câu này mà nói lúc giao ban là bị mời ra ngoài." },
        { id: "d", text: "Azithromycin uống đơn trị", is_correct: false, rationale: "Không đủ phổ, không đủ đường dùng cho ca dọa tắc nghẽn đường thở." },
      ],
    },
  ],
};
