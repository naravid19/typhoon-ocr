<!-- Improved compatibility of back to top link -->

<a id="readme-top"></a>

<!-- LANGUAGE SWITCHER -->
<p align="center">
  <a href="README.md"><img src="https://img.shields.io/badge/🌐_English-blue?style=for-the-badge" alt="English"></a>
  <a href="README.th.md"><img src="https://img.shields.io/badge/🇹🇭_ภาษาไทย-green?style=for-the-badge" alt="ภาษาไทย"></a>
</p>

<!-- PROJECT SHIELDS -->

[![Contributors][contributors-shield]][contributors-url]
[![Forks][forks-shield]][forks-url]
[![Stargazers][stars-shield]][stars-url]
[![Issues][issues-shield]][issues-url]
[![Apache 2.0 License][license-shield]][license-url]

<!-- PROJECT LOGO -->
<br />
<div align="center">
  <a href="https://github.com/naravid19/typhoon-ocr">
    <img src="https://avatars.githubusercontent.com/u/153214217?s=200&v=4" alt="Logo" width="80" height="80">
  </a>

  <h3 align="center">Typhoon OCR</h3>

  <p align="center">
    แอปพลิเคชัน OCR สำหรับแปลงรูปภาพและ PDF เป็น Markdown แบบมีโครงสร้าง
    <br />
    <a href="https://github.com/naravid19/typhoon-ocr"><strong>สำรวจเอกสาร »</strong></a>
    <br />
    <br />
    <a href="https://github.com/naravid19/typhoon-ocr">ดูตัวอย่าง</a>
    &middot;
    <a href="https://github.com/naravid19/typhoon-ocr/issues/new?labels=bug">รายงานบัก</a>
    &middot;
    <a href="https://github.com/naravid19/typhoon-ocr/issues/new?labels=enhancement">เสนอฟีเจอร์</a>
  </p>
</div>

<!-- TABLE OF CONTENTS -->
<details>
  <summary>สารบัญ</summary>
  <ol>
    <li>
      <a href="#เกี่ยวกับโปรเจกต์">เกี่ยวกับโปรเจกต์</a>
      <ul>
        <li><a href="#สร้างด้วย">สร้างด้วย</a></li>
      </ul>
    </li>
    <li>
      <a href="#เริ่มต้นใช้งาน">เริ่มต้นใช้งาน</a>
      <ul>
        <li><a href="#ข้อกำหนดเบื้องต้น">ข้อกำหนดเบื้องต้น</a></li>
        <li><a href="#การติดตั้ง">การติดตั้ง</a></li>
      </ul>
    </li>
    <li><a href="#วิธีใช้งาน">วิธีใช้งาน</a></li>
    <li><a href="#คุณสมบัติ">คุณสมบัติ</a></li>
    <li><a href="#แผนการพัฒนา">แผนการพัฒนา</a></li>
    <li><a href="#การมีส่วนร่วม">การมีส่วนร่วม</a></li>
    <li><a href="#ใบอนุญาต">ใบอนุญาต</a></li>
    <li><a href="CHANGELOG.md">บันทึกการเปลี่ยนแปลง (Changelog)</a></li>
    <li><a href="#ติดต่อ">ติดต่อ</a></li>
    <li><a href="#กิตติกรรมประกาศ">กิตติกรรมประกาศ</a></li>
  </ol>
</details>

<!-- ABOUT THE PROJECT -->

## เกี่ยวกับโปรเจกต์

