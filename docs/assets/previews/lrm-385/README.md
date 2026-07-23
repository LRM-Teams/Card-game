# LRM-385 邀请进房验收附录

- 规格：`docs/invite-entry-spec.md`
- 图标 license：`docs/assets/invite/LICENSE.md`（MDI Apache-2.0）

## 验收路径（89 现网）

1. **邀请方**：大厅 → 创建房间 → 房间页点「邀请好友」→ 复制链接
2. **被邀请方**：新标签打开链接（或大厅粘贴链接）→ 自动加入 → `/room` 同房
3. **开局**：满 3 真人自动开局 / 房主手动开始

## 组件

| 文件 | 说明 |
|---|---|
| `apps/client/src/components/InviteModal.tsx` | 邀请弹层 |
| `apps/client/src/components/Room.tsx` | 房间页「邀请好友」入口 |
| `apps/client/src/components/Lobby.tsx` | 大厅粘贴链接/房间号加入 |
| `apps/client/src/lib/invite.ts` | 链接构建与房间号解析 |

## 烟测命令

```bash
pnpm install
pnpm build
# 本地：apps/server + apps/client dev
```

## 截图占位

> 部署 89 后补充：邀请弹层截图、深链进房截图各 1 张。
