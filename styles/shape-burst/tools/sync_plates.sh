#!/bin/zsh
# public/ に実在するキャラ素材だけを input/lyrics.json の meta に配線する。
#   - public/plates/char_<表情>.png → meta.charPlates（base は必須）
#   - public/plates/char_closeup.png → meta.charCloseup（顔アップ構図用・任意）
#   - public/char_seq/ / public/char_seq_<表情>/ の 001.png〜 → meta.charSeqs（微動ループ連番・任意）
# meta にパスがあるのにファイルが無いと staticFile() が 404 でレンダーが落ちるため、実在するものだけ載せる。
set -eu
cd "$(dirname "$0")/.."
python3 - <<'PY'
import json, os, collections
p = 'input/lyrics.json'
d = json.load(open(p), object_pairs_hook=collections.OrderedDict)
want = ['base', 'downcast', 'sideglance', 'fang', 'closed']   # Stage.tsx の ExprKey と対応
plates = collections.OrderedDict()
missing = []
for k in want:
    rel = f'plates/char_{k}.png'
    if os.path.exists(os.path.join('public', rel)):
        plates[k] = rel
    else:
        missing.append(k)
assert 'base' in plates, 'plates/char_base.png が無い＝フォールバック先が無いので配線できない'
d['meta']['charPlates'] = plates

cu = 'plates/char_closeup.png'
if os.path.exists(os.path.join('public', cu)):
    d['meta']['charCloseup'] = cu
else:
    d['meta'].pop('charCloseup', None)

# 表情ごとの微動ループ連番。実在する分だけ配線し、枚数もディレクトリから数える。
seqs = collections.OrderedDict()
for k in want:
    dirname = 'char_seq' if k == 'base' else f'char_seq_{k}'
    full = os.path.join('public', dirname)
    if os.path.isdir(full):
        n = len([f for f in os.listdir(full) if f.endswith('.png')])
        if n > 0:
            seqs[k] = collections.OrderedDict([('dir', dirname), ('len', n), ('fps', 24)])
if seqs:
    d['meta']['charSeqs'] = seqs
else:
    d['meta'].pop('charSeqs', None)

json.dump(d, open(p, 'w'), ensure_ascii=False, indent=1)
print('配線:', ', '.join(plates))
print('未用意(base へフォールバック):', ', '.join(missing) if missing else 'なし')
print('顔アップ:', d['meta'].get('charCloseup', '無し（FACE_* 構図は通常プレートで描かれる）'))
if seqs:
    print('微動ループ:', ', '.join(f'{k}({v["len"]}枚)' for k, v in seqs.items()))
else:
    print('微動ループ: なし（全部静止画）')
PY
