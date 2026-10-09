import React from 'react';
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { Paper } from './Paper';
import { PhotocopyZineType, TypeItem, TypeLayout } from './PhotocopyZineType';
import { PAL, rand, rand2 } from './photocopy-zine';
import {
  CREDITS,
  CREDIT_HOLD,
  DEGRADE,
  DOUBLE_TIME_FROM,
  GHOSTS_UNTIL,
  OUTRO_STAMP,
  TITLE,
  TITLE_TEXT,
  cutAt,
  genAt,
  lerpAt,
} from './scenes';

export interface StageData {
  meta: {
    duration: number;
    fps: number;
    bpm: number;
    firstBeat: number;
    timingOffsetSec?: number;
    audio?: string;
  };
  lyrics: {
    t: number;
    hold: number;
    text: string;
    layout: TypeLayout;
    scale?: number;
    accent?: string;
    grp?: string;
    gi?: number;
    gn?: number;
  }[];
}

const FONT_MONO = '"Courier Prime", monospace';
const FONT_DISPLAY = 'Anton, sans-serif';
const FONT_JP = '"Noto Sans JP", sans-serif';

/** アンバーの回転警告灯のスイープ（サイレンの視覚版・周期2.2秒） */
const AmberSweep: React.FC<{ on: boolean; degrade: number }> = ({ on, degrade }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = (Math.floor(frame / 4) * 4) / fps;
  const phase = (t % 2.2) / 2.2;
  const x = -40 + phase * 180; // 画面外から画面外へ
  const strength = (on ? 1 : 0.12) * (0.42 + degrade * 0.16);
  if (strength < 0.02) return null;
  return (
    <AbsoluteFill style={{ pointerEvents: 'none', mixBlendMode: 'multiply', opacity: strength }}>
      <div
        style={{
          position: 'absolute',
          inset: '-20% -40%',
          background: `linear-gradient(100deg,
            rgba(0,0,0,0) ${x - 15}%,
            ${PAL.amberSoft} ${x - 6}%,
            ${PAL.amber} ${x}%,
            ${PAL.amberSoft} ${x + 6}%,
            rgba(0,0,0,0) ${x + 15}%)`,
        }}
      />
    </AbsoluteFill>
  );
};

/* コピー機のランプ（白フラッシュ）は入れない＝チラつくため。紙送りの打点は registration slam（位置のズレ）だけで取る。 */

/** 隅の書類UI：コピー世代・通し番号・タイムコード（mono・薄い黒） */
const Marks: React.FC<{ gen: string | null; sheet: number; sec: number; degrade: number }> = ({
  gen,
  sheet,
  sec,
  degrade,
}) => {
  const mm = String(Math.floor(sec / 60)).padStart(2, '0');
  const ss = String(Math.floor(sec % 60)).padStart(2, '0');

  const base: React.CSSProperties = {
    position: 'absolute',
    fontFamily: FONT_MONO,
    fontWeight: 700,
    fontSize: '1.9vh',
    letterSpacing: '0.2em',
    color: PAL.ink,
    opacity: 0.62 + degrade * 0.2,
    mixBlendMode: 'multiply',
  };
  return (
    <>
      {gg(gen) ? (
        <div style={{ ...base, left: '4.2%', bottom: '6.4%' }}>{gen}</div>
      ) : null}
      <div style={{ ...base, left: '4.2%', bottom: '3.6%', opacity: 0.5 + degrade * 0.15 }}>
        SHEET {String(sheet).padStart(3, '0')}
      </div>
      <div style={{ ...base, right: '4.2%', bottom: '3.6%', opacity: 0.5 + degrade * 0.15 }}>
        {mm}:{ss}
      </div>
    </>
  );
};
const gg = (s: string | null): s is string => !!s;

