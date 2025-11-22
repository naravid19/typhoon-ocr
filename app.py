import base64
import json
import os
import time
import random
from dataclasses import dataclass
from io import BytesIO
from typing import List, Tuple, Any

import gradio as gr
from dotenv import load_dotenv
from openai import OpenAI, APIConnectionError, APITimeoutError
from PIL import Image
from pypdf import PdfReader
from typhoon_ocr import prepare_ocr_messages

# Load environment variables
load_dotenv()

@dataclass
class Config:
    """Configuration settings for the application."""
    BASE_URL: str = os.getenv("TYPHOON_BASE_URL")
    API_KEY: str = os.getenv("TYPHOON_API_KEY")
    MODEL_NAME: str = os.getenv("TYPHOON_OCR_MODEL")
    MAX_TOKENS: int = 16384
    REPETITION_PENALTY: float = 1.2
    TEMPERATURE: float = 0.1
    TOP_P: float = 0.6
    MAX_RETRIES: int = 5
    IMAGE_DIM: int = 1800
    TEXT_LENGTH: int = 8000

class TyphoonOCR:
    """
    Main class for handling Typhoon OCR operations.
    Encapsulates API interaction, image processing, and error handling.
    """

    def __init__(self):
        """Initialize the TyphoonOCR client."""
        if not Config.BASE_URL or not Config.API_KEY:
            raise ValueError("Environment variables TYPHOON_BASE_URL and TYPHOON_API_KEY must be set.")
        
        self.client = OpenAI(base_url=Config.BASE_URL, api_key=Config.API_KEY)

    def _get_page_count(self, file_path: str) -> int:
        """Get the total number of pages in a PDF file."""
        try:
            if file_path and file_path.lower().endswith(".pdf"):
                return len(PdfReader(file_path).pages)
        except Exception:
            pass
        return 1

    def _parse_llm_output(self, text_output: str) -> str:
        """Parse the JSON output from the LLM."""
        try:
            data = json.loads(text_output)
            return (
                data.get("natural_text", "")
                .replace("<figure>", "")
                .replace("</figure>", "")
            )
        except Exception:
            return text_output

    def _call_api_with_retry(self, messages: List[dict]) -> Any:
        """Call the OpenAI API with exponential backoff retry logic."""
        for attempt in range(Config.MAX_RETRIES):
            try:
                return self.client.chat.completions.create(
                    model=Config.MODEL_NAME,
                    messages=messages,
                    max_tokens=Config.MAX_TOKENS,
                    extra_body={
                        "repetition_penalty": Config.REPETITION_PENALTY,
                        "temperature": Config.TEMPERATURE,
                        "top_p": Config.TOP_P,
                    },
                )
            except (APIConnectionError, APITimeoutError) as e:
                if attempt < Config.MAX_RETRIES - 1:
                    wait_time = (2 ** attempt) + random.uniform(0, 1)
                    print(f"Connection error: {e}. Retrying in {wait_time:.2f} seconds... (Attempt {attempt + 1}/{Config.MAX_RETRIES})")
                    time.sleep(wait_time)
                else:
                    print(f"Failed after {Config.MAX_RETRIES} attempts.")
                    raise e

    def process_document(
        self,
        pdf_or_image_file: Any,
        task_type: str,
        page_mode: str,
        page_number: float,
        start_page: float,
        end_page: float,
        progress: gr.Progress = gr.Progress(track_tqdm=True)
    ) -> Tuple[List[Image.Image], str]:
        """Process the uploaded document and perform OCR."""
        if pdf_or_image_file is None:
            return [], "⚠️ กรุณาอัปโหลดไฟล์ก่อนเริ่มการทำงาน"

        file_path = pdf_or_image_file.name
        is_pdf = file_path.lower().endswith(".pdf")
        total_pages = self._get_page_count(file_path)

        # Determine pages to process
        selected_pages: List[int] = []
        if not is_pdf:
            selected_pages = [1]
        else:
            if page_mode == "ทุกหน้า":
                selected_pages = list(range(1, total_pages + 1))
            elif page_mode == "ช่วงหน้า":
                s = int(start_page or 1)
                e = int(end_page or total_pages)
                s = max(1, min(s, total_pages))
                e = max(1, min(e, total_pages))
                if s > e:
                    s, e = e, s
                selected_pages = list(range(s, e + 1))
            else:  # หน้าเดียว
                p = int(page_number or 1)
                p = max(1, min(p, total_pages))
                selected_pages = [p]

        images = []
        parts = []
        
        total_selected = len(selected_pages)

        for idx, p in enumerate(selected_pages, start=1):
            # Update progress: Show current step out of total selected
            progress((idx - 1, total_selected), desc=f"กำลังประมวลผลหน้า {p} ({idx}/{total_selected})", unit="หน้า")

            messages = prepare_ocr_messages(
                pdf_or_image_path=file_path,
                task_type=task_type,
                target_image_dim=Config.IMAGE_DIM,
                target_text_length=Config.TEXT_LENGTH,
                page_num=p,
            )

            try:
                image_url = messages[0]["content"][1]["image_url"]["url"]
                image_base64 = image_url.split(",")[-1]
                images.append(Image.open(BytesIO(base64.b64decode(image_base64))))
            except Exception as e:
                print(f"Error extracting image preview: {e}")

            try:
                response = self._call_api_with_retry(messages)
                text_output = response.choices[0].message.content
                markdown_out = self._parse_llm_output(text_output)
                parts.append(markdown_out.strip())
            except Exception as e:
                error_msg = f"❌ เกิดข้อผิดพลาดที่หน้า {p}: {str(e)}"
                parts.append(error_msg)

        progress(1.0, desc="เสร็จสิ้น", unit="หน้า")
        combined_markdown = "\n\n".join(parts)
        return images, combined_markdown

