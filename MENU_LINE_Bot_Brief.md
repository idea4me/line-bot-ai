# 📋 PROJECT BRIEF — MENU LINE Bot
### AI-Powered Customer Support | ทีมงาน MENU | 2025

> Powered by Gemini AI + Next.js 14 + Vercel

---

## ภาพรวมโปรเจกต์

MENU LINE Bot คือระบบ chatbot บน LINE ที่ใช้ AI ตอบคำถามลูกค้าแบบอัตโนมัติ โดยดึงข้อมูลจาก Google Sheet (FAQ) มาให้ AI อ่านและตอบด้วยภาษาธรรมชาติ เหมือนมีเจ้าหน้าที่ Support คอยตอบตลอด 24 ชั่วโมง

| รายการ | รายละเอียด |
|---|---|
| ชื่อระบบ | MENU LINE Bot — AI Customer Support |
| ตอบในนาม | ทีมงาน MENU |
| Platform | LINE Messaging API |
| Deploy URL | https://line-bot-ai-eight.vercel.app |
| Webhook | https://line-bot-ai-eight.vercel.app/api/line-webhook |
| Framework | Next.js 14 App Router + TypeScript |
| AI Engine | Google Gemini (gemini-2.5-flash) |
| Hosting | Vercel (Serverless) |

---

## ส่วนที่ 1 — โครงสร้างไฟล์

```
menu-line-bot/
├── app/
│   └── api/
│       └── line-webhook/
│           └── route.ts          ← รับ webhook จาก LINE + ส่ง reply
├── lib/
│   ├── gemini.ts                 ← เรียก Gemini API + log tokens
│   ├── faq.ts                    ← ดึง FAQ จาก Google Sheet (cache 60 วิ)
│   └── line.ts                   ← verify signature + reply message
├── constants/
│   └── prompts.ts                ← System Prompt + default_reply
├── .env.local                    ← env vars (ไม่ push ขึ้น Git)
├── vercel.json                   ← timeout config
└── package.json
```

> ⚠️ ไฟล์ `.env.local` ห้าม push ขึ้น GitHub เด็ดขาด ให้ตั้งค่า env ใน Vercel Dashboard แทน

---

## ส่วนที่ 2 — Sheet Schema (FAQ)

Google Sheet สำหรับเก็บคำถาม-คำตอบที่บอทจะนำไปใช้ตอบลูกค้า

| Column | ชื่อ Header | คำอธิบาย |
|---|---|---|
| A | `category` | หมวดหมู่ เช่น สมัครสมาชิก, การชำระเงิน, เมนูอาหาร |
| B | `question` | คำถามที่ลูกค้าถามบ่อย (ภาษาธรรมชาติ) |
| C | `answer` | คำตอบที่ถูกต้อง (บอทจะนำไปใช้โดยตรง) |
| D | `keywords` | คำสำคัญ คั่นด้วย `|` เพื่อช่วยให้ AI จับคู่ได้แม่นขึ้น |
| E | `active` | `TRUE`/`FALSE` — ถ้า FALSE = ไม่นำไปใส่ใน prompt |

### ตัวอย่างข้อมูลใน Sheet

```csv
category,question,answer,keywords,active
สมัครสมาชิก,สมัครสมาชิก MENU ได้อย่างไร,ดาวน์โหลดแอป MENU แล้วกดสมัครสมาชิก ใช้เบอร์มือถือ,สมัคร|ลงทะเบียน|register,TRUE
การชำระเงิน,ชำระเงินด้วยอะไรได้บ้าง,รองรับบัตรเครดิต/เดบิต PromptPay และ TrueMoney Wallet,ชำระเงิน|จ่ายเงิน|payment,TRUE
ร้านอาหาร,ดูเมนูร้านได้ที่ไหน,เปิดแอป MENU แล้วค้นหาชื่อร้าน หรือดูที่ menu.in.th,เมนู|menu|ร้าน,TRUE
```

