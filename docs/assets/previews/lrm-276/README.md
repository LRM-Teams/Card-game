# LRM-276 断线重连可见反馈

## 89 烟测步骤

1. 打开 http://82.157.184.89:8088/ ，匹配开局至出牌阶段（`/game`）。
2. **出牌中强刷页面**（F5）：应先见顶部 banner「连接已断开，正在重连…」（spinner），牌桌保持可见不白屏。
3. 约数秒内重连成功：banner 消失，短暂 toast「已恢复对局」；手牌张数、轮到谁应与刷新前一致（服务端 snapshot）。
4. （可选）断网或停服 >30s：应出现「无法恢复连接」遮罩 + 主按钮「返回大厅」。

## 本地 bundle

```bash
pnpm --filter @card-game/client build
# dist: apps/client/dist/
```

## 实现要点

- `ReconnectFeedback`：全局 banner / toast / 失败引导
- `GameTable`：有 snapshot 时断线不再整页 TableShell 阻塞
- `gameStore`：30s 超时或 5 次重连尝试后 `reconnectFailed`
