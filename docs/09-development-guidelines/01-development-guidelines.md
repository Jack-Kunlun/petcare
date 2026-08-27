# PetCare宠伴 - 开发规范与流程

## 📋 项目概述

- **项目名称**：PetCare宠伴
- **当前定位**：个人、非商业、可本地验收的宠物内容、社区与档案管理原型
- **当前主线**：账户、宠物档案、萌宠课堂、受控社区、内容治理和本地运行
- **未来设计**：宠物服务交易、服务者认证和资金能力已暂停，不属于当前 backlog

当前任务以[开发路线图](../01-requirements/05-development-roadmap.md)为准，范围落实与历史商业代码处理遵循[个人开发版范围与代码清理规范](./06-personal-scope-and-code-cleanup.md)。本文只提供研发流程概览；技术栈、分支、命令或路径与根目录 `AGENTS.md`、实际仓库配置冲突时，以当前仓库为准。

---

## 🎯 研发流程规范

### 阶段一：需求分析（01-requirements）

**输出物**：

- `01-prd.md` - 产品需求文档
- `02-user-stories.md` - 用户故事
- `03-competitive-analysis.md` - 竞品分析

**准入条件**：业务方提出明确需求  
**准出条件**：PRD评审通过，需求冻结

---

### 阶段二：技术方案设计（02-technical-design）

**输出物**：

- `01-architecture.md` - 系统架构设计
- `02-tech-stack.md` - 技术栈选型
- `03-module-design.md` - 核心模块设计

**准入条件**：PRD已冻结  
**准出条件**：技术方案评审通过

---

### 阶段三：API设计（03-api-design）

**输出物**：

- `01-api-spec.md` - RESTful API 接口规范
- `02-data-dictionary.md` - 请求/响应数据结构
- `03-mock-data.json` - 前端联调 Mock 数据

**准入条件**：技术方案已评审  
**准出条件**：前后端对接口定义达成一致

---

### 阶段四：数据库设计（04-database-design）

**输出物**：

- `01-er-diagram.md` - 实体关系图
- `02-schema.sql` - DDL 建表语句
- `03-index-strategy.md` - 索引设计策略

**准入条件**：API设计已完成  
**准出条件**：DBA评审通过

---

### 阶段五：开发实施

**范围准入**：

- 工作项必须存在于当前路线图；未来 PRD、历史原型和既有代码不能单独授权实现；
- 当前优先清理 Miniapp、Website、Admin 和默认 Server 运行时中的商业入口，再删除无消费者代码；
- Schema、migration 与运行数据清理必须单独立项，不得混入普通页面或代码清理。

**代码规范**：

- 前端：遵循微信小程序官方规范 + ESLint
- 后端：遵循Node.js最佳实践 + Prettier格式化
- Git提交：Conventional Commits规范

**分支策略**：

```
main          # 生产环境
├── develop   # 开发主分支
│   ├── feature/xxx  # 功能分支
│   └── bugfix/xxx   # 修复分支
└── release/x.x      # 发布分支
```

---

### 阶段六：测试（05-testing）

**输出物**：

- `01-test-cases.md` - 功能测试用例
- `02-api-test-report.md` - 接口集成测试报告
- `03-performance-test.md` - 性能测试报告

**准入条件**：开发完成，提测  
**准出条件**：P0/P1级Bug清零，测试通过率≥95%

---

### 阶段七：部署运维（06-deployment）

**输出物**：

- `01-deployment-guide.md` - 部署手册
- `02-monitoring-alerts.md` - 监控告警规则
- `03-incident-response.md` - 故障应急预案

**准入条件**：测试通过  
**准出条件**：生产环境验证通过

---

## 📝 文档编写规范

### 文档存放位置

所有文档统一存放在 `docs/` 目录下，按阶段分类：

