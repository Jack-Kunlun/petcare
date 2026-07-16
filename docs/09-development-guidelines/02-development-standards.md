# PetCare宠伴 - 开发规范与流程

## 文档信息

| 项目     | 内容        |
| -------- | ----------- |
| 项目名称 | PetCare宠伴 |
| 文档版本 | v1.0        |
| 创建日期 | 2026-07-15  |

---

## 一、Git Flow分支策略

### 1.1 分支类型

| 分支类型    | 命名规范           | 说明                     | 生命周期 |
| ----------- | ------------------ | ------------------------ | -------- |
| **main**    | `main`             | 生产环境分支，受保护     | 永久     |
| **develop** | `develop`          | 开发主分支，集成测试环境 | 永久     |
| **feature** | `feature/功能描述` | 新功能开发分支           | 临时     |
| **bugfix**  | `bugfix/问题描述`  | Bug修复分支              | 临时     |
| **hotfix**  | `hotfix/紧急修复`  | 生产环境紧急修复         | 临时     |
| **release** | `release/v版本号`  | 发布准备分支             | 临时     |

---

### 1.2 分支工作流程

```mermaid
graph LR
    A[develop] -->|创建| B[feature/xxx]
    B -->|完成| C[PR到develop]
    C -->|Code Review| D[合并到develop]
    D -->|定期| E[release/v1.0.0]
    E -->|测试通过| F[合并到main + develop]
    F -->|打标签| G[v1.0.0]

    H[main] -->|紧急Bug| I[hotfix/xxx]
    I -->|修复完成| J[合并到main + develop]
    J -->|打标签| K[v1.0.1]
```

---

### 1.3 分支操作规范

#### 创建功能分支

```bash
# 从develop创建功能分支
git checkout develop
git pull origin develop
git checkout -b feature/user-authentication

# 开发完成后推送到远程
git push origin feature/user-authentication
```

#### 提交Pull Request

1. 在GitHub/GitLab上创建PR：`feature/xxx` → `develop`
2. 填写PR模板（见下文）
3. 至少需要1位Reviewer审核
4. CI检查通过后合并

#### 合并到main

```bash
# 从release分支合并到main
git checkout main
git pull origin main
git merge release/v1.0.0
git tag v1.0.0
git push origin main --tags

# 同时合并回develop
git checkout develop
git merge release/v1.0.0
git push origin develop
```

#### 紧急Hotfix流程

```bash
# 从main创建hotfix分支
git checkout main
git pull origin main
git checkout -b hotfix/critical-bug-fix

# 修复后合并到main和develop
git checkout main
git merge hotfix/critical-bug-fix
git tag v1.0.1
git push origin main --tags

git checkout develop
git merge hotfix/critical-bug-fix
git push origin develop

# 删除hotfix分支
git branch -d hotfix/critical-bug-fix
git push origin --delete hotfix/critical-bug-fix
```

---

## 二、Commit规范

### 2.1 Commit消息格式

采用 **Conventional Commits** 规范：

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

**示例**：

```
feat(auth): 添加微信登录功能

- 实现微信code2Session接口
- 添加JWT token生成逻辑
- 完善用户注册流程

Closes #123
```

---

### 2.2 Type类型定义

| Type         | 说明                       | 示例                                 |
| ------------ | -------------------------- | ------------------------------------ |
| **feat**     | 新功能                     | `feat(order): 添加订单评价功能`      |
| **fix**      | Bug修复                    | `fix(payment): 修复支付回调失败问题` |
| **docs**     | 文档更新                   | `docs(api): 补充订单接口文档`        |
| **style**    | 代码格式调整（不影响逻辑） | `style: 统一缩进为2空格`             |
| **refactor** | 代码重构（不改变功能）     | `refactor(user): 重构用户服务层`     |
| **perf**     | 性能优化                   | `perf(query): 优化订单列表查询`      |
| **test**     | 测试相关                   | `test(order): 添加订单单元测试`      |
| **chore**    | 构建/工具链变更            | `chore: 升级TypeScript到5.x`         |
| **ci**       | CI/CD配置变更              | `ci: 添加自动化测试流程`             |

