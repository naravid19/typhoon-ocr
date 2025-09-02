## Typhoon OCR (Windows Fork)

Typhoon OCR คือโมเดลสำหรับแปลงเอกสารรูปภาพหรือ PDF ให้เป็น **Markdown/HTML** พร้อมวิเคราะห์โครงร่างเอกสาร (layout) และตาราง เพื่อสาธิตการทำงาน มีเว็บตัวอย่างด้วย **Gradio**

> **หมายเหตุ:** รีโพนี้เป็น **fork สำหรับ Windows 10/11 โดยเฉพาะ** (โฟกัสการติดตั้งและใช้งานบน Windows)  
> วิธีติดตั้งบน **macOS/Linux** โปรดดูจากรีโพ **Typhoon OCR official**

### คุณสมบัติ (Features)
- อัปโหลด PDF หรือรูปภาพได้ (1 หน้า)
- ดึงข้อความและสร้างเอกสารใหม่เป็น Markdown
- มีโหมดพรอมต์สำหรับ layout/structure
- รองรับภาษาอังกฤษและภาษาไทย
- เรียกใช้งานผ่าน API รูปแบบ OpenAI-compatible (เช่น vLLM, opentyphoon.ai)
- บทความเพิ่มเติม: https://opentyphoon.ai/blog/en/typhoon-ocr-release

### ข้อกำหนด (Requirements)
- Windows 10/11 พร้อม Python 3.10 ขึ้นไป

### ติดตั้งแพ็กเกจ (Install)
ติดตั้งเฉพาะแพ็กเกจ `typhoon-ocr`:
```bash
pip install typhoon-ocr
```

หรือเตรียมรันเว็บเดโม Gradio จากโปรเจกต์นี้:
```bash
pip install -r requirements.txt
# แก้ไฟล์ .env ให้ถูกต้อง
# (ตัวเลือก) ติดตั้ง vLLM หากต้องการโฮสต์โมเดลในเครื่อง
# pip install vllm
```

### ตั้งค่า Windows (ติดตั้ง Poppler + เพิ่ม PATH)
โปรเจกต์ต้องใช้เครื่องมือจาก Poppler คือ `pdfinfo` และ `pdftoppm` เพื่ออ่าน PDF  
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
ตั้งค่าตัวแปรแวดล้อมในไฟล์ `.env` ให้เรียบร้อย (เช่น API base/key ถ้าเรียกใช้บริการภายนอก) แล้วรัน:

```bash
python app.py
```

> หมายเหตุ: **vLLM ไม่รองรับบน Windows แบบ native**  
> หากต้องการรันเซิร์ฟเวอร์โมเดลในเครื่อง ให้ใช้ **WSL2 (Ubuntu)** หรือเลือกใช้ **Remote API**

### เริ่ม vLLM (ตัวเลือก — รันใน WSL2 เท่านั้น)
คำสั่งตัวอย่าง (รัน **ภายใน WSL2/Ubuntu** ไม่ใช่ PowerShell ของ Windows โดยตรง):
```bash
vllm serve scb10x/typhoon-ocr-7b --served-model-name typhoon-ocr --dtype bfloat16 --port 8101
```

จากนั้นตั้งค่า `.env` ให้ `OPENAI_BASE_URL` ชี้ไปที่ `http://127.0.0.1:8101/v1` และ `OPENAI_API_KEY` เป็นค่าจำลองได้

### ไลบรารีที่ใช้ (Dependencies)
- openai
- python-dotenv
- ftfy
- pypdf
- gradio
- vllm (จำเป็นเฉพาะกรณีโฮสต์โมเดลในเครื่อง/WSL2)
- pillow

### แก้ปัญหา (Debug)
หากขึ้น `Error processing document` บน Windows:
```powershell
# ตรวจสอบว่า Poppler ติดตั้งและอยู่ใน PATH
pdfinfo -v
pdftoppm -v
```
ถ้าไม่พบคำสั่ง ให้ย้อนดูหัวข้อ **ตั้งค่า Windows (ติดตั้ง Poppler + เพิ่ม PATH)** ด้านบน

### ใบอนุญาต (License)
โปรเจกต์นี้ใช้สัญญาอนุญาตแบบ Apache 2.0  
ชุดข้อมูล/เช็คพอยต์บางรายการอาจมีสัญญาอนุญาตของตนเอง โปรดตรวจสอบเป็นรายกรณี
