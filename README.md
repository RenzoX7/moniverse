# Moniverse (个人资产全景管理)

## 本地开发
```bash
cd /Users/renzo/Documents/Moniverse
python3 -m http.server 8000
```
浏览器打开 `http://localhost:8000`。

## Cloudflare Worker
Worker 代码在 `worker/moniverse-worker.js`，部署说明见 `worker/README.md`。

部署完成后，在 `app.js` 顶部配置：
```js
const API_CONFIG = {
  apiBase: 'https://你的-worker.workers.dev',
  fxBase: 'https://你的-worker.workers.dev'
};
```

## CSV 导入导出格式
导出文件包含三个区块：`#ACCOUNTS`、`#ASSETS`、`#TRADES`。
```
#ACCOUNTS
id,name,principal,cash
...
#ASSETS
id,nameOrCode,symbol,accountId,quantity,cost,tag,currency,market
...
#TRADES
id,assetId,qty,price,date
...
```
