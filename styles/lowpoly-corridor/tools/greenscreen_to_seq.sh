#!/bin/zsh
# グリーンバックのキャラ動画 → 透過連番(public/char_seq)。
# クロマキー+despill → 断片除去(連結成分) → 穴埋め → (任意)Real-ESRGAN超解像 → 枠正規化 → ピンポン連番。
# 枠を正規化するので、キャラを差し替えても MainScene/ShortScene のカメラ設定をそのまま使える。
# 最後に SEQ_LEN(=連番枚数)を表示するので src/MainScene.tsx の SEQ_LEN をその値にする。
#
# Usage: tools/greenscreen_to_seq.sh <greenscreen_video.mp4>
# 依存: ffmpeg / python3 + numpy scipy pillow（PYTHON=... で別の python を指定可）
#       超解像したいときだけ REALESRGAN_DIR=<realesrgan-ncnn-vulkan と models/ のあるフォルダ>
set -eu
SRC="${1:?greenscreen video mp4}"
PROJ="$(cd "$(dirname "$0")/.." && pwd)"
SEQ="$PROJ/public/char_seq"
PY_BIN="${PYTHON:-python3}"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/resonal-seq.XXXXXX")/seq"; mkdir -p "$WORK"/{raw,clean,up}
trap 'rm -rf "$(dirname "$WORK")"' EXIT
# --- 1) 緑をサンプルしてクロマキー+despill → 30fps連番 ---
GREEN=$("$PY_BIN" - "$SRC" <<'PY'
import subprocess,sys,numpy as np
from PIL import Image
import io
p=subprocess.run(['ffmpeg','-v','error','-i',sys.argv[1],'-frames:v','1','-f','image2pipe','-vcodec','png','-'],capture_output=True)
im=Image.open(io.BytesIO(p.stdout)).convert('RGB'); r,g,b=im.getpixel((8,8)); print(f"0x{r:02x}{g:02x}{b:02x}")
PY
)
echo "[key] green=$GREEN"
ffmpeg -v error -i "$SRC" -r 30 -vf "chromakey=$GREEN:0.22:0.10,despill=type=green:mix=0.5:expand=0.4" "$WORK/raw/%03d.png"

# --- 2) 断片除去(連結成分・本体+面積2%以上) + 穴埋め + 二値化alpha ---
"$PY_BIN" - "$WORK" <<'PY'
import numpy as np, glob, sys
from PIL import Image, ImageFilter
from scipy.ndimage import label, binary_fill_holes, binary_closing, binary_dilation
W=sys.argv[1]
for f in sorted(glob.glob(f"{W}/raw/*.png")):
    im=Image.open(f).convert("RGBA"); arr=np.array(im); a=arr[:,:,3]; mask=a>30
    lbl,n=label(mask,structure=np.ones((3,3)))
    if n>0:
        sizes=np.array([(lbl==i).sum() for i in range(1,n+1)])
        keep=set(i+1 for i,s in enumerate(sizes) if s>=sizes.max()*0.02); mask=np.isin(lbl,list(keep))
    mask=binary_closing(mask,iterations=2); mask=binary_fill_holes(mask); mask=binary_dilation(mask,iterations=1)
    arr[:,:,3]=np.where(mask,255,0).astype(np.uint8)
    out=Image.fromarray(arr); al=out.split()[-1].filter(ImageFilter.GaussianBlur(0.6)); out.putalpha(al)
    out.save(f.replace("/raw/","/clean/"))
print("[clean] done")
PY

# --- 3) Real-ESRGAN x2 超解像（REALESRGAN_DIR があるときだけ） ---
if [ -n "${REALESRGAN_DIR:-}" ] && [ -x "$REALESRGAN_DIR/realesrgan-ncnn-vulkan" ]; then
  "$REALESRGAN_DIR/realesrgan-ncnn-vulkan" -i "$WORK/clean" -o "$WORK/up" -m "$REALESRGAN_DIR/models" -n realesr-animevideov3-x2 -s 2 -f png 2>/dev/null
  echo "[esrgan] up done"
else
  cp "$WORK"/clean/*.png "$WORK/up/"
  echo "[esrgan] skip（REALESRGAN_DIR 未設定）"
fi

# --- 4) 枠正規化(aspect0.667・頭頂0.16/足元0.96・水平中央・足元固定) + 5) ピンポン連番 → public/char_seq ---
rm -rf "$SEQ"; mkdir -p "$SEQ"
"$PY_BIN" - "$WORK" "$SEQ" <<'PY'
import glob, sys, numpy as np
from PIL import Image
W,SEQ=sys.argv[1],sys.argv[2]
ups=sorted(glob.glob(f"{W}/up/*.png"))
CW=1200; CH=int(round(CW/0.667)); TOP=0.16; FOOT=0.96; targetH=int((FOOT-TOP)*CH); footpx=int(FOOT*CH)
norm=[]
data=[]
for f in ups:
    im=Image.open(f).convert("RGBA"); a=np.array(im)[:,:,3]
    ys=np.where(a.max(axis=1)>20)[0]; xs=np.where(a.max(axis=0)>20)[0]
    data.append((im,(xs.min(),ys.min(),xs.max()+1,ys.max()+1)))
mid=data[len(data)//2][1]; scale=targetH/(mid[3]-mid[1])
for im,bbox in data:
    ch=im.crop(bbox); ch=ch.resize((int(ch.width*scale),int(ch.height*scale)),Image.LANCZOS)
    cv=Image.new("RGBA",(CW,CH),(0,0,0,0)); cv.alpha_composite(ch,((CW-ch.width)//2, footpx-ch.height)); norm.append(cv)
order=list(range(len(norm)))+list(range(len(norm)-2,0,-1))  # ピンポン
for i,idx in enumerate(order,start=1): norm[idx].save(f"{SEQ}/{i:03d}.png")
print(f"[done] SEQ_LEN = {len(order)}  → src/MainScene.tsx の SEQ_LEN をこの値に更新")
PY
