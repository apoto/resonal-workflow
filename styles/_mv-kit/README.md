# _mv-kit（plate-swap / portrait-frame が読む共有キット）

`styles/plate-swap` と `styles/portrait-frame` が相対パスで import する共有レイヤーです。単体では動きません（スタイル側の `package.json` で `npm install` する）。

| 場所 | 中身 |
|---|---|
| `src/spec.ts` | `SceneSpec`（1曲の組み立て指示書）の型。見せ方（treatment）はセクション単位で持ち、行は params だけ持つ |
| `src/lint.ts` / `src/headless.ts` | spec の機械検品（レンダー前に構成の破綻を落とす。React 非依存） |
| `src/Scene.tsx` | spec → Remotion の Sequence 木。演出は書かない |
| `src/registry.ts` | treatment / field / overlay / stageFx の登録簿 |
| `styles/plate-swap/` `styles/portrait-frame/` | スタイルパック（import すると registry に登録される） |
| `styles/burn-in/` | burn-in の SceneSpec 版パック。**どのスタイルからも使っていない別実装・未検証**（`styles/burn-in` 本体はこれを使わない） |

- 曲ごとに変えるのはスタイル側の `src/scene.ts`（配色 palette・画像・区間・歌詞）だけ。色や画像名をパックに書き込まない（他の曲を巻き込む）。
- 2つのスタイルから同じキットを読むので、キット側を直すと両方に効きます。
- コメントの中に `records/...` や `direction-library` という参照が残っていますが、このリポジトリには入っていません（制作元の演出メモの名残り）。

発展途上の実装をそのまま共有しています。型チェック（`tsc --noEmit`）は plate-swap / portrait-frame 側から通ることを確認済み。サポートはありません。