---

### 2.3 Scope范围定义

Scope表示修改的模块或功能范围，常用值：

- `auth` - 认证授权
- `user` - 用户管理
- `order` - 订单管理
- `payment` - 支付结算
- `community` - 社区功能
- `admin` - 后台管理
- `api` - API接口
- `db` - 数据库
- `deps` - 依赖管理

---

### 2.4 Description描述规范

- 使用中文描述
- 使用祈使句（"添加"而非"添加了"）
- 首字母小写（英文时）
- 结尾不加句号
- 长度不超过50个字符

**✅ 正确示例**：

```
feat(order): 添加订单纠纷处理流程
fix(auth): 修复token过期刷新逻辑
docs(api): 补充用户接口Swagger文档
```

**❌ 错误示例**：

```
修改了一些代码
更新了订单功能
fixed bug
```

---

### 2.5 Body正文（可选）

当修改较复杂时，应在Body中详细说明：

- 修改的原因和背景
- 具体做了哪些改动
- 可能的影响范围

**示例**：

```
feat(order): 添加T+0实时结算功能

原因：提升服务提供者积极性，缩短资金托管时间

改动：
- 修改结算定时器，从T+1改为实时触发
- 新增微信支付分接口调用
- 更新订单状态流转逻辑

影响：
- 所有新订单将实时结算
- 历史订单不受影响
```

---

### 2.6 Footer脚注（可选）

用于关联Issue或标记Breaking Changes：

```
Closes #123
Refs #456

BREAKING CHANGE: 移除旧的订单API v1接口
```

---

### 2.7 Commit最佳实践

1. **原子性提交**：每次commit只做一件事
2. **及时提交**：完成一个功能点就提交，不要堆积
3. **清晰描述**：让其他人能通过commit消息理解改动
4. **避免无用commit**：如"fix typo"、"update"等模糊描述

---

## 三、Code Review规范

### 3.1 PR模板

创建Pull Request时必须填写以下信息：

```markdown
## 📋 变更说明

<!-- 简要描述本次PR的目的和改动 -->

## 🔗 关联Issue

<!-- 关联的Issue编号，如：Closes #123 -->

## 🧪 测试情况

- [ ] 单元测试已通过
- [ ] 集成测试已通过
- [ ] 手动测试已完成
- [ ] 无测试必要（说明原因）

## 📸 截图/录屏（如适用）

<!-- UI变更需提供前后对比截图 -->

## ⚠️ 注意事项

<!-- 需要Reviewers特别关注的地方 -->

## 📚 文档更新

- [ ] 已更新相关文档
- [ ] 无需更新文档
```

---

### 3.2 Review检查清单

### 功能性检查

- [ ] 功能是否符合需求？
- [ ] 边界条件是否处理？
- [ ] 异常情况是否有容错？

### 代码质量检查

- [ ] 代码是否清晰易读？
- [ ] 是否有重复代码？
- [ ] 函数/类职责是否单一？
- [ ] 命名是否语义化？

### 安全性检查

- [ ] 是否有SQL注入风险？
- [ ] 敏感数据是否加密？
- [ ] 权限校验是否完整？
- [ ] 输入验证是否充分？

### 性能检查

- [ ] 是否有N+1查询问题？
- [ ] 是否有内存泄漏风险？
- [ ] 大数据量场景是否优化？
- [ ] 缓存策略是否合理？

### 规范性检查

- [ ] 是否遵循项目代码规范？
- [ ] TypeScript类型是否完整？
- [ ] 是否有TODO注释未处理？
- [ ] Commit消息是否规范？

### 测试检查

- [ ] 单元测试覆盖率是否达标（≥80%）？
- [ ] 关键路径是否有集成测试？
- [ ] 测试用例是否覆盖边界情况？

---

### 3.3 Review反馈规范

