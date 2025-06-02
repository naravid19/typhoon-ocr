from setuptools import setup, find_packages

with open("README.md", "r", encoding="utf-8") as fh:
    long_description = fh.read()

setup(
    name="typhoon-ocr",
    version="0.3.8",
    author="Typhoon OCR Contributors",
    author_email="contact@opentyphoon.ai",
    description="A package for extracting structured content from PDFs and images using Typhoon OCR models",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://github.com/scb-10x/typhoon-ocr",
    packages=find_packages(),
    classifiers=[
        "Programming Language :: Python :: 3",
        "License :: OSI Approved :: Apache Software License",
        "Operating System :: OS Independent",
    ],
    python_requires=">=3.7",
    install_requires=[
        "ftfy",
        "pypdf",
        "pillow",
        "openai",
    ],
    extras_require={
        "dev": [
            "pytest",
            "black",
            "flake8",
        ],
        "app": [
            "gradio",
            "python-dotenv",
        ],
    },
) 