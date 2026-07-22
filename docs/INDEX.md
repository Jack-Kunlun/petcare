# PetCare 文档索引

本文档提供PetCare项目所有文档的分类索引，便于快速查找所需信息。

**最后更新**: 2026-07-16

---

## 📋 快速导航

### 新人必读（按顺序）

1. [README.md](../README.md) - 项目概览和快速开始
2. [环境变量配置](./environment-variables.md) - 开发环境设置
3. [产品需求文档](./01-requirements/01-prd.md) - 了解业务背景
4. [技术架构](./03-technical-architecture/01-tech-stack.md) - 理解技术选型
5. [API接口规范](./06-api-specification/api-specification.md) - 前后端协作基础
6. [开发规范](./09-development-guidelines/02-development-standards.md) - 编码标准
7. [部署指南](./08-deployment/deployment.md) - 上线部署流程

---

## 📚 文档分类

### 1️⃣ 需求文档 (01-requirements)

业务需求和用户故事，帮助理解产品目标。

| 文档                                                                             | 说明              | 适合人群        |
| -------------------------------------------------------------------------------- | ----------------- | --------------- |
| [01-prd.md](./01-requirements/01-prd.md)                                         | 产品需求文档      | PM、开发、测试  |
| [02-user-stories.md](./01-requirements/02-user-stories.md)                       | 用户故事          | PM、开发        |
| [03-competitive-analysis.md](./01-requirements/03-competitive-analysis.md)       | 竞品分析          | PM、产品        |
| [04-prototype-specification.md](./01-requirements/04-prototype-specification.md) | 原型规格文档(v41) | PM、前端、UI/UX |

**使用场景**:

- 新功能开发前了解业务背景
- 评估功能优先级
- 理解用户痛点和使用场景

---

### 2️⃣ 技术设计 (02-technical-design)

详细的技术设计方案和流程图。

| 文档                                                                       | 说明       | 适合人群        |
| -------------------------------------------------------------------------- | ---------- | --------------- |
| [01-order-flow-diagram.md](./02-technical-design/01-order-flow-diagram.md) | 订单流程图 | 后端开发、测试  |
| [02-menu-structure.md](./02-technical-design/02-menu-structure.md)         | 菜单结构   | 前端开发、UI/UX |

**使用场景**:

- 实现具体功能前查看设计细节
- 理解业务流程和数据流转
- UI开发参考菜单层级

---

### 3️⃣ 技术架构 (03-technical-architecture)

系统整体技术选型和架构设计。

| 文档                                                                                     | 说明               | 适合人群               |
| ---------------------------------------------------------------------------------------- | ------------------ | ---------------------- |
| [01-tech-stack.md](./03-technical-architecture/01-tech-stack.md)                         | 技术栈选型         | 全体开发               |
| [02-monorepo-structure.md](./03-technical-architecture/02-monorepo-structure.md)         | Monorepo结构       | 全栈开发、DevOps       |
| [03-architecture-evolution.md](./03-technical-architecture/03-architecture-evolution.md) | 架构基线与演进决策 | 后端开发、架构、DevOps |

**使用场景**:

- 新项目成员了解技术栈
- 技术决策参考
- 理解代码组织结构

---

### 4️⃣ API设计 (04-api-design)

API设计和规范文档。

| 文档                                   | 说明            | 适合人群         |
| -------------------------------------- | --------------- | ---------------- |
| [README.md](./04-api-design/README.md) | API设计文档索引 | 后端开发、架构师 |

**规划中的内容**:

- API设计规范（RESTful/GraphQL）
- 接口定义文档
- 数据流图
- 版本管理策略
- 向后兼容性指南

---

### 5️⃣ 数据库设计 (05-database-design)

数据库设计和规范文档。

| 文档                                        | 说明               | 适合人群      |
| ------------------------------------------- | ------------------ | ------------- |
| [README.md](./05-database-design/README.md) | 数据库设计文档索引 | 后端开发、DBA |

**规划中的内容**:

- ER图（实体关系图）
- 数据字典
- 索引策略
- 迁移脚本说明
- 性能优化指南

---

### 6️⃣ API规范 (06-api-specification)

RESTful API设计规范和接口定义。