#### 反馈类型

| 类型         | 图标 | 说明                   |
| ------------ | ---- | ---------------------- |
| **必须修改** | ❌   | 阻塞合并，必须修复     |
| **建议修改** | 💡   | 非阻塞，但强烈建议优化 |
| **疑问**     | ❓   | 需要作者澄清           |
| **赞赏**     | 👍   | 代码写得好             |

#### 反馈示例

```typescript
// ❌ 必须修改：缺少空值检查
const user = await getUserById(id);
return user.name; // user可能为null

// 建议改为：
const user = await getUserById(id);
if (!user) {
  throw new NotFoundException("用户不存在");
}
return user.name;
```

```typescript
// 💡 建议修改：提取常量
const MAX_RETRY_COUNT = 3; // 建议提取为常量

// 建议在文件顶部定义：
const MAX_RETRY_COUNT = 3;
```

```typescript
// ❓ 疑问：为什么这里用setTimeout而不是setInterval？
// 请说明原因
```

```typescript
// 👍 赞赏：这个正则表达式写得很优雅！
```

---

### 3.4 Review流程

1. **提交PR**：作者填写PR模板，指定Reviewer
2. **自动检查**：CI运行Lint、Test、Build
3. **人工Review**：Reviewer检查代码，提出反馈
4. **作者修改**：根据反馈修改代码，push到同一分支
5. **再次Review**：Reviewer确认修改
6. **批准合并**：至少1人批准后，作者或Maintainer合并
7. **删除分支**：合并后删除feature分支

---

### 3.5 Review时间要求

- **普通PR**：24小时内完成Review
- **紧急PR**（hotfix）：4小时内完成Review
- **大型PR**（>500行）：可拆分为多个小PR

---

## 四、代码规范

### 4.1 TypeScript规范

#### 类型定义

```typescript
// ✅ 使用interface定义对象类型
interface User {
  id: string;
  name: string;
  email?: string; // 可选属性
}

// ✅ 使用type定义联合类型
type UserRole = "admin" | "user" | "guest";

// ❌ 避免使用any
const data: any = fetchData(); // 错误

// ✅ 使用unknown或具体类型
const data: unknown = fetchData();
if (isUser(data)) {
  console.log(data.name);
}
```

#### 泛型使用

```typescript
// ✅ 合理使用泛型
function firstElement<T>(arr: T[]): T | undefined {
  return arr[0];
}

// ✅ 泛型约束
function longest<T extends { length: number }>(a: T, b: T): T {
  return a.length >= b.length ? a : b;
}
```

---

### 4.2 React规范（Admin前端）

#### 组件命名

```tsx
// ✅ PascalCase命名组件
export default function UserProfile() {
  return <div>...</div>;
}

// ✅ 文件名与组件名一致
// UserProfile.tsx
```

#### Hooks使用

```tsx
// ✅ 自定义Hook以use开头
function useOrderList() {
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    fetchOrders().then(setOrders);
  }, []);

  return { orders };
}

// ✅ 避免在循环/条件中使用Hooks
function MyComponent() {
  if (condition) {
    const [value, setValue] = useState(0); // ❌ 错误
  }
}
```

#### 性能优化

```tsx
// ✅ 使用React.memo包裹纯展示组件
const OrderCard = React.memo(({ order }: { order: Order }) => {
  return <div>{order.id}</div>;
});

// ✅ 使用useMemo缓存计算结果
const totalAmount = useMemo(() => {
  return orders.reduce((sum, order) => sum + order.amount, 0);
}, [orders]);

// ✅ 使用useCallback缓存回调函数
const handleClick = useCallback(() => {
  console.log("clicked");
}, []);
```

---

### 4.3 Nest.js规范（后端）

#### 模块组织

```typescript
// ✅ 每个功能独立模块
@Module({
  imports: [PrismaModule],
  controllers: [OrderController],
  providers: [OrderService],
  exports: [OrderService],
})
export class OrderModule {}
```

