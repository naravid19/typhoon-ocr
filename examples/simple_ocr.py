from typhoon_ocr import ocr_document

# please set env TYPHOON_OCR_API_KEY or OPENAI_API_KEY to use this function
markdown = ocr_document("/Users/kunato/typhoon-applications/typhoon-ocr/examples/test.png")
print(markdown)