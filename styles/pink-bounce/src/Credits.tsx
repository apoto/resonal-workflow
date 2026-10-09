import React from 'react';
import { AbsoluteFill } from 'remotion';
import { Glyph, PALETTE, PixelSvg, HEART_GRID, STAR_GRID, PLUS_GRID } from './PinkBounce';
import { MOCHIY_POP } from './fonts';
import { IntroCard } from './types';
import { clamp01, seeded } from './Camera';
import project from '../input/project.json';

/**
 * 冒頭クレジット。文言は input/project.json の credits（workflow.config.json の credits をそのまま写す）。
 * "Label: Name" 形式なら Label を小さいラベル、Name を大きい名前にする。
 * 秒は lyrics.json の meta.intro（i 番目のカードの t/hold）。無ければ 1.5 秒ずつ並べる。
 * カバーアートが主役のスタイルなので、全面カードではなく「キャンディ帯」を背景の上へハードカットで差し込む。
 * カットは小節頭にロックすると気持ちいい。
 */
export const cardsFromProject = (intro?: IntroCard[]): IntroCard[] =>
  (project.credits as string[]).map((s, i) => {
    const m = s.match(/^(.+?):\s*(.+)$/);
    const at = intro?.[i] ?? { t: i * 1.5, hold: 1.5 };
    return { t: at.t, hold: at.hold, title: m ? m[2] : s, sub: m ? m[1] : undefined, big: i === 0 };
  });

const easeOutBack = (t: number, overshoot = 2.0) => {
  const x = clamp01(t);
  return 1 + (overshoot + 1) * Math.pow(x - 1, 3) + overshoot * Math.pow(x - 1, 2);
};

const KINDS = [HEART_GRID, STAR_GRID, PLUS_GRID];
const COLORS = [PALETTE.HEART, PALETTE.STAR, PALETTE.PLUS];

/** カット直後にだけ弾ける小さなピクセルバースト（帯の左右から） */
const CutBurst: React.FC<{ age: number; index: number; scale: number }> = ({ age, index, scale }) => {
  if (age > 0.5) return null;
  const life = clamp01(1 - age / 0.5);
  const p = 1 - Math.pow(life, 2);
  return (
    <>
      {Array.from({ length: 10 }).map((_, i) => {
        const r = (k: number) => seeded(index * 31.7 + i * 5.3 + k);
        const left = i % 2 === 0;
        const x = left ? 6 + r(1) * 16 : 78 + r(1) * 16;
        const y = 52 + r(2) * 30;
        const kind = Math.floor(r(3) * 3);
        const size = (26 + r(4) * 30) * scale;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: `${x}%`,
              top: `${y}%`,
              transform: `translate(-50%,-50%) translate(${(left ? -1 : 1) * 60 * p}px, ${-70 * p}px) scale(${0.5 + life * 0.7}) rotate(${(r(5) - 0.5) * 160 * p}deg)`,
              opacity: life * 0.9,
              filter: `drop-shadow(0 0 ${size * 0.3}px ${COLORS[kind]}) drop-shadow(0 2px 0 #fff)`,
              imageRendering: 'pixelated',
            }}
          >
            <PixelSvg grid={KINDS[kind]} s={size} color={COLORS[kind]} />
          </div>
        );
      })}
    </>
  );
};

export const IntroCredits: React.FC<{
  cards: IntroCard[];
  sec: number;
  /** 9:16 では帯と文字を詰める */
  scale?: number;
}> = ({ cards, sec, scale = 1 }) => {
  const index = cards.findIndex((c) => sec >= c.t && sec < c.t + c.hold);
  if (index < 0) return null;
  const card = cards[index];
  const age = sec - card.t;

  // ハードカット感: 0.18秒でオーバーシュート着地＋最初の3フレームだけ白飛び＋横ジッタ
  const pop = easeOutBack(age / 0.18);
  const flash = age < 0.1 ? 1 - age / 0.1 : 0;
  const jitter = age < 0.14 ? (Math.floor(age / 0.045) % 2 === 0 ? -16 : 16) * scale : 0;
  // 帯は出際に少しだけ引く（静止させない）
  const settle = clamp01((age - 0.18) / (card.hold - 0.18));
  const slide = -settle * 14 * scale;

  const titleSize = (card.big ? 132 : 104) * scale;
  const subSize = 34 * scale;

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      {/* キャンディ帯: 白プレート＋ピンク内フチ。斜めに振ってポップに置く */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '76%',
          // 文字幅にぴったり吸い付く「キャンディラベル」。固定幅の帯だと余白が死んで置きっぱなしに見える。
          width: 'auto',
          maxWidth: '92%',
          transform: `translate(-50%,-50%) translate(${jitter + slide}px, 0) rotate(-2.2deg) scaleX(${0.86 + pop * 0.14}) scaleY(${0.6 + pop * 0.4})`,
          borderRadius: 999,
          background: `linear-gradient(180deg, #fffffff2 0%, #fff0f8f2 100%)`,
          border: `${Math.max(3, 8 * scale)}px solid ${PALETTE.OUTLINE_IN}`,
          boxShadow: `0 ${10 * scale}px 0 ${PALETTE.OUTLINE_IN}66, 0 0 ${44 * scale}px ${PALETTE.GLOW}`,
          padding: `${14 * scale}px ${72 * scale}px ${20 * scale}px`,
          textAlign: 'center',
          opacity: clamp01(age / 0.06),
        }}
      >
        {card.sub && (
          <div
            style={{
              fontFamily: MOCHIY_POP,
              fontSize: subSize,
              letterSpacing: '0.36em',
              color: PALETTE.OUTLINE_IN,
              marginBottom: 6 * scale,
              // 帯の中で sub だけ遅れて出す＝2段のリズム
              opacity: clamp01((age - 0.08) / 0.12),
            }}
          >
            {card.sub}
          </div>
        )}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            fontFamily: MOCHIY_POP,
            fontWeight: 800,
            fontSize: titleSize,
            lineHeight: 1.02,
            letterSpacing: '0.05em',
            whiteSpace: 'nowrap',
          }}
        >
          {Array.from(card.title ?? '').map((ch, i) => {
            // 1文字ずつステッガー＋常時ゆらぎ（帯の中でも死なせない）
            const cp = easeOutBack((age - i * 0.022) / 0.16);
            if (cp <= 0) return null;
            const wob = Math.sin(age * 8 + i * 0.8) * 4 * scale;
            return (
              <span
                key={i}
                style={{
                  display: 'inline-block',
                  transform: `translateY(${wob}px) rotate(${Math.sin(age * 6 + i) * 2}deg) scale(${cp})`,
                }}
              >
                <Glyph ch={ch} size={titleSize} neon={i % 2 === 1} />
              </span>
            );
          })}
        </div>
      </div>

      <CutBurst age={age} index={index} scale={scale} />
      {flash > 0 && <AbsoluteFill style={{ backgroundColor: '#ffffff', opacity: flash * 0.55 }} />}
    </AbsoluteFill>
  );
};