#### 依赖注入

```typescript
// ✅ 通过构造函数注入依赖
@Injectable()
export class OrderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
  ) {}
}
```

#### 异常处理

```typescript
// ✅ 使用Nest内置异常
throw new NotFoundException("订单不存在");
throw new BadRequestException("参数错误");
throw new UnauthorizedException("未授权");

// ✅ 自定义异常过滤器
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    // 统一异常响应格式
  }
}
```

---

### 4.4 命名规范

| 类型             | 规范             | 示例                                     |
| ---------------- | ---------------- | ---------------------------------------- |
| **变量/函数**    | camelCase        | `userName`, `getUserInfo`                |
| **类/接口/类型** | PascalCase       | `UserService`, `OrderDTO`                |
| **常量**         | UPPER_SNAKE_CASE | `MAX_RETRY_COUNT`                        |
| **枚举**         | PascalCase       | `UserRole`, `OrderStatus`                |
| **文件**         | kebab-case       | `user-service.ts`, `order.controller.ts` |
| **目录**         | kebab-case       | `user-management`, `order-flow`          |

---

### 4.5 注释规范

```typescript
/**
 * 获取用户详情
 * @param userId - 用户ID
 * @returns 用户信息
 * @throws NotFoundException 用户不存在
 */
async getUserDetail(userId: string): Promise<User> {
  // 先检查缓存
  const cached = await this.cache.get(userId);
  if (cached) {
    return cached;
  }

  // 查询数据库
  const user = await this.prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new NotFoundException('用户不存在');
  }

  return user;
}
```

---

## 五、测试规范

### 5.1 测试覆盖率要求

| 测试类型     | 覆盖率要求   | 说明                 |
| ------------ | ------------ | -------------------- |
| **单元测试** | ≥80%         | 核心业务逻辑必须覆盖 |
| **集成测试** | 关键路径100% | API接口、数据库操作  |
| **E2E测试**  | 核心流程100% | 用户注册、下单、支付 |

---

### 5.2 单元测试示例

```typescript
// apps/api/src/modules/order/order.service.spec.ts

describe("OrderService", () => {
  let service: OrderService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        OrderService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<OrderService>(OrderService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it("应该成功创建订单", async () => {
    const createDto: CreateOrderDto = {
      serviceType: ServiceType.FEEDING,
      petId: "pet-123",
      serviceTime: new Date(),
    };

    const result = await service.createOrder(createDto);

    expect(result).toBeDefined();
    expect(result.status).toBe(OrderStatus.PENDING_CONFIRM);
    expect(prisma.order.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        serviceType: ServiceType.FEEDING,
      }),
    });
  });

  it("宠物不存在时应抛出异常", async () => {
    mockPrismaService.pet.findUnique.mockResolvedValue(null);

    await expect(
      service.createOrder({
        serviceType: ServiceType.FEEDING,
        petId: "invalid-pet-id",
        serviceTime: new Date(),
      }),
    ).rejects.toThrow(NotFoundException);
  });
});
```

---

### 5.3 测试命名规范

```typescript
// ✅ 清晰的测试名称
it("应该在用户不存在时抛出NotFoundException", () => {});
it("应该成功创建悬赏订单并返回订单ID", () => {});

// ❌ 模糊的测试名称
it("测试用户功能", () => {});
it("应该工作正常", () => {});
```

---

## 六、环境管理

### 6.1 环境变量文件

```
.env                # 默认环境变量（不提交到git）
.env.development    # 开发环境
.env.test           # 测试环境
.env.production     # 生产环境
```

### 6.2 .env.example模板

```bash
# 数据库
DATABASE_URL=postgresql://user:password@localhost:5432/petcare

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# JWT
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d

# 微信
WECHAT_APP_ID=
WECHAT_APP_SECRET=

# OSS
OSS_ACCESS_KEY=
OSS_SECRET_KEY=
OSS_BUCKET=
```

---

## 七、部署规范

### 7.1 版本号规范