> ⚠️ Row แรก (header) ต้องตรงกับชื่อ column ที่กำหนดพอดี — ระบบดึงข้อมูลด้วย column name ไม่ใช่ตำแหน่ง

---

## ส่วนที่ 3 — System Prompt (โครงสร้าง Google Official)

System Prompt ที่ส่งให้ Gemini ทุก request ประกอบด้วย 5 tags ตามมาตรฐาน Google:

---

### `<role>`

```xml
<role>
คุณคือพนักงาน Support ของทีมงาน MENU คุณมีหน้าที่ตอบคำถามลูกค้า
เกี่ยวกับแอปพลิเคชัน MENU และบริการที่เกี่ยวข้องอย่างถูกต้องและเป็นมิตร
</role>
```

---

### `<constraints>`

```xml
<constraints>
1. ตอบโดยใช้ข้อมูลใน <faq> เป็นหลัก
2. ถ้าไม่มีใน FAQ ให้ค้นหาข้อมูลเพิ่มเติมจาก
   - https://km.menu.in.th/public/
   - https://menu.in.th/help/
3. ห้ามแต่งราคา / เวลาทำการ / ที่ตั้ง ที่ไม่มีในข้อมูล
4. ถ้าตอบไม่ได้เลย ให้ขอโทษและแจ้งว่าจะติดต่อกลับ
5. โทนสุภาพ เป็นกันเอง เป็นมิตร มี emoji
6. ความยาวคำตอบ 1-3 ประโยค กระชับตรงประเด็น
</constraints>
```

---

### `<output_format>`

```xml
<output_format>
ภาษาไทย — ไม่ใช้ markdown (ไม่มี ** หรือ # หรือ -)
ข้อความธรรมดาอ่านง่ายบน LINE — ใช้ emoji ได้ 1-2 ตัวต่อข้อความ
</output_format>
```

---

### `<faq>` — ดึงจาก Google Sheet ก่อน task

```xml
<faq>
[CSV จาก Google Sheet — inject ตอน runtime]

category,question,answer,keywords
สมัครสมาชิก,สมัคร MENU ได้อย่างไร,ดาวน์โหลดแอป MENU แล้วกดสมัครสมาชิก...,สมัคร|register
...
</faq>
```

---

### `<question>` — message จาก user มาท้ายสุด

```xml
<question>
[ข้อความที่ลูกค้าส่งมาใน LINE — inject ตอน runtime]
</question>
```

---

### Gemini Config

| พารามิเตอร์ | ค่าที่ใช้ |
|---|---|
| model | `gemini-2.5-flash` |
| temperature | `1.0` |
| maxOutputTokens | `1024` |
| finishReason guard | ถ้า `MAX_TOKENS` → return `default_reply` (ป้องกันส่งครึ่งประโยค) |
| Logging | `finishReason` + `thoughtsTokenCount` + `candidatesTokenCount` ทุก request |

---

## ส่วนที่ 4 — LINE Webhook Flow

ทุก request จาก LINE ต้องจบภายใน **10 วินาที** (LINE timeout)

| # | ขั้นตอน | รายละเอียด |
|---|---|---|
| 1 | รับ Request จาก LINE | `POST /api/line-webhook` — รับ body + headers |
| 2 | Verify Signature | ตรวจสอบ `X-Line-Signature` ด้วย HMAC-SHA256 + `LINE_CHANNEL_SECRET` — ถ้าผิด → return 401 |
| 3 | Parse Events | ดึง `events[]` จาก body — กรองเฉพาะ `type: message` + `message.type: text` |
| 4 | Fetch FAQ Sheet | ดึง CSV จาก `SHEET_CSV_URL` — ใช้ in-memory cache 60 วินาที |
| 5 | Build System Prompt | inject FAQ CSV + user message เข้า prompt template |
| 6 | Call Gemini API | ส่ง prompt ไปที่ `gemini-2.5-flash` — timeout 8 วิ |
| 7 | Check finishReason | ถ้า `STOP` → ใช้ response ปกติ / ถ้า `MAX_TOKENS` → ใช้ `default_reply` |
| 8 | Log Tokens | log `finishReason` + `thoughtsTokenCount` + `candidatesTokenCount` |
| 9 | Reply to LINE | ส่ง `replyMessage` ด้วย `replyToken` + `LINE_CHANNEL_ACCESS_TOKEN` |
| 10 | Return 200 | ตอบ LINE ว่าได้รับ webhook แล้ว |

