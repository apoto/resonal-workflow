#!/usr/bin/env python3
"""歌詞フレーズの時間的な重なりを解消する（hold だけを詰める）。

shape-burst の核は「1フレーズ＝1画面のハードカット・重なり無し」。
タイミングを手で調整すると hold が次フレーズの t を跨いで、2フレーズが同時に描かれ文字が重なる。

方針:
  - t（開始秒）は動かさない（耳で合わせた値を尊重する）。
  - hold を `min(hold, 次のt - 自分のt)` に詰めるだけ。伸ばさない＝意図的な「間」は保たれる。

Usage: fix_overlaps.py <lyrics.json> [--apply]
  --apply を付けない限り書き換えない（差分の確認だけ）。
"""
import collections
import json
import sys

path = sys.argv[1]
apply = '--apply' in sys.argv

d = json.load(open(path), object_pairs_hook=collections.OrderedDict)
ph = sorted(d['phrases'], key=lambda x: x['t'])

fixed = []
for a, b in zip(ph, ph[1:]):
    gap = round(b['t'] - a['t'], 3)
    if a['hold'] > gap + 1e-9:
        fixed.append((a['t'], a['text'], a['hold'], gap))
        a['hold'] = gap

if not fixed:
    print('重なりなし')
    sys.exit(0)

print(f"重なりを解消するフレーズ: {len(fixed)}件（t は変更しない）")
for t, text, old, new in fixed:
    print(f"  {t:7.2f} hold {old:.2f} → {new:.2f}  「{text}」")

short = [x for x in ph if x['hold'] < 0.5]
if short:
    print(f"\n⚠ hold が 0.5秒未満になったフレーズ {len(short)}件（読めるか要確認）:")
    for x in short:
        print(f"  {x['t']:7.2f} hold={x['hold']:.2f} 「{x['text']}」")

if apply:
    d['phrases'] = ph
    json.dump(d, open(path, 'w'), ensure_ascii=False, indent=1)
    print('\n→ 書き込みました')
else:
    print('\n（--apply を付けると書き込み）')