| 文档                                                                | 说明           | 适合人群         |
| ------------------------------------------------------------------- | -------------- | ---------------- |
| [api-specification.md](./06-api-specification/api-specification.md) | API接口规范 📡 | 前后端开发、测试 |

**核心内容**:

- RESTful设计原则
- 认证授权机制（JWT + RBAC）
- 请求/响应格式规范
- 错误处理标准
- 分页和速率限制
- 完整API列表（8个模块）

**使用场景**:

- 前端调用API前查阅参数格式
- 后端开发新接口时遵循规范
- 测试编写API测试用例
- 第三方集成参考

---

### 7️⃣ 测试文档 (07-testing)

测试规范和指南。

| 文档                                | 说明         | 适合人群         |
| ----------------------------------- | ------------ | ---------------- |
| [README.md](./07-testing/README.md) | 测试文档索引 | 测试工程师、开发 |

**规划中的内容**:

- 单元测试规范
- E2E测试指南
- 性能测试方案
- 测试覆盖率报告

---

### 8️⃣ 部署运维 (08-deployment)

Docker容器化部署和运维指南。

| 文档                                                                         | 说明            | 适合人群         |
| ---------------------------------------------------------------------------- | --------------- | ---------------- |
| [deployment.md](./08-deployment/deployment.md)                               | 完整部署指南 ⭐ | DevOps、后端开发 |
| [deployment-architecture.html](./08-deployment/deployment-architecture.html) | 交互式架构图 🎨 | 全体技术         |
| [env-example.md](./08-deployment/env-example.md)                             | 环境变量示例    | DevOps           |

**核心内容**:

- Docker Compose多容器编排
- 安全配置（Redis密码、端口暴露控制）
- 健康检查和资源限制
- 数据备份和恢复
- 生产环境最佳实践

**使用场景**:

- 首次部署项目
- 生产环境上线
- 故障排查和运维
- 理解系统架构

---

### 9️⃣ 开发规范 (09-development-guidelines)

代码规范和开发流程标准。

| 文档                                                                                     | 说明           | 适合人群 |
| ---------------------------------------------------------------------------------------- | -------------- | -------- |
| [01-development-guidelines.md](./09-development-guidelines/01-development-guidelines.md) | 开发指南       | 全体开发 |
| [02-development-standards.md](./09-development-guidelines/02-development-standards.md)   | 开发规范详细版 | 全体开发 |

**核心内容**:

- 代码风格（ESLint + Prettier）
- Git提交规范（Conventional Commits）
- 测试规范（Vitest + Playwright）
- ConfigService使用规范
- Docker开发环境配置

**使用场景**:

- 新成员入职学习编码规范
- Code Review检查清单
- CI/CD配置参考

---

### 🔒 安全文档

安全审计和检查清单。

| 文档                                              | 说明         | 适合人群             |
| ------------------------------------------------- | ------------ | -------------------- |
| [SECURITY-AUDIT.md](../SECURITY-AUDIT.md)         | 安全审计报告 | 后端开发、安全工程师 |
| [SECURITY-CHECKLIST.md](../SECURITY-CHECKLIST.md) | 安全检查清单 | DevOps、后端开发     |

**核心内容**:

- Redis密码认证配置
- 端口暴露控制
- JWT密钥强度验证
- CORS动态配置
- 生产环境禁用Swagger

**使用场景**:

- 生产环境上线前安全检查
- 安全漏洞修复参考
- 合规性审查

---

### 🤖 AI助手指南

| 文档                      | 说明           | 适合人群     |
| ------------------------- | -------------- | ------------ |
| [AGENTS.md](../AGENTS.md) | AI助手项目指南 | AI Assistant |

**核心内容**:

- 项目技术栈和结构
- 环境变量配置方式
- ConfigService使用规范
- 必读文档清单
- Docker部署说明

---

## 🔍 按角色查找

### 👨‍💻 前端开发

**必读**:

1. [README.md](../README.md) - 项目概览
2. [技术架构](./03-technical-architecture/01-tech-stack.md) - React + Vite技术栈
3. [API接口规范](./06-api-specification/api-specification.md) - 接口调用规范
4. [开发规范](./09-development-guidelines/02-development-standards.md) - 代码风格
5. [菜单结构](./02-technical-design/02-menu-structure.md) - UI层级

**常用**:

- [Monorepo结构](./03-technical-architecture/02-monorepo-structure.md) - 共享包使用
- [部署架构图](./08-deployment/deployment-architecture.html) - 理解Nginx配置

