# 音频资源许可说明（LRM-176）

本目录及 `apps/client/public/audio/` 下全部音频均为 **程序化合成的原创 placeholder**，供斗地主客户端 P0 听觉反馈使用。

## 来源

| 类别 | 路径 | 生成方式 |
|------|------|----------|
| 音效 SFX | `sfx/*.ogg` | Python 合成正弦/噪声后经 ffmpeg→Opus |
| BGM | `bgm/lobby.ogg` | Python 合成和弦琶音循环垫底后经 ffmpeg→Opus |
| 语音 stub | `voice/*.ogg` | Python 合成区分旋律 stub（非真人采样）；运行时若浏览器有中文 SpeechSynthesis 则优先 TTS |

## 版权声明

- **不含**任何腾讯 / 欢乐斗地主 / 其他商业游戏的音频资产或再采样。
- 素材由项目组自行合成，可随仓库商用与二次替换。
- 后续可用正式可商用音源或自制真人语音替换同名文件，无需改客户端路径约定。

## 文件清单

```
sfx/play.ogg      出牌
sfx/pass.ogg      不要 / 过
sfx/button.ogg    按钮点击
sfx/bomb.ogg      炸弹
sfx/rocket.ogg    火箭 / 王炸
sfx/win.ogg       胜利
sfx/lose.ogg      失败
bgm/lobby.ogg     大厅/对局 BGM（可开关，默认开）
voice/pass.ogg    「不要」
voice/bomb.ogg    「炸弹」
voice/rocket.ogg  「火箭」
voice/spring.ogg  「春天」
voice/win.ogg     「胜利」
voice/lose.ogg    「失败」
```
