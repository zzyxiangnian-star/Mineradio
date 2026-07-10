# Mineradio 1.4.0 Open-Source Documentation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Mineradio's GitHub-facing documentation with an accurate, Chinese-first open-source documentation set for version 1.4.0.

**Architecture:** Keep documentation responsibilities separated: `README.md` is the product and onboarding entry point, `CHANGELOG.md` is the release history, `CONTRIBUTING.md` is the contributor workflow, `.env.example` is the executable configuration template, and `SECURITY.md` is the security reporting policy. Derive every command, variable, version, and feature claim from the restored 1.4.0 source tree.

**Tech Stack:** Markdown, Electron 33, Node.js 18+, npm 9+, `node:test`, electron-builder, GitHub.

## Global Constraints

- Write primarily in Chinese while preserving necessary English technical terms.
- Use Mineradio version `1.4.0` consistently.
- Preserve the existing MIT `LICENSE` without editing its text.
- State the original project URL and the current repository's iteration relationship clearly.
- Never include real API keys, cookies, user data, cache files, installed Electron runtime files, or build artifacts.
- Do not change application behavior, dependencies, UI, or build configuration.
- Do not rewrite historical files under `docs/superpowers/` other than this plan and its approved design spec.

---

### Task 1: Verify the Documentation Fact Base

**Files:**
- Read: `package.json`
- Read: `server.js`
- Read: `src/desktop/*.js`
- Read: `src/lib/ai/*.js`
- Read: `test/*.test.js`
- Read: `build/*`

**Interfaces:**
- Consumes: the restored Mineradio 1.4.0 source tree.
- Produces: the verified version, scripts, environment variables, features, platform requirements, and repository paths used by Tasks 2-4.

- [ ] **Step 1: Verify package metadata and executable scripts**

Run:

```powershell
node -e "const p=require('./package.json'); console.log(p.version); console.log(JSON.stringify(p.scripts, null, 2))"
```

Expected: version `1.4.0` and scripts named `start`, `test`, `rebuild:native`, `build`, and `build:portable`.

- [ ] **Step 2: Inventory environment variables from source**

Run:

```powershell
rg -o "process\.env\.[A-Z0-9_]+" server.js src | Sort-Object -Unique
```

Expected: output includes `MIMO_API_KEY`, `MIMO_BASE_URL`, `MIMO_MODEL`, `MIMO_AUTH_METHOD`, `MINERADIO_USER_DATA_DIR`, server/cookie paths, update paths, and desktop shortcut controls.

- [ ] **Step 3: Verify documented features have source or test evidence**

Run:

```powershell
rg -n "playlist-import|taskbar|chatWallpaper|updateMetadata|kugou" public src test server.js
```

Expected: matches for external playlist import, taskbar integration, Music Soul chat wallpaper, update metadata, and Kugou handling.

### Task 2: Rewrite README.md

**Files:**
- Modify: `README.md`
- Reference: `docs/images/*`
- Reference: `package.json`

**Interfaces:**
- Consumes: the verified fact base from Task 1.
- Produces: the primary GitHub landing page and links to the supporting documents in Tasks 3-4.

- [ ] **Step 1: Replace README with the approved product-first structure**

Write these sections in order:

```markdown
<div align="center">logo, title, one-sentence positioning, badges</div>

## 项目简介
## 1.4.0 版本亮点
## 核心功能
## 运行效果
## 技术架构
## 技术栈
## 快速开始
## 测试与构建
## 项目结构
## 配置与数据安全
## 常见问题
## 贡献与安全
## 项目来源与许可证
```

The project-source section must name `https://github.com/XxHuberrr/Mineradio.git` as the original project and describe `zzyxiangnian-star/Mineradio` as an independently maintained iteration without implying original authorship.

- [ ] **Step 2: Use only repository-valid commands**

Include these exact commands:

```powershell
git clone https://github.com/zzyxiangnian-star/Mineradio.git
cd Mineradio
npm install --ignore-scripts
npm run rebuild:native
npm start
npm test
npm run build
npm run build:portable
```

Explain that Windows Build Tools are required for the native taskbar module and that users who do not need to resynchronize dependencies may use `npm install` when their toolchain already supports native builds.

- [ ] **Step 3: Link all supporting policies**

Add relative links to `CHANGELOG.md`, `CONTRIBUTING.md`, `SECURITY.md`, `.env.example`, and `LICENSE`. Keep the three existing screenshot paths and logo path unchanged so GitHub renders repository assets.

- [ ] **Step 4: Validate README claims and links locally**

Run:

```powershell
rg -n "1\.4\.0|npm run rebuild:native|CHANGELOG|CONTRIBUTING|SECURITY|XxHuberrr" README.md
```

Expected: every required version, command, policy link, and attribution appears at least once.

### Task 3: Rewrite Release and Contribution Documentation

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `CONTRIBUTING.md`

