# LRM-527 叙事音效试听

```bash
# 逐条试听（ogg）
for f in bid play bomb spring win lose; do ffplay -nodisp -autoexit apps/client/public/narrative-pixel/audio/$f.ogg; done

# 或 dev server 直链
# http://localhost:3099/narrative-pixel/audio/play.ogg
```

生成：`python3 docs/assets/narrative-pixel/generate_narrative_audio.py`