/** クレジット＝スタンプで押される（0.12秒で叩きつけ→わずかに沈む） */
const StampCredits: React.FC<{ sec: number }> = ({ sec }) => {
  const { fps } = useVideoConfig();
  return (
    <>
      {CREDITS.map((c, i) => {
        const d = sec - c.t;
        if (d < 0 || d > CREDIT_HOLD) return null;
        // 叩きつけ: 0→0.12s で 1.35倍から1.0へ、以後わずかに沈む
        const hit = Math.min(1, d / 0.12);
        const scale = interpolate(hit, [0, 1], [1.35, 1.0]);
        const settle = interpolate(d, [0.12, CREDIT_HOLD], [1.0, 0.985], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });
        // キックの1音目と同時に「ドン」＝立ち上がりは1フレーム相当（フェードすると打点が鈍る）
        const op = interpolate(d, [0, 0.02, CREDIT_HOLD - 0.14, CREDIT_HOLD], [0, 1, 1, 0]);
        const rot = rand2(i * 3.1) * 1.6;
        return (
          <div
            key={c.text}
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              transform: `translate(-50%,-50%) rotate(${rot}deg) scale(${scale * settle})`,
              opacity: op,
              mixBlendMode: 'multiply',
              fontFamily: c.jp ? FONT_JP : FONT_DISPLAY,
              fontWeight: c.jp ? 900 : 400,
              fontSize: c.jp ? '8.6vh' : '11.5vh',
              letterSpacing: c.jp ? '0.06em' : '0.03em',
              color: PAL.ink,
              whiteSpace: 'pre',
              // ink の乗りムラ（スタンプらしさ）
              filter: `contrast(${1.1 + (1 - hit) * 0.6})`,
            }}
          >
            {c.text}
          </div>
        );
      })}
    </>
  );
};

/** アウトロのスタンプ（文言と秒は scenes.ts の OUTRO_STAMP） */
const OutroStamp: React.FC<{ sec: number }> = ({ sec }) => {
  const d = sec - OUTRO_STAMP.t;
  if (d < 0) return null;
  const hit = Math.min(1, d / 0.1);
  const scale = interpolate(hit, [0, 1], [1.5, 1.0]);
  const op = interpolate(d, [0, 0.05, 8.5, 10.0], [0, 1, 1, 0], {
    extrapolateRight: 'clamp',
  });
  return (
    <div
      style={{
        position: 'absolute',
        left: '43%',
        top: '66%',
        transform: `translate(-50%,-50%) rotate(-11deg) scale(${scale})`,
        opacity: op,
        mixBlendMode: 'multiply',
        border: `0.9vh solid ${PAL.amber}`,
        borderRadius: '0.6vh',
        padding: '1.1vh 2.6vh 1.6vh',
        color: PAL.amber,
        fontFamily: FONT_DISPLAY,
        fontSize: '9.2vh',
        letterSpacing: '0.06em',
        whiteSpace: 'pre',
      }}
    >
      {OUTRO_STAMP.text}
    </div>
  );
};


/**
 * TitleSheet — タイトルが刷られた1枚の紙が、上から流れてきて中央で止まり、下へ抜ける。
 * タイトルは1行。装飾は文字を足さず図版だけ（二重罫 / パンチ穴 / トンボ / 横罫 / 丸スタンプ痕）。
 */
