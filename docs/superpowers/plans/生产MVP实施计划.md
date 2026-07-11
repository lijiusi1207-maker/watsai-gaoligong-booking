# 哇噻·高黎贡预约系统生产 MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将当前演示版推进为具备安全、容量控制、取消、家庭成员与可部署验证的预约 MVP。

**Architecture:** 保持零依赖 Node 单体服务和 JSON 持久化，新增密码哈希/会话、预约域校验和可扫码凭证辅助函数；前后台页面只做必要的接口适配，部署与运营说明同步更新。

**Tech Stack:** Node.js >=18、内置 `http`/`crypto`/`fs`，现有 HTML 前后台，Node 原生测试脚本。

## Global Constraints

- 不把 `data.json`、密码、生产 token 提交到 Git。
- 兼容现有数据结构和已有验证脚本。
- 每个行为变更先写失败测试，再写最小实现。
- 不声称 Render/VPS/微信已上线，除非真实验证成功。

### Task 1: 安全基础与兼容迁移

**Files:**
- Modify: `server.js`
- Create: `__verify3.js`
- Modify: `README.md`

- [ ] 写测试：新注册用户密码不等于明文；错误管理 token 和错误用户 session 均返回 401/403；旧数据用户仍可启动读取。
- [ ] 运行 `node __verify3.js`，确认在当前代码上因明文密码/session 不存在而失败。
- [ ] 实现 `scryptSync` 密码哈希、随机 session token、环境变量 `ADMIN_TOKEN`、旧用户兼容登录迁移。
- [ ] 运行新测试及 `node __verify.js`、`node __verify2.js`，确认全部通过。

### Task 2: 预约容量、重复预约与取消

**Files:**
- Modify: `server.js`
- Modify: `index.html`
- Modify: `__verify3.js`

- [ ] 写测试：同一活动/场次重复有效预约被拒；超过数值容量被拒；取消后名额释放；已核销预约不能取消。
- [ ] 运行测试确认失败。
- [ ] 实现统一的 `sessionKey`、容量解析、有效预约统计、取消接口和前台按钮适配。
- [ ] 运行全部回归测试并检查管理端统计。

### Task 3: 家庭成员与凭证 payload

**Files:**
- Modify: `server.js`
- Modify: `index.html`
- Modify: `admin.html`
- Modify: `__verify3.js`
- Modify: `README.md`

- [ ] 写测试：participant 列表保存脱敏身份信息；预约返回可解析的 `credentialPayload`；核销 payload 与原始 code 等价。
- [ ] 运行测试确认失败。
- [ ] 实现 participant 校验、家庭成员容量计数、凭证 payload 生成与后台解析核销。
- [ ] 运行全部回归测试，确认旧单人预约仍可核销。

### Task 4: 生产部署与运营验收

**Files:**
- Modify: `README.md`
- Modify: `render.yaml`
- Create: `OPERATIONS-CHECKLIST.md`
- Create: `__smoke.js`

- [ ] 写 smoke test：启动服务后检查 `/healthz`、前台活动、后台鉴权、注册/登录/预约/取消/核销主链路。
- [ ] 运行 smoke test，确认失败项能准确指出环境或代码问题。
- [ ] 补充 Render 环境变量、备份恢复、数据迁移、研学活动放票前压测门槛和现场验收清单。
- [ ] 本地启动并运行 smoke + 全部回归；记录未能外部验证的 GitHub/Render/微信依赖。

### Task 5: 最终交付审计

**Files:**
- Modify: `项目交接手册.md`（工作区交付文档）
- Modify: `待确认与后续行动.md`（工作区交付文档）

- [ ] 对照 10 项目标逐项标记完成、依赖用户或不在本阶段范围。
- [ ] 检查 Git 状态，保留用户已有未提交的 `HANDOFF.md`。
- [ ] 输出可点击文件清单、验证命令、外部依赖和下一步。

