# 参与贡献

感谢你愿意改进 Mineradio。无论是问题报告、文档修正、测试补充还是功能实现，都请先确认改动可以在本地复现和验证。

## 开始之前

- 阅读 [README.md](./README.md)、[CHANGELOG.md](./CHANGELOG.md) 和 [SECURITY.md](./SECURITY.md)。
- 搜索现有 Issue 和 Pull Request，避免重复工作。
- 功能改动建议先通过 Issue 说明使用场景、预期行为和替代方案。
- 安全漏洞不要提交公开 Issue，请按 [SECURITY.md](./SECURITY.md) 私下报告。
- 本仓库是 [XxHuberrr/Mineradio](https://github.com/XxHuberrr/Mineradio.git) 的独立维护迭代；请尊重原项目、第三方依赖和音乐平台的许可证与服务条款。

## 开发环境

- Windows 10/11 x64。
- Node.js 18 或更高版本，推荐当前 LTS。
- npm 9 或更高版本。
- Git。
- Visual Studio 2022 Build Tools：安装“使用 C++ 的桌面开发”和 Windows SDK，用于构建 `native/taskbar-thumbnail`。

克隆仓库并安装依赖：

```powershell
git clone https://github.com/zzyxiangnian-star/Mineradio.git
cd Mineradio
npm install --ignore-scripts
node node_modules/electron/install.js
npm run rebuild:native
```

如果本机 C++ 工具链已完整配置，也可以直接使用 `npm install`，随后仍建议运行 `npm run rebuild:native`，确保原生模块与当前 Electron ABI 一致。

## 本地开发与验证

启动应用：

```powershell
npm start
```

运行自动化测试：

```powershell
npm test
```

需要验证安装包时运行：

```powershell
npm run build
npm run build:portable
```

提交 PR 前至少完成 `npm test`。如果改动涉及任务栏缩略图、桌面窗口、安装器或平台登录，还应在 Windows 实机验证相关交互，并在 PR 中写明测试环境和结果。

## 提交 Issue

问题报告请包含：

- Mineradio 版本、Windows 版本和安装/源码运行方式。
- 清晰的复现步骤、预期结果和实际结果。
- 是否稳定复现，以及涉及的音乐平台或歌曲来源。
- 已脱敏的错误信息、控制台日志或截图。
- 已尝试的排查方式。

不要在 Issue 中粘贴 API Key、Cookie、账号凭据、用户数据路径中的私密内容或可直接利用的安全细节。音乐版权、地区、登录、会员和平台接口变更可能导致部分内容不可用，请先区分平台限制与应用缺陷。

## 提交 Pull Request

1. 从最新 `main` 创建范围清晰的分支。
2. 一个 PR 只解决一个主题，避免混入无关格式化或重构。
3. 行为改动应补充或更新 `test/` 下的自动化测试。
4. UI 改动应提供截图或短视频，并说明窗口尺寸和系统缩放比例。
5. 依赖或构建改动应解释必要性、兼容性和产物变化。
6. 文档、版本号和用户提示应与实际行为一致。
7. 提交前运行 `npm test` 和 `git diff --check`。

PR 描述至少应回答：

- 改了什么，为什么需要改。
- 对用户或开发者有什么影响。
- 如何验证，验证结果是什么。
- 是否存在已知限制、平台差异或后续工作。

## 提交信息

建议使用简洁、可检索的提交前缀：

```text
feat: add playlist import flow
fix: handle unavailable kugou tracks
docs: clarify native build requirements
test: cover taskbar preview state
chore: update build metadata
```

使用祈使语气描述一个完整改动，不要用“update files”“fix stuff”等无法说明范围的信息。

## 敏感信息与第三方服务

以下内容不得提交：

- `.env` 中的真实 API Key、令牌或私有服务地址。
- `.cookie`、`.qq-cookie`、`.kugou-cookie` 和其他登录凭据。
- 用户配置、播放历史、缓存、日志、更新下载和本机绝对路径。
- `node_modules/`、`dist/`、原生模块编译目录、已安装 Electron 运行库和可执行程序。
- 无权再分发的音乐、封面、字体、图片或其他媒体。

第三方音乐服务可能随时调整接口、登录、地区、会员和版权策略。贡献者应提供明确的失败处理，不应加入绕过访问控制、付费权益或数字版权保护的逻辑。

## 行为准则

- 讨论问题本身，尊重不同经验和观点。
- 提供可验证的技术证据，避免人身攻击或贬低式表达。
- 接受维护者对范围、安全、版权和长期维护成本的判断。
- 发现敏感信息时停止传播，并尽快通知维护者处理。
