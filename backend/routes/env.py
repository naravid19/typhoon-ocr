import logging
import os
import shutil
from pathlib import Path
from typing import Literal
from fastapi import APIRouter
from pydantic import BaseModel, Field
from dotenv import dotenv_values, set_key
import services.ocr_service

router = APIRouter(prefix="/api/env", tags=["Environment"])

def get_env_path() -> Path:
    """Resolve the path to the .env file in the project root."""
    return Path(__file__).parent.parent.parent / ".env"

def get_template_path() -> Path:
    """Resolve the path to the .env.template file."""
    return Path(__file__).parent.parent.parent / ".env.template"

class EnvUpdate(BaseModel):
    base_url: str | None = None
    api_key: str | None = None
    model: str | None = None
    max_files: int | None = None
    # Throughput tuning (0 = unlimited for the rate limits)
    rate_limit_rpm: int | None = Field(default=None, ge=0, le=6000)
    rate_limit_rps: float | None = Field(default=None, ge=0, le=100)
    max_concurrency: int | None = Field(default=None, ge=1, le=64)
    first_pass_max_tokens: int | None = Field(default=None, ge=256, le=32768)
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] | None = None

def _update_env_var(env_path: str, key: str, value: str | None) -> None:
    if value is not None:
        set_key(env_path, key, value)
        os.environ[key] = value

def _tuning(file_values: dict) -> dict:
    """Throughput settings: the .env value if set, otherwise what the service would actually use."""
    effective = services.ocr_service.Config()

    def pick(key: str, default, cast):
        try:
            return cast(file_values[key]) if file_values.get(key) not in (None, "") else default
        except ValueError:
            return default

    return {
        "TYPHOON_RATE_LIMIT_RPM": pick("TYPHOON_RATE_LIMIT_RPM", effective.RATE_LIMIT_RPM, int),
        "TYPHOON_RATE_LIMIT_RPS": pick("TYPHOON_RATE_LIMIT_RPS", effective.RATE_LIMIT_RPS, float),
        "TYPHOON_MAX_CONCURRENCY": pick("TYPHOON_MAX_CONCURRENCY", effective.MAX_CONCURRENCY, int),
        "TYPHOON_FIRST_PASS_MAX_TOKENS": pick("TYPHOON_FIRST_PASS_MAX_TOKENS", effective.FIRST_PASS_MAX_TOKENS, int),
        "LOG_LEVEL": (file_values.get("LOG_LEVEL") or os.getenv("LOG_LEVEL") or "INFO").upper(),
    }

@router.get("/")
async def get_env():
    env_path = get_env_path()
    if not env_path.exists():
        return {
            "success": True,
            "data": {
                "TYPHOON_BASE_URL": "", 
                "TYPHOON_API_KEY_SET": False, 
                "TYPHOON_OCR_MODEL": "",
                "TYPHOON_MAX_FILES": 10,
                **_tuning({}),
            },
            "error": None
        }
    
    config = dotenv_values(env_path)
    api_key = config.get("TYPHOON_API_KEY", "")
    max_files_str = config.get("TYPHOON_MAX_FILES", "10")
    try:
        max_files = int(max_files_str)
    except ValueError:
        max_files = 10
    
    return {
        "success": True,
        "data": {
            "TYPHOON_BASE_URL": config.get("TYPHOON_BASE_URL", ""),
            "TYPHOON_API_KEY_SET": bool(api_key.strip()),
            "TYPHOON_OCR_MODEL": config.get("TYPHOON_OCR_MODEL", "typhoon-ocr"),
            "TYPHOON_MAX_FILES": max_files,
            **_tuning(config),
        },
        "error": None
    }

@router.post("/")
async def update_env(data: EnvUpdate):
    env_path = get_env_path()
    if not env_path.exists():
        template_path = get_template_path()
        if template_path.exists():
            shutil.copy2(template_path, env_path)
        else:
            env_path.touch()
        
    env_path_str = str(env_path)
    
    _update_env_var(env_path_str, "TYPHOON_BASE_URL", data.base_url)
    
    # Only update API key if a non-empty string is provided
    if data.api_key is not None and data.api_key.strip() != "":
        _update_env_var(env_path_str, "TYPHOON_API_KEY", data.api_key)
        
    _update_env_var(env_path_str, "TYPHOON_OCR_MODEL", data.model)
    
    if data.max_files is not None:
        _update_env_var(env_path_str, "TYPHOON_MAX_FILES", str(data.max_files))
        
    for key, value in (
        ("TYPHOON_RATE_LIMIT_RPM", data.rate_limit_rpm),
        ("TYPHOON_RATE_LIMIT_RPS", data.rate_limit_rps),
        ("TYPHOON_MAX_CONCURRENCY", data.max_concurrency),
        ("TYPHOON_FIRST_PASS_MAX_TOKENS", data.first_pass_max_tokens),
        ("LOG_LEVEL", data.log_level),
    ):
        _update_env_var(env_path_str, key, None if value is None else str(value))
    if data.log_level:
        logging.getLogger().setLevel(data.log_level)

    services.ocr_service.reset_service()

    return {
        "success": True, 
        "data": {"message": "Environment variables updated"},
        "error": None
    }