# --- UI Setup ---

def create_ui():
    """Create and configure the Gradio UI."""
    
    ocr_app = TyphoonOCR()

    # Dark Theme CSS
    custom_css = """
    @import url('https://fonts.googleapis.com/css2?family=Prompt:wght@300;400;500;600&display=swap');
    
    body, .gradio-container {
        font-family: 'Prompt', sans-serif !important;
        background-color: #0f1117 !important;
        color: #e5e7eb !important;
    }
    
    /* Header */
    .header-container {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 24px;
    }
    .logo-text {
        font-size: 24px;
        font-weight: 600;
        color: #fff;
    }

    /* Panels */
    .panel-container {
        background-color: #1e1e2e !important;
        border: 1px solid #2e2e3e !important;
        border-radius: 8px !important;
        padding: 16px !important;
        position: relative; /* For absolute positioning of children */
    }
    
    /* Output Group Styling */
    .output-group {
        border: 1px solid #2e2e3e !important;
        border-radius: 8px !important;
        overflow: hidden !important;
        margin-top: 16px;
    }
    
    /* Header Row Styling */
    .output-header {
        background-color: #0f1117 !important; /* Match textbox bg */
        border-bottom: 1px solid #2e2e3e !important;
        padding: 0 12px !important;
        display: flex !important;
        align-items: center !important;
        justify-content: space-between !important;
        height: 36px !important;
    }
    
    .output-header-label {
        font-weight: 600;
        font-size: 0.75rem;
        color: #9ca3af;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        font-family: 'Prompt', sans-serif;
    }

    /* Textbox Styling to merge with header */
    .output-box {
        border: none !important;
        border-radius: 0 0 8px 8px !important;
        margin-top: 0 !important;
    }
    .output-box textarea {
        border: none !important;
        padding-top: 8px !important;
    }
    
    /* Minimal Copy Button Styles */
    .minimal-copy-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
        cursor: pointer;
        outline: none;
        height: 28px;
        width: 28px;
        border-radius: 4px;
        padding: 0;
        color: #9ca3af;
        background-color: transparent;
        border: none !important;
    }
    .minimal-copy-btn:hover {
        background-color: rgba(255, 255, 255, 0.05);
        color: #e5e7eb;
    }
    .minimal-copy-btn svg {
        width: 16px;
        height: 16px;
    }
    /* Hidden Bridge Button */
    .hidden-btn {
        display: none !important;
    }
    """

    # Use a dark theme base
    theme = gr.themes.Base(
        primary_hue="violet",
        secondary_hue="slate",
        neutral_hue="slate",
        font=["Prompt", "sans-serif"]
    ).set(
        body_background_fill="#0f1117",
        block_background_fill="#1e1e2e",
        block_border_color="#2e2e3e",
        block_title_text_color="#e5e7eb",
        body_text_color="#e5e7eb",
    )

    with gr.Blocks(theme=theme, css=custom_css, title="Typhoon OCR") as demo:
        
        # Header
        with gr.Row(elem_classes=["header-container"]):
            gr.HTML("""
                <div style="display: flex; align-items: baseline;">
                    <span class="logo-text">Typhoon</span>
                    <span class="logo-text" style="color: #7c3aed; margin-left: 4px;">OCR</span>
                </div>
            """)

        with gr.Row():
            # Left Column: Configuration
            with gr.Column(scale=1, elem_classes=["panel-container"]):
                gr.Markdown("### Configuration")
                
                with gr.Tabs():
                    with gr.TabItem("Files"):
                        file_input = gr.File(
                            label="Upload File",
                            file_types=[".pdf", ".png", ".jpg", ".jpeg"],
                            file_count="single",
                            height=200
                        )
                        
                        page_info = gr.Markdown(value="Status: Waiting for upload...")
                        
                        # Page Controls
                        with gr.Group(visible=False) as page_controls:
                            gr.Markdown("#### Page Selection")
                            page_mode = gr.Radio(
                                ["ทุกหน้า", "ช่วงหน้า", "หน้าเดียว"],
                                label="Select Pages",
                                value="ทุกหน้า",
                                show_label=False
                            )
                            with gr.Row(visible=False) as single_page_row:
                                page_number = gr.Number(label="Page Number", value=1, minimum=1, step=1)
                            with gr.Row(visible=False) as range_page_row:
                                start_page = gr.Number(label="Start", value=1, minimum=1, step=1)
                                end_page = gr.Number(label="End", value=1, minimum=1, step=1)

                    with gr.TabItem("Model Parameters"):
                        task_dropdown = gr.Dropdown(
                            choices=["default", "structure"],
                            label="Task Type",
                            value="default",
                            info="Default: General text | Structure: Complex tables"
                        )
                        gr.Markdown("_More parameters can be added here._")

                run_button = gr.Button("Submit", variant="primary", elem_classes=["primary-btn"])

            # Right Column: Response
            with gr.Column(scale=2, elem_classes=["panel-container"]):
                gr.Markdown("### Response")

                image_gallery = gr.Gallery(
                    label="Preview", 
                    height=300, 
                    columns=[2], 
                    object_fit="contain",
                    preview=True,
                    show_label=False
                )
                
                # Output Group with Header Row
                with gr.Group(elem_classes=["output-group"]):
                    # Header Row (Single HTML block for perfect control)
                    gr.HTML("""
                        <div class="output-header">
                            <span class="output-header-label">OUTPUT</span>
                            <button onclick="document.getElementById('real_copy_btn').click()" class="minimal-copy-btn" title="Copy to clipboard">
                                <span class="icon-container">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-copy"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"></rect><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"></path></svg>
                                </span>
                            </button>
                        </div>
                    """)
                    
                    # Hidden Bridge Button
                    real_copy_btn = gr.Button("Copy Real", elem_id="real_copy_btn", elem_classes=["hidden-btn"])
                    
                    result_output = gr.Textbox(
                        label="Markdown Output", 
                        lines=15, 
                        show_copy_button=False, 
                        elem_classes=["output-box"],
                        elem_id="ocr_result_box",
                        show_label=False,
                        placeholder="Upload an image/PDF and run OCR to see results"
                    )

        # State management
        result_state = gr.State("")

        # --- JavaScript for Robust Copy ---
        robust_copy_js = """
        (text) => {
            // 1. Visual Feedback Function
            const showSuccess = () => {
                const btn = document.querySelector('.minimal-copy-btn .icon-container');
                if (btn) {
                    const originalIcon = btn.innerHTML;
                    btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4ade80" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-check"><path d="M20 6 9 17l-5-5"/></svg>';
                    setTimeout(() => {
                        btn.innerHTML = originalIcon;
                    }, 2000);
                }
            };

            // 2. Robust Copy Logic
            if (!text) {
                console.warn("No text to copy");
                return;
            }

            // Try Clipboard API first
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(text).then(showSuccess).catch(err => {
                    console.error("Clipboard API failed, trying fallback...", err);
                    fallbackCopy(text);
                });
            } else {
                fallbackCopy(text);
            }

            function fallbackCopy(text) {
                const textArea = document.createElement("textarea");
                textArea.value = text;
                
                // Ensure it's not visible but part of DOM
                textArea.style.position = "fixed";
                textArea.style.left = "-9999px";
                textArea.style.top = "0";
                document.body.appendChild(textArea);
                
                textArea.focus();
                textArea.select();
                
                try {
                    const successful = document.execCommand('copy');
                    if (successful) {
                        showSuccess();
                    } else {
                        console.error("Fallback copy failed.");
                        alert("Copy failed. Please copy manually.");
                    }
                } catch (err) {
                    console.error("Fallback copy error:", err);
                    alert("Copy failed. Please copy manually.");
                }
                
                document.body.removeChild(textArea);
            }
        }
        """

        # --- Event Handlers ---
        
        # Wire up the hidden button to the JS function
        real_copy_btn.click(None, [result_output], None, js=robust_copy_js)

        def on_file_change(f):
            if f is None:
                return (
                    gr.update(value="Status: Waiting for upload..."),
                    gr.update(visible=False),
                    gr.update(value="ทุกหน้า"),
                    gr.update(minimum=1, maximum=1, value=1),
                    gr.update(minimum=1, maximum=1, value=1),
                    gr.update(minimum=1, maximum=1, value=1),
                )
            
            total = ocr_app._get_page_count(f.name)
            is_pdf = f.name.lower().endswith(".pdf")
            
            info_text = f"✅ **Ready** | Type: {'PDF' if is_pdf else 'Image'} | Pages: {total}"
            
            return (
                gr.update(value=info_text),
                gr.update(visible=is_pdf),
                gr.update(value="ทุกหน้า"),
                gr.update(minimum=1, maximum=total, value=1),
                gr.update(minimum=1, maximum=total, value=1),
                gr.update(minimum=1, maximum=total, value=total),
            )

        def on_mode_change(mode):
            return (
                gr.update(visible=(mode == "หน้าเดียว")),
                gr.update(visible=(mode == "ช่วงหน้า")),
            )

        file_input.change(
            fn=on_file_change,
            inputs=[file_input],
            outputs=[page_info, page_controls, page_mode, page_number, start_page, end_page],
        )

        page_mode.change(
            fn=on_mode_change,
            inputs=[page_mode],
            outputs=[single_page_row, range_page_row],
        )

        run_button.click(
            fn=ocr_app.process_document,
            inputs=[file_input, task_dropdown, page_mode, page_number, start_page, end_page],
            outputs=[image_gallery, result_state],
        ).then(
            fn=lambda s: s,
            inputs=[result_state],
            outputs=[result_output],
        )

    return demo

if __name__ == "__main__":
    demo = create_ui()
    demo.launch(share=False)
