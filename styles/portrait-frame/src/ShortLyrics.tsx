import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { fontFor, pal } from '../../_mv-kit/styles/portrait-frame/engine';
import { scene } from './scene';
import project from '../input/project.json';
import { SHORT_FROM } from './short';

/**
 * 縦ショート専用のテキスト層。**上下の帯**に置く。
 *
 * ★ショートの歌詞は「**上部の空白に特大**・意味単位で折り返す」。
 *   拡大率を下げて上下に帯を作ったので、そこが歌詞と曲名の置き場になる。
 */
const START = SHORT_FROM;

export const ShortLyrics: React.FC<{ bandTop: number; bandBottom: number }> = ({ bandTop, bandBottom }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const t = frame / fps + START;
  const palette = scene.stage.palette ?? {};

  let cur: string | null = null;
  for (const s of scene.sections) {
    for (const l of s.lines) {
      if (l.params?.notLyric) continue;
      if (t >= l.t && t < l.t + l.hold) cur = l.text;
    }
  }

  const floods = (scene.stage.ambientFront ?? []).filter((o) => o.id === 'portrait-frame.flood-white');
  const inWhiteout = floods.some((f) => {
    const peak = (f.params?.peak as number) ?? 0.42;
    const holdRatio = (f.params?.hold as number) ?? 0.16;
    return t >= f.t + f.hold * peak && t <= f.t + f.hold * (peak + holdRatio);
  });

  // 意味単位で折り返す（歌詞のスペースを改行位置として使う＝フレーズの途中で割らない）
  /**
   * 折り返しは**意味単位**（フレーズの途中で割らない）。
   * ★ただし歌詞のスペースをそのまま改行にすると細かく割れすぎる
   *   （「ほら 手 出して」→3行になり、帯からはみ出す／中央でも縦に間延びする）。
   *   **2〜3語は1行にまとめ、最大2行**にする。
   */
  const wrap = (text: string): string[] => {
    const w = text.split(/[\s　]+/).filter(Boolean);
    if (w.length <= 2) return [w.join(' ')];
    // 文字数がだいたい半分になる位置で2行に割る（語の途中では割らない）
    const total = w.join('').length;
    let acc = 0, cut = 1;
    for (let i = 0; i < w.length - 1; i += 1) {
      acc += w[i].length;
      if (acc >= total / 2) { cut = i + 1; break; }
      cut = i + 1;
    }
    return [w.slice(0, cut).join(' '), w.slice(cut).join(' ')];
  };
  const parts = cur ? wrap(cur) : [];
  const longest = parts.reduce((n, p) => Math.max(n, p.replace(/[\s　]/g, '').length), 0);
  const fit = Math.min(1, 8 / Math.max(1, longest));
  const size = width * 0.104 * fit * (parts.length > 1 ? 0.92 : 1);

  // 全白の間は中央に大きく（帯には出さない）
  if (inWhiteout && parts.length) {
    const big = width * 0.148 * Math.min(1, 7 / Math.max(1, longest));
    return (
      <AbsoluteFill
        style={{
          pointerEvents: 'none',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: big * 0.12,
          color: pal(palette, 'ink'),
          ...fontFor('display'),
        }}
      >
        {parts.map((p, i) => (
          <div key={i} style={{ fontSize: big, lineHeight: 1.04, letterSpacing: big * 0.02 }}>
            {p}
          </div>
        ))}
      </AbsoluteFill>
    );
  }

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      {/* 上の帯＝歌詞 */}
      <div
        style={{
          position: 'absolute',
          left: '5%',
          right: '5%',
          top: 0,
          height: bandTop,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          gap: size * 0.14,
          textAlign: 'center',
          color: pal(palette, 'ink'),
          ...fontFor('display'),
        }}
      >
        {parts.map((p, i) => (
          <div key={i} style={{ fontSize: size, lineHeight: 1.04, letterSpacing: size * 0.02 }}>
            {p}
          </div>
        ))}
      </div>

      {/* 下の帯＝曲名（固定） */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: bandBottom,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: pal(palette, 'ink'),
          opacity: 0.9,
          ...fontFor('display'),
        }}
      >
        <div style={{ fontSize: width * 0.072, letterSpacing: width * 0.004 }}>{project.title}</div>
      </div>
    </AbsoluteFill>
  );
};
