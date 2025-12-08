"""
Typhoon OCR Pro Application
===========================

This module hosts the Gradio-based web application for Typhoon OCR.
It features a premium "Glasmorphism" UI, robust error handling, and
explicit encoding fixes for Windows environments.

Date: 2025-12-08
"""

import base64
import json
import os
import time
import subprocess
from dataclasses import dataclass
from io import BytesIO
from typing import List, Tuple, Any, Optional, Callable

import gradio as gr
from dotenv import load_dotenv
from openai import OpenAI, APIConnectionError, APITimeoutError
from PIL import Image
from pypdf import PdfReader
import typhoon_ocr.ocr_utils
from typhoon_ocr import prepare_ocr_messages

# --- CONSTANTS & CONFIGURATION ---

APP_TITLE = "Typhoon OCR"
APP_SUBTITLE = "ระบบแปลงเอกสารเป็นดิจิทัลระดับมืออาชีพ"

# Premium Dark Theme CSS (Ultra-Refined)
APP_CSS = """
@import url('https://fonts.googleapis.com/css2?family=Kanit:wght@300;400;500;600;700&family=Outfit:wght@300;400;500;600;700&display=swap');

:root {
    --primary-color: #8b5cf6;
    --primary-glow: rgba(139, 92, 246, 0.4);
    --secondary-color: #6366f1;
    --bg-dark: #09090b;
    --card-glass: rgba(30, 30, 46, 0.7);
    --border-glass: rgba(255, 255, 255, 0.08);
    --text-main: #e4e4e7;
    --text-muted: #a1a1aa;
}

body {
    font-family: 'Kanit', 'Outfit', sans-serif !important;
    background-color: var(--bg-dark) !important;
    margin: 0;
    padding: 0;
    /* Deep Radial Gradient Background */
    background-image: 
        radial-gradient(circle at 15% 50%, rgba(139, 92, 246, 0.08), transparent 25%), 
        radial-gradient(circle at 85% 30%, rgba(99, 102, 241, 0.08), transparent 25%);
    background-attachment: fixed;
}

.gradio-container {
    background-color: transparent !important; /* Let body bg shine through */
    max-width: 1400px !important;
}

/* Header */
.header-container {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 40px;
    padding: 20px 0;
    border-bottom: 1px solid var(--border-glass);
}
.logo-text {
    font-size: 36px;
    font-weight: 700;
    font-family: 'Outfit', sans-serif;
    background: linear-gradient(to right, #fff, #a78bfa);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    letter-spacing: -0.03em;
}

/* Glassmorphism Cards */
.glass-card {
    background: var(--card-glass) !important;
    backdrop-filter: blur(16px) !important;
    -webkit-backdrop-filter: blur(16px) !important;
    border: 1px solid var(--border-glass) !important;
    border-radius: 20px !important;
    padding: 32px !important;
    box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.2) !important;
    transition: all 0.3s ease;
}
.glass-card:hover {
    border-color: rgba(139, 92, 246, 0.2) !important;
    box-shadow: 0 12px 40px -10px rgba(139, 92, 246, 0.15) !important;
    transform: translateY(-2px);
}

/* Section Titles */
.section-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 8px;
    background: rgba(139, 92, 246, 0.1);
    color: #a78bfa;
    margin-right: 12px;
}
.section-title h3 {
    display: flex;
    align-items: center;
    color: var(--text-main);
    font-weight: 600 !important;
    font-size: 1.1rem !important;
    margin-bottom: 24px !important;
    font-family: 'Kanit', sans-serif !important;
}

/* Custom Inputs to sink them in */
.gr-input, .gr-box, input, textarea, select {
    background-color: rgba(0, 0, 0, 0.3) !important;
    border: 1px solid var(--border-glass) !important;
    border-radius: 12px !important;
    color: var(--text-main) !important;
    font-family: 'Kanit', sans-serif !important;
    transition: border-color 0.2s;
}
.gr-input:focus-within {
    border-color: var(--primary-color) !important;
    box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.2) !important;
}

/* Status Bar (Integrated) */
.status-bar {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    background: rgba(139, 92, 246, 0.05);
    border: 1px solid rgba(139, 92, 246, 0.1);
    border-radius: 12px;
    margin-top: 16px;
    font-size: 0.9rem;
    color: #d4d4d8;
    font-family: 'Kanit', sans-serif;
}
.status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background-color: #52525b; /* Default gray */
    box-shadow: 0 0 8px rgba(82, 82, 91, 0.5);
}
.status-active .status-dot {
    background-color: #4ade80;
    box-shadow: 0 0 8px #4ade80;
}

/* Radio Buttons & Checkboxes Fix (Aggressive) */
fieldset {
    background-color: transparent !important;
    border: 1px solid var(--border-glass) !important;
}
fieldset span {
    color: var(--text-main) !important;
    font-weight: 500;
    font-family: 'Kanit', sans-serif !important;
}
label {
    background-color: rgba(255, 255, 255, 0.05) !important;
    border-color: var(--border-glass) !important;
    color: var(--text-main) !important;
    transition: all 0.2s;
}
label:hover {
    background-color: rgba(139, 92, 246, 0.2) !important;
}
label.selected {
    background-color: var(--primary-color) !important;
    border-color: var(--primary-color) !important;
    color: white !important;
}
/* Hide default radio circle if custom styling is applied to label */
input[type="radio"] {
    accent-color: var(--primary-color) !important;
}

/* Primary Button */
.primary-btn {
    background: linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%) !important;
    border: none !important;
    color: white !important;
    font-weight: 600 !important;
    font-size: 1.1rem !important;
    border-radius: 14px !important;
    padding: 16px 24px !important;
    box-shadow: 0 4px 15px rgba(124, 58, 237, 0.3) !important;
    transition: all 0.2s !important;
    margin-top: 24px !important;
    font-family: 'Kanit', sans-serif !important;
}
.primary-btn:hover {
    transform: translateY(-1px);
    box-shadow: 0 6px 20px rgba(124, 58, 237, 0.4) !important;
    opacity: 0.95;
}

/* Results Area */
.output-container {
    background-color: rgba(0, 0, 0, 0.3) !important;
    border-radius: 16px !important;
    border: 1px solid var(--border-glass) !important;
    overflow: hidden;
}
.output-header-bar {
    padding: 12px 20px;
    background: rgba(255, 255, 255, 0.03);
    border-bottom: 1px solid var(--border-glass);
    display: flex;
    justify-content: space-between;
    align-items: center;
}
.copy-btn-styled {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border-radius: 8px;
    background: rgba(255,255,255,0.05);
    color: #a78bfa;
    border: 1px solid transparent;
    cursor: pointer;
    font-size: 0.85rem;
    font-weight: 500;
    transition: all 0.2s;
    font-family: 'Kanit', sans-serif;
}
.copy-btn-styled:hover {
    background: rgba(139, 92, 246, 0.15);
    border-color: rgba(139, 92, 246, 0.3);
    color: #fff;
}
.gr-textarea textarea {
    font-family: 'JetBrains Mono', 'Courier New', monospace !important;
    font-size: 0.95rem !important;
    line-height: 1.6 !important;
    color: #e4e4e7 !important;
}

/* Utilities */
.sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    border: 0;
}
#toast-container {
    position: fixed;
    bottom: 32px;
    right: 32px;
    z-index: 9999;
}

/* Dropdown Menu Fix */
.gr-dropdown, .dropdown-trigger {
    border-radius: 12px !important;
    background-color: rgba(0, 0, 0, 0.3) !important;
    border: 1px solid var(--border-glass) !important;
}
.options, .gr-dropdown-options {
    background: rgba(30, 30, 46, 0.95) !important;
    backdrop-filter: blur(16px) !important;
    border: 1px solid var(--border-glass) !important;
    border-radius: 12px !important;
    margin-top: 8px !important;
    box-shadow: 0 10px 25px rgba(0,0,0,0.3) !important;
    padding: 8px !important;
}
.options .item, .gr-dropdown-options .item {
    color: var(--text-main) !important;
    padding: 10px 16px !important;
    font-size: 0.95rem !important;
    border-radius: 8px !important;
    margin-bottom: 2px !important;
    cursor: pointer !important;
    font-family: 'Kanit', sans-serif !important;
}
.options .item:hover, .options .item.selected, .gr-dropdown-options .item:hover {
    background: rgba(139, 92, 246, 0.2) !important;
    color: white !important;
}
.wrap-inner {
    background-color: transparent !important;
    border: none !important;
}
/* Fix arrow icon */
.gr-dropdown svg {
    fill: #a1a1aa !important;
}

/* Tab Labels */
.tab-nav button {
    font-family: 'Kanit', sans-serif !important;
    font-weight: 500;
}
"""

