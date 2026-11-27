"""Tách M2-Lernplan AMBOSS (PDF) thành JSON và nhúng vào trang M2 AMBOSS.

  python3 -I lernplan.py <Lernplan.pdf> <m2-amboss.html> <out.html>   # nhúng vào bản publish
  python3 -I lernplan.py <Lernplan.pdf> - <plan.json>                  # chỉ xuất JSON

Danh sách chương là tài liệu AMBOSS: chỉ nằm trong bản publish riêng tư, không commit.
Id chương = t<Tag>_<số> nên tách lại từ cùng PDF thì id giữ nguyên (tiến độ đọc trong db không mất).
"""
import json, re, subprocess, sys

ZW = "​"  # pdftotext để dấu cách rộng 0 sau số Tag/số chương: dấu hiệu tin cậy hơn layout

def join(a, b):
    # gạch nối cuối dòng + chữ thường là ngắt từ ("Komplementär-"+"medizin"); "Arbeits- und"+"Umweltmedizin" thì giữ
    return a[:-1] + b if a.endswith("-") and b[:1].islower() and not b.startswith("und ") else (a + " " + b).strip()

def parse(pdf):
    raw = subprocess.run(["pdftotext", "-raw", pdf, "-"], capture_output=True, text=True, check=True).stdout
    lines = raw.splitlines()
    # bảng tổng quan cuối file: "Tag 12 | Innere Medizin" → Fach lớn
    fach = {int(m[1]): m[2].strip() for m in (re.match(r"^\s*Tag (\d+) \| (.+)$", l) for l in lines) if m}
    days, cur, mode = {}, None, None
    for l in lines:
        s = l.strip()
        m = re.match(r"^Tag (\d+)" + ZW + r"\s*(.*)$", s)
        if m:
            n = int(m[1])
            if n > 85: cur = None; continue          # 86–100: Wiederholung/Generalprobe, không có chương
            cur = days[n] = {"tag": n, "fach": fach.get(n, ""), "sub": m[2].strip(), "ch": []}; mode = "sub"; continue
        if cur is None: continue
        m = re.match(r"^(\d+)" + ZW + r"\s*(.+)$", s)
        if m:
            assert int(m[1]) == len(cur["ch"]) + 1, (cur["tag"], s)
            cur["ch"].append(m[2]); mode = "ch"; continue
        if not s or s.startswith(("Die spezifisch", "zusammengestellte", "AMBOSS voreingestellt", "M2 LERNPLAN")):
            if s.startswith("Die spezifisch"): mode = None
            continue
        if mode == "sub": cur["sub"] = join(cur["sub"], s)
        elif mode == "ch": cur["ch"][-1] = join(cur["ch"][-1], s)   # tên chương xuống dòng
    out = []
    for n in sorted(days):
        d = days[n]
        chs = []
        for i, t in enumerate(d["ch"], 1):
            t = re.sub(r"\s+", " ", t)
            audio = "🎧" in t
            chs.append({"id": f"t{n}_{i}", "n": i, "t": t.replace("🎧", "").strip(), "a": audio})
        out.append({"tag": n, "fach": d["fach"], "sub": d["sub"] or d["fach"], "ch": chs})
    return out

def check(plan):
    assert [d["tag"] for d in plan] == list(range(1, 86)), "thiếu Tag"
    total = sum(len(d["ch"]) for d in plan)
    assert 800 <= total <= 900, total
    assert all(d["ch"] and d["fach"] for d in plan)
    return total

if __name__ == "__main__":
    pdf, tpl, out = sys.argv[1:4]
    plan = parse(pdf)
    total = check(plan)
    js = json.dumps(plan, ensure_ascii=False, separators=(",", ":")).replace("<", "\\u003c")
    if tpl == "-":
        open(out, "w").write(js)
    else:
        html = open(tpl).read()
        tag = '<script id="m2-plan" type="application/json">null</script>'
        assert html.count(tag) == 1, "thiếu chỗ nhúng m2-plan"
        open(out, "w").write(html.replace(tag, tag.replace("null", js)))
    print(f"{len(plan)} Tag, {total} Kapitel → {out}")
