const subjectContainsChinese = ({ subject }) => [
  typeof subject === "string" && /\p{Script=Han}/u.test(subject),
  "subject must contain Chinese characters",
];

export default {
  extends: ["@commitlint/config-conventional"],
  plugins: [
    {
      rules: {
        "subject-contains-chinese": subjectContainsChinese,
      },
    },
  ],
  rules: {
    "type-enum": [
      2,
      "always",
      [
        "feat", // 新功能
        "fix", // Bug修复
        "docs", // 文档更新
        "style", // 代码格式（不影响代码运行）
        "refactor", // 重构（既不是新功能也不是修复）
        "perf", // 性能优化
        "test", // 测试相关
        "chore", // 构建过程或辅助工具变动
        "ci", // CI配置文件和脚本
      ],
    ],
    "type-case": [2, "always", "lower-case"],
    "type-empty": [2, "never"],
    "scope-case": [2, "always", "lower-case"],
    "subject-case": [0],
    "subject-empty": [2, "never"],
    "subject-full-stop": [2, "never", "."],
    "subject-contains-chinese": [2, "always"],
    "header-max-length": [2, "always", 100],
    "body-leading-blank": [2, "always"],
    "footer-leading-blank": [2, "always"],
  },
};
