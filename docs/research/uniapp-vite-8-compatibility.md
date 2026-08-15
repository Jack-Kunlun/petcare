# UniApp 与 Vite 8 兼容性核验

> 核验日期：2026-08-15
> 范围：PetCare PR [#27](https://github.com/Jack-Kunlun/petcare/pull/27) 与 [#19](https://github.com/Jack-Kunlun/petcare/pull/19)；仅使用 DCloud 官方文档、DCloud 官方 GitHub tag 和 npm 官方 Registry 元数据。

## 结论

**证据不足，不升级 Miniapp 到 Vite 8。关闭 #27 当前版本；如其他应用需要 Vite 8，另开不触及 `apps/miniapp` 的 PR。**

当前 `@dcloudio/vite-plugin-uni@3.0.0-4080520251106001`、#19 目标版 `3.0.0-5020420260811002`，以及核验时 npm `vue3` 标签指向的更新版本 `3.0.0-5020420260813002`，均把 `peerDependencies.vite` 精确声明为 `5.2.8`，不是包含 Vite 8 的版本范围。DCloud 两个对应 tag 的 workspace catalog 也都固定为 Vite `5.2.8`。未找到 DCloud 对这几版插件支持 Vite 8 的官方说明。

PetCare 现有 Node 24/H5 构建基线通过 `packageExtensions` 为 `@dcloudio/uni-h5-vite` 显式注入 Vite `5.4.21`，客户端也实际解析到该版本。本次维护锁定这个已验证的项目基线，不扩大到 Vite 8；但 `5.4.21` 同样不满足插件精确 peer `5.2.8`，因此它是项目现有兼容性例外，不代表 DCloud 官方支持。

#19 也不应原样合并：它只更新 `@dcloudio/vite-plugin-uni`，没有同步项目中的其他 `@dcloudio/*` 编译器包。DCloud 官方建议使用 `@dcloudio/uvm` 管理编译器主要依赖，并说明 IDE、编译器、运行时保持版本一致可减少兼容问题。[官方 CLI 升级说明](https://uniapp.dcloud.net.cn/quickstart-cli.html#%E6%9B%B4%E6%96%B0%E4%BE%9D%E8%B5%96%E5%88%B0%E6%8C%87%E5%AE%9A%E7%89%88%E6%9C%AC)

## 已验证事实

| 对象                                         | 官方 Vite 约束     | 相关官方依赖                                                                 |
| -------------------------------------------- | ------------------ | ---------------------------------------------------------------------------- |
| 当前插件 `3.0.0-4080520251106001`            | peer `vite: 5.2.8` | `@vitejs/plugin-vue: 5.2.4`、`plugin-legacy: 5.3.2`、`plugin-vue-jsx: 3.1.0` |
| #19 目标插件 `3.0.0-5020420260811002`        | peer `vite: 5.2.8` | 同上                                                                         |
| npm `vue3` 标签版本 `3.0.0-5020420260813002` | peer `vite: 5.2.8` | 同上                                                                         |

来源：

- npm Registry：[当前版元数据](https://registry.npmjs.org/@dcloudio%2Fvite-plugin-uni/3.0.0-4080520251106001)、[#19 目标版元数据](https://registry.npmjs.org/@dcloudio%2Fvite-plugin-uni/3.0.0-5020420260811002)、[核验时 `vue3` 标签版本元数据](https://registry.npmjs.org/@dcloudio%2Fvite-plugin-uni/3.0.0-5020420260813002)。
- DCloud GitHub：[当前版插件 `package.json`](https://github.com/dcloudio/uni-app/blob/v3.0.0-4080520251106001/packages/vite-plugin-uni/package.json)、[#19 目标版插件 `package.json`](https://github.com/dcloudio/uni-app/blob/v3.0.0-5020420260811002/packages/vite-plugin-uni/package.json)。源码中的 `catalog:` 由同 tag 的 [当前版 catalog](https://github.com/dcloudio/uni-app/blob/v3.0.0-4080520251106001/pnpm-workspace.yaml) 和 [目标版 catalog](https://github.com/dcloudio/uni-app/blob/v3.0.0-5020420260811002/pnpm-workspace.yaml) 解析为 `vite: 5.2.8`。
- #27 实际同时把 `apps/admin` 与 `apps/miniapp` 的 Vite 升级到 `^8.2.1`；#19 只改 Miniapp 的单个 DCloud 插件。[#27](https://github.com/Jack-Kunlun/petcare/pull/27)；[#19](https://github.com/Jack-Kunlun/petcare/pull/19)

## 推论与不确定性

- **推论：** Vite 8 不满足精确 peer 约束 `5.2.8`，因此 #27 超出 DCloud 对这些发布版本声明的兼容范围；包管理器允许安装或一次 H5 构建成功，都不能变成官方支持证据。
- **不确定性：** 没有官方支持证据不等于已证明 Vite 8 必然无法运行；结论是风险不可接受，而不是断言所有目标端必然失败。
- **重新评估条件：** 等 DCloud 发布的 `@dcloudio/vite-plugin-uni` 明确把 peer 范围扩展到 Vite 8，并同步其 Vite 插件依赖后，再成组升级 UniApp 编译器包，并分别验证 H5、微信小程序、Android 与 iOS。
