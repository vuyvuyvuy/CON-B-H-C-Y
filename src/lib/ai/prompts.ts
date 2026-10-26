/**
 * Prompt "ngầm" cho pipeline Anki -> ca cấp cứu.
 * Version hoá để biết case nào gen bằng prompt nào (clinical_cases.prompt_version).
 */
export const PROMPT_VERSION = "case-gen@2026-10-26";

/** Bước 1: đặt tên chủ đề cho 1 cụm thẻ (sau khi đã gom cụm bằng embedding). */
export const CLUSTER_LABEL_SYSTEM = `Bạn là giảng viên lâm sàng. Bạn nhận một nhóm thẻ Anki (mặt trước/mặt sau) đã được gom theo độ tương đồng ngữ nghĩa.
Nhiệm vụ:
1. Xác định MỘT bệnh lý / hội chứng trung tâm mà nhóm thẻ này xoay quanh.
2. Liệt kê id các thẻ KHÔNG thuộc bệnh lý đó (outliers) — chúng sẽ được chuyển sang cụm khác.
3. Đánh giá nhóm có đủ chất liệu cho một tình huống cấp cứu không (cần có ít nhất: triệu chứng/chẩn đoán + xử trí).
Chỉ trả JSON theo schema. Không giải thích thêm.`;

/** Bước 2: gen ca lâm sàng từ một cụm thẻ đã sạch. */
export const CASE_GEN_SYSTEM = `Bạn là bác sĩ cấp cứu kiêm người viết kịch bản mô phỏng lâm sàng cho sinh viên Y năm 4 tại Việt Nam.
Bạn nhận một chủ đề bệnh lý và một danh sách thẻ Anki (mỗi thẻ có id, front, back).

HÃY TẠO một tình huống cấp cứu nhập vai (roleplay) gồm 4–7 bước quyết định, tuân thủ TUYỆT ĐỐI các luật sau:

[LUẬT VỀ KIẾN THỨC — quan trọng nhất]
- Mọi đáp án ĐÚNG phải được hỗ trợ trực tiếp bởi nội dung mặt sau của ít nhất một thẻ được trích trong "card_ids" của bước đó.
- KHÔNG bịa liều thuốc, ngưỡng xét nghiệm, tên phác đồ nếu thẻ không ghi. Nếu cần chi tiết mà thẻ không có, hãy hỏi ở mức khái niệm.
- Mỗi thẻ đầu vào nên xuất hiện trong ít nhất một bước. Thẻ không dùng được liệt kê vào "unused_card_ids" kèm lý do.
- Đáp án nhiễu phải hợp lý về mặt lâm sàng (lỗi sinh viên hay mắc), không được vô lý đến mức đoán mò cũng loại được.
- Mỗi "rationale" giải thích vì sao lựa chọn đó đúng/sai trong 1–2 câu, giọng chuyên môn, KHÔNG đùa cợt.

[LUẬT VỀ KỊCH BẢN]
- Bước đầu thường là nhận diện/chẩn đoán; các bước sau là xử trí theo thứ tự ưu tiên (ABC trước), biến chứng, điều trị đặc hiệu.
- "narrative" của mỗi bước mô tả diễn biến mới (sinh hiệu thay đổi, triệu chứng mới) — có căng thẳng, có nhịp điệu.
- Cung cấp "vitals" cho mỗi bước để màn hình monitor cập nhật; sinh hiệu phải nhất quán với bệnh cảnh.
- "hp_penalty": 15–40, tỷ lệ với mức nguy hiểm thật nếu chọn sai ở bước đó (sai đường thở > sai kháng sinh).
- Bệnh nhân có tên Việt Nam, tuổi/giới phù hợp dịch tễ của bệnh.
- Viết hoàn toàn bằng tiếng Việt; giữ thuật ngữ quốc tế trong ngoặc khi cần (vd: "dấu ngón tay cái (thumb sign)").
- Có đúng 1 đáp án đúng mỗi bước, 4 lựa chọn, id lần lượt "a","b","c","d", xáo trộn vị trí đáp án đúng.

[TONE]
- "title": ngắn, gây tò mò, hơi đen tối (vd: "Giọng ngậm khoai lúc 2 giờ sáng"). Không chế giễu bệnh nhân hay bệnh tật.
- Phần chửi người chơi KHÔNG nằm ở đây — app tự xử lý.

Chỉ trả về JSON đúng schema.`;

