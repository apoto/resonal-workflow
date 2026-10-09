import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { loadFont } from '@remotion/google-fonts/NotoSansJP';
import { Credit } from './types';

// クレジット（文言は workflow.config.json の credits。秒は song.config.ts）。
//  - 名前の出入りはハードカット（フェードで2枚が重なると読めない瞬間ができる）
//  - スクリムはクレジット区間中ずっと出す（名前ごとに出し入れすると点滅して見える）
//  - 意匠を曲で振りたいときは theme を渡す（文言と「出す」ことは動かさない）
const FONT = loadFont('normal', { weights: ['600', '800'], subsets: ['japanese', 'latin'], ignoreTooManyRequestsWarning: true }).fontFamily;
export type CreditsTheme = {
  ink: string;         // 文字色
  sub: string;         // subtitle 色
  glow: string;        // 文字グロー（'none' 可）
  scrim: string;       // スクリムのグラデーション（background 値）
  scrimEdge: number;   // スクリムのフェード秒（区間の出入りだけ・名前の切替では動かさない）
};
const DEFAULT_THEME: CreditsTheme = {
  ink: '#f4f2ff',
  sub: 'rgba(244,242,255,0.72)',
  glow: '0 0 22px rgba(120,110,255,0.55), 0 2px 10px rgba(0,0,0,0.85)',
  scrim: 'radial-gradient(ellipse 62% 46% at 50% 50%, rgba(4,1,14,0.62) 0%, rgba(4,1,14,0.34) 60%, rgba(4,1,14,0) 100%)',
  scrimEdge: 0.4,
};

export const Credits: React.FC<{ credits?: Credit[]; theme?: Partial<CreditsTheme>; offset?: number; scale?: number }> =
  ({ credits, theme, offset = 0, scale = 1 }) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    const t = frame / fps + offset;
    if (!credits || credits.length === 0) return null;
    const th = { ...DEFAULT_THEME, ...(theme ?? {}) };

    const span: [number, number] = [Math.min(...credits.map((c) => c.from)), Math.max(...credits.map((c) => c.to))];
    if (t < span[0] || t >= span[1]) return null;
    const active = credits.find((c) => t >= c.from && t < c.to);
    const scrimA = Math.max(0, Math.min((t - span[0]) / th.scrimEdge, (span[1] - t) / th.scrimEdge, 1));

    return (
      <AbsoluteFill style={{ pointerEvents: 'none' }}>
        <AbsoluteFill style={{ background: th.scrim, opacity: scrimA }} />
        {active && (
          <div style={{ position: 'absolute', left: '50%', top: '50%', transform: `translate(-50%,-50%) scale(${scale})`, textAlign: 'center' }}>
            {active.subtitle && (
              <div style={{
                fontFamily: FONT,
                fontWeight: 600, fontSize: 26, letterSpacing: '0.42em', color: th.sub,
                whiteSpace: 'nowrap', marginBottom: 14, textShadow: '0 2px 8px rgba(0,0,0,0.8)',
              }}>
                {active.subtitle}
              </div>
            )}
            <div style={{
              fontFamily: FONT,
              fontWeight: 800, fontSize: 64, letterSpacing: '0.3em', color: th.ink,
              whiteSpace: 'nowrap', textShadow: th.glow,
            }}>
              {active.text}
            </div>
          </div>
        )}
      </AbsoluteFill>
    );
  };