const TitleSheet: React.FC<{ stepSec: number; sec: number }> = ({ stepSec, sec }) => {
  if (stepSec < TITLE.in || stepSec >= TITLE.end) return null;
  const y =
    stepSec < TITLE.hold
      ? interpolate(stepSec, [TITLE.in, TITLE.hold], [-118, 0], { extrapolateRight: 'clamp' })
      : stepSec < TITLE.out
        ? 0
        : // 1拍で一気に引き抜く
          interpolate(stepSec, [TITLE.out, TITLE.end], [0, 130], { extrapolateRight: 'clamp' });
  // 紙が止まってからタイトルが左から刷られる
  const ink = interpolate(stepSec, [TITLE.hold, TITLE.hold + 0.5], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const clip = `inset(0 ${(1 - ink) * 100}% 0 0)`;
  const rule = `1px solid ${PAL.inkSoft}`;

  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        top: '50%',
        width: '86%',
        height: '56%',
        // ★押された瞬間、紙そのものが一瞬沈む（＝グッと押しつけられた）
        transform: `translate(-50%,-50%) translateY(${y}%) rotate(-0.7deg) scale(${
          sec >= TITLE.stamp && sec < TITLE.stamp + 0.1 ? 0.978 : 1
        })`,
        backgroundColor: PAL.paper,
        boxShadow: '0 0 60px rgba(0,0,0,0.22)',
        overflow: 'hidden',
      }}
    >
      {/* 記入欄の横罫（薄く・書類らしさ） */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0.16,
          backgroundImage: `repeating-linear-gradient(0deg, transparent 0 5.4%, ${PAL.inkSoft} 5.4% calc(5.4% + 1px))`,
        }}
      />
      {/* 外枠の二重罫 */}
      <div style={{ position: 'absolute', inset: '2.4%', border: `3px solid ${PAL.ink}` }} />
      <div style={{ position: 'absolute', inset: '4.2%', border: rule, opacity: 0.55 }} />

      {/* 左端のパンチ穴3つ */}
      {[30, 50, 70].map((t) => (
        <div
          key={t}
          style={{
            position: 'absolute',
            left: '1.15%',
            top: `${t}%`,
            width: '1.5vh',
            height: '1.5vh',
            transform: 'translate(-50%,-50%)',
            borderRadius: '50%',
            backgroundColor: PAL.paperDark,
            boxShadow: `inset 0 1px 2px rgba(0,0,0,0.35)`,
          }}
        />
      ))}

      {/* 四隅のトンボ */}
      {[
        { left: '3.4%', top: '7%' },
        { right: '3.4%', top: '7%' },
        { left: '3.4%', bottom: '7%' },
        { right: '3.4%', bottom: '7%' },
      ].map((pos, i) => (
        <div key={i} style={{ position: 'absolute', ...pos, width: '2.2vh', height: '2.2vh' }}>
          <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 1, backgroundColor: PAL.ink }} />
          <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, backgroundColor: PAL.ink }} />
        </div>
      ))}

      {/* アンバーの丸スタンプ痕（文字は入れない） */}
      <div
        style={{
          position: 'absolute',
          right: '7%',
          top: '17%',
          width: '11vh',
          height: '11vh',
          borderRadius: '50%',
          border: `0.7vh solid ${PAL.amber}`,
          opacity: 0.5,
          transform: 'rotate(-14deg)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          right: '9.2%',
          top: '19.2%',
          width: '6.6vh',
          height: '6.6vh',
          borderRadius: '50%',
          border: `0.28vh solid ${PAL.amber}`,
          opacity: 0.42,
        }}
      />

      {/* 押された指紋（public/thumbprint.png）。紙の上下ギリギリの大きさでタイトルに重なる。
          指は描かず、押し込みの物理（潰れて戻る／圧の暈／インクのにじみ）だけで「押された」と読ませる。 */}
      {sec >= TITLE.stamp ? (
        (() => {
          const d = sec - TITLE.stamp;
          // ①潰れて戻る: 押しつけた直後は横に広がって縦に潰れている
          const sx = interpolate(d, [0, 0.18], [1.22, 1.0], { extrapolateRight: 'clamp' });
          const sy = interpolate(d, [0, 0.18], [0.82, 1.0], { extrapolateRight: 'clamp' });
          // ③インクが紙に染みてゆっくり広がり続ける
          const bleed = interpolate(d, [0.16, 1.2], [1.0, 1.025], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });
          const op = interpolate(d, [0, 0.04], [0, 1], { extrapolateRight: 'clamp' });
          // ②圧の暈＝押した瞬間だけ、まわりの紙がわずかに沈んで見える
          const halo = interpolate(d, [0, 0.02, 0.22], [0, 0.5, 0], { extrapolateRight: 'clamp' });
          return (
            <>
              {halo > 0.01 ? (
                <div
                  style={{
                    position: 'absolute',
                    left: '50%',
                    top: '50%',
                    width: '46%',
                    height: '112%',
                    transform: 'translate(-50%,-50%)',
                    borderRadius: '50%',
                    opacity: halo,
                    mixBlendMode: 'multiply',
                    background:
                      'radial-gradient(ellipse at center, rgba(20,18,16,0.30) 0%, rgba(20,18,16,0.14) 52%, rgba(20,18,16,0) 72%)',
                  }}
                />
              ) : null}
              <div
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  height: '104%',
                  transform: `translate(-50%,-50%) rotate(-3deg) scale(${sx * bleed}, ${sy * bleed})`,
                  opacity: op,
                  mixBlendMode: 'multiply',
                }}
              >
                <Img src={staticFile('thumbprint.png')} style={{ height: '100%', display: 'block' }} />
              </div>
            </>
          );
        })()
      ) : null}

      {/* タイトル＝1行・横並び（改行なし） */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%,-50%)',
          clipPath: clip,
          WebkitClipPath: clip,
        }}
      >
        <span
          style={{
            fontFamily: FONT_DISPLAY,
            fontSize: '11.5vh',
            letterSpacing: '0.012em',
            color: PAL.ink,
            display: 'inline-block',
            transform: 'scaleX(0.87)',
            whiteSpace: 'pre',
          }}
        >
          {TITLE_TEXT}
        </span>
      </div>
    </div>
  );
};