APP_JS = """
(text) => {
    if (!text) return;
    
    const showToast = (message) => {
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            document.body.appendChild(container);
        }
        
        const toast = document.createElement('div');
        toast.textContent = message;
        toast.style.background = 'rgba(16, 185, 129, 0.9)';
        toast.style.backdropFilter = 'blur(8px)';
        toast.style.color = '#fff';
        toast.style.padding = '14px 24px';
        toast.style.marginTop = '10px';
        toast.style.borderRadius = '12px';
        toast.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.3)';
        toast.style.fontWeight = '500';
        toast.style.fontSize = '0.95rem';
        toast.style.display = 'flex';
        toast.style.alignItems = 'center';
        toast.style.gap = '8px';
        toast.style.fontFamily = "'Kanit', sans-serif";
        toast.style.animation = 'slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)';
        
        container.appendChild(toast);
        
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(10px)';
            toast.style.transition = 'all 0.5s ease';
            setTimeout(() => toast.remove(), 500);
        }, 3000);
    }
    
    // Inject Styles for Toast Animation
    const style = document.createElement('style');
    style.innerHTML = `
        @keyframes slideIn {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
        }
    `;
    document.head.appendChild(style);

    // Copy to Clipboard with Fallback
    navigator.clipboard.writeText(text).then(() => {
        showToast("✨ คัดลอกข้อความสำเร็จ!");
    }).catch(err => {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        try {
            document.execCommand('copy');
            showToast("✨ คัดลอกข้อความสำเร็จ!");
        } catch (e) {
            alert("Failed to copy");
        }
        document.body.removeChild(ta);
    });
}
"""