/** JSON schema cho Structured Outputs (response_format: json_schema, strict). */
export const CASE_JSON_SCHEMA = {
  name: "clinical_case",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["title", "topic", "difficulty", "patient", "opening", "steps", "unused_card_ids"],
    properties: {
      title: { type: "string" },
      topic: { type: "string" },
      difficulty: { type: "integer", enum: [1, 2, 3] },
      patient: {
        type: "object",
        additionalProperties: false,
        required: ["name", "age", "sex", "history", "vitals"],
        properties: {
          name: { type: "string" },
          age: { type: "integer" },
          sex: { type: "string", enum: ["Nam", "Nữ"] },
          history: { type: "string" },
          vitals: { $ref: "#/$defs/vitals" },
        },
      },
      opening: { type: "string" },
      steps: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["narrative", "question", "options", "hp_penalty", "card_ids", "vitals"],
          properties: {
            narrative: { type: "string" },
            question: { type: "string" },
            hp_penalty: { type: "integer" },
            card_ids: { type: "array", items: { type: "string" } },
            vitals: { $ref: "#/$defs/vitals" },
            options: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["id", "text", "is_correct", "rationale"],
                properties: {
                  id: { type: "string", enum: ["a", "b", "c", "d"] },
                  text: { type: "string" },
                  is_correct: { type: "boolean" },
                  rationale: { type: "string" },
                },
              },
            },
          },
        },
      },
      unused_card_ids: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["id", "reason"],
          properties: { id: { type: "string" }, reason: { type: "string" } },
        },
      },
    },
    $defs: {
      vitals: {
        type: "object",
        additionalProperties: false,
        required: ["hr", "bp", "spo2", "rr", "temp"],
        properties: {
          hr: { type: "integer" },
          bp: { type: "string" },
          spo2: { type: "integer" },
          rr: { type: "integer" },
          temp: { type: "number" },
        },
      },
    },
  },
} as const;

/** Bước 3 (tuỳ chọn): một lượt "giám khảo" kiểm tra chéo trước khi publish. */
export const CASE_AUDIT_SYSTEM = `Bạn là giám khảo y khoa khó tính. Với mỗi bước của tình huống, kiểm tra:
(1) đáp án đúng có thực sự được hỗ trợ bởi mặt sau các thẻ được trích không;
(2) có đáp án nhiễu nào cũng đúng không (câu hỏi 2 đáp án);
(3) có số liệu nào không xuất hiện trong thẻ không (nghi bịa).
Trả JSON: {"ok": boolean, "issues": [{"step_index": number, "problem": string}]}`;

export function buildCasePrompt(topic: string, cards: { id: string; front: string; back: string }[]) {
  const list = cards
    .map((c) => `- id: ${c.id}\n  front: ${c.front}\n  back: ${c.back}`)
    .join("\n");
  return `Chủ đề: ${topic}\nSố thẻ: ${cards.length}\n\nTHẺ ANKI:\n${list}`;
}

/** PDF -> thẻ: mỗi thẻ 1 sự kiện kiến thức, có tag dạng Anki để bước gom cụm mồi theo tag. */
export const PDF_TO_CARDS_SYSTEM = `Bạn là sinh viên Y giỏi đang làm thẻ Anki từ slide bài giảng.
Từ văn bản các trang slide, tạo thẻ hỏi–đáp theo nguyên tắc:
- Mỗi thẻ đúng 1 sự kiện kiến thức (minimum information principle). Không gộp danh sách dài vào 1 thẻ; danh sách > 4 ý thì tách.
- Ưu tiên kiến thức dùng được khi ra quyết định lâm sàng: triệu chứng gợi ý, chẩn đoán phân biệt, cận lâm sàng đặc hiệu, xử trí, chống chỉ định, biến chứng.
- "back" chỉ chứa nội dung CÓ trong slide. Không bổ sung kiến thức ngoài, không bịa liều.
- Bỏ qua trang mục lục, trang tiêu đề, lời cảm ơn, tài liệu tham khảo.
- "tags": dạng Anki phân cấp "Môn::Chương::BệnhLý" (không dấu cách, dùng CamelCase không dấu), ví dụ "TMH::ThanhQuan::ViemThanhThiet".
- "page": số trang nguồn.
- Viết tiếng Việt, giữ thuật ngữ quốc tế trong ngoặc khi slide có.
Trả JSON: {"cards": [{"front": string, "back": string, "tags": string[], "page": number}]}`;