---

### 👨‍💻 后端开发

**必读**:

1. [README.md](../README.md) - 项目概览
2. [技术架构](./03-technical-architecture/01-tech-stack.md) - Nest.js + Prisma技术栈
3. [API接口规范](./06-api-specification/api-specification.md) - API设计规范
4. [开发规范](./09-development-guidelines/02-development-standards.md) - ConfigService使用
5. [部署指南](./08-deployment/deployment.md) - Docker部署

**常用**:

- [订单流程图](./02-technical-design/01-order-flow-diagram.md) - 业务逻辑
- [安全审计报告](../SECURITY-AUDIT.md) - 安全配置
- [安全检查清单](../SECURITY-CHECKLIST.md) - 上线前检查

---

### 🧪 测试工程师

**必读**:

1. [产品需求文档](./01-requirements/01-prd.md) - 功能需求
2. [用户故事](./01-requirements/02-user-stories.md) - 验收标准
3. [API接口规范](./06-api-specification/api-specification.md) - 接口测试依据
4. [订单流程图](./02-technical-design/01-order-flow-diagram.md) - 业务流程

**常用**:

- [开发规范](./09-development-guidelines/02-development-standards.md) - E2E测试配置
- [部署指南](./08-deployment/deployment.md) - 测试环境搭建

---

### 📦 DevOps工程师

**必读**:

1. [部署指南](./08-deployment/deployment.md) - Docker Compose配置
2. [环境变量配置](./environment-variables.md) - 配置项说明
3. [安全检查清单](../SECURITY-CHECKLIST.md) - 生产环境安全
4. [部署架构图](./08-deployment/deployment-architecture.html) - 系统架构

**常用**:

- [安全审计报告](../SECURITY-AUDIT.md) - 安全加固参考
- [Monorepo结构](./03-technical-architecture/02-monorepo-structure.md) - CI/CD配置

---

### 📊 产品经理

**必读**:

1. [产品需求文档](./01-requirements/01-prd.md) - PRD模板
2. [用户故事](./01-requirements/02-user-stories.md) - 用户视角
3. [竞品分析](./01-requirements/03-competitive-analysis.md) - 市场定位

**常用**:

- [订单流程图](./02-technical-design/01-order-flow-diagram.md) - 业务流程可视化
- [README.md](../README.md) - 项目整体了解

---

## 🔗 外部资源

### 技术文档

- [Nest.js 官方文档](https://docs.nestjs.com/)
- [Prisma 官方文档](https://www.prisma.io/docs)
- [React 官方文档](https://react.dev/)
- [Taro 官方文档](https://taro-docs.jd.com/)
- [OpenAPI 规范](https://swagger.io/specification/)

### 工具推荐

- **API测试**: Postman / Apifox
- **Mock服务**: Mockoon
- **代码规范**: ESLint + Prettier
- **容器化**: Docker + Docker Compose
- **监控**: Prometheus + Grafana

---

## 📝 文档维护

### 更新频率

- **需求文档**: 随产品迭代更新
- **技术文档**: 重大技术变更后更新
- **API规范**: 新增/修改接口时同步更新
- **部署文档**: 部署流程变更时更新
- **开发规范**: 团队规范调整时更新

### 贡献指南

1. 保持文档与代码同步
2. 使用清晰的标题和结构
3. 添加必要的示例代码
4. 更新相关文档的交叉引用
5. 在PR中说明文档变更原因

### 版本管理

每个文档顶部应包含：

```markdown
**最后更新**: YYYY-MM-DD  
**维护者**: XXX团队  
**版本**: vX.X
```

---

## 💡 使用提示

### 如何快速找到所需文档？

1. **明确你的角色** → 查看"按角色查找"部分
2. **知道文档类别** → 查看"文档分类"部分
3. **搜索关键词** → 使用IDE或编辑器的全局搜索
4. **不确定从哪里开始** → 阅读"新人必读"

### 文档缺失怎么办？

1. 检查是否有相似主题的文档
2. 在GitHub Issues中提出文档需求
3. 临时记录在代码注释中
4. 补充到相应分类并更新本索引

---

**维护者**: PetCare 文档团队  
**反馈渠道**: GitHub Issues  
**下次审计**: 2026-08-16
