# 🧠 课脉 CourseMind

**网课内容 → AI 提炼重点 → 可编辑思维导图**

一个轻量级工具，帮你把网课内容快速转化为结构化的思维导图。支持逐节分析、AI 拓展、手动编辑、最终合并为完整课程导图。

## ✨ 功能

- **AI 智能提炼** — 粘贴课程文本，AI 自动识别核心知识点，区分重点和补充信息
- **多 AI 服务商** — 支持 Anthropic Claude / OpenAI GPT / Google Gemini / Kimi / MiniMax
- **可编辑导图** — 双击编辑节点、添加/删除/标记重点
- **AI 拓展 & 对话** — 对任意节点进行 AI 启发拓展，还可以追问对话
- **分节累积** — 逐节分析，最后一键合并为完整课程总图
- **原文对照** — 原始文本保留，随时对照查看
- **保存/导入** — 导出为 JSON 文件，下次继续编辑
- **无限画布** — 拖拽平移 + 滚轮缩放

## 🚀 部署到 GitHub Pages

### 1. 创建 GitHub 仓库

```bash
# 克隆或下载本项目后
cd coursemind
git init
git add .
git commit -m "init"
git remote add origin https://github.com/YOUR_USERNAME/coursemind.git
git push -u origin main
```

### 2. 修改 base path

编辑 `vite.config.js`，把 `base` 改为你的仓库名：

```js
base: '/coursemind/',  // 改成你的仓库名
```

### 3. 开启 GitHub Pages

1. 进入仓库 → Settings → Pages
2. Source 选择 **GitHub Actions**
3. push 代码后会自动部署

### 4. 配置 AI API Key

部署完成后打开网站，点击右上角 **⚙️ AI设置**，选择服务商并填入 API Key。

## 🔑 各服务商 API Key 获取

| 服务商 | 获取地址 | 备注 |
|--------|---------|------|
| Anthropic | https://console.anthropic.com | 需要 CORS 代理 |
| OpenAI | https://platform.openai.com/api-keys | 需要 CORS 代理 |
| Google Gemini | https://aistudio.google.com/apikey | ✅ 可直接浏览器调用 |
| Kimi (Moonshot) | https://platform.moonshot.cn | 可能需要代理 |
| MiniMax | https://platform.minimaxi.com | 可能需要代理 |

> **推荐**：Gemini 免费额度大且支持浏览器直接调用，无需代理，适合入门。

## 🌐 CORS 代理（可选）

部分 API（如 Anthropic、OpenAI）不允许浏览器直接调用。你有两个选择：

### 方案 A：使用 Cloudflare Worker（推荐，免费）

1. 注册 [Cloudflare](https://dash.cloudflare.com)
2. 创建 Worker，粘贴 `worker/proxy.js` 的内容
3. 修改 `ALLOWED_ORIGINS` 为你的 GitHub Pages 域名
4. 部署后，在 CourseMind 设置中填入 Worker URL

### 方案 B：使用 Gemini

Google Gemini API 支持浏览器直接调用，无需代理。选择 Gemini 作为服务商即可。

## 🛠 本地开发

```bash
npm install
npm run dev
```

访问 http://localhost:5173

## 📁 项目结构

```
coursemind/
├── src/
│   ├── main.jsx          # 入口
│   ├── App.jsx           # 主组件
│   ├── ai.js             # 多服务商 AI 调用层
│   └── prompts.js        # AI 提示词
├── worker/
│   └── proxy.js          # Cloudflare Worker CORS 代理
├── .github/workflows/
│   └── deploy.yml        # GitHub Pages 自动部署
├── index.html
├── vite.config.js
└── package.json
```

## 📝 使用技巧

1. **粘贴字幕最佳** — 网课字幕比笔记更完整，效果更好
2. **指定重点方向** — 填写"重点方向"字段，AI 会侧重提炼
3. **逐节分析** — 一节一节来，最后合并效果最好
4. **善用 AI 拓展** — 对模糊的节点点 AI 按钮，获取深入启发
5. **手动调整** — AI 不完美，双击修改、删除冗余、标记真正的重点

## License

MIT
