# 更新日志

本文件记录 Mineradio 当前维护分支的重要变化。格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/)。

## [1.4.0] - 2026-07-10

### 新增

- 增加 Windows 任务栏音乐卡片，将当前歌曲、封面和播放状态同步到缩略图预览。
- 增加基于 Node-API 的任务栏原生模块及像素桥接，并提供 Electron ABI 加载测试。
- 支持导入网易云音乐、QQ 音乐、酷狗音乐和汽水音乐歌单链接。
- 增加 Music Soul 聊天区域的独立壁纸选择、保存和恢复能力。
- 增加面板布局、歌单模型、酷狗匹配、歌单导入和更新元数据的自动化测试。

### 改进

- 歌单详情改为在左侧歌单卡片内行内展开，减少重复节点并改善长标题、滚动和返回顶部体验。
- 统一酷狗歌曲字段，改进标题、歌手、专辑、时长、封面和可播放信息匹配。
- 细分酷狗登录、VIP、版权和歌曲地址不可用提示，并改善自动换源反馈。
- 完善在线更新的版本比较、GitHub Releases 元数据、镜像地址、下载进度、失败状态和安装器打开流程。
- 优化 Music Soul 面板触发区域和桌面端布局辅助逻辑。

### 工程

- 应用版本更新为 `1.4.0`。
- 新增 `npm test` 与 `npm run rebuild:native` 脚本。
- electron-builder 配置加入任务栏原生模块源码和 `.node` 文件解包规则。
- 扩展本地运行时、原生编译目录、Cookie、缓存和更新产物的忽略规则。

## [1.3.5] - 2026-07-05

### 新增

- 增加现代、柔和、科技三种界面字体主题。
- 支持为首页 Music Soul / AI DJ 展示栏设置独立壁纸。
- 增加 GitHub 仓库预览、功能截图、SVG Logo、贡献指南和环境变量示例。

### 改进

- 完善 Windows NSIS 安装包与便携版构建配置。
- 将自动更新仓库配置与当前 GitHub 仓库对齐。
- 补充项目功能、技术架构、运行效果和源码启动说明。

### 安全

- 扩展 Cookie、AI 本地配置、缓存和 Electron 安装产物的忽略规则。

## [1.3.3] - 2026-07-04

### 新增

- 完成面向开源发布的 Mineradio v1.3.3 主要功能整理。
- 增加 electron-builder Windows 安装程序配置。

[1.4.0]: https://github.com/zzyxiangnian-star/Mineradio/compare/v1.3.5...HEAD
[1.3.5]: https://github.com/zzyxiangnian-star/Mineradio/releases/tag/v1.3.5
[1.3.3]: https://github.com/zzyxiangnian-star/Mineradio/releases/tag/v1.3.3
