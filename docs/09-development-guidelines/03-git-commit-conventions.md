# Git Commit 规范

## Husky + Commitlint 配置

本项目已配置 Husky v10 和 commitlint 来强制规范 Git 提交。

### Pre-commit Hook

在每次提交前自动执行以下检查：

1. **Prettier** - 代码格式化
2. **ESLint** - 代码规范检查
3. **单元测试** - 运行受影响文件的测试

配置文件：`.husky/pre-commit`

### Commit Message 规范

Commit message 必须遵循 [Conventional Commits](https://www.conventionalcommits.org/) 规范。

#### 格式

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

#### Type 类型

| Type       | 说明                           |
| ---------- | ------------------------------ |
| `feat`     | 新功能                         |
| `fix`      | Bug 修复                       |
| `docs`     | 文档更新                       |
| `style`    | 代码格式（不影响代码运行）     |
| `refactor` | 重构（既不是新功能也不是修复） |
| `perf`     | 性能优化                       |
| `test`     | 测试相关                       |
| `chore`    | 构建过程或辅助工具变动         |
| `ci`       | CI 配置文件和脚本              |

#### 规则

- ✅ type 必须小写
- ✅ type 不能为空
- ✅ subject 不能为空
- ✅ subject 不能以 `.` 结尾
- ✅ header 最大长度 100 字符
- ✅ body 前需要空行
- ✅ footer 前需要空行

#### 示例

```bash
# ✅ 正确
git commit -m "feat: add user authentication"
git commit -m "fix: resolve login timeout issue"
git commit -m "docs: update API documentation"
git commit -m "feat(auth): add OAuth2 support"

# ❌ 错误
git commit -m "add new feature"           # 缺少 type
git commit -m "feat:"                     # subject 为空
git commit -m "FEAT: add feature"         # type 必须小写
git commit -m "feat: add feature."        # subject 不能以 . 结尾
```

### 配置文件

- `.husky/pre-commit` - Pre-commit hook 配置
- `.husky/commit-msg` - Commit message 验证 hook
- `commitlint.config.js` - Commitlint 规则配置
- `package.json` - lint-staged 配置

### 本地测试

```bash
# 测试 commit message 格式
echo "feat: test message" | npx commitlint

# 手动运行 lint-staged
npx lint-staged
```

### 常见问题

**Q: 如何跳过 hooks？**

A: 使用 `--no-verify` 标志（不推荐）：

```bash
git commit --no-verify -m "message"
```

**Q: 为什么我的 commit 被拒绝了？**

A: 检查 commit message 是否符合 Conventional Commits 规范，或代码是否通过了 ESLint/Prettier/测试检查。
