## Typhoon OCR

### Install
```
pip install requirements.txt
# edit .env
```

### Start vllm
```
vllm serve scb10x/typhoon-ocr-7b --served-model-name typhoon-ocr --dtype bfloat16 --port 8101
```

#### Run gradio demo
```
python app.py
```