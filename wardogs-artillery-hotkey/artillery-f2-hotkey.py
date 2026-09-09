# -*- coding: utf-8 -*-
"""USSMAX 射击播报 F2 热键助手（可打包为单文件 exe，配置可嵌入 exe 末尾）"""

from __future__ import annotations

import json
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

from pynput import keyboard

COOLDOWN_SEC = 3.0
CFG_MARKER = b"\n__USS_ARTY_CFG_V1__\n"
_last_fire = 0.0
_runtime_cfg: dict | None = None


def app_dir() -> Path:
    if getattr(sys, "frozen", False):
        return Path(sys.executable).resolve().parent
    return Path(__file__).resolve().parent


def load_embedded_cfg() -> dict | None:
    if not getattr(sys, "frozen", False):
        return None
    try:
        data = Path(sys.executable).read_bytes()
    except Exception:
        return None
    idx = data.rfind(CFG_MARKER)
    if idx < 0:
        return None
    raw = data[idx + len(CFG_MARKER) :].decode("utf-8", errors="ignore").strip()
    if not raw:
        return None
    # Tolerate trailing whitespace / extra bytes after JSON
    decoder = json.JSONDecoder()
    obj, _ = decoder.raw_decode(raw)
    if not isinstance(obj, dict):
        return None
    return obj


def load_file_cfg(path: Path) -> dict:
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise ValueError("config must be a JSON object")
    return data


def resolve_cfg() -> tuple[dict, str]:
    embedded = load_embedded_cfg()
    if embedded:
        return embedded, "已嵌入本程序"

    if len(sys.argv) > 1:
        path = Path(sys.argv[1]).expanduser()
        return load_file_cfg(path), str(path)

    here = app_dir() / "artillery-hotkey.json"
    if here.is_file():
        return load_file_cfg(here), str(here)

    home = Path.home() / ".ussmax" / "artillery-hotkey.json"
    if home.is_file():
        return load_file_cfg(home), str(home)

    raise FileNotFoundError("no config")


def fire_once() -> None:
    global _last_fire, _runtime_cfg
    now = time.monotonic()
    if now - _last_fire < COOLDOWN_SEC:
        return
    cfg = _runtime_cfg
    if not cfg:
        print("[失败] 无配置")
        return
    if not cfg.get("enabled"):
        print("[跳过] 网页未开启射击播报，请开启后重新下载助手")
        return
    api = str(cfg.get("apiBase") or "").rstrip("/")
    token = str(cfg.get("token") or "").strip()
    if not api or not token:
        print("[失败] 配置无效，请回网页重新下载助手")
        return
    url = f"{api}/api/me/oopz/artillery-fire"
    payload = json.dumps({"repeat": 1}, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=payload,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {token}",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=12) as resp:
            body = resp.read().decode("utf-8", errors="replace")
            print(f"[成功] {body[:160]}")
            _last_fire = now
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        print(f"[失败] HTTP {exc.code} {detail[:200]}")
        # 冷却由服务端按用户限制；仅成功入队后本地也挡一下连按
        if exc.code != 429:
            pass
        else:
            _last_fire = now
    except Exception as exc:
        print(f"[失败] {exc}")


def main() -> int:
    global _runtime_cfg
    print("USSMAX 射击播报热键")
    try:
        cfg, source = resolve_cfg()
        _runtime_cfg = cfg
        print(f"配置来源: {source}")
        print(f"接口: {cfg.get('apiBase')}")
    except Exception:
        print()
        print("本程序还没有你的登录配置。")
        print("请打开网站「WARDOGS炮兵计算」→ 开启射击播报 → 再点「下载 F2 助手」")
        print("（网页会生成已含你账号的 exe，下载后直接打开即可）")
        try:
            input("按回车退出…")
        except EOFError:
            pass
        return 1

    print("已监听 F2。保持此窗口打开，进游戏按 F2 播报。Ctrl+C 退出。")

    def on_press(key):
        try:
            if key == keyboard.Key.f2:
                fire_once()
        except Exception as exc:
            print(f"[错误] {exc}")

    with keyboard.Listener(on_press=on_press) as listener:
        listener.join()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