采用 **Semantic Versioning**（语义化版本）：

- **主版本号**（Major）：不兼容的API修改
- **次版本号**（Minor）：向下兼容的功能性新增
- **修订号**（Patch）：向下兼容的问题修正

**示例**：

- `v1.0.0` - 初始发布
- `v1.1.0` - 新增订单评价功能
- `v1.1.1` - 修复支付回调Bug
- `v2.0.0` - API重大重构

---

### 7.2 发布流程

1. **创建release分支**：`git checkout -b release/v1.1.0`
2. **更新版本号**：修改package.json中的version字段
3. **更新CHANGELOG.md**：记录本次发布的所有变更
4. **运行测试**：确保所有测试通过
5. **合并到main**：`git merge release/v1.1.0`
6. **打标签**：`git tag v1.1.0`
7. **推送**：`git push origin main --tags`
8. **部署**：触发CI/CD自动部署

---

### 7.3 回滚策略

当生产环境出现严重问题时：

```bash
# 1. 找到上一个稳定版本的tag
git tag -l | grep "^v"

# 2. 回滚到指定版本
git checkout v1.0.0
git push origin HEAD:main --force

# 3. 重新部署
# 触发CI/CD部署流程
```

---

## 八、文档规范

### 8.1 文档结构

```
docs/
├── 01-requirements/         # 需求文档
│   ├── 01-prd.md
│   ├── 02-user-stories.md
│   └── 03-competitive-analysis.md
├── 02-technical-design/     # 技术设计
│   ├── 01-order-flow-diagram.md
│   └── 02-menu-structure.md
├── 03-technical-architecture/ # 技术架构
│   ├── 01-tech-stack.md
│   └── 02-monorepo-structure.md
├── 04-api-docs/             # API文档（Swagger自动生成）
├── 05-database/             # 数据库文档
│   └── er-diagram.md
├── 06-deployment/           # 部署文档
│   └── deployment-guide.md
└── 07-development-guidelines/ # 开发规范
    └── 01-development-guidelines.md
```

### 8.2 文档更新原则

- **代码即文档**：优先通过代码注释和类型定义表达意图
- **及时更新**：功能变更后同步更新文档
- **简洁明了**：避免冗长描述，多用图表和示例
- **版本管理**：重要文档随代码一起版本控制

---

## 九、常见问题FAQ

### Q1: 如何处理冲突的PR？

**A**:

1. 在本地合并目标分支：`git merge develop`
2. 解决冲突
3. 提交解决后的代码：`git commit -m "resolve conflicts"`
4. 推送到远程：`git push origin feature/xxx`

### Q2: 如何撤销最后一次commit？

**A**:

```bash
# 保留修改，撤销commit
git reset --soft HEAD~1

# 完全撤销（丢弃修改）
git reset --hard HEAD~1
```

### Q3: 如何修改已经push的commit消息？

**A**:

```bash
# 修改最后一次commit消息
git commit --amend -m "新的commit消息"
git push --force-with-lease
```

⚠️ **注意**：仅在你独自使用该分支时使用`--force`，否则会影响其他人。

### Q4: Code Review时发现严重Bug怎么办？

**A**:

1. 标记为"必须修改"（❌）
2. 阻止合并直到修复
3. 如果紧急，可要求作者立即修复并重新提交
4. 记录到Issue跟踪系统

---

## 十、工具推荐

### 开发工具

| 工具               | 用途             | 链接                           |
| ------------------ | ---------------- | ------------------------------ |
| **VS Code**        | 代码编辑器       | https://code.visualstudio.com/ |
| **Prisma Studio**  | 数据库可视化工具 | https://www.prisma.io/studio   |
| **Postman**        | API测试          | https://www.postman.com/       |
| **Docker Desktop** | 容器化管理       | https://www.docker.com/        |

### Git工具

