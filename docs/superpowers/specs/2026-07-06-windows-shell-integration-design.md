# Mineradio Windows 桌面外壳集成设计

日期：2026-07-06

## 背景

Mineradio 已经是 Electron 桌面应用，现有主进程在 `src/desktop/main.js` 中创建托盘图标，并支持关闭到托盘、桌面歌词、音乐桌面、全局快捷键等桌面能力。播放器核心状态和操作集中在 `public/index.html`，已有 `playQueue`、`currentIdx`、`playing`、`playMode`、喜欢状态、桌面歌词状态和音乐桌面状态。

本次优化目标是让 Mineradio 在 Windows 托盘和任务栏中的体验接近 QQ 音乐和网易云音乐：

- 托盘右键菜单接近网易云音乐截图中的浅色自绘菜单。
- 任务栏悬停预览优先追求 QQ 音乐截图中的小播放器卡片感。
- 不重写播放逻辑，不复制播放器状态，只把现有播放器状态映射到 Windows 外壳。

## 范围

### 托盘菜单

新增自绘托盘菜单窗口，右键托盘图标时显示：

- 顶部当前歌曲行：音乐图标、当前歌曲名，长标题省略；无歌曲时显示 `Mineradio`。
- 快捷控制区：上一首、播放/暂停、下一首、喜欢。
- 菜单项：
  - 播放模式，带子菜单：顺序循环、随机播放、单曲循环。
  - 完整模式：显示或恢复主窗口。
  - 开启音乐桌面：切换现有 `wallpaperMode`。
  - 打开桌面歌词：切换现有 `desktopLyrics`。
  - 设置：保留入口，本次不实现设置页；点击后给出轻提示或关闭菜单。
  - 退出：真正退出应用。
- 菜单视觉接近网易云截图：白色面板、圆角、细分割线、灰蓝图标、状态高亮、舒适行高、右侧箭头。
- 点击外部、窗口失焦、再次右键托盘时关闭菜单。
- 在多显示器和屏幕边缘场景下自动调整位置，避免菜单超出工作区。

### 任务栏预览

任务栏走“相似优先”：

- 使用 Windows 原生 `setThumbarButtons` 提供上一首、播放/暂停、下一首按钮。
- 播放状态变化时更新播放/暂停按钮图标。
- 歌曲切换时更新窗口标题、任务栏提示和相关状态。
- 在主窗口内新增任务栏预览专用区域，包含应用图标、歌曲名、封面、上一首、播放/暂停、下一首，供 Windows 缩略图尽量截出类似 QQ 音乐的小播放器卡片。
- 如果 Electron 或 Windows 对缩略图裁剪、隐藏区域渲染、DPI 或任务栏策略的表现不稳定，则降级为系统缩略图 + 原生任务栏按钮 + 标题同步。

## 非目标

- 不实现新的设置中心。
- 不重写播放器播放、队列、喜欢、歌词或音乐桌面的核心逻辑。
- 不要求非 Windows 平台拥有相同任务栏预览效果；非 Windows 平台保持现有能力或自然降级。
- 不引入 native addon 或 C++ 扩展来强行接管 Windows 任务栏缩略图。

## 架构

新增一个“桌面外壳层”，由主播放器页面、preload 桥接、主进程、托盘菜单页面四部分组成。

### 1. Renderer 状态上报

`public/index.html` 新增桌面外壳状态生成和推送逻辑。状态来自现有变量和函数：

- 当前歌曲：`playQueue[currentIdx]`、`currentDesktopSongMeta()`、`songCoverSrc()`。
- 播放状态：`playing` 和 `audio.paused`。
- 喜欢状态：`isSongLiked(currentCoverSong())`。
- 播放模式：`playMode`，取值 `loop`、`shuffle`、`single`。
- 桌面歌词：`fx.desktopLyrics`。
- 音乐桌面：`fx.wallpaperMode`。
- 主窗口模式：是否可认为处于完整模式由主进程窗口显示状态判断；托盘菜单中的“完整模式”动作为显示主窗口。

推送时机：

- 播放、暂停、上一首、下一首、歌曲切换后。
- 喜欢状态变化后。
- 播放模式变化后。
- 桌面歌词或音乐桌面开关变化后。
- 页面加载完成后推送一次初始状态。

推送需要节流，避免进度或歌词高频更新带动托盘菜单刷新。桌面外壳状态只关心低频结构状态，不包含歌词逐字进度。

### 2. Preload 桥接

`src/desktop/preload.js` 在 `window.desktopWindow` 下新增能力：

- `updateShellState(payload)`：渲染层向主进程上报桌面外壳状态。
- `onShellCommand(callback)`：主进程向播放器发送命令。
- `notifyShellCommandResult(payload)`：可选，用于托盘菜单显示失败或保留入口提示。

桥接只传可序列化 JSON，不暴露 Node 能力。

### 3. 主进程状态与命令分发

`src/desktop/main.js` 新增 `desktopShellState`，保存最近一次上报：

- `title`
- `artist`
- `cover`
- `playing`
- `liked`
- `playMode`
- `desktopLyrics`
- `wallpaperMode`
- `hasTrack`
- `updatedAt`

主进程负责：

- 创建和定位自绘托盘菜单窗口。
- 将最新状态发送给托盘菜单窗口。
- 根据最新状态更新任务栏按钮和窗口标题。
- 把托盘菜单或任务栏按钮点击转成命令，发送给主播放器页面。
- 在主窗口不存在或已销毁时，优先创建或恢复主窗口，再处理需要播放器页面执行的命令。

