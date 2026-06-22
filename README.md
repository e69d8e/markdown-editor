# Markdown Editor

一款基于 Electron 的桌面端 Markdown 编辑器，支持实时预览，使用 React + TypeScript + CodeMirror 6 构建。

## 功能特性

### 三种视图模式

| 模式 | 说明 |
|------|------|
| **源码模式** | 纯代码编辑，显示行号、折叠标记、语法高亮 |
| **WYSIWYG 模式** | 所见即所得，Markdown 语法实时渲染为富文本，当前编辑行保持原始语法 |
| **分屏模式**（默认） | 左侧编辑器 + 右侧实时预览，拖拽分隔线调整比例，双向滚动同步 |

### WYSIWYG 实时渲染

在 WYSIWYG 模式下，以下 Markdown 元素会实时渲染为视觉样式：

- **标题** (H1–H6) — 隐藏 `#` 标记，衬线字体展示
- **粗体 / 斜体 / 删除线** — 隐藏标记符，内容直接加粗/倾斜/划线
- **行内代码** — 珊瑚色高亮 + 圆角背景
- **链接** — 隐藏方括号和 URL，文字显示为珊瑚色下划线
- **图片** — 直接在编辑器中渲染图片预览
- **有序 / 无序列表** — 隐藏标记，显示编号或圆点
- **引用块** — 左侧珊瑚色边框 + 灰色背景
- **围栏代码块** — 带语言标签头部的样式化代码区域
- **任务列表** — 渲染为复选框
- **水平分隔线** — 渲染为 `<hr>` 样式

> 当前编辑行始终显示原始 Markdown 源码，方便直接修改。

### 编辑器功能

- **语法高亮** — 支持 100+ 编程语言的代码块高亮（基于 highlight.js）
- **代码折叠** — 源码模式下的折叠标记
- **搜索替换** — 内置搜索面板，显示匹配计数（X / Y）
- **选中高亮** — 自动高亮文档中所有相同文本
- **撤销/重做** — 完整的历史记录
- **CJK 字数统计** — 中文字符逐字计数

### 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Cmd/Ctrl + N` | 新建文件 |
| `Cmd/Ctrl + O` | 打开文件 |
| `Cmd/Ctrl + S` | 保存文件 |
| `Cmd/Ctrl + Shift + S` | 另存为 |
| `Cmd/Ctrl + B` | 插入粗体 |
| `Cmd/Ctrl + I` | 插入斜体 |
| `` Cmd/Ctrl + ` `` | 插入行内代码 |
| `Cmd/Ctrl + K` | 插入链接 |

### 文件操作

- 打开 `.md`、`.markdown`、`.txt` 及任意文件
- 保存为 `.md` 或 `.txt` 格式
- 窗口标题栏显示当前文件名
- 工具栏显示文件路径、字数/字符数/行数统计

## 技术架构

```
electron-vite 构建（三个独立目标）
├── electron/main.ts       — 主进程：窗口管理、原生菜单、IPC 文件对话框
├── electron/preload.ts    — 预加载桥接：contextBridge 暴露 electronAPI
└── src/                   — 渲染进程（React 应用）
    ├── main.tsx           — 入口
    ├── components/
    │   ├── App.tsx        — 根组件：视图模式、分屏、滚动同步
    │   ├── Editor.tsx     — CodeMirror 6 编辑器封装
    │   ├── Preview.tsx    — markdown-it HTML 预览
    │   └── Toolbar.tsx    — 工具栏与格式化按钮
    ├── hooks/
    │   └── useMarkdown.ts — 状态管理、markdown-it 配置、IPC 通信
    ├── plugins/
    │   └── livePreview.ts — WYSIWYG 模式的 CodeMirror 装饰插件
    └── styles/            — CSS 样式
```

### 技术栈

| 层 | 技术 |
|----|------|
| 桌面框架 | Electron 28 |
| 构建工具 | electron-vite (Vite 5) |
| UI 框架 | React 18 |
| 编辑器 | CodeMirror 6 |
| Markdown 解析 | markdown-it |
| 代码高亮 | highlight.js |
| 打包分发 | electron-builder |
| 语言 | TypeScript 5 |

## 开发

### 环境要求

- Node.js >= 18
- npm

### 安装与运行

```bash
# 安装依赖
npm install

# 开发模式（热更新）
npm run dev

# 构建
npm run build
```

### 打包安装程序

```bash
# macOS（.dmg + .zip）
npm run build:mac

# Windows（.exe NSIS 安装程序）
npm run build:win

# Linux（.AppImage + .deb）
npm run build:linux

# 全部平台
npm run build:all
```

> **注意：** macOS 安装程序只能在 macOS 上构建；Windows 和 Linux 安装程序在 macOS 上构建需要安装 Wine（`brew install wine`）。

构建产物输出到 `dist/` 目录。

## 设计风格

采用暖色调编辑器设计语言：

- **主色调：** 珊瑚色 `#cc785c`
- **画布底色：** 米白 `#faf9f5`
- **文字色：** 深墨 `#141413`
- **字体：** Outfit（正文）、Lora（衬线标题）、Fira Code（等宽代码）

## 许可证

MIT