```
docs/
├── 01-requirements/           # 需求文档
├── 02-technical-design/       # 技术方案
├── 03-api-design/             # API设计
├── 04-database-design/        # 数据库设计
├── 05-testing/                # 测试文档
├── 06-deployment/             # 部署运维
└── 07-development-guidelines/ # 开发规范
```

### 文档命名规范

- **使用英文命名**，遵循 kebab-case（短横线分隔）规范
- 文件名格式：`[序号]-[document-name].md`
- 示例：`01-prd.md`、`02-user-stories.md`、`03-competitive-analysis.md`
- 避免使用空格和特殊字符，仅使用小写字母、数字和短横线

### 各阶段标准文档清单

#### 01-requirements/

- `01-prd.md` - 产品需求文档
- `02-user-stories.md` - 用户故事与验收标准
- `03-competitive-analysis.md` - 竞品分析

#### 02-technical-design/

- `01-architecture.md` - 系统架构设计
- `02-tech-stack.md` - 技术栈选型
- `03-module-design.md` - 核心模块设计

#### 03-api-design/

- `01-api-spec.md` - RESTful API 接口规范
- `02-data-dictionary.md` - 请求/响应数据结构
- `03-mock-data.json` - 前端联调 Mock 数据

#### 04-database-design/

- `01-er-diagram.md` - 实体关系图
- `02-schema.sql` - DDL 建表语句
- `03-index-strategy.md` - 索引设计策略

#### 05-testing/

- `01-test-cases.md` - 功能测试用例
- `02-api-test-report.md` - 接口集成测试报告
- `03-performance-test.md` - 性能测试报告

#### 06-deployment/

- `01-deployment-guide.md` - 部署手册
- `02-monitoring-alerts.md` - 监控告警规则
- `03-incident-response.md` - 故障应急预案

### 文档更新原则

1. **单一事实源**：同一信息只在一处维护，避免多处更新导致不一致
2. **版本管理**：重大变更需记录版本号及变更说明
3. **评审机制**：关键文档需经过相关人员评审后方可定稿

---

## 🔧 技术栈约定

### 前端（Miniapp）

- ~~**框架**：原生小程序 / Taro / Uni-app（待选型）~~
- ~~**状态管理**：MobX / Redux（待选型）~~
- ~~**UI组件库**：Vant Weapp / TDesign（待选型）~~
- ~~**HTTP客户端**：wx.request封装~~
- **框架**：UniApp + Vue 3
- **UI组件库**：Wot UI
- **样式**：UnoCSS
- **HTTP客户端**：UniApp 请求适配层

### 后端

- **运行时**：Node.js 18+
- **框架**：Express / Koa / NestJS（待选型）
- **数据库**：MySQL 8.0+
- **缓存**：Redis
- **ORM**：Sequelize / TypeORM（待选型）

### 基础设施

- **容器化**：Docker
- **CI/CD**：GitHub Actions / Jenkins（待选型）
- **监控**：Sentry + Prometheus + Grafana

---

## ⚠️ 重要原则

1. **范围先行**：任务必须属于当前路线图，不能从未来设计或残留代码推导需求
2. **清理可验证**：移除入口、路由、静态数据和无消费者代码后，必须验证当前能力不回归
3. **数据单独治理**：Schema、migration 和运行数据不随普通代码清理删除
4. **文档先行**：任何功能开发前必须先有对应的设计文档
5. **评审机制**：关键节点必须经过评审，不得跳过
6. **代码审查**：所有代码集成前必须经过 Code Review
7. **测试覆盖**：核心业务逻辑必须有单元测试覆盖
8. **变更记录**：范围变化必须同步路线图及相关产品文档

---

## 📞 沟通协作

- **日常沟通**：钉钉群
- **文档协作**：钉钉文档（实时协同编辑）
- **任务管理**：钉钉待办 / Teambition
- **代码仓库**：GitLab / GitHub（待定）

---

- _最后更新时间：2026-08-27_
- _文档维护者：PetCare研发团队_
