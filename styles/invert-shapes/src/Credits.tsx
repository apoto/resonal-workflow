import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { NOTO_JP } from './fonts';
import project from '../input/project.json';

export type CreditTiming = { from: number; to: number };

const buildCards = (timing?: CreditTiming[]) =>
  ((project as { credits?: string[] }).credits ?? []).map((text, i) => ({
    text,
    subtitle: undefined as string | undefined,
    from: timing?.[i]?.from ?? 0.85 + i * 2.6,
    to: timing?.[i]?.to ?? 0.85 + (i + 1) * 2.6,
  }));

/**
 * MV クレジット。文言は input/project.json の credits（workflow.config.json の credits と同じ形）を1項目1枚で出す。
 * 秒は meta.credits（[{from,to}] を項目順に）。無ければ 0.85 秒から 2.6 秒刻み。
 *  - 冒頭イントロで順次ハードカット（フェード無し）。歌い出し前に終える。
 *  - 下スクリムはクレジット全区間で出しっぱなし＝名前ごとに点滅させない。
 *  - 書体は NOTO_JP 900（Dela Gothic One は小サイズの密な漢字が白つぶれする）。
 */
export const Credits: React.FC<{
  /** 秒の上書き（meta.credits） */
  credits?: CreditTiming[];
  scale?: number;
  startSec?: number;
}> = ({ credits: timing, scale = 1, startSec = 0 }) => {
  const credits = buildCards(timing);
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (credits.length === 0) return null;

  const t = startSec + frame / fps;
  const span = { from: credits[0].from, to: credits[credits.length - 1].to };
  const inSpan = t >= span.from && t < span.to;
  if (!inSpan) return null;

  const active = credits.find((c) => t >= c.from && t < c.to);

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      {/* 可読性スクリム：全区間出しっぱなし（名前ごとに点滅させない） */}
      <AbsoluteFill
        style={{
          background: 'linear-gradient(to top, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.55) 42%, rgba(0,0,0,0) 100%)',
          top: '52%',
        }}
      />
      {active ? (
        <AbsoluteFill
          style={{
            alignItems: 'center',
            justifyContent: 'flex-end',
            paddingBottom: `${9 * scale}%`,
          }}
        >
          <div
            style={{
              fontFamily: NOTO_JP,
              fontWeight: 900,
              // 純白より僅かに寒色の白
              color: '#f2f4f8',
              fontSize: 64 * scale,
              letterSpacing: 0.1 * 64 * scale,
              textAlign: 'center',
              lineHeight: 1.25,
              textShadow: '0 2px 18px rgba(0,0,0,0.9), 0 0 2px rgba(0,0,0,0.9)',
              whiteSpace: 'nowrap',
            }}
          >
            {active.text}
          </div>
          {active.subtitle ? (
            <div
              style={{
                fontFamily: NOTO_JP,
                fontWeight: 900,
                color: '#f2f4f8',
                opacity: 0.82,
                fontSize: 34 * scale,
                letterSpacing: 0.08 * 34 * scale,
                marginTop: 10 * scale,
              }}
            >
              {active.subtitle}
            </div>
          ) : null}
        </AbsoluteFill>
      ) : null}
    </AbsoluteFill>
  );
};