# --- SYSTEM PATCHES ---

def _apply_patches() -> None:
    """
    Applies a monkey patch to `typhoon_ocr.ocr_utils` to fix Windows encoding issues.
    Overrides `get_pdf_media_box_width_height` to use UTF-8 explicitly.
    """
    def patched_get_pdf_media_box_width_height(local_pdf_path: str, page_num: int) -> tuple[float, float]:
        command = [
            "pdfinfo", "-f", str(page_num), "-l", str(page_num), "-box",
            "-enc", "UTF-8", local_pdf_path
        ]
        result = subprocess.run(
            command, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
            text=True, encoding='utf-8', errors='replace'
        )
        
        if result.returncode != 0:
            raise ValueError(f"Error running pdfinfo: {result.stderr}")
            
        for line in result.stdout.splitlines():
            if "MediaBox" in line:
                try:
                    parts = line.split(":")[1].split()
                    return (
                        abs(float(parts[0]) - float(parts[2])),
                        abs(float(parts[3]) - float(parts[1]))
                    )
                except (IndexError, ValueError):
                    continue
        raise ValueError("MediaBox not found")

    typhoon_ocr.ocr_utils.get_pdf_media_box_width_height = patched_get_pdf_media_box_width_height

# --- STARTUP & CONFIGURATION ---

load_dotenv()

# Apply patches immediately on module load
_apply_patches()

