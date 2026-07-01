# Mineradio

沉浸式音乐播放器，融合天气电台、歌词舞台、粒子视觉和 3D 歌单架。

## 功能特性

- **粒子音乐可视化** — 实时音频驱动粒子特效
- **桌面歌词** — 独立悬浮歌词窗口，支持锁定穿透
- **壁纸模式** — 全屏粒子视觉壁纸
- **天气电台** — 基于天气自动推荐音乐氛围
- **3D 歌单架** — Three.js 驱动的立体歌单浏览
- **AI 推荐** — 智能音乐推荐（MiMo/自定义 AI 模型）
- **多音源** — 支持网易云音乐、QQ 音乐、汽水音乐
- **DJ 分析** — 播客/电台节目自动分析

## 技术栈

- **Electron** — 桌面应用框架
- **Node.js + Express** — 后端 API 服务
- **NeteaseCloudMusicApi** — 网易云音乐 API
- **Three.js** — 3D 可视化
- **GSAP** — 动画引擎
- **mpg123-decoder** — 音频解码

## 开发

### 环境要求

- Node.js >= 18
- npm >= 9

### 安装依赖

```bash
npm install
```

### 启动开发

```bash
npm start
```

### 构建安装包

```bash
# 构建 Windows NSIS 安装包
npm run build

# 构建便携版
npm run build:portable
```

构建产物在 `dist/` 目录下。

## 项目结构

```
Mineradio/
├── package.json           # 项目配置 + electron-builder 配置
├── server.js              # Node.js 后端（网易云/QQ音乐 API 代理）
├── build/                 # electron-builder 构建资源
│   ├── icon.ico           # 应用图标
│   ├── installer.nsh      # NSIS 安装器自定义脚本
│   ├── after-pack.js      # 打包后钩子
│   └── installerHeader/Sidebar.bmp
├── public/                # 前端静态资源
│   ├── index.html         # 主界面
│   ├── desktop-lyrics.html
│   ├── wallpaper.html
│   └── vendor/            # 第三方库 (Three.js, GSAP)
└── src/
    ├── desktop/           # Electron 主进程
    │   ├── main.js
    │   ├── preload.js
    │   └── overlay-preload.js
    ├── dj-analyzer.js     # 播客分析模块
    └── lib/
        ├── qishui.js      # 汽水音乐支持
        └── ai/            # AI 推荐模块
```

## License

[MIT](LICENSE)