export const Stage: React.FC<{ data: StageData; scale?: number; vertical?: boolean }> = ({
  data,
  scale = 1,
  vertical = false,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const off = data.meta.timingOffsetSec ?? 0;
  const sec = frame / fps + off;

  // ★紙とプレートの動きは6フレーム刻みに量子化する。
  //   (a) コピーされた紙は本来「止まっている1枚」＝連続移動は嘘
  //   (b) 網点が毎フレーム書き変わると時間方向の圧縮が全く効かない（実測 2.7GB）
  const stepSec = (Math.floor(frame / 6) * 6) / fps + off;
  const cut = cutAt(sec);
  const cutStartFrame = Math.round((cut.t - off) * fps);
  // ★劣化も量子化する。連続で動かすと網点の閾値とドット径が毎フレーム変わり、
  //   画面の全ピクセルが書き変わって時間方向の圧縮が効かない（実測 1.16GB）。
  //   6フレーム刻みの秒から引き、さらに 1/60 段に丸める＝見た目は変わらず段で進む。
  const degrade = Math.round(lerpAt(DEGRADE, stepSec) * 60) / 60;

  // 紙送り（feed 指定の区間だけ sheet が刻まれる）
  const fedSheets = cut.feed ? Math.floor((sec - cut.t) / cut.feed) : 0;
  const sheet = cut.sheet + fedSheets;

  // ── registration slam（拍で紙がガタッとズレる＝打点。サビ/Drop限定） ──
  const beat = 60 / data.meta.bpm;
  const sinceBeat = (sec - data.meta.firstBeat) % beat;
  const beatIdx = Math.floor((sec - data.meta.firstBeat) / beat);
  const slamAmp = cut.slam ? 1 : 0;
  // 1拍おき（2拍に1回）＝密になりすぎない。倍テンのラスサビだけ毎拍。
  const doubleTime = sec >= DOUBLE_TIME_FROM;
  const onSlamBeat = doubleTime ? true : beatIdx % 2 === 0;
  const slamEnv =
    slamAmp && onSlamBeat
      ? Math.max(0, 1 - sinceBeat / 0.1) * (0.6 + degrade * 0.6)
      : 0;
  // 冒頭の3打（拍に乗せる）: ①指紋の叩きつけ ②紙を引き抜く ③キャラが出る
  const hitAt = (t: number, dur: number) => (sec >= t && sec < t + dur ? 1 - (sec - t) / dur : 0);
  const stampHit = hitAt(TITLE.stamp, 0.18);
  const revealHit = hitAt(TITLE.end, 0.16);
  const slamX = slamEnv * 14 * rand2(beatIdx * 2.7) + stampHit * 10 + revealHit * 24;
  const slamY = slamEnv * 8 * rand2(beatIdx * 5.3) + stampHit * 30 - revealHit * 14;

  // ── プレートの変形（push-in / slide / 微ドリフト） ──
  const inCut = stepSec - cut.t;
  const pushK = cut.pushIn ? interpolate(inCut, [0, 6], [1.0, 1.09], { extrapolateRight: 'clamp' }) : 1;
  const slideY = vertical ? 0 : cut.slide === 1
    ? interpolate(inCut, [0, 5.4], [0, 118], { extrapolateRight: 'clamp' })
    : cut.slide === -1
      ? interpolate(inCut, [0, 2.4], [-118, 0], { extrapolateRight: 'clamp' })
      : 0;
  const drift = Math.sin(stepSec * 0.31 + cut.t) * 0.9;
  const plateTransform = `translate(${drift}%, ${slideY}%) scale(${pushK})`;

  // ── 歌詞 ──
  const items: TypeItem[] = data.lyrics.map((l) => ({
    ...l,
    style: 'center',
    startFrame: Math.round((l.t - off) * fps),
    endFrame: Math.round((l.t + l.hold - off) * fps),
  })) as TypeItem[];

  const gen = genAt(sec);

  return (
    <AbsoluteFill style={{ backgroundColor: PAL.paper, overflow: 'hidden' }}>
      <AbsoluteFill style={{ transform: `translate(${slamX}px, ${slamY}px)` }}>
        <Paper
          degrade={degrade}
          plate={cut.plate}
          plateOpacity={cut.op ?? 1}
          plateTransform={plateTransform}
          sheet={sheet}
          objectPosition={vertical ? 'center 26%' : undefined}
        />

        <PhotocopyZineType items={items} degrade={degrade} scale={scale} ghosts={sec < GHOSTS_UNTIL} />

        <TitleSheet stepSec={stepSec} sec={sec} />
        <StampCredits sec={sec} />
        <OutroStamp sec={sec} />
        <Marks gen={gen} sheet={sheet} sec={sec} degrade={degrade} />
      </AbsoluteFill>

      <AmberSweep on={!!cut.amber} degrade={degrade} />
    </AbsoluteFill>
  );
};
