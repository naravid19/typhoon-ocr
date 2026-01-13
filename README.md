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
    A powerful OCR application for extracting structured markdown from images and PDFs
    <br />
    <a href="https://github.com/naravid19/typhoon-ocr"><strong>Explore the docs »</strong></a>
    <br />
    <br />
    <a href="https://github.com/naravid19/typhoon-ocr">View Demo</a>
    &middot;
    <a href="https://github.com/naravid19/typhoon-ocr/issues/new?labels=bug">Report Bug</a>
    &middot;
    <a href="https://github.com/naravid19/typhoon-ocr/issues/new?labels=enhancement">Request Feature</a>
  </p>
</div>

<!-- TABLE OF CONTENTS -->
<details>
  <summary>Table of Contents</summary>
  <ol>
    <li>
      <a href="#about-the-project">About The Project</a>
      <ul>
        <li><a href="#built-with">Built With</a></li>
      </ul>
    </li>
    <li>
      <a href="#getting-started">Getting Started</a>
      <ul>
        <li><a href="#prerequisites">Prerequisites</a></li>
        <li><a href="#installation">Installation</a></li>
      </ul>
    </li>
    <li><a href="#usage">Usage</a></li>
    <li><a href="#features">Features</a></li>
    <li><a href="#roadmap">Roadmap</a></li>
    <li><a href="#contributing">Contributing</a></li>
    <li><a href="#license">License</a></li>
    <li><a href="#contact">Contact</a></li>
    <li><a href="#acknowledgments">Acknowledgments</a></li>
  </ol>
</details>

<!-- ABOUT THE PROJECT -->

## About The Project

[![Product Name Screen Shot][product-screenshot]](https://github.com/naravid19/typhoon-ocr/images/screenshot.png)

Typhoon OCR is a model for extracting structured markdown from images or PDFs. It supports document layout analysis and table extraction, returning results in markdown or HTML.

This fork provides a modern **Next.js web application** alongside the original Gradio demo, featuring:

- 🚀 **Modern UI** with dark theme and premium aesthetics
- 📄 **Multi-page PDF support** with interactive page selection
- 🔗 **URL import** for loading documents directly from the web
- 📊 **Real-time progress** indicators during OCR processing
- 🎨 **Compare mode** to view original and extracted text side-by-side

> **This fork focuses on Windows 10/11.** For macOS/Linux setup, please refer to the official Typhoon OCR repository.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

### Built With

- [![Next][Next.js]][Next-url]
- [![React][React.js]][React-url]
- [![TailwindCSS][TailwindCSS]][TailwindCSS-url]
- [![FastAPI][FastAPI]][FastAPI-url]
- [![Python][Python]][Python-url]

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- GETTING STARTED -->

## Getting Started

To get a local copy up and running follow these steps.

### Prerequisites

- **Windows 10/11** with Python 3.10+
- **Node.js 18+** with npm
- **Poppler** (for PDF processing)

Install Poppler using PowerShell:

```powershell
iwr -useb https://github.com/oschwartz10612/poppler-windows/releases/download/v25.07.0-0/Release-25.07.0-0.zip -OutFile $env:TEMP\poppler.zip; rm C:\poppler -Recurse -Force -ErrorAction SilentlyContinue; Expand-Archive $env:TEMP\poppler.zip C:\poppler -Force; $bin=(Get-ChildItem C:\poppler -Recurse -Filter pdfinfo.exe | Select-Object -First 1).DirectoryName; if(-not $bin){throw "pdfinfo.exe not found under C:\poppler"}; $u=[Environment]::GetEnvironmentVariable('Path','User'); if([string]::IsNullOrEmpty($u)){$u=''}; if($u -notlike "*$bin*"){[Environment]::SetEnvironmentVariable('Path', ($u.TrimEnd(';')+';'+$bin).Trim(';'), 'User')}; $env:Path+=';'+$bin; pdfinfo -v
```

Verify installation:

```powershell
pdfinfo -v
pdftoppm -v
```

### Installation

1. **Clone the repo**

   ```sh
   git clone https://github.com/naravid19/typhoon-ocr.git
   cd typhoon-ocr
   ```

2. **Configure environment**

   Create a `.env` file in the project root:

   ```ini
   TYPHOON_BASE_URL=https://api.opentyphoon.ai/v1
   TYPHOON_API_KEY=YOUR_API_KEY
   TYPHOON_OCR_MODEL=typhoon-ocr
   ```

3. **Set up Backend (Python)**

   ```sh
   python -m venv venv
   .\venv\Scripts\activate
   pip install -r backend/requirements.txt
   ```

4. **Set up Frontend (Next.js)**

   ```sh
   cd frontend
   npm install
   ```

5. **Run the application**

   Terminal 1 - Backend:

   ```sh
   python -m uvicorn backend.main:app --reload --port 8000
   ```

   Terminal 2 - Frontend:

   ```sh
   cd frontend
   npm run dev
   ```

6. **Open in browser**

   Navigate to [http://localhost:3000/ocr](http://localhost:3000/ocr)

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- USAGE -->

## Usage

1. **Upload a document** - Drag & drop or click to upload PDF/images
2. **Import from URL** - Paste a URL to load documents directly from the web
3. **Select pages** - For multi-page PDFs, select specific pages or use quick actions (Select All, Odd/Even, Range)
4. **Configure parameters** - Adjust temperature, top_p, and other OCR settings
5. **Run OCR** - Click "Run OCR" and monitor progress
6. **View results** - Switch between Combined and Compare views

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- FEATURES -->

## Features

- ✅ Upload PDF or images (PNG, JPG, WebP)
- ✅ Multi-page PDF selection with visual grid preview
- ✅ Import documents from URL (with CORS proxy)
- ✅ Shift-click for range selection
- ✅ Quick actions: Select All, Odd/Even pages, Custom range
- ✅ Two task types: `default` (Markdown) and `structure` (HTML tables)
- ✅ Real-time progress indicator
- ✅ Compare mode: Original image vs. extracted text
- ✅ Copy extracted text with one click
- ✅ Code generator for API integration

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- ROADMAP -->

## Roadmap

- [x] Modern Next.js frontend
- [x] Multi-page PDF selection with preview
- [x] URL import with proxy
- [x] Progress indicators
- [x] Compare view mode
- [ ] Batch processing
- [ ] Export to Markdown/HTML file
- [ ] Support for more document types

See the [open issues](https://github.com/naravid19/typhoon-ocr/issues) for a full list of proposed features (and known issues).

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- CONTRIBUTING -->

## Contributing

Contributions are what make the open source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- LICENSE -->

## License

Distributed under the Apache 2.0 License. See `LICENSE` for more information.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- CONTACT -->

## Contact

Project Link: [https://github.com/naravid19/typhoon-ocr](https://github.com/naravid19/typhoon-ocr)

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- ACKNOWLEDGMENTS -->

## Acknowledgments

- [SCB10X Typhoon OCR](https://github.com/scb10x/typhoon-ocr) - Original project
- [OpenAI](https://openai.com) - API compatibility
- [Best-README-Template](https://github.com/othneildrew/Best-README-Template) - README template
- [Shields.io](https://shields.io) - Badges

<p align="right">(<a href="#readme-top">back to top</a>)</p>

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
[product-screenshot]: frontend/public/screenshot.png
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