| 工具               | 用途              | 链接                           |
| ------------------ | ----------------- | ------------------------------ |
| **GitKraken**      | Git图形化客户端   | https://www.gitkraken.com/     |
| **SourceTree**     | Atlassian Git工具 | https://www.sourcetreeapp.com/ |
| **GitHub Desktop** | GitHub官方客户端  | https://desktop.github.com/    |

### 代码质量

| 工具            | 用途                  | 配置位置       |
| --------------- | --------------------- | -------------- |
| **ESLint**      | JavaScript/TS代码检查 | `.eslintrc.js` |
| **Prettier**    | 代码格式化            | `.prettierrc`  |
| **Husky**       | Git hooks管理         | `.husky/`      |
| **lint-staged** | 暂存文件检查          | `package.json` |

---

## 附录：快速参考

### Git常用命令速查

```bash
# 创建分支
git checkout -b feature/xxx

# 查看状态
git status

# 添加文件
git add .

# 提交
git commit -m "feat: 添加新功能"

# 推送
git push origin feature/xxx

# 拉取最新代码
git pull origin develop

# 查看日志
git log --oneline -10

# 切换分支
git checkout develop

# 合并分支
git merge feature/xxx

# 删除本地分支
git branch -d feature/xxx

# 删除远程分支
git push origin --delete feature/xxx
```

### Commit消息模板

```
<type>(<scope>): <description>

<body>

<footer>
```

**快速填写**：

```bash
# feat
git commit -m "feat(order): 添加订单评价功能"

# fix
git commit -m "fix(payment): 修复支付回调失败"

# docs
git commit -m "docs(api): 补充用户接口文档"

# refactor
git commit -m "refactor(user): 重构用户服务层"
```

---

## 五、单元测试规范

### 5.1 测试框架选型

根据项目构建工具选择合适的测试框架：

| 项目                      | 构建工具    | 测试框架                       | 说明                     |
| ------------------------- | ----------- | ------------------------------ | ------------------------ |
| **apps/admin**            | Vite        | Vitest + React Testing Library | 与Vite无缝集成，配置简单 |
| **apps/server**           | Nest.js CLI | Jest + ts-jest                 | Nest.js官方推荐          |
| **apps/miniapp**          | Taro        | Jest                           | Taro官方支持             |
| **packages/shared-types** | TypeScript  | Vitest                         | 轻量快速                 |
| **packages/shared-utils** | TypeScript  | Vitest                         | 轻量快速                 |
| **packages/api-client**   | TypeScript  | Vitest                         | 轻量快速                 |

---

### 5.2 Admin前端测试（Vitest）

#### 安装依赖

```bash
pnpm add -D vitest @vitest/coverage-v8 @testing-library/react @testing-library/jest-dom
```

#### 配置文件

`apps/admin/vitest.config.ts`:

```typescript
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
    },
  },
});
```

#### 常用命令

```bash
# 运行所有测试（watch模式）
pnpm test

# 运行一次并退出
pnpm test:run

# 生成覆盖率报告
pnpm test:coverage
```

#### 测试文件命名规范

- 组件测试：`ComponentName.test.tsx`
- 工具函数测试：`utils.test.ts`
- Hook测试：`useHookName.test.ts`

#### 示例：组件测试

```typescript
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import Dashboard from '../pages/Dashboard';

describe('Dashboard', () => {
  it('should render dashboard title', () => {
    render(<Dashboard />);
    expect(screen.getByText('仪表盘')).toBeInTheDocument();
  });
});
```

---

### 5.3 Server后端测试（Jest）

#### 安装依赖

已包含在 `@nestjs/testing` 中，无需额外安装。

#### 配置文件

`apps/server/jest.config.json`:

```json
{
  "moduleFileExtensions": ["ts", "js"],
  "rootDir": "src",
  "testRegex": ".*\\.spec\\.ts$",
  "transform": {
    "^.+\\.(t|j)s$": "ts-jest"
  },
  "collectCoverageFrom": ["**/*.ts"],
  "coverageDirectory": "../coverage",
  "testEnvironment": "node"
}
```

#### 常用命令

