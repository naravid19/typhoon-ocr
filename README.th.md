## Typhoon OCR (Windows Fork)

[![README TH](https://img.shields.io/badge/README-TH-blue?style=flat)](README.th.md) [![README EN](https://img.shields.io/badge/README-EN-lightgrey?style=flat)](README.md)

Typhoon OCR คือโมเดลสำหรับแปลงเอกสารรูปภาพหรือ PDF ให้เป็น **Markdown/HTML** พร้อมวิเคราะห์โครงร่างเอกสารและตาราง โปรเจกต์นี้คือหน้าเว็บ **Gradio** สำหรับสาธิตการทำงานของ Typhoon OCR

> **หมายเหตุ:** รีโพนี้โฟกัส **Windows 10/11** เท่านั้น วิธีติดตั้งบน **macOS/Linux** โปรดดูที่รีโพทางการ

### คุณสมบัติ (Features)
- อัปโหลด PDF หรือรูปภาพ
- **เลือกหลายหน้า (PDF)**: ทุกหน้า / ช่วงหน้า / หน้าเดียว
- **พรีวิวแบบแกลเลอรี** ของหน้าที่เลือก
- **แถบความคืบหน้า** ระหว่างทำ OCR
- แปลงผลลัพธ์เป็น Markdown (โหมด `default` ตารางเป็น Markdown, โหมด `structure` ตารางเป็น HTML)
- โหมดพรอมต์ 2 แบบ: `default`, `structure`
- รองรับภาษาอังกฤษและไทย
- เรียกผ่าน API รูปแบบ OpenAI-compatible (ผู้ให้บริการภายนอก หรือ vLLM บน WSL2)

### ข้อกำหนด (Requirements)
- Windows 10/11 พร้อม Python 3.10 ขึ้นไป

### ติดตั้งแพ็กเกจ (Install)
```bash
pip install typhoon-ocr
# หรือถ้าจะรันเดโม:
pip install -r requirements.txt
```

### ตั้งค่าไฟล์ `.env`

สร้างไฟล์ `.env` ไว้ที่โฟลเดอร์โปรเจกต์:

```ini
# จุดปลาย API รูปแบบ OpenAI-compatible (ผู้ให้บริการภายนอก หรือ vLLM ใน WSL2)
TYPHOON_BASE_URL=https://api.opentyphoon.ai/v1
# คีย์สำหรับ API ดังกล่าว
TYPHOON_API_KEY=YOUR_KEY
# ชื่อโมเดลที่ปลายทางเปิดให้เรียก
TYPHOON_OCR_MODEL=typhoon-ocr
```

> ถ้ารัน vLLM ใน WSL2 ให้ตั้งค่า `TYPHOON_BASE_URL=http://127.0.0.1:8101/v1` และ `TYPHOON_API_KEY=dummy`

### ตั้งค่า Windows (ติดตั้ง Poppler + เพิ่ม PATH)
ต้องมีเครื่องมือจาก Poppler (`pdfinfo`, `pdftoppm`) เพื่ออ่าน PDF  
ใช้คำสั่งเดียวด้านล่างนี้ใน **PowerShell** (ไม่ต้องสิทธิ์แอดมิน) เพื่อติดตั้งและเพิ่ม **User PATH** แบบถาวร

```powershell
iwr -useb https://github.com/oschwartz10612/poppler-windows/releases/download/v25.07.0-0/Release-25.07.0-0.zip -OutFile $env:TEMP\poppler.zip; rm C:\poppler -Recurse -Force -ErrorAction SilentlyContinue; Expand-Archive $env:TEMP\poppler.zip C:\poppler -Force; $bin=(Get-ChildItem C:\poppler -Recurse -Filter pdfinfo.exe | Select-Object -First 1).DirectoryName; if(-not $bin){throw "pdfinfo.exe not found under C:\poppler"}; $u=[Environment]::GetEnvironmentVariable('Path','User'); if([string]::IsNullOrEmpty($u)){$u=''}; if($u -notlike "*$bin*"){[Environment]::SetEnvironmentVariable('Path', ($u.TrimEnd(';')+';'+$bin).Trim(';'), 'User')}; $env:Path+=';'+$bin; pdfinfo -v
```

ตรวจสอบว่าใช้งานได้:
```powershell
pdfinfo -v
pdftoppm -v
```

### รัน Gradio Demo
```bash
python app.py
```

> **vLLM ไม่รองรับบน Windows แบบ native** หากต้องการโฮสต์โมเดลในเครื่อง ให้ใช้ **WSL2 (Ubuntu)** หรือเลือกใช้ **Remote API**

### เริ่ม vLLM (ตัวเลือก: รันใน WSL2 เท่านั้น)
```bash
vllm serve scb10x/typhoon-ocr-7b --served-model-name typhoon-ocr --dtype bfloat16 --port 8101
```

### สิ่งที่ปรับปรุงใน fork นี้
- เพิ่ม **หลายหน้า** (ทุกหน้า/ช่วงหน้า/หน้าเดียว) พร้อม **แกลเลอรีพรีวิว** และ **แถบความคืบหน้า**
- ปรับการตีความผล LLM: ถ้าไม่ใช่ JSON จะคืนข้อความดิบ
- ใช้ตัวแปรแวดล้อม `TYPHOON_BASE_URL`, `TYPHOON_API_KEY`, `TYPHOON_OCR_MODEL`
- เพิ่มการพึ่งพา `pypdf` สำหรับนับจำนวนหน้า PDF

### ไลบรารีที่ใช้ (Dependencies)
- openai
- python-dotenv
- ftfy
- pypdf
- gradio
- pillow
- vllm (ใช้เฉพาะกรณีโฮสต์ inference server บน WSL2; ไม่รองรับบน Windows โดยตรง)

### แก้ปัญหา (Debug)
หากขึ้น `Error processing document` บน Windows ให้ตรวจว่า Poppler ติดตั้งและอยู่ใน PATH (ดูหัวข้อด้านบน) แล้วลอง:
```powershell
pdfinfo -v
pdftoppm -v
```

### ใบอนุญาต (License)
โปรเจกต์นี้ใช้สัญญาอนุญาตแบบ Apache 2.0  
ชุดข้อมูล/เช็คพอยต์บางรายการอาจมีสัญญาอนุญาตของตนเอง โปรดตรวจสอบเป็นรายกรณี