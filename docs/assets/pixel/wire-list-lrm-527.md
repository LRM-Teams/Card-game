# LRM-527 叙事音效接线（小雅 → 小林）

| ID | 路径 | 触发 |
|---|---|---|
| bid | `narrative-pixel/audio/bid.{ogg,mp3}` | 叫分 |
| play | `narrative-pixel/audio/play.{ogg,mp3}` | 出牌 |
| bomb | `narrative-pixel/audio/bomb.{ogg,mp3}` | 炸弹 |
| spring | `narrative-pixel/audio/spring.{ogg,mp3}` | 春天 |
| win | `narrative-pixel/audio/win.{ogg,mp3}` | 结算胜 |
| lose | `narrative-pixel/audio/lose.{ogg,mp3}` | 结算负 |

Narrative 主题优先读本目录，fallback `/audio/sfx/`。建议 `narrativeAudioAssets.ts` + `audioStore` 分支。