```bash
# 运行所有测试
pnpm test

# 监听模式
pnpm test:watch

# 生成覆盖率
pnpm test:cov

# E2E测试
pnpm test:e2e
```

#### 测试文件命名规范

- 单元测试：`*.service.spec.ts`, `*.controller.spec.ts`
- E2E测试：`test/**/*.e2e-spec.ts`

#### 示例：Service测试

```typescript
import { Test, TestingModule } from "@nestjs/testing";
import { UserService } from "./user.service";
import { PrismaService } from "../prisma/prisma.service";

describe("UserService", () => {
  let service: UserService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UserService, PrismaService],
    }).compile();

    service = module.get<UserService>(UserService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });
});
```

---

### 5.4 Packages共享库测试（Vitest）

所有`packages/`目录下的共享库统一使用Vitest作为测试框架。

#### 已配置的包

| 包名                      | 说明          | 测试重点                 |
| ------------------------- | ------------- | ------------------------ |
| **@petcare/shared-types** | 共享类型定义  | 类型导出完整性           |
| **@petcare/shared-utils** | 共享工具函数  | 函数逻辑正确性、边界条件 |
| **@petcare/api-client**   | API客户端封装 | HTTP请求mock、响应处理   |

#### 配置文件

每个包的根目录下都有`vitest.config.ts`：

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
    },
  },
});
```

#### 常用命令

```bash
# 以shared-utils为例
cd packages/shared-utils

# 运行所有测试（watch模式）
pnpm test

# 运行一次并退出
pnpm test:run

# 生成覆盖率报告
pnpm test:coverage
```

#### 测试文件命名规范

- 工具函数测试：`functionName.test.ts`
- 类型测试：`typeName.test.ts`（使用tsd或手动类型检查）

#### 示例：工具函数测试

```typescript
// packages/shared-utils/src/format.test.ts
import { describe, it, expect } from "vitest";
import { formatCurrency } from "./format";

describe("formatCurrency", () => {
  it("should format number to CNY currency", () => {
    expect(formatCurrency(1234.56)).toBe("¥1,234.56");
  });

  it("should handle zero value", () => {
    expect(formatCurrency(0)).toBe("¥0.00");
  });

  it("should handle negative values", () => {
    expect(formatCurrency(-100)).toBe("-¥100.00");
  });
});
```

#### 示例：API客户端测试

```typescript
// packages/api-client/src/endpoints/user.test.ts
import { describe, it, expect, vi } from "vitest";
import { userEndpoints } from "./user";
import { http } from "../http";

vi.mock("../http", () => ({
  http: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

describe("userEndpoints", () => {
  it("should call correct endpoint for getUserById", () => {
    const mockResponse = { id: 1, name: "Test" };
    (http.get as any).mockResolvedValue(mockResponse);

    userEndpoints.getUserById(1);

    expect(http.get).toHaveBeenCalledWith("/users/1");
  });
});
```

---

### 5.5 测试覆盖率要求

| 项目类型         | 最低覆盖率 | 说明                |
| ---------------- | ---------- | ------------------- |
| **核心业务逻辑** | ≥ 80%      | Service层、工具函数 |
| **API控制器**    | ≥ 70%      | Controller层        |
| **UI组件**       | ≥ 60%      | 关键交互组件        |
| **工具函数**     | ≥ 90%      | shared-utils        |

---

### 5.6 测试编写最佳实践

1. **AAA模式**：Arrange（准备）→ Act（执行）→ Assert（断言）
2. **单一职责**：每个测试只验证一个行为
3. **独立运行**：测试之间不应有依赖关系
4. **Mock外部依赖**：数据库、API调用等需要mock
5. **有意义的描述**：测试名称应清晰表达测试意图

#### 反例 ❌

```typescript
it("test1", () => {
  // 测试名称不明确
});
```

#### 正例 ✅

```typescript
it("should return user detail when valid id is provided", () => {
  // 清晰描述测试场景和预期结果
});
```