[![Product Name Screen Shot][product-screenshot]](https://github.com/naravid19/typhoon-ocr/images/screenshot.png)

Typhoon OCR คือโมเดลสำหรับแปลงเอกสารรูปภาพหรือ PDF ให้เป็น **Markdown/HTML** พร้อมวิเคราะห์โครงร่างเอกสารและตาราง

Fork นี้มาพร้อมกับ **เว็บแอปพลิเคชัน Next.js** ที่ทันสมัย นอกเหนือจาก Gradio demo ดั้งเดิม ประกอบด้วย:

- 🚀 **UI ทันสมัย** ธีมมืดและดีไซน์ระดับพรีเมียม
- 📄 **รองรับ PDF หลายหน้า** พร้อมการเลือกหน้าแบบอินเทอร์แอคทีฟ
- 🔗 **นำเข้าจาก URL** โหลดเอกสารจากเว็บได้โดยตรง
- 📊 **แสดงความคืบหน้า** แบบเรียลไทม์ระหว่างประมวลผล OCR
- 🎨 **โหมดเปรียบเทียบ** ดูต้นฉบับและข้อความที่แยกออกมาเคียงข้างกัน

> **หมายเหตุ:** Fork นี้โฟกัส **Windows 10/11** สำหรับ macOS/Linux โปรดดูที่รีโพทางการ
>
> 📝 **ดู [CHANGELOG.md](CHANGELOG.md) สำหรับการอัปเดตล่าสุด**

<p align="right">(<a href="#readme-top">กลับด้านบน</a>)</p>

### สร้างด้วย

- [![Next][Next.js]][Next-url]
- [![React][React.js]][React-url]
- [![TailwindCSS][TailwindCSS]][TailwindCSS-url]
- [![FastAPI][FastAPI]][FastAPI-url]
- [![Python][Python]][Python-url]

<p align="right">(<a href="#readme-top">กลับด้านบน</a>)</p>

<!-- GETTING STARTED -->

## เริ่มต้นใช้งาน

ทำตามขั้นตอนด้านล่างเพื่อรันโปรเจกต์ในเครื่อง

### ข้อกำหนดเบื้องต้น

- **Windows 10/11** พร้อม Python 3.10+
- **Node.js 18+** พร้อม npm
- **Poppler** (สำหรับประมวลผล PDF)

ติดตั้ง Poppler ผ่าน PowerShell:

```powershell
iwr -useb https://github.com/oschwartz10612/poppler-windows/releases/download/v25.07.0-0/Release-25.07.0-0.zip -OutFile $env:TEMP\poppler.zip; rm C:\poppler -Recurse -Force -ErrorAction SilentlyContinue; Expand-Archive $env:TEMP\poppler.zip C:\poppler -Force; $bin=(Get-ChildItem C:\poppler -Recurse -Filter pdfinfo.exe | Select-Object -First 1).DirectoryName; if(-not $bin){throw "pdfinfo.exe not found under C:\poppler"}; $u=[Environment]::GetEnvironmentVariable('Path','User'); if([string]::IsNullOrEmpty($u)){$u=''}; if($u -notlike "*$bin*"){[Environment]::SetEnvironmentVariable('Path', ($u.TrimEnd(';')+';'+$bin).Trim(';'), 'User')}; $env:Path+=';'+$bin; pdfinfo -v
```

ตรวจสอบการติดตั้ง:

```powershell
pdfinfo -v
pdftoppm -v
```

### การติดตั้ง

1. **โคลนรีโพ**

   ```sh
   git clone https://github.com/naravid19/typhoon-ocr.git
   cd typhoon-ocr
   ```

2. **ตั้งค่า environment**

   สร้างไฟล์ `.env` ที่โฟลเดอร์โปรเจกต์:

   ```ini
   TYPHOON_BASE_URL=https://api.opentyphoon.ai/v1
   TYPHOON_API_KEY=YOUR_API_KEY
   TYPHOON_OCR_MODEL=typhoon-ocr
   ```

3. **ติดตั้ง Backend (Python)**

   ```sh
   python -m venv venv
   .\venv\Scripts\activate
   pip install -r backend/requirements.txt
   ```

4. **ติดตั้ง Frontend (Next.js)**

   ```sh
   cd frontend
   npm install
   ```

5. **รันแอปพลิเคชัน**

   ### ทางเลือก A: เริ่มต้นแบบคลิกเดียว (แนะนำ)

   เพียงดับเบิลคลิกที่ไฟล์ **`start_app.bat`** ในโฟลเดอร์หลัก

   > สคริปต์จะตรวจสอบสภาพแวดล้อม (Virtual Environment) และเปิดเบราว์เซอร์ให้โดยอัตโนมัติ

   ### ทางเลือก B: เริ่มต้นแบบ Manual

   **Terminal 1 - Backend:**

   ```sh
   python -m uvicorn backend.main:app --reload --port 8345
   ```

   Terminal 2 - Frontend:

   ```sh
   cd frontend
   npm run dev
   ```

6. **เปิดใน browser**

   ไปที่ [http://localhost:3000/ocr](http://localhost:3000/ocr)

<p align="right">(<a href="#readme-top">กลับด้านบน</a>)</p>

<!-- USAGE -->

## วิธีใช้งาน

1. **อัปโหลดเอกสาร** - ลากวางหรือคลิกเพื่ออัปโหลด PDF/รูปภาพ
2. **นำเข้าจาก URL** - วาง URL เพื่อโหลดเอกสารจากเว็บ
3. **เลือกหน้า** - สำหรับ PDF หลายหน้า เลือกหน้าที่ต้องการหรือใช้ปุ่มลัด (เลือกทั้งหมด, คี่/คู่, ช่วง)
4. **ตั้งค่าพารามิเตอร์** - ปรับ temperature, top_p และการตั้งค่า OCR อื่นๆ
5. **รัน OCR** - คลิก "Run OCR" และดูความคืบหน้า
6. **ดูผลลัพธ์** - สลับระหว่างโหมด Combined และ Compare

<p align="right">(<a href="#readme-top">กลับด้านบน</a>)</p>

<!-- FEATURES -->

## คุณสมบัติ

- ✅ อัปโหลด PDF หรือรูปภาพ (PNG, JPG, WebP)
- ✅ เลือกหลายหน้า PDF พร้อมพรีวิวแบบ grid
- ✅ นำเข้าเอกสารจาก URL (ผ่าน CORS proxy)
- ✅ กด Shift+คลิกเพื่อเลือกช่วงหน้า
- ✅ ปุ่มลัด: เลือกทั้งหมด, หน้าคี่/คู่, ช่วงกำหนดเอง
- ✅ 2 โหมด: `default` (Markdown) และ `structure` (HTML tables)
- ⚡ **ประมวลผลความเร็วสูง (Asynchronous)** ดึงข้อมูลหลายหน้าพร้อมกัน
- ✅ แสดงความคืบหน้าแบบเรียลไทม์
- ✅ โหมดเปรียบเทียบ: รูปต้นฉบับ vs. ข้อความที่แยกได้
- ✅ คัดลอกข้อความด้วยคลิกเดียว
- ✅ ตัวสร้างโค้ดสำหรับ API integration

<p align="right">(<a href="#readme-top">กลับด้านบน</a>)</p>

<!-- ROADMAP -->

## แผนการพัฒนา

- [x] Frontend Next.js ที่ทันสมัย
- [x] เลือกหลายหน้า PDF พร้อมพรีวิว
- [x] นำเข้าจาก URL พร้อม proxy
- [x] แสดงความคืบหน้า
- [x] โหมดเปรียบเทียบ
- [x] **การประมวลผล OCR แบบขนาน (Asynchronous/Concurrent)**
- [ ] ประมวลผลแบบ batch
- [ ] ส่งออกเป็นไฟล์ Markdown/HTML
- [ ] รองรับเอกสารประเภทอื่นเพิ่มเติม

ดู [open issues](https://github.com/naravid19/typhoon-ocr/issues) สำหรับรายการฟีเจอร์ที่เสนอและปัญหาที่ทราบ

<p align="right">(<a href="#readme-top">กลับด้านบน</a>)</p>

<!-- CONTRIBUTING -->

## การมีส่วนร่วม

การมีส่วนร่วมทำให้ชุมชนโอเพนซอร์สเป็นสถานที่ที่ยอดเยี่ยมในการเรียนรู้ สร้างแรงบันดาลใจ และสร้างสรรค์ ทุกการมีส่วนร่วมของคุณ **ได้รับการชื่นชมอย่างสูง**

1. Fork โปรเจกต์
2. สร้าง Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit การเปลี่ยนแปลง (`git commit -m 'Add some AmazingFeature'`)
4. Push ไปที่ Branch (`git push origin feature/AmazingFeature`)
5. เปิด Pull Request

<p align="right">(<a href="#readme-top">กลับด้านบน</a>)</p>

<!-- LICENSE -->

## ใบอนุญาต

เผยแพร่ภายใต้ใบอนุญาต Apache 2.0 ดูรายละเอียดที่ `LICENSE`

<p align="right">(<a href="#readme-top">กลับด้านบน</a>)</p>

<!-- CONTACT -->

## ติดต่อ

ลิงก์โปรเจกต์: [https://github.com/naravid19/typhoon-ocr](https://github.com/naravid19/typhoon-ocr)

<p align="right">(<a href="#readme-top">กลับด้านบน</a>)</p>

<!-- ACKNOWLEDGMENTS -->

## กิตติกรรมประกาศ

- [SCB10X Typhoon OCR](https://github.com/scb10x/typhoon-ocr) - โปรเจกต์ต้นฉบับ
- [OpenAI](https://openai.com) - ความเข้ากันได้ของ API
- [Best-README-Template](https://github.com/othneildrew/Best-README-Template) - เทมเพลต README
- [Shields.io](https://shields.io) - Badges

<p align="right">(<a href="#readme-top">กลับด้านบน</a>)</p>

<!-- MARKDOWN LINKS & IMAGES -->

[contributors-shield]: https://img.shields.io/github/contributors/naravid19/typhoon-ocr.svg?style=for-the-badge
[contributors-url]: https://github.com/naravid19/typhoon-ocr/graphs/contributors
[forks-shield]: https://img.shields.io/github/forks/naravid19/typhoon-ocr.svg?style=for-the-badge
[forks-url]: https://github.com/naravid19/typhoon-ocr/network/members
[stars-shield]: https://img.shields.io/github/stars/naravid19/typhoon-ocr.svg?style=for-the-badge
[stars-url]: https://github.com/naravid19/typhoon-ocr/stargazers
[issues-shield]: https://img.shields.io/github/issues/naravid19/typhoon-ocr.svg?style=for-the-badge
[issues-url]: https://github.com/naravid19/typhoon-ocr/issues
[license-shield]: https://img.shields.io/github/license/naravid19/typhoon-ocr.svg?style=for-the-badge
[license-url]: https://github.com/naravid19/typhoon-ocr/blob/main/LICENSE
[product-screenshot]: images/screenshot.png
[Next.js]: https://img.shields.io/badge/next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white
[Next-url]: https://nextjs.org/
[React.js]: https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB
[React-url]: https://reactjs.org/
[TailwindCSS]: https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white
[TailwindCSS-url]: https://tailwindcss.com/
[FastAPI]: https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white
[FastAPI-url]: https://fastapi.tiangolo.com/
[Python]: https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white
[Python-url]: https://python.org/
