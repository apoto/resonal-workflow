import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { DELA } from './fonts';

/**
 * エンドカード:
 *   器楽アウトロで動画素材を動かす → **電気がバチッ**（invertHits + 電光）→ **暗転** → **タイトル表示** で終わる。
 *
 * ここは「暗転」と「タイトル」だけを担う（バチッは既存の invertHits / SparkOverlay が鳴らす）。
 * タイトルは invert-shapes の署名に合わせ、**白いソリッド図形にタイトルを difference で重ねてネガポジ反転**させる。
 */
const WHITE = '#f2f4f8';

export const EndCard: React.FC<{
  ec?: { boltAt: number; blackFrom: number; titleFrom: number; title: string };
  t: number;
  scale?: number;
  /** true = 黒背景を敷かない（冒頭の曲名カード用。背景の上にタイトルだけ重ねる） */
  transparent?: boolean;
}> = ({ ec, t, scale = 1, transparent = false }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (!ec) return null;
  if (t < 0 || t < ec.blackFrom) return null;

  // 暗転はハードカット（invert-shapes の様式＝フェードしない）
  const titleOn = t >= ec.titleFrom;
  const local = (t - ec.titleFrom) * fps; // タイトル表示からの経過フレーム

  // 図形は少し遅れて（3f）ポップし、以後わずかに脈動
  const shapeT = Math.max(0, local - 3);
  const pop = Math.min(1, shapeT / 6);
  const puls = 1 + Math.sin(frame / 22) * 0.012;
  const size = 300 * scale;

  return (
    <AbsoluteFill style={{ backgroundColor: transparent ? 'transparent' : '#000000' }}>
      {titleOn ? (
        <AbsoluteFill style={{ isolation: 'isolate', alignItems: 'center', justifyContent: 'center' }}>
          {/* 白いソリッド図形（invert-shapes の核） */}
          <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
            <div
              style={{
                width: size * 2.5 * pop * puls,
                height: size * 2.5 * pop * puls,
                borderRadius: '50%',
                background: WHITE,
              }}
            />
          </AbsoluteFill>
          {/* タイトルを difference で重ねる＝図形に重なった部分だけ黒に反転する */}
          <AbsoluteFill style={{ mixBlendMode: 'difference', alignItems: 'center', justifyContent: 'center' }}>
            <div
              style={{
                fontFamily: DELA,
                fontSize: size,
                lineHeight: 0.96,
                letterSpacing: '-0.02em',
                color: WHITE,
                textAlign: 'center',
                transform: `scaleX(0.94)`,
              }}
            >
              {/* ★曲名は meta から。2語なら自動で2行に割る（英語は1行に詰めると画面外へ出る） */}
              {ec.title.split(/\s+/).map((w, i, a) => (
                <React.Fragment key={i}>
                  {w}
                  {i < a.length - 1 ? <br /> : null}
                </React.Fragment>
              ))}
            </div>
          </AbsoluteFill>
        </AbsoluteFill>
      ) : null}
    </AbsoluteFill>
  );
};
