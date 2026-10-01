#!/usr/bin/env python3
"""把 Vite 构建产物内联成单个自包含 HTML（兼容 Android WebView file:// 加载）。

Android WebView 在 file:// 协议下会拦截外部 ES module 脚本，因此必须把
JS/CSS 全部内联、并去掉 type="module"。

用法: python3 scripts/inline_game.py <dist目录> <输出.html>
"""
import re
import sys
from pathlib import Path

dist = Path(sys.argv[1]).resolve()
out = Path(sys.argv[2]).resolve()
html = (dist / "index.html").read_text(encoding="utf-8")


def inline_css(m: re.Match) -> str:
    css = (dist / m.group(1).lstrip("/")).read_text(encoding="utf-8")
    return f"<style>{css}</style>"


def inline_js(m: re.Match) -> str:
    js = (dist / m.group(1).lstrip("/")).read_text(encoding="utf-8")
    # 去掉模块标记，避免 file:// 下被当外部模块拦截
    return f"<script>{js}</script>"


html = re.sub(r'<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"[^>]*>', inline_css, html)
html = re.sub(r'<script[^>]*type="module"[^>]*src="([^"]+)"[^>]*>\s*</script>', inline_js, html)
html = re.sub(r'<script type="module"', '<script"', html)

out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(html, encoding="utf-8")
print(f"single-file html: {out} ({out.stat().st_size} bytes)")
