# Moniverse (个人资产全景管理)

## 本地开发
```bash
cd /Users/renzo/Documents/Moniverse
python3 -m http.server 8000
```
浏览器打开 `http://localhost:8000`。

## 数据源配置
在 `app.js` 顶部的 `API_CONFIG` 中配置你的数据代理服务：
```js
const API_CONFIG = {
  apiBase: 'https://你的代理域名',
  fxBase: 'https://你的汇率代理域名'
};
```

说明：GitHub Pages 是静态站点，直接请求 yfinance/AKShare 往往会被 CORS 限制。建议使用 Cloudflare Worker 或 Vercel Function 做轻量代理。

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
