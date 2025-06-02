from typhoon_ocr import ocr_document
import os

# please set env TYPHOON_API_KEY or OPENAI_API_KEY to use this function

script_dir = os.path.dirname(os.path.abspath(__file__))
image_path = os.path.join(script_dir, "test.png")

markdown = ocr_document(image_path)
print(markdown)
