from __future__ import annotations

import base64
import hmac
import os
import shutil
import tempfile
import urllib.request
import zipfile
from pathlib import Path

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

from sl2modgen.build import build_project
from sl2modgen.spec import SpecError


app = FastAPI(title="SL2Together Mod Builder", version="0.1.0")


class BuildRequest(BaseModel):
    jobId: str = Field(min_length=1, max_length=80)
    spec: dict


def _reference_dir() -> Path:
    configured = os.environ.get("STS2_DLL_DIR", "").strip()
    if configured:
        return Path(configured)
    return Path("/tmp/sl2-reference-kit")


def _download_reference_kit(target: Path) -> None:
    url = os.environ.get("STS2_REFERENCE_URL", "").strip()
    if not url:
        raise RuntimeError("缺少 STS2_DLL_DIR，也没有配置 STS2_REFERENCE_URL。")
    archive = target.with_suffix(".zip")
    target.mkdir(parents=True, exist_ok=True)
    urllib.request.urlretrieve(url, archive)
    with zipfile.ZipFile(archive) as zip_file:
        zip_file.extractall(target)
    archive.unlink(missing_ok=True)


def ensure_reference_kit() -> Path:
    target = _reference_dir()
    required = ("sts2.dll", "GodotSharp.dll", "0Harmony.dll")
    if all((target / name).exists() for name in required):
        return target
    _download_reference_kit(target)
    missing = [name for name in required if not (target / name).exists()]
    if missing:
        raise RuntimeError(f"引用目录缺少文件：{', '.join(missing)}")
    return target


def _authorize(authorization: str | None, mod_build_token: str | None) -> None:
    expected = os.environ.get("MOD_BUILD_TOKEN", "")
    if not expected:
        raise HTTPException(status_code=503, detail="MOD_BUILD_TOKEN 未配置。")
    supplied = (mod_build_token or "").strip()
    if authorization and authorization.startswith("Bearer "):
        supplied = supplied or authorization.removeprefix("Bearer ").strip()
    if not supplied or not hmac.compare_digest(supplied, expected):
        raise HTTPException(status_code=401, detail="未授权。")


def _read_artifact(path: Path) -> str:
    maximum = int(os.environ.get("MAX_ARTIFACT_BYTES", str(20 * 1024 * 1024)))
    size = path.stat().st_size
    if size > maximum:
        raise HTTPException(status_code=413, detail=f"产物超过限制：{path.name} {size} bytes")
    return base64.b64encode(path.read_bytes()).decode("ascii")


@app.get("/health")
def health() -> dict:
    godot_bin = os.environ.get("GODOT_BIN", "/usr/local/bin/godot")
    return {
        "ok": True,
        "godot": godot_bin,
        "dotnet": shutil.which("dotnet"),
    }


@app.post("/build")
def build(
    request: BuildRequest,
    authorization: str | None = Header(default=None),
    x_mod_build_token: str | None = Header(default=None, alias="X-Mod-Build-Token"),
) -> dict:
    _authorize(authorization, x_mod_build_token)
    reference_dir = ensure_reference_kit()
    godot_bin = Path(os.environ.get("GODOT_BIN", "/usr/local/bin/godot"))
    if not godot_bin.exists():
        raise HTTPException(status_code=503, detail=f"Godot 不存在：{godot_bin}")

    work_root = Path(os.environ.get("MOD_BUILD_WORK_DIR", "/tmp/sl2-mod-builder"))
    work_root.mkdir(parents=True, exist_ok=True)
    output_dir = Path(tempfile.mkdtemp(prefix=f"{request.jobId}-", dir=work_root))
    try:
        result = build_project(
            request.spec,
            output_dir,
            reference_dir,
            godot_bin,
        )
        mod_zip = Path(result["modZip"])
        source_zip = Path(result["sourceZip"])
        return {
            "ok": True,
            "jobId": request.jobId,
            "manifest": result["manifest"],
            "modZipBase64": _read_artifact(mod_zip),
            "sourceZipBase64": _read_artifact(source_zip),
            "modZipSize": mod_zip.stat().st_size,
            "sourceZipSize": source_zip.stat().st_size,
        }
    except SpecError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    except Exception as error:
        print(f"build_error jobId={request.jobId} error={error}")
        raise HTTPException(status_code=500, detail="构建失败。") from error
    finally:
        shutil.rmtree(output_dir, ignore_errors=True)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        app,
        host="0.0.0.0",
        port=int(os.environ.get("PORT", "8080")),
        log_level="info",
    )
