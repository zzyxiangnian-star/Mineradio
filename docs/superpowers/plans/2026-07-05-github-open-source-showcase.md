# Mineradio GitHub Open-Source Showcase Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 Mineradio v1.3.5 整理为可验证、可运行、展示完整的 GitHub 开源仓库更新，并推送至现有远端。

**Architecture:** 保留现有 Electron + Node.js + 单页渲染层结构，不重构播放器业务。工作集中在仓库卫生、启动与更新配置、真实截图素材、README 信息架构和发布验证上；所有展示内容从代码及用户提供的运行截图中取证。

**Tech Stack:** Electron、Node.js、HTML/CSS/JavaScript、Three.js、GSAP、NeteaseCloudMusicApi、MiMo 兼容 Chat Completions API、electron-builder、Markdown、Mermaid。

## Global Constraints

- 中文为主要文档语言，表达专业、自然，不虚构功能或状态。
- 保留现有 MIT 许可证与用户现有 v1.3.5 工作区改动。
- 不提交 Cookie、API Key、用户配置、缓存、安装目录或无关二进制文件。
- 三张功能图必须来自用户提供的真实运行截图。
- 不新增播放器业务功能，不重新设计应用界面。
- 验证通过后直接更新当前 `main` 分支对应的原 GitHub 仓库。

---

### Task 1: 仓库卫生与安全配置

**Files:**
- Modify: `.gitignore`
- Create: `.env.example`
- Remove from working tree: Electron 安装产物和 `.mineradio-install-root`

**Interfaces:**
- Consumes: 当前 Git 跟踪列表和 AI 配置读取规则。
- Produces: 只允许源码、文档、构建资源和安全示例进入提交的工作区。

- [ ] **Step 1: 修复并扩展忽略规则**

