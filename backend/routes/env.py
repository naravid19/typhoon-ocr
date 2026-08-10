import os
import shutil
from pathlib import Path
from fastapi import APIRouter
from pydantic import BaseModel
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

def _update_env_var(env_path: str, key: str, value: str | None) -> None:
    if value is not None:
        set_key(env_path, key, value)
        os.environ[key] = value

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
                "TYPHOON_MAX_FILES": 10
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
            "TYPHOON_MAX_FILES": max_files
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
        
    services.ocr_service.reset_service()
        
    return {
        "success": True, 
        "data": {"message": "Environment variables updated"},
        "error": None
    }
