import base64
from io import BytesIO
import json
import os
from typing import List

from openai import OpenAI
from dotenv import load_dotenv
from typhoon_ocr import prepare_ocr_messages
import gradio as gr
from PIL import Image
from pypdf import PdfReader

load_dotenv()

openai = OpenAI(base_url=os.getenv("TYPHOON_BASE_URL"), api_key=os.getenv("TYPHOON_API_KEY"))

theme = gr.themes.Soft(
    primary_hue=gr.themes.Color(
        c50="#f7f7fd",
        c100="#dfdef8",
        c200="#c4c1f2",
        c300="#a29eea",
        c400="#8f8ae6",
        c500="#756fe0",
        c600="#635cc1",
        c700="#4f4a9b",
        c800="#433f83",
        c900="#302d5e",
        c950="#302d5e",
    ),
    secondary_hue="rose",
    neutral_hue="stone",
)


def _get_page_count(file_path: str) -> int:
    try:
        if file_path and file_path.lower().endswith(".pdf"):
            return len(PdfReader(file_path).pages)
    except Exception:
        pass
    return 1


def _parse_llm_output(text_output: str) -> str:
    try:
        data = json.loads(text_output)
        return (
            data.get("natural_text", "")
            .replace("<figure>", "")
            .replace("</figure>", "")
        )
    except Exception:
        # หากไม่ใช่ JSON ให้คืนค่าข้อความดิบทั้งหมด
        return text_output


def process_document(pdf_or_image_file, task_type, page_mode, page_number, start_page, end_page, progress=gr.Progress(track_tqdm=True)):
    if pdf_or_image_file is None:
        return [], "ยังไม่ได้อัปโหลดไฟล์"

    file_path = pdf_or_image_file.name
    is_pdf = file_path.lower().endswith(".pdf")
    total_pages = _get_page_count(file_path)

    # Determine pages to process
    if not is_pdf:
        selected_pages: List[int] = [1]
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

    for idx, p in enumerate(selected_pages, start=1):
        progress((idx, len(selected_pages)), desc=f"กำลังประมวลผลหน้า {p}/{total_pages}", unit="หน้า")

        # Prepare LLM messages for this page
        messages = prepare_ocr_messages(
            pdf_or_image_path=file_path,
            task_type=task_type,
            target_image_dim=1800,
            target_text_length=8000,
            page_num=p,
        )

        # Extract preview image from messages
        image_url = messages[0]["content"][1]["image_url"]["url"]
        image_base64 = image_url.split(",")[-1]
        images.append(Image.open(BytesIO(base64.b64decode(image_base64))))

        # Call the OCR model
        response = openai.chat.completions.create(
            model=os.getenv("TYPHOON_OCR_MODEL"),
            messages=messages,
            max_tokens=16384,
            extra_body={
                "repetition_penalty": 1.2,
                "temperature": 0.1,
                "top_p": 0.6,
            },
        )
        text_output = response.choices[0].message.content
        markdown_out = _parse_llm_output(text_output)
        parts.append(markdown_out.strip())

    progress(1.0, desc="เสร็จสิ้น", unit="หน้า")
    combined_markdown = "\n\n".join(parts)
    return images, combined_markdown


# Build the Gradio UI.
custom_css = """
html { scroll-behavior: smooth; }
.task-background { background: var(--block-background-fill) !important; }
.task-background > * { background: var(--block-background-fill) !important; }
.task-dropdown-info { padding: 0 16px; font-size: 12px; }
.scroll-output textarea { height: 360px !important; max-height: 60vh; overflow: auto !important; }
"""

