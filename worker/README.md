# Moniverse Cloudflare Worker

该 Worker 提供三个接口：
- `/search?q=关键词` 资产联想
- `/quote?symbol=代码` 行情查询
- `/fx?base=CNY` 汇率

## 部署步骤（Cloudflare Workers）
1. 打开 Cloudflare Dashboard → Workers & Pages → Create
2. 选择 **Create Worker**
3. 进入编辑器后，把 `moniverse-worker.js` 全部内容粘贴进去
4. 点击 **Save and Deploy**
5. 记下你的 Worker URL，例如 `https://moniverse-worker.yourname.workers.dev`

## 前端配置
在 `app.js` 顶部 `API_CONFIG` 填入 Worker URL：
```js
const API_CONFIG = {
  apiBase: 'https://moniverse-worker.yourname.workers.dev',
  fxBase: 'https://moniverse-worker.yourname.workers.dev'
};
```

## 说明
- 行情数据来自 Yahoo Finance / 东方财富 / 基金估值接口
- 如需更稳定或更全面的数据源，可替换为付费 API