命令集合：

- `prev`
- `togglePlay`
- `next`
- `toggleLike`
- `setPlayMode`
- `showMain`
- `toggleWallpaper`
- `toggleDesktopLyrics`
- `settings`
- `quit`

命令映射到现有播放器函数：

- `prev` -> `prevTrack()`
- `togglePlay` -> `togglePlay()`
- `next` -> `nextTrack()`
- `toggleLike` -> `toggleLikeCurrent()`
- `setPlayMode` -> 设置 `playMode` 并调用 `updatePlayModeButton(true)`，再同步状态
- `toggleWallpaper` -> `toggleFx('wallpaperMode')`
- `toggleDesktopLyrics` -> `toggleFx('desktopLyrics')`
- `settings` -> 本次保留入口，显示“设置中心开发中”或关闭菜单
- `showMain` -> 主进程显示或恢复主窗口
- `quit` -> 主进程设置 `isQuitting = true` 后退出

### 4. 自绘托盘菜单窗口

新增 `public/tray-menu.html`，通过专用 preload 或现有安全桥接与主进程通信。

窗口属性建议：

- `frame: false`
- `transparent: true`
- `resizable: false`
- `show: false`
- `skipTaskbar: true`
- `alwaysOnTop: true`
- `focusable: true`

菜单窗口只渲染菜单，不直接访问播放器状态。它接收主进程发送的 `desktopShellState`，点击按钮时发送命令给主进程。

定位规则：

- 优先使用 `tray.getBounds()`。
- 根据托盘位置和 `screen.getDisplayMatching()` 找到对应显示器工作区。
- 默认把菜单放在托盘图标上方或旁边。
- 如果右侧、底部或顶部溢出工作区，则向内翻转或贴边。

## UI 设计

托盘菜单宽度约 240px 至 270px，高度随内容固定在约 410px 内。

视觉原则：

- 面板背景：接近白色。
- 文字：主文字深灰，辅助文字灰蓝。
- 图标：灰蓝色；喜欢状态为柔和红色。
- 分割线：浅灰细线。
- 控制按钮：图标按钮，播放按钮视觉权重更高。
- 子菜单：可采用右侧浮出的第二个小面板，也可在主菜单内展开。优先采用右侧浮出；屏幕边缘时改为左侧或内嵌展开。

任务栏预览卡片：

- 卡片采用浅色、圆角、紧凑布局。
- 顶部：应用图标 + 歌曲名。
- 中部：封面图。
- 底部：上一首、播放/暂停、下一首。
- 无封面时使用 Mineradio 图标或默认封面。

## 数据流

1. 播放器页面状态变化。
2. `index.html` 生成桌面外壳状态。
3. `preload.js` 调用 IPC 上报到主进程。
4. `main.js` 保存 `desktopShellState`。
5. `main.js` 更新任务栏按钮和标题。
6. 如果托盘菜单打开，`main.js` 推送状态给 `tray-menu.html`。
7. 用户点击托盘菜单或任务栏按钮。
8. `main.js` 收到命令。
9. `main.js` 对主进程命令直接执行；对播放器命令发送给 `index.html`。
10. `index.html` 调用现有函数完成操作，并重新上报状态。

## 错误处理与降级

- 无当前歌曲：禁用上一首、下一首、喜欢；播放按钮仅在队列存在时可用。
- 封面为空或加载失败：使用应用图标或默认占位。
- 主窗口被隐藏：命令仍发送到页面；如果页面不存在则先创建主窗口。
- 托盘菜单窗口创建失败：降级为 Electron 原生 `Menu`，保留显示主窗口和退出。
- 任务栏预览增强失败：保留 `setThumbarButtons` 和窗口标题同步。
- 非 Windows 平台：保留现有托盘行为或使用简化菜单，不启用 Windows 任务栏增强。
- 设置入口：不进入不存在页面，避免误导；显示轻提示或关闭菜单。

## 测试与验收

手动验收：

- 启动应用后托盘图标正常出现。
- 右键托盘图标显示自绘菜单，样式接近网易云截图。
- 播放歌曲后，托盘顶部显示当前歌曲名。
- 从托盘执行上一首、播放/暂停、下一首，主播放器状态正确变化。
- 从托盘切换喜欢状态，按钮状态与主播放器一致。
- 从托盘切换播放模式，顺序循环、随机播放、单曲循环状态正确显示。
- 点击完整模式时，隐藏或最小化的主窗口会恢复显示。
- 从托盘开启或关闭音乐桌面和桌面歌词，现有功能正常响应。
- 点击设置入口不会报错。
- 点击退出后应用真正退出，托盘图标消失。
- 任务栏悬停时能看到尽量接近 QQ 音乐的小播放器预览；至少能看到原生上一首、播放/暂停、下一首按钮。
- 多显示器、任务栏位于底部或侧边时，托盘菜单不超出屏幕边缘。

工程验证：

- `npm start` 能启动应用。
- Windows 主流程无主进程异常日志。
- 打包配置不遗漏新增 `public/tray-menu.html`。

## 实施顺序

1. 增加桌面外壳状态上报和命令接收桥接。
2. 在主进程保存状态并实现命令分发。
3. 实现任务栏按钮和标题同步。
4. 实现自绘托盘菜单窗口、定位和失焦关闭。
5. 实现播放模式子菜单和状态高亮。
6. 实现任务栏预览卡片增强和降级逻辑。
7. 做 Windows 手动验收和构建检查。
