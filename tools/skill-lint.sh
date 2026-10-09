#!/usr/bin/env bash
# リポジトリ内 skill（.claude/skills/<name>/）の機械検査。
#   ./tools/skill-lint.sh [skill ...]   （省略で全 skill）
#   - SKILL.md の frontmatter（--- で始まる・name がディレクトリ名と一致・description がある）
#   - 本文中の `相対パス.拡張子` の参照先が実在するか（リポジトリ直下・その skill 内・他の skill 内・MV テンプレート内のどれか）
#   - 経緯マーカー（日付・「以前は」等）が残っていないか。skill は手順だけを書き、経緯は git 履歴に任せる
# 非0 = 違反あり。
set -uo pipefail
REPO="$(git -C "$(dirname "$0")" rev-parse --show-toplevel 2>/dev/null || (cd "$(dirname "$0")/.." && pwd))"
cd "$REPO" || exit 1
SK=.claude/skills
MARK='(^|[^0-9])20[0-9]{2}-[0-9]{2}-[0-9]{2}([^0-9]|$)|以前は|経緯[:：]|教訓[:：]|実害[:：]'
rc=0; total=0
targets=("$@")
if [ ${#targets[@]} -eq 0 ]; then
  [ -d "$SK" ] || { echo "skill が無い（${SK}）"; exit 0; }
  for d in "$SK"/*/; do [ -d "$d" ] && targets+=("$(basename "$d")"); done
  [ ${#targets[@]} -gt 0 ] || { echo "skill が無い（${SK}）"; exit 0; }
fi
for s in "${targets[@]}"; do
  d="$SK/$s"
  [ -d "$d" ] || { echo "NG $s: ディレクトリが無い"; rc=1; continue; }
  [ -f "$d/SKILL.md" ] || { echo "NG $s: SKILL.md が無い"; rc=1; continue; }
  head -1 "$d/SKILL.md" | grep -q '^---$' || { echo "NG $s: frontmatter が無い"; rc=1; }
  grep -q "^name: $s\$" "$d/SKILL.md" || { echo "NG $s: frontmatter の name がディレクトリ名と違う"; rc=1; }
  grep -q '^description: .\+' "$d/SKILL.md" || { echo "NG $s: description が無い"; rc=1; }
  bytes="$(find "$d" -name '*.md' -exec cat {} + | wc -c | tr -d ' ')"
  # description（起動トリガー文）は数えない
  marks="$(find "$d" -name '*.md' -exec grep -hE "$MARK" {} + | grep -vc '^description: ' || true)"
  missing=0
  while IFS= read -r p; do
    [ -z "$p" ] && continue
    q="${p#./}"; q="${q%%#*}"; q="${q%% *}"; q="${q%%:*}"
    case "$q" in *"<"*|*">"*|*"*"*|*'$'*|../*|~*|/*) continue;; esac
    case "$q" in *.wav|*.mp4|*.png|*.jpg) continue;; esac   # 曲ごとの素材（置き場の説明）
    found=0
    for base in "" "$d/" "templates/mv/" "$SK"/*/; do [ -e "$base$q" ] && { found=1; break; }; done
    [ "$found" = 1 ] || { missing=$((missing+1)); echo "   !! $s: 参照先が無い: $p"; }
  done < <(find "$d" -name '*.md' -exec grep -ohE '`(\./)?[A-Za-z0-9_.-]+(/[A-Za-z0-9_.-]+)*/[A-Za-z0-9_.-]+\.(md|js|py|sh|json|tsx|ts)`' {} + | tr -d '`' | sort -u)
  mk="OK"; { [ "$marks" -gt 0 ] || [ "$missing" -gt 0 ]; } && { mk="NG"; rc=1; }
  total=$((total+bytes))
  printf "%s %-26s %7s bytes  経緯マーカー=%3s  参照切れ=%s\n" "$mk" "$s" "$bytes" "$marks" "$missing"
done
echo "合計 ${total} bytes（.md）"
exit $rc