with gr.Blocks(theme=theme, css=custom_css) as demo:
    gr.HTML(
        """
        <h1>Typhoon OCR</h1>
        <p style=\"margin: 4px 0 12px 0; color: var(--body-text-color);\">
            แปลงเอกสาร PDF / รูปภาพ เป็น Markdown อย่างสวยงาม รองรับเลือกหลายหน้า
        </p>
        """
    )

    with gr.Row():
        with gr.Column(scale=1):
            with gr.Tabs():
                with gr.TabItem("ไฟล์"):
                    file_input = gr.File(
                        label="อัปโหลดไฟล์ (PDF/PNG/JPG)",
                        file_types=[".pdf", ".png", ".jpg", ".jpeg"],
                    )

                    page_info = gr.Markdown(value="จำนวนหน้า: -")
                    page_mode = gr.Radio(
                        ["ทุกหน้า", "ช่วงหน้า", "หน้าเดียว"],
                        label="เลือกหน้า",
                        value="ทุกหน้า",
                    )
                    with gr.Row():
                        page_number = gr.Number(label="หน้าเดียว", value=1, minimum=1, step=1, visible=False)
                    with gr.Row():
                        start_page = gr.Number(label="เริ่มหน้า", value=1, minimum=1, step=1, visible=True)
                        end_page = gr.Number(label="ถึงหน้า", value=1, minimum=1, step=1, visible=True)
                    run_button = gr.Button("เริ่มประมวลผล", variant="primary")

                with gr.TabItem("พารามิเตอร์"):
                    with gr.Group(elem_classes=["task-background"]):
                        task_dropdown = gr.Radio(
                            ["default", "structure"],
                            label="โหมดการทำงาน",
                            value="default",
                        )
                        gr.HTML(
                            """
                            <p><b>default</b>: เหมาะกับเอกสารทั่วไป ตารางเป็น Markdown</p>
                            <p><b>structure</b>: เน้นโครงสร้างซับซ้อน ตารางเป็น HTML</p>
                            """,
                            elem_classes=["task-dropdown-info"],
                        )

        with gr.Column(scale=2):
            image_gallery = gr.Gallery(label="ตัวอย่างหน้า", height=240, preview=True)
            result_output = gr.Textbox(label="ผลลัพธ์", lines=18, interactive=False, show_copy_button=True, elem_classes=["scroll-output"])

    # Keep result text in state so result box doesn't show spinner during long run
    result_state = gr.State("")

    # Update controls when file changes
    def on_file_change(f):
        if f is None:
            return (
                gr.update(value="จำนวนหน้า: -"),
                gr.update(value="หน้าเดียว", interactive=False),
                gr.update(minimum=1, maximum=1, value=1, visible=False),
                gr.update(minimum=1, maximum=1, value=1, visible=False),
                gr.update(minimum=1, maximum=1, value=1, visible=False),
            )
        total = _get_page_count(f.name)
        is_pdf = f.name.lower().endswith(".pdf")
        return (
            gr.update(value=(f"จำนวนหน้า: {total} หน้า" if is_pdf else "ไฟล์รูปภาพ (1 หน้า)")),
            gr.update(value=("ทุกหน้า" if is_pdf else "หน้าเดียว"), interactive=is_pdf),
            gr.update(minimum=1, maximum=total, value=1, visible=False),
            gr.update(minimum=1, maximum=total, value=1, visible=False),
            gr.update(minimum=1, maximum=total, value=total, visible=False),
        )

    file_input.change(
        fn=on_file_change,
        inputs=[file_input],
        outputs=[page_info, page_mode, page_number, start_page, end_page],
    )

    # Toggle visibility based on selection mode
    def on_mode_change(mode, f):
        is_pdf = bool(f and f.name.lower().endswith(".pdf"))
        return (
            gr.update(visible=(not is_pdf) or mode == "หน้าเดียว"),
            gr.update(visible=is_pdf and mode == "ช่วงหน้า"),
            gr.update(visible=is_pdf and mode == "ช่วงหน้า"),
        )

    page_mode.change(
        fn=on_mode_change,
        inputs=[page_mode, file_input],
        outputs=[page_number, start_page, end_page],
    )

    # Connect the processing function: update gallery + markdown, then copy markdown to the box
    run_button.click(
        fn=process_document,
        inputs=[file_input, task_dropdown, page_mode, page_number, start_page, end_page],
        outputs=[image_gallery, result_state],
    ).then(
        fn=lambda s: s,
        inputs=[result_state],
        outputs=[result_output],
    )


# Launch the Gradio demo
demo.launch(share=False)