将无效的 `D:\MineradioCache\` glob 替换为通用缓存目录规则，增加 `.miss-ai-config.json`、Electron 根目录运行文件、`locales/`、`resources/` 和安装标记规则，同时保留源码所需的 `build/`。

- [ ] **Step 2: 增加安全环境变量示例**

创建 `.env.example`，仅列出空值或公开默认值：`MIMO_API_KEY`、`MIMO_BASE_URL`、`MIMO_MODEL`、`MIMO_AUTH_METHOD`、`MINERADIO_USER_DATA_DIR`。

- [ ] **Step 3: 清理误入根目录的安装产物**

只删除 Git 未跟踪且由 Electron 安装产生的 DLL、PAK、根目录 `index.html`、`locales/`、`resources/`、卸载器与安装标记；不碰 `public/`、`src/`、`build/` 或用户源码改动。

- [ ] **Step 4: 验证敏感信息与状态**

运行 `git status --short` 和 `git ls-files`，确认 `.kugou-cookie`、`.miss-ai-config.json`、`.env`、安装产物未进入跟踪列表。

### Task 2: 启动、更新与版本配置

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Consumes: `src/desktop/main.js` 的 Electron 入口和当前 GitHub 远端。
- Produces: `npm start` 开发启动接口，以及指向 `zzyxiangnian-star/Mineradio` 的更新元数据。

- [ ] **Step 1: 增加启动脚本和开发依赖**

在 `scripts` 中增加 `"start": "electron ."`，并把 Electron 与 electron-builder 固定为锁文件中已使用的开发依赖，保证克隆后可启动和构建。

- [ ] **Step 2: 对齐自动更新仓库**

把 `mineradio.update.owner` 从旧值修正为 `zzyxiangnian-star`，仓库名保持 `Mineradio`。

- [ ] **Step 3: 重建并校验锁文件**

运行 `npm install --package-lock-only`，再用 Node.js 加载 `package.json`，确认 JSON 有效、版本为 1.3.5、启动和构建脚本存在。

### Task 3: README 展示素材

**Files:**
- Create: `docs/images/logo.svg`
- Create: `docs/images/preview.png`
- Create: `docs/images/screenshot-home.png`
- Create: `docs/images/screenshot-feature-1.png`
- Create: `docs/images/screenshot-feature-2.png`

**Interfaces:**
- Consumes: `build/icon.png` 和用户提供的三张真实截图。
- Produces: README 可通过仓库相对路径加载的展示素材。

- [ ] **Step 1: 创建展示目录并复制截图**

首页截图保存为 `screenshot-home.png`，AI DJ 对话保存为 `screenshot-feature-1.png`，账号信息保存为 `screenshot-feature-2.png`；保留原始画面比例与内容。

- [ ] **Step 2: 生成主预览图**

由首页真实截图生成适合 README 顶部展示的 `preview.png`，不叠加虚构界面，仅做画布与压缩优化。

- [ ] **Step 3: 制作 SVG Logo**

将现有原创应用图标作为视觉依据，制作简洁的唱片/声波主题 SVG；不得使用音乐平台品牌标志。

- [ ] **Step 4: 验证素材**

检查五个文件存在、PNG 可解码、尺寸合理、SVG 可解析，README 不引用绝对本地路径。

### Task 4: 开源规范文档

**Files:**
- Create: `CONTRIBUTING.md`
- Create: `CHANGELOG.md`

**Interfaces:**
- Consumes: 当前 GitHub 仓库、v1.3.3 标签和 v1.3.5 工作区版本。
- Produces: Issue/PR 流程与可追溯版本变化说明。

- [ ] **Step 1: 编写贡献指南**

说明提 Issue 前检查、分支和提交建议、本地验证命令、PR 描述要求、敏感信息禁令和第三方音乐服务合规注意事项。

- [ ] **Step 2: 编写更新日志**

按 Keep a Changelog 风格记录 v1.3.5 的首页字体与 AI DJ 壁纸设置、仓库展示与发布配置改进，并保留 v1.3.3 的已有发布节点。

- [ ] **Step 3: 文档自检**

扫描占位符、绝对路径、虚构链接和真实密钥，保证文档可直接发布。

### Task 5: 重写 README

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: Tasks 1–4 的命令、配置、截图和仓库路径，以及已核验源码功能。
- Produces: GitHub 仓库首页完整展示文档。

- [ ] **Step 1: 重建顶部展示区**

加入居中 Logo、项目名、准确的一句话简介、Electron/Node.js/Three.js/License/版本徽章、章节导航和 `preview.png`。

- [ ] **Step 2: 编写项目简介与功能亮点**

用代码可证实的能力描述多音源、AI DJ、音频可视化、3D 歌单架、桌面歌词、动态壁纸和个性化设置，并同时说明技术实现与用户价值。

- [ ] **Step 3: 编排运行截图**

首页图独立展示；AI DJ 和账号管理图用双列表格排列，每张图下写明功能和真实运行状态。

- [ ] **Step 4: 补齐架构、技术栈与使用文档**

加入真实 Mermaid 数据流、分类技术栈、克隆/安装/配置/启动/构建命令、精简目录树、配置项说明、Roadmap、贡献入口和 MIT License。

- [ ] **Step 5: 校验 README**

检查所有相对链接存在、代码块闭合、Mermaid 节点真实、徽章 URL 与远端一致、没有在线 Demo 或 CI 等虚构状态。

### Task 6: 运行与构建验证

**Files:**
- Test: `test-ai-modules.js`
- Verify: `package.json`, `src/desktop/main.js`, `server.js`, `public/index.html`

**Interfaces:**
- Consumes: 已整理的依赖、启动脚本与当前 v1.3.5 源码。
- Produces: 可引用于发布结论的本地验证证据。

- [ ] **Step 1: 安装依赖**

运行 `npm install`，预期依赖安装成功且锁文件稳定。

- [ ] **Step 2: 运行 AI 模块测试**

运行 `node test-ai-modules.js`，预期退出码为 0；如失败，记录具体断言或环境依赖。

- [ ] **Step 3: 启动 Electron 应用**

运行 `npm start`，确认本地服务监听、主窗口进程启动且无立即崩溃，然后正常终止验证进程。

- [ ] **Step 4: 构建 Windows 安装包**

运行 `npm run build`，预期在 `dist/` 生成 v1.3.5 NSIS 安装包；构建产物保持忽略状态。

- [ ] **Step 5: 最终安全检查**

扫描待提交差异中的常见 API Key、Cookie、Authorization 和本地绝对路径模式；只保留公开默认 URL 与文档示例变量名。

### Task 7: 提交并更新原 GitHub 仓库

**Files:**
- Stage: 本计划列出的源码、文档与展示素材

**Interfaces:**
- Consumes: Tasks 1–6 的已验证成果。
- Produces: `origin/main` 上可见的 Mineradio v1.3.5 开源展示更新。

- [ ] **Step 1: 审查最终差异**

确认没有误删用户源码，没有安装产物或敏感文件，README 图片及命令与仓库内容一致。

- [ ] **Step 2: 创建发布更新提交**

将现有 v1.3.5 功能改动与开源展示更新提交为清晰的发布提交，不改写已有历史。

- [ ] **Step 3: 推送当前 main**

运行 `git push origin main`，确认远端接受设计提交和发布更新提交。

- [ ] **Step 4: 核对远端状态**

确认本地 `main` 与 `origin/main` 同步，并输出修改文件、素材、README 模块、验证结果、待用户填写项和敏感信息检查结论。
