import React from 'react';
import { AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { SongConfig, Shot, Style } from './types';
import { ShotView, ShotCtx, MoodDark, shotGeom, projectPct } from './ShotView';
import { WhiteOut, BlackOut } from './cuts';
import { Credits } from './Credits';
import { getStyle } from '../styles/registry';
import { config } from '../../input/song.config';

// 前トンネル（吸い込み）＝スクリーン効果。収束点は被写体の目に固定（アクティブショットの変換で目をスクリーン投影）。
const FrontTunnel: React.FC<{ cfg: SongConfig; shots: Shot[]; style: Style; offset?: number }> = ({ cfg, shots, style, offset = 0 }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const sec = frame / fps + offset;
  const { tunnelP } = cfg.lightAt(sec);
  if (tunnelP <= 0) return null;
  let vx = 50, vy = 50;
  if (cfg.eye) {
    const shot = shots.find((s) => sec >= s.start && sec < s.end);
    if (shot) {
      const g = shotGeom(shot, sec - shot.start, sec, frame, cfg.dropHits, width, height);
      const [ex, ey] = g.wide ? cfg.eye.wide : cfg.eye.vert;
      const p = projectPct(g, ex / 100, ey / 100, width, height);
      vx = p.vx; vy = p.vy;
    }
  }
  return <style.DecoFront light={{ rainbow: 0, tunnelP }} vx={vx} vy={vy} />;
};

const makeCtx = (cfg: SongConfig): ShotCtx => ({
  style: getStyle(cfg.style),
  lightAt: cfg.lightAt,
  dropHits: cfg.dropHits,
  bg: 'bg.png', fg: 'fg.png', bgV: 'bg_vertical.png', fgV: 'fg_vertical.png',
  bgLoop: cfg.bgLoop,
  scenes: cfg.scenes,
});

const ShotTrack: React.FC<{ shots: Shot[]; offset: number; ctx: ShotCtx }> = ({ shots, offset, ctx }) => {
  const { fps } = useVideoConfig();
  return (
    <>
      {shots.map((shot, i) => (
        <Sequence key={i} from={Math.round((shot.start - offset) * fps)} durationInFrames={Math.max(1, Math.round((shot.end - shot.start) * fps))} layout="none">
          <ShotView shot={shot} absStart={shot.start} ctx={ctx} />
        </Sequence>
      ))}
    </>
  );
};

const hardHideWindows = (cfg: SongConfig): [number, number][] =>
  (cfg.blackouts ?? []).filter((b) => b.hard).map((b) => [b.at, b.at + (b.hold ?? 0.3)]);

// 本編 16:9（props無し・configを直接読む＝関数をdefaultPropsで直列化しないため）
export const LyricVideo: React.FC = () => {
  const cfg = config;
  const ctx = makeCtx(cfg);
  const style = ctx.style;
  return (
    <AbsoluteFill style={{ backgroundColor: '#05010E' }}>
      <ShotTrack shots={cfg.shots16} offset={0} ctx={ctx} />
      <MoodDark bright={cfg.moodBright} />
      <FrontTunnel cfg={cfg} shots={cfg.shots16} style={style} />
      {(cfg.whiteouts ?? []).map((c, i) => <WhiteOut key={'w' + i} {...c} />)}
      {(cfg.blackouts ?? []).map((c, i) => <BlackOut key={'b' + i} {...c} />)}
      <style.Overlay fx={cfg.fx ?? {}} />
      <style.Grade />
      <style.Hud hideDuring={hardHideWindows(cfg)} />
      {cfg.lines.map((line, i) => <style.Phrase key={i} line={line} idx={i} scale={1} />)}
      {/* クレジット。最前面＝グレード/FXに沈めない */}
      <Credits credits={cfg.credits} />
      <Audio src={staticFile(cfg.meta.audio)} />
    </AbsoluteFill>
  );
};

// 縦ショート 9:16（区間切り出し）
export const ShortVideo: React.FC = () => {
  const cfg = config;
  const { start: startSec, end: endSec } = cfg.short;
  const ctx = makeCtx(cfg);
  const style = ctx.style;
  const { fps } = useVideoConfig();
  const scale = cfg.meta.shortScale ?? 0.82; // 04_build_lyrics.py が行幅計算に使う値と同じものを lyrics.json 経由で受け取る
  return (
    <AbsoluteFill style={{ backgroundColor: '#05010E' }}>
      <ShotTrack shots={cfg.shotsShort} offset={startSec} ctx={ctx} />
      <FrontTunnel cfg={cfg} shots={cfg.shotsShort} style={style} offset={startSec} />
      {/* 窓内の白飛び/停電も出す（offset=startSecで絶対秒に補正） */}
      {(cfg.whiteouts ?? []).map((c, i) => <WhiteOut key={'w' + i} {...c} offset={startSec} />)}
      {(cfg.blackouts ?? []).map((c, i) => <BlackOut key={'b' + i} {...c} offset={startSec} />)}
      <style.Overlay fx={cfg.fx ?? {}} offset={startSec} />
      <style.Grade />
      <style.Hud scale={scale} hideDuring={hardHideWindows(cfg).map(([a, b]) => [a - startSec, b - startSec])} />
      {cfg.lines.map((line, i) => <style.Phrase key={i} line={{ ...line, t: line.t - startSec }} idx={i} scale={scale} />)}
      <Audio src={staticFile(cfg.meta.audio)} startFrom={Math.round(startSec * fps)} endAt={Math.round(endSec * fps)} />
    </AbsoluteFill>
  );
};
