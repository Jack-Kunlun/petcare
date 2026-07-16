# PetCare宠伴 - 开发规范与流程

## 📋 项目概述

**项目名称**：PetCare宠伴  
**项目定位**：基于微信小程序的宠物上门托管服务平台  
**核心价值**：连接宠物主人与认证宠托师，提供上门喂养、遛狗等宠物照料服务  
**产品特色**：「服务 + 内容」双轮驱动的宠物生活入口

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

### 前端（微信小程序）

- **框架**：原生小程序 / Taro / Uni-app（待选型）
- **状态管理**：MobX / Redux（待选型）
- **UI组件库**：Vant Weapp / TDesign（待选型）
- **HTTP客户端**：wx.request封装

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

1. **文档先行**：任何功能开发前必须先有对应的设计文档
2. **评审机制**：关键节点必须经过评审，不得跳过
3. **代码审查**：所有代码合并到develop分支前必须经过Code Review
4. **测试覆盖**：核心业务逻辑必须有单元测试覆盖
5. **变更记录**：所有需求变更必须更新PRD并重新评审

---

## 📞 沟通协作

- **日常沟通**：钉钉群
- **文档协作**：钉钉文档（实时协同编辑）
- **任务管理**：钉钉待办 / Teambition
- **代码仓库**：GitLab / GitHub（待定）

---

_最后更新时间：2026-07-15_  
_文档维护者：PetCare研发团队_