---

## ส่วนที่ 5 — Error Handling Flow

ระบบต้องรับมือกับ error 5 ประเภทหลัก โดยไม่ทำให้ลูกค้าเห็น error message ดิบๆ

| สถานการณ์ | สิ่งที่เกิดขึ้น | วิธีรับมือ |
|---|---|---|
| Google Sheet ดึงไม่ได้ | Network timeout / Sheet ถูกลบ / URL ผิด | ใช้ cache ก่อน (ถ้ามี) — ถ้าไม่มี cache ให้ตอบด้วย `default_reply` พร้อม log error |
| Gemini timeout / Error | API ช้า / quota หมด / network ล่ม | ส่ง `default_reply` ให้ลูกค้า — log error detail — ไม่ throw exception |
| LINE ส่งกลับไม่ได้ | replyToken หมดอายุ (>30 วิ) / token ผิด | log warning แต่ไม่ retry — return 200 ปกติ |
| Signature ไม่ตรง | Request ไม่ได้มาจาก LINE จริง | return 401 ทันที — log IP + timestamp |
| MAX_TOKENS (Gemini) | คำตอบยาวเกิน 1024 tokens | ตรวจ `finishReason === MAX_TOKENS` แล้วส่ง `default_reply` แทน |

### Default Reply Message

```
ขอบคุณที่ติดต่อทีมงาน MENU นะคะ 😊
ขณะนี้ระบบไม่สามารถตอบคำถามนี้ได้
ทีมงานจะรีบติดต่อกลับโดยเร็วที่สุดค่ะ
```

---

## Environment Variables

| Environment Variable | คำอธิบาย |
|---|---|
| `LINE_CHANNEL_ACCESS_TOKEN` | Token สำหรับส่ง reply message กลับไปหาลูกค้า (ดูใน LINE Developers Console) |
| `LINE_CHANNEL_SECRET` | Secret สำหรับ verify signature ของ webhook request |
| `GEMINI_API_KEY` | API Key สำหรับเรียก Google Gemini API (ดูใน Google AI Studio) |
| `SHEET_CSV_URL` | URL ของ Google Sheet ที่ publish เป็น CSV สาธารณะ |

> ⚠️ ตั้งค่า env vars ใน **Vercel Dashboard → Settings → Environment Variables** ไม่ใช่ใน `.env.local` ของ repo

---

## ขั้นตอน Deploy

| # | คำสั่ง / ขั้นตอน | รายละเอียด |
|---|---|---|
| 1 | `git add .` | stage ไฟล์ทั้งหมด |
| 2 | `git commit -m "feat: MENU LINE bot"` | commit พร้อม message |
| 3 | `git push origin main` | push ขึ้น GitHub |
| 4 | Vercel Auto Deploy | Vercel detect push แล้ว build + deploy อัตโนมัติ |
| 5 | ตั้งค่า Webhook บน LINE | LINE Developers → Messaging API → Webhook URL → `https://line-bot-ai-eight.vercel.app/api/line-webhook` |
| 6 | Verify Webhook | กด Verify บน LINE Console — ต้องขึ้น Success |
| 7 | ทดสอบ | ส่งข้อความใน LINE → ดู log ใน Vercel Dashboard |

---

*ทีมงาน MENU • MENU LINE Bot Project Brief • 2025*
