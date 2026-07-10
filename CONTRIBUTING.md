# 参与贡献

感谢你愿意改进 Mineradio。无论是问题反馈、文档修正还是功能提交，都欢迎通过 GitHub Issue 或 Pull Request 参与。

## 提交 Issue

提交前请先搜索已有 Issue，避免重复。问题报告建议包含：

- Windows 版本、Node.js 版本与 Mineradio 版本；
- 可复现步骤、预期结果与实际结果；
- 必要的日志或截图（请先移除账号、Cookie、API Key 等敏感信息）；
- 问题是否与特定音乐平台、登录状态或音频格式有关。

## 本地开发

```bash
git clone https://github.com/zzyxiangnian-star/Mineradio.git
cd Mineradio
npm install
npm start
```

提交前请至少运行：

```bash
node test-ai-modules.js
npm run build
```

## Pull Request

1. 从 `main` 创建语义清楚的功能分支。
2. 保持改动聚焦，避免在同一个 PR 中混入无关格式化或重构。
3. 在 PR 描述中说明动机、主要改动、验证方式和界面截图（如适用）。
4. 不要提交 `.env`、Cookie、账号数据、API Key、缓存或构建产物。
5. 新功能应同步更新 README 或相关文档；行为修改应补充可复现的验证步骤。

## 第三方服务说明

Mineradio 会接入第三方音乐与 AI 服务。贡献代码时请遵守相应平台的服务条款和内容许可，不要提交绕过付费、权限或访问控制的实现，也不要在测试数据中包含真实用户凭据。

## 提交信息建议

推荐使用简洁的 Conventional Commits 风格，例如：

```text
feat: add playlist interaction
fix: restore desktop lyrics position
docs: clarify AI configuration
```
