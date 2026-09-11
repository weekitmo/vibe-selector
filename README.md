<div align="center">

# Vibe Selector

**把任意网页元素变成 AI 编程助手的上下文**

指向、选中、复制 —— 结构化提示词 · Markdown · 截图

[![Release](https://img.shields.io/badge/%E6%9C%80%E6%96%B0%E7%89%88%E6%9C%AC-Releases-blue)](../../releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](#license)

[下载安装](#安装) · [功能总览](#功能) · [快捷键](#快捷键) · [常见问题](#常见问题)

</div>

---

## 为什么需要它

给 AI 编程助手（Cursor、Claude Code、Copilot…）描述「页面上那个按钮」总是很低效：截图、手写选择器、来回确认。**Vibe Selector 让你直接在页面上指给它看** —— 选中元素，一键复制 AI 可读的上下文，粘贴进对话框即可。

## 功能

### 🎯 精准选中

- 点击选中，`Shift+点击` 多选，拖拽框选
- 方向键在父子 / 兄弟元素间导航
- 每个元素可附加上下文说明与备注

### 📋 三种复制

| 复制内容 | 适合场景 |
|---|---|
| **结构化提示词** | 元素定位、语义位置、布局摘要、框架信息（React / Vue）—— AI 直接理解你要改哪 |
| **Markdown** | 标题、列表、表格、代码块、链接、图片，格式完整保留 |
| **截图** | 所见即所得，带完整上下文一并复制 |

### 📸 截图增强

- **三种范围**：视口 / 整个元素 / 整页（自动滚动拼接长页面）
- **跨域资源内联**：截图前自动抓取跨域图片、样式表、字体，报告尽可能还原原页面
- 复制进剪贴板，直接粘贴给支持图片的 AI 助手

### ⚙️ 其他特性

- **三种唤起**：快捷键 / 工具栏图标 / 右键菜单
- **跨标签页保持**：切换标签页、刷新、SPA 跳转后自动恢复
- **中英双语界面**：面板内一键切换
- **设置同步**：所有偏好经 Chrome 账号跨设备同步

## 安装

### 方式一：下载 Release（推荐）

1. 从 [Releases](../../releases) 下载最新的 `vibe-selector-vX.X.X.zip`
2. 解压得到 `dist-extension` 文件夹（或直接使用压缩包内的目录）
3. 打开 Chrome，访问 `chrome://extensions`
4. 打开右上角 **「开发者模式」**
5. 点击 **「加载已解压的扩展程序」**，选择解压后的文件夹

> 需要 Chrome 116+。这是开发者模式安装，浏览器可能会在启动时提示「请关闭开发者模式扩展」，选择保留即可。

### 方式二：从源码构建

```bash
git clone <repo-url>
cd vibe-selector
npm run build
```

无需安装任何依赖，然后在 `chrome://extensions` 加载 `dist-extension/`，同上。

## 快捷键

### 唤起 / 关闭

| 默认快捷键 | 说明 |
|---|---|
| `Alt+Shift+S` | 唤起 / 关闭选择器（可在 `chrome://extensions/shortcuts` 修改） |

### 选中后（页面内）

| 快捷键 | 动作 |
|---|---|
| `⌘C` / `Ctrl+C` | 复制结构化提示词 |
| `⌘⇧C` / `Ctrl+Shift+C` | 截图 + 提示词 |
| `⌘M` / `Ctrl+M` | 复制 Markdown |
| `Esc` | 取消选择 / 关闭面板 |

> 页面内快捷键可在选择器面板的 **设置** 中录制自定义组合；全局快捷键在 `chrome://extensions/shortcuts` 配置。

## 使用示例

```
你 → AI：
  帮我改这个按钮的悬停颜色（Vibe Selector 复制的上下文）
  <button> 元素，位于侧边栏导航，当前 hover 为 #f5f5f5 ……

AI → 你：
  好的，这是修改方案：……
```

## 常见问题

**安装后点击工具栏图标没反应？**
先在普通网页上测试（`chrome://` 商店页等受保护页面无法注入）。仍无反应时，到 `chrome://extensions` 打开本扩展的「服务工作进程」控制台运行：

```js
const m = await import(chrome.runtime.getURL("diagnose.js"));
await m.diagnose();
```

按控制台提示定位问题。

**截图没有保存成文件？**
默认行为是**只复制到剪贴板**（避免触发下载管理器拦截）。需要存文件时，在设置里打开「自动保存 PNG」。

**快捷键冲突？**
浏览器可能占用了 `Alt+Shift+S`。到 `chrome://extensions/shortcuts` 改成任意你喜欢的组合。

**如何更新？**
下载新版 Release 重新加载即可，设置会自动保留。

## 开发

<details>
<summary>构建与测试（面向贡献者）</summary>

```bash
npm run build          # 打包 extension/ → dist-extension/（无任何外部依赖）
node scripts/e2e.mjs   # 真实浏览器 E2E（27 项断言）
```

</details>

## License

MIT
