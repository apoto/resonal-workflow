/**
 * steps.js — 1曲の6工程と、その「終わったか」の判定（中身の軽い検査だけ）。
 * 各 check(ctx) は null（完了）か { who: 'ai'|'human', why, todo } を返す。
 * 判定の正本はこのファイルだけ（next.js は順に呼ぶだけ）。
 */
const path = require('path');

const ai = (why, todo) => ({ who: 'ai', why, todo });
const human = (why, todo) => ({ who: 'human', why, todo });

// 「## 見出し」の本文（次の ## まで）。見出しは部分一致
function section(md, pred) {
  const lines = (md || '').split('\n');
  const i = lines.findIndex((l) => /^##\s/.test(l) && pred(l));
  if (i < 0) return null;
  const body = [];
  for (const l of lines.slice(i + 1)) { if (/^##\s/.test(l)) break; body.push(l); }
  return body.filter((l) => l.trim() && !/^```/.test(l.trim()));
}

const STEPS = [
  {
    id: 'planning', label: '企画', skill: 'planning',
    check(c) {
      const md = c.read(c.file('BRIEF.md'));
      if (!md) return ai('BRIEF.md が無い', 'コンセプト案を2〜3つ BRIEF.md に書く（各案は「### 案A …」の見出し）');
      const plans = md.split('\n').filter((l) => /^#{2,4}\s.*案/.test(l) && !/選んだ案/.test(l));
      if (plans.length < 2) return ai(`案が ${plans.length} つ`, 'BRIEF.md に案を2つ以上並べる（「### 案A …」「### 案B …」）');
      const chosen = section(md, (l) => /選んだ案/.test(l));
      if (!chosen || !chosen.length) {
        return human('どの案にするか未決定', '案を人に見せて選んでもらい、BRIEF.md の「## 選んだ案」に結果と理由を書く');
      }
      return null;
    },
  },
  {
    id: 'lyrics', label: '作詞', skill: 'lyric-writing',
    check(c) {
      const md = c.read(c.file('LYRICS.md'));
      if (!md) return ai('LYRICS.md が無い', 'BRIEF.md の選んだ案から歌詞を書く');
      const disp = section(md, (l) => l.includes('表示用'));
      const suno = section(md, (l) => /suno/i.test(l));
      const miss = [!disp || !disp.length ? '「## 歌詞（表示用）」' : null, !suno || !suno.length ? '「## 歌詞（Suno用）」' : null].filter(Boolean);
      if (miss.length) return ai(`${miss.join('・')} 節が無い／空`, 'LYRICS.md に表示用（MV の字幕）と Suno用（構成タグ付き）の2節を書く');
      return null;
    },
  },
  {
    id: 'composing', label: '作曲', skill: 'composing',
    check(c) {
      const music = c.config.get('providers.music'); const image = c.config.get('providers.image');
      const txt = ['suno_style.txt', 'suno_lyrics.txt'].filter((f) => !c.exists(c.file(f)));
      if (txt.length) return ai(`${txt.join(' / ')} が無い`, '音源の生成に渡す Style と Lyrics をファイルに書き出す');
      const coverOk = () => { const s = c.imageSize(c.file('cover.png')); return s && s.w > s.h; };
      // 画像を生成できる設定（codex / other）なら AI の番。manual は音源と同じく人が置く
      if (image.use !== 'manual' && !coverOk()) {
        return ai('cover.png が無い／横長でない', `tools/gen_image.sh でカバー（横長 16:9）を作って cover.png に置く（providers.image=${image.use}）`);
      }
      // 音源はどのサービスでも人が作って置く
      const how = {
        suno: 'Suno で生成し、気に入ったテイクを WAV でダウンロードして',
        other: `providers.music の note（${music.note || '未記入'}）のとおりに生成し、WAV を`,
        manual: '用意した音源を WAV で',
      }[music.use];
      const wav = c.file('audio.wav');
      const alsoCover = coverOk() ? '' : '。cover.png（横長）もまだ無いので、cover_prompt.txt を見せて一緒に置いてもらう';
      if (!c.exists(wav)) return human('audio.wav が無い', `${how}曲フォルダに audio.wav として置く${alsoCover}`);
      const d = c.duration(wav);
      if (c.probe(wav).errors || !d) return human('audio.wav がデコードできない', 'WAV を書き出し直して置き直す');
      if (d < 30) return human(`audio.wav が ${d.toFixed(1)} 秒`, '30 秒以上の完成テイクを置く');
      if (!coverOk()) return human('cover.png が無い／横長でない', '横長（16:9 推奨）のカバー画像を cover.png として置く');
      return null;
    },
  },
  {
    id: 'mastering', label: 'マスタリング', skill: 'mastering',
    check(c) {
      const master = c.file(`${c.title}.wav`);
      const run = `python3 mastering/auto_master.py "songs/${c.name}/audio.wav" --promote`;
      if (!c.exists(master)) return ai(`${c.title}.wav が無い`, run);
      const s = c.masterSpec(); const m = c.loudness(master);
      if (!m) return ai(`${c.title}.wav が読めない`, `${run} --force`);
      if (Math.abs(m.lufs - s.lufs) > s.lufsTol || m.tp > s.tpCeil) {
        return ai(`実測 ${m.lufs} LUFS / ${m.tp} dBTP（目標 ${s.lufs}±${s.lufsTol} / ≤${s.tpCeil}）`, `${run} --force`);
      }
      return null;
    },
  },
  {
    id: 'music-video', label: 'MV', skill: 'music-video',
    check(c) {
      const make = `tools/make_mv.sh "songs/${c.name}"`;
      const main = c.file(`${c.title}.mp4`); const short = c.file(`${c.title} (Short).mp4`);
      const miss = [main, short, c.file('thumbnail.jpg')].filter((p) => !c.exists(p)).map((p) => path.basename(p));
      if (miss.length) return ai(`${miss.join(' / ')} が無い`, make);
      for (const p of [main, short]) if (c.probe(p).errors) return ai(`${path.basename(p)} がデコードできない`, make);
      const a = c.loudness(main); const m = c.loudness(c.file(`${c.title}.wav`));
      if (!a || !m || Math.abs(a.lufs - m.lufs) > 1) {
        return ai(`本編の音（${a && a.lufs} LUFS）がマスター（${m && m.lufs} LUFS）と違う`, `マスター確定後に作り直す: ${make}`);
      }
      if (!c.sj.approved_at) {
        return human('人が見ていない', '本編とショートを人に見てもらう。OK なら song.json の approved_at に日付を入れる（直しがあれば直して作り直す）');
      }
      return null;
    },
  },
  {
    id: 'release-prep', label: 'リリース準備', skill: 'release-prep',
    check(c) {
      const prep = `tools/release_prep.sh "songs/${c.name}"`;
      // 作るものはリリース先（workflow.config.json の release.targets）で決まる。none は判定なしで完了
      const t = c.config.get('release').targets;
      if (t.includes('none')) return null;
      const jacket = t.includes('dsp') || t.includes('other');
      const texts = [t.includes('youtube') && 'youtube.txt', t.includes('dsp') && 'dsp.txt'].filter(Boolean);
      const files = [jacket && 'jacket_3000.jpg', t.includes('youtube') && 'thumbnail.jpg', ...texts, 'UPLOAD-CHECKLIST.md'].filter(Boolean);
      const miss = files.filter((f) => !c.exists(c.file(path.join('release', f))));
      if (miss.length) return ai(`release/ に ${miss.join(' / ')} が無い`, prep);
      const s = jacket && c.imageSize(c.file('release/jacket_3000.jpg'));
      if (jacket && (!s || s.w !== 3000 || s.h !== 3000)) return ai('jacket_3000.jpg が 3000×3000 でない', prep);
      // 雛形は先頭に [下書き] 行を持つ＝AI が文面を整えたら消す
      const draft = texts.filter((f) => /^\[下書き\]/.test(c.read(c.file(path.join('release', f))) || ''));
      if (draft.length) return ai(`${draft.join(' / ')} が下書きのまま`, '文面を整え、先頭の [下書き] 行を消す');
      return null;
    },
  },
];

/** 曲の全工程を判定。[{ step, result }]（result=null は完了） */
function evaluate(ctx) {
  return STEPS.map((step) => {
    let result;
    try { result = step.check(ctx); } catch (e) { result = ai(`判定が例外: ${e.message}`, '原因を調べる'); }
    return { step, result };
  });
}

module.exports = { STEPS, evaluate, section };
