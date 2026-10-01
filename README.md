# 坦克大战 Tank Battle

经典红白机风格的复古像素坦克大战，网页版，可安装到 Android / iOS 桌面，**完全离线可玩**。

## 玩法

- **单人闯关**：驾驶黄色坦克消灭全部敌军即可过关，守护底部金色基地（被毁即失败）
- **8 个手工关卡**：砖墙阵地、钢铁走廊、河流、丛林、基地堡垒……通关后可开启敌军强化的二周目
- **4 种敌军 AI**：普通 / 快速 / 火力 / 装甲（多血变色），会主动逼近玩家与基地
- **6 种道具**：火力升星、防护罩、全屏炸弹、冻结、1UP、基地钢墙
- **地形规则**：砖墙可击破、钢墙仅满级火力可破、河流不可通行、草丛可隐蔽

## 操作

| 平台 | 移动 | 开火 | 暂停 | 静音 |
| ---- | ---- | ---- | ---- | ---- |
| 手机 | 左下方向键（支持斜向换手） | 右下红色按钮（按住连发） | 顶栏 ⏸ | 顶栏 🔊 |
| 电脑 | WASD / 方向键 | J / 空格 | P | M |

横屏时自动切换为「画布 + 操控」左右分栏。

## 安装到手机桌面（PWA）

游戏是标准 PWA（含 manifest、Service Worker 与全套图标），部署到任意静态托管后：

1. Android：用 Chrome 打开链接 → 浏览器菜单 →「安装应用 / 添加到主屏幕」
2. iOS：用 Safari 打开 → 分享 →「添加到主屏幕」

安装后全屏运行、断网可玩。

## 技术

- React 18 + TypeScript + Vite + Tailwind CSS
- 游戏本体：Canvas 2D 像素渲染 + 自研游戏引擎（固定步长逻辑循环）
- 音效：Web Audio API 现场合成，零音频资源文件
- PWA：离线缓存（Service Worker）+ 安装清单
- 最高分/静音设置：localStorage 本地保存

## 本地开发

```bash
npm install
npm run dev      # 开发预览
npm run build    # 产物输出到 dist/
```

PWA 图标由脚本代码生成（无需提交二进制文件）：

```bash
pip install pillow
python3 scripts/make_icons.py   # 生成到 public/icons/
```

## 部署到 GitHub Pages

仓库已附带 `.github/workflows/deploy.yml`：推送到 `main` 分支即自动构建并发布到 Pages。
首次使用需在仓库 Settings → Pages 中将 Source 设为「GitHub Actions」。

## 许可

MIT
