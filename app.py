import base64
from io import BytesIO
import json
import os
from meta_prompt import get_prompt
from openai import OpenAI
from dotenv import load_dotenv
from utils import render_pdf_to_base64png, image_to_pdf, get_anchor_text
import gradio as gr
from PIL import Image

load_dotenv()

openai = OpenAI(base_url=os.getenv("TYPHOON_BASE_URL"), api_key=os.getenv("TYPHOON_API_KEY"))


def process_pdf(pdf_or_image_file, task_type):
    if pdf_or_image_file is None:
        return None, "No file uploaded"
    
    orig_filename = pdf_or_image_file.name
    ext = os.path.splitext(orig_filename)[1].lower()
    filename = orig_filename  # default to original file if PDF
    
    # If the file is not a PDF, assume it's an image and convert it to PDF.
    if ext not in [".pdf"]:
        filename = image_to_pdf(orig_filename)
        if filename is None:
            return None, "Error converting image to PDF"
    
    # Render the first page to base64 PNG and then load it into a PIL image.
    image_base64 = render_pdf_to_base64png(filename, 1, target_longest_image_dim=1800)
    image_pil = Image.open(BytesIO(base64.b64decode(image_base64)))
    
    # Extract anchor text from the PDF (first page)
    anchor_text = get_anchor_text(filename, 1, pdf_engine="pdfreport", target_length=8000)
    
    # Retrieve and fill in the prompt template with the anchor_text
    prompt_template_fn = get_prompt(task_type)
    PROMPT = prompt_template_fn(anchor_text)
    
    # Create a messages structure including text and image URL
    messages = [{
        "role": "user",
        "content": [
            {"type": "text", "text": PROMPT},
            {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{image_base64}"}},
        ],
    }]
    # send messages to openai compatible api
    response = openai.chat.completions.create(
        model="typhoon-ocr",
        messages=messages,
    )
    text_output = response.choices[0].message.content
    
    # Try to parse the output assuming it is a Python dictionary containing 'natural_text'
    try:
        json_data = json.loads(text_output)
        markdown_out = json_data.get('natural_text', "").replace("<figure>", "").replace("</figure>", "")
    except Exception as e:
        markdown_out = f"⚠️ Could not extract `natural_text` from output.\nError: {str(e)}"
    
    return image_pil, markdown_out


# Build the Gradio UI.
with gr.Blocks() as demo:
    title = gr.HTML("<h1>Typhoon OCR</h1>")
    with gr.Row():
        with gr.Column(scale=1):
            # Update file_types to accept PDF as well as common image formats.
            pdf_input = gr.File(label="📄 Upload PDF or Image (1 page only)", file_types=[".pdf", ".png", ".jpg", ".jpeg"])
            task_dropdown = gr.Dropdown(["default", "structure"], label="🎯 Select Task", value="default")
            run_button = gr.Button("🚀 Run")
            image_output = gr.Image(label="📸 Preview Image (Page 1)", type="pil")
        with gr.Column(scale=2):
            markdown_output = gr.Markdown(label='Markdown Result', show_label=True)

    
    # Connect the UI inputs to the processing function.
    run_button.click(
        fn=process_pdf,
        inputs=[pdf_input, task_dropdown],
        outputs=[image_output, markdown_output]
    )

# Launch the Gradio demo (temporary public share for 72 hours)
demo.launch(share=False)