**Interfaces:**
- Consumes: the verified package scripts, feature evidence, and version history.
- Produces: authoritative release notes and the contributor workflow linked from README.

- [ ] **Step 1: Rewrite CHANGELOG.md using versioned release sections**

Keep versions `1.4.0`, `1.3.5`, and `1.3.3`. Under `1.4.0`, document taskbar music preview, multi-provider playlist-link import, inline playlist expansion, Kugou matching/restriction messages, Music Soul chat wallpaper, and update download metadata. End with stable links for `v1.3.5`, `v1.3.3`, and the `v1.3.5...HEAD` comparison.

- [ ] **Step 2: Rewrite CONTRIBUTING.md as an executable workflow**

Use these sections:

```markdown
# 参与贡献
## 开始之前
## 开发环境
## 本地开发与验证
## 提交 Issue
## 提交 Pull Request
## 提交信息
## 敏感信息与第三方服务
## 行为准则
```

Require Node.js 18+, npm 9+, Windows for desktop/native integration validation, `npm test` before PRs, and no secrets/cookies/user data/build artifacts in commits.

- [ ] **Step 3: Cross-check commands against package.json**

Run:

```powershell
$scripts = (Get-Content -Raw package.json | ConvertFrom-Json).scripts.PSObject.Properties.Name
$documented = rg -o "npm run [a-z:-]+|npm (start|test|install)" README.md CONTRIBUTING.md
$scripts
$documented
```

Expected: all documented `npm run` targets exist in `$scripts`; `npm start`, `npm test`, and `npm install` are valid npm commands.

### Task 4: Rewrite Configuration Template and Add Security Policy

**Files:**
- Modify: `.env.example`
- Create: `SECURITY.md`
- Do not modify: `LICENSE`

**Interfaces:**
- Consumes: environment-variable reads from Task 1 and the security requirements in the approved design.
- Produces: a safe copyable local configuration template and the disclosure policy linked from README.

- [ ] **Step 1: Rewrite .env.example with safe values**

Include only these user-facing variables and no real credentials:

```dotenv
# 复制为 .env 后按需填写；不要提交包含真实密钥的 .env 文件。
MIMO_API_KEY=
MIMO_BASE_URL=https://api.xiaomimimo.com/v1
MIMO_MODEL=mimo-v2.5-pro
MIMO_AUTH_METHOD=api-key
MINERADIO_USER_DATA_DIR=
```

Explain in comments that AI configuration is optional and the user-data override should normally remain empty.

- [ ] **Step 2: Create SECURITY.md**

State that security fixes target `1.4.x`; ask reporters to use GitHub private vulnerability reporting when available or contact the maintainer privately; request impact, reproduction, environment, and mitigation details; prohibit public disclosure of secrets or exploitable details before coordination; distinguish platform availability, copyright, VIP, region, and login restrictions from security vulnerabilities.

- [ ] **Step 3: Confirm LICENSE is unchanged**

Run:

```powershell
git diff --exit-code 9fba2eb -- LICENSE
```

Expected: exit code `0` and no output.

### Task 5: Verify and Commit the Documentation Set

**Files:**
- Verify: `README.md`
- Verify: `CHANGELOG.md`
- Verify: `CONTRIBUTING.md`
- Verify: `.env.example`
- Verify: `SECURITY.md`

**Interfaces:**
- Consumes: all rewritten documents.
- Produces: a validated documentation commit ready for GitHub publication.

- [ ] **Step 1: Scan for placeholders and accidental secrets**

Run:

```powershell
rg -n "(^|\s)(TBD|TODO)\s*:|ghp_[A-Za-z0-9]+|sk-[A-Za-z0-9]+|MIMO_API_KEY=.+" README.md CHANGELOG.md CONTRIBUTING.md .env.example SECURITY.md
```

Expected: no output.

- [ ] **Step 2: Verify version and required files**

Run:

```powershell
node -e "const p=require('./package.json'); if(p.version!=='1.4.0') process.exit(1)"
@('README.md','CHANGELOG.md','CONTRIBUTING.md','.env.example','SECURITY.md') | ForEach-Object { if (-not (Test-Path $_)) { throw "Missing $_" } }
```

Expected: exit code `0` with all five files present.

- [ ] **Step 3: Run product tests and whitespace checks**

Run:

```powershell
npm test
git diff --check
```

Expected: all 32 Node tests pass and Git reports no whitespace errors.

- [ ] **Step 4: Review the final documentation-only diff**

Run:

```powershell
git status -sb
git diff --stat
git diff -- README.md CHANGELOG.md CONTRIBUTING.md .env.example SECURITY.md
```

Expected: only the five intended documentation files are changed by implementation; the approved design and plan are separate committed artifacts.

- [ ] **Step 5: Commit the documentation refresh**

```powershell
git add -- README.md CHANGELOG.md CONTRIBUTING.md .env.example SECURITY.md
git commit -m "docs: rewrite open-source documentation for v1.4.0"
```