def _check_system_requirements() -> None:
    """
    Performs startup checks for dependencies and configuration.
    """
    print("🔄 Running system health check...")
    
    # 1. Check for pdfinfo (Poppler)
    try:
        subprocess.run(["pdfinfo", "-v"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
        print("✅ Dependency 'pdfinfo' found.")
    except (FileNotFoundError, subprocess.CalledProcessError):
        print("⚠️  WARNING: 'pdfinfo' not found. PDF processing may fail. Please install Poppler.")

    # 2. Check API Key
    if not os.getenv("TYPHOON_API_KEY"):
        print("⚠️  WARNING: 'TYPHOON_API_KEY' is missing in environment variables.")
    else:
        print("✅ 'TYPHOON_API_KEY' detected.")

# Run checks
_check_system_requirements()

# --- CONFIGURATION (ENV) ---

@dataclass
class Config:
    """Application configuration and model parameters."""
    BASE_URL: str = os.getenv("TYPHOON_BASE_URL", "")
    API_KEY: str = os.getenv("TYPHOON_API_KEY", "")
    MODEL_NAME: str = os.getenv("TYPHOON_OCR_MODEL", "")
    MAX_TOKENS: int = 16384
    REPETITION_PENALTY: float = 1.2
    TEMPERATURE: float = 0.1
    TOP_P: float = 0.6
    MAX_RETRIES: int = 5
    IMAGE_DIM: int = 1800
    TEXT_LENGTH: int = 8000

# --- CORE LOGIC ---

class TyphoonOCR:
    """Core logic helper for interacting with the Typhoon OCR API."""

    def __init__(self):
        if not Config.BASE_URL or not Config.API_KEY:
            # In production, we might want to log this or handle it gracefully
            pass 
        self.client = OpenAI(base_url=Config.BASE_URL, api_key=Config.API_KEY)

    def _get_page_count(self, file_path: str) -> int:
        """Safely retrieves page count for PDFs; returns 1 for images."""
        try:
            if file_path and file_path.lower().endswith(".pdf"):
                return len(PdfReader(file_path).pages)
        except Exception:
            pass
        return 1

    def _call_api_with_retry(self, func: Callable, *args, **kwargs) -> Any:
        """
        Executes a function with exponential backoff retry logic.
        Handles APIConnectionError and APITimeoutError.
        """
        for attempt in range(Config.MAX_RETRIES):
            try:
                return func(*args, **kwargs)
            except (APIConnectionError, APITimeoutError) as e:
                if attempt == Config.MAX_RETRIES - 1:
                    raise e
                time.sleep(2 ** attempt)
            except Exception as e:
                raise e

    def process_document(
        self,
        file_obj: Any,
        task_mode: str,
        scope_mode: str,
        single_page: float,
        start_page: float,
        end_page: float,
        progress: gr.Progress = gr.Progress(track_tqdm=True)
    ) -> Tuple[List[Image.Image], str]:
        """
        Main processing function triggered by the UI.
        Handles page selection logic, API calls with retry, and result aggregation.
        """
        if not file_obj:
            return [], "⚠️ กรุณาอัปโหลดไฟล์ก่อนเริ่ม"

        file_path = file_obj.name
        is_pdf = file_path.lower().endswith(".pdf")
        total_pages = self._get_page_count(file_path)

        # Determine target pages
        target_pages: List[int] = [1]
        
        # Mapping Thai scope labels to logic
        # scope_mode values: ["ทั้งหมด", "ช่วงหน้า", "หน้าเดียว"]
        
        if is_pdf:
            if scope_mode == "ทั้งหมด":
                target_pages = list(range(1, total_pages + 1))
            elif scope_mode == "ช่วงหน้า":
                s = max(1, int(start_page))
                e = min(total_pages, int(end_page))
                target_pages = list(range(s, e + 1))
            else: # "หน้าเดียว"
                p = max(1, min(total_pages, int(single_page)))
                target_pages = [p]

        images: List[Image.Image] = []
        text_parts: List[str] = []
        total_targets = len(target_pages)

        for idx, page_num in enumerate(target_pages, 1):
            progress((idx - 1, total_targets), desc=f"กำลังประมวลผลหน้าที่ {page_num}")
            
            try:
                # Prepare payload
                messages = prepare_ocr_messages(
                    file_path, task_mode, Config.IMAGE_DIM, Config.TEXT_LENGTH, page_num
                )
                
                # Extract image preview from payload (Base64)
                try:
                    img_data = messages[0]["content"][1]["image_url"]["url"].split(",")[-1]
                    pil_img = Image.open(BytesIO(base64.b64decode(img_data)))
                    images.append(pil_img)
                except Exception:
                    pass
                
                # API Call with Retry
                response = self._call_api_with_retry(
                    self.client.chat.completions.create,
                    model=Config.MODEL_NAME,
                    messages=messages,
                    max_tokens=Config.MAX_TOKENS,
                    extra_body={
                        "repetition_penalty": Config.REPETITION_PENALTY,
                        "temperature": Config.TEMPERATURE,
                        "top_p": Config.TOP_P
                    }
                )
                
                # Parse JSON output
                content = response.choices[0].message.content
                parsed_text = json.loads(content).get("natural_text", "")
                
                # Clean tags
                clean_text = parsed_text.replace("<figure>", "").replace("</figure>", "").strip()
                text_parts.append(clean_text)

            except Exception as e:
                text_parts.append(f"❌ เกิดข้อผิดพลาดในหน้าที่ {page_num}: {str(e)}")

        return images, "\n\n".join(text_parts)

# --- UI CONSTRUCTION ---

def _build_header() -> None:
    """Renders the top navigation bar."""
    with gr.Row(elem_classes=["header-container"]):
        gr.HTML(
            f"""<div class="logo-text">Typhoon<span style="color:#a78bfa; margin-left:8px">OCR</span></div>"""
        )
        gr.Markdown(
            f"""<span style="color:#a1a1aa; font-weight:500; font-family:'Kanit',sans-serif">{APP_SUBTITLE}</span>"""
        )

def _build_left_panel(ocr_instance: TyphoonOCR) -> dict:
    """Builds the left-side control panel (Upload + Config)."""
    ui_elements = {}
    
    with gr.Column(scale=1, elem_classes=["glass-card"]):
        # Source Section
        gr.Markdown("""<div class="section-title"><span class="section-icon">📄</span><h3>ไฟล์ต้นฉบับ</h3></div>""")
        
        ui_elements["file_input"] = gr.File(
            label="อัปโหลดไฟล์", file_types=[".pdf", ".png", ".jpg"], 
            height=180, container=False
        )
        
        ui_elements["status_bar"] = gr.HTML(
            value="""<div class="status-bar"><div class="status-dot"></div><span>รออัปโหลดไฟล์...</span></div>""",
            elem_id="status-bar"
        )
        
        gr.HTML('<div style="height: 32px"></div>')
        
        # Config Section
        gr.Markdown("""<div class="section-title"><span class="section-icon">⚙️</span><h3>การตั้งค่า</h3></div>""")
        
        with gr.Tabs():
            with gr.TabItem("เลือกหน้า"):
                ui_elements["page_mode"] = gr.Radio(
                    ["ทั้งหมด", "ช่วงหน้า", "หน้าเดียว"], 
                    label="ขอบเขต", value="ทั้งหมด", container=False
                )
                
                # Dynamic Groups
                with gr.Group(visible=False) as single_grp:
                    ui_elements["page_num"] = gr.Number(label="เลขหน้า", value=1, container=False)
                ui_elements["grp_single"] = single_grp
                
                with gr.Group(visible=False) as range_grp:
                    with gr.Row():
                        ui_elements["start_p"] = gr.Number(label="เริ่มต้น", value=1, container=False)
                        ui_elements["end_p"] = gr.Number(label="สิ้นสุด", value=1, container=False)
                ui_elements["grp_range"] = range_grp
                
            with gr.TabItem("โมเดล"):
                ui_elements["task_mode"] = gr.Dropdown(
                    ["default", "structure"], 
                    label="โหมดการอ่าน", value="default", container=False
                )

        ui_elements["btn_run"] = gr.Button("เริ่มประมวลผล", elem_classes=["primary-btn"])
        
    return ui_elements

def _build_right_panel() -> dict:
    """Builds the right-side result panel (Markdown + Gallery)."""
    ui_elements = {}
    
    with gr.Column(scale=2, elem_classes=["glass-card"]):
        gr.Markdown("""<div class="section-title"><span class="section-icon">👁️</span><h3>ผลลัพธ์</h3></div>""")
        
        with gr.Tabs():
            with gr.TabItem("ข้อความ (Markdown)"):
                with gr.Group(elem_classes=["output-container"]):
                    # Custom Header with Copy Button
                    gr.HTML("""
                        <div class="output-header-bar">
                            <span style="font-weight:600; color:#a1a1aa; font-size:0.8rem; letter-spacing:0.5px">GENERATED CONTENT</span>
                            <button onclick="document.getElementById('real_copy_btn').click()" class="copy-btn-styled">
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                                คัดลอกข้อความ
                            </button>
                        </div>
                    """)
                    ui_elements["out_txt"] = gr.Textbox(
                        lines=22, show_label=False, container=False, 
                        elem_classes=["gr-textarea"]
                    )
                    # Hidden bridge button for Copy JS
                    ui_elements["copy_bridge"] = gr.Button(
                        "bridge", elem_id="real_copy_btn", 
                        elem_classes=["sr-only"], visible=True
                    )
                    
            with gr.TabItem("รูปภาพ"):
                ui_elements["out_gal"] = gr.Gallery(
                    height=600, columns=[2], object_fit="contain", 
                    show_label=False, container=False
                )
                
    return ui_elements

def create_ui() -> gr.Blocks:
    """
    Constructs the main Gradio Blocks interface.
    Combines all panels and defines event listeners.
    """
    ocr_service = TyphoonOCR()
    
    # Force Dark Theme Configuration
    theme = gr.themes.Base(
        primary_hue="violet", 
        secondary_hue="slate", 
        neutral_hue="slate", 
        font=["Kanit", "Outfit", "sans-serif"]
    ).set(
        body_background_fill="#09090b",
        block_background_fill="#18181b",
        block_border_color="rgba(255, 255, 255, 0.1)",
        block_title_text_color="#e4e4e7",
        body_text_color="#e4e4e7",
        background_fill_primary="#09090b",
        background_fill_secondary="#09090b",
        layout_gap="6px"
    )

    with gr.Blocks(theme=theme, css=APP_CSS, title=APP_TITLE) as demo:
        _build_header()
        
        with gr.Row():
            left = _build_left_panel(ocr_service)
            right = _build_right_panel()

        # Event: File Upload Interaction
        def update_status(f):
            if not f:
                return (
                    """<div class="status-bar"><div class="status-dot"></div><span>รออัปโหลดไฟล์...</span></div>""",
                    gr.update(visible=False), 1, 1, 1
                )
            
            total = ocr_service._get_page_count(f.name)
            is_pdf = f.name.lower().endswith(".pdf")
            status_text = f"พร้อมทำงาน • {'PDF' if is_pdf else 'รูปภาพ'} • {total} หน้า"
            
            return (
                f"""<div class="status-bar status-active"><div class="status-dot"></div><span>{status_text}</span></div>""",
                gr.update(visible=is_pdf), 
                total, 1, total
            )

        left["file_input"].change(
            fn=update_status, 
            inputs=[left["file_input"]], 
            outputs=[left["status_bar"], left["page_mode"], left["page_num"], left["start_p"], left["end_p"]]
        )

        # Event: Visibility Toggles
        left["page_mode"].change(
            fn=lambda x: (gr.update(visible=x=="หน้าเดียว"), gr.update(visible=x=="ช่วงหน้า")),
            inputs=[left["page_mode"]],
            outputs=[left["grp_single"], left["grp_range"]]
        )

        # Event: Main Processing
        left["btn_run"].click(
            fn=ocr_service.process_document,
            inputs=[
                left["file_input"], left["task_mode"], left["page_mode"],
                left["page_num"], left["start_p"], left["end_p"]
            ],
            outputs=[right["out_gal"], right["out_txt"]]
        )

        # Event: Copy Action
        right["copy_bridge"].click(
            fn=None, 
            inputs=[right["out_txt"]], 
            js=APP_JS
        )

    return demo

if __name__ == "__main__":
    create_ui().launch(share=False)
