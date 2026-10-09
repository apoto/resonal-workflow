/**
 * SceneSpec の機械検品。
 *
 * 今の「セルフ検品8観点」は散文＋主観なので、レンダーを観るまで何も分からず、観ても見落とす
 * （目視だけでは止まっている箇所を見落とす）。spec がデータになっていれば、
 * 少なくとも**構成の破綻はレンダー前に**落とせる。画そのものの検品は
 * direction-library/records/motion-continuity-audit.md（レンダー後の実測）と対で使う。
 */

import { SceneSpec, Section, Line, allLines, treatmentsUsed } from './spec';
import { getTreatment } from './registry';

export type Finding = {
  level: 'error' | 'warn';
  rule: string;
  where: string;
  message: string;
};

/** 1文字あたりの最低表示時間（秒）。日本語の黙読速度から。 */
const SEC_PER_CHAR = 0.085;
const MIN_HOLD = 0.6;
/** 1曲で使ってよい treatment の上限。これ以上はデモリール化する。 */
const MAX_TREATMENTS = 4;

export function lintScene(spec: SceneSpec): Finding[] {
  const out: Finding[] = [];
  const push = (level: Finding['level'], rule: string, where: string, message: string) =>
    out.push({ level, rule, where, message });

  // --- 構成 ---------------------------------------------------------------
  const used = treatmentsUsed(spec);
  if (used.length > MAX_TREATMENTS) {
    push(
      'error',
      'too-many-treatments',
      'scene',
      `treatment が ${used.length} 種類 (${used.join(', ')})。上限 ${MAX_TREATMENTS}。見せ方を増やすほど1本の作品に見えなくなる`
    );
  }

  spec.sections.forEach((s, i) => {
    const prev = spec.sections[i - 1];
    if (prev && prev.treatment === s.treatment && !s.allowRepeat) {
      push(
        'warn',
        'adjacent-same-treatment',
        s.id,
        `直前 ${prev.id} と同じ treatment "${s.treatment}"。意図的なら allowRepeat: true、違うならセクションを統合するか見せ方を変える`
      );
    }
  });

  // サビは同じ見せ方で返ってくるほうがフックになる
  const choruses = spec.sections.filter((s) => s.kind === 'chorus');
  const chorusTreatments = new Set(choruses.map((s) => s.treatment));
  if (choruses.length > 1 && chorusTreatments.size > 1) {
    push(
      'warn',
      'chorus-inconsistent',
      choruses.map((s) => s.id).join(','),
      `サビの treatment が揃っていない (${[...chorusTreatments].join(', ')})。サビは同じ顔で返ってくるからフックになる`
    );
  }

  // --- 時間 ---------------------------------------------------------------
  spec.sections.forEach((s, i) => {
    if (s.to <= s.from) push('error', 'bad-range', s.id, `to(${s.to}) <= from(${s.from})`);
    const next = spec.sections[i + 1];
    if (next && next.from < s.to - 1e-6) {
      push('error', 'sections-overlap', `${s.id}/${next.id}`, `区間が重なっている (${s.to} > ${next.from})`);
    }
    s.lines.forEach((l, li) => {
      const w = `${s.id}#${li}`;
      if (l.t < s.from - 1e-6 || l.t + l.hold > s.to + 1e-6) {
        push('error', 'line-outside-section', w, `行が区間外 (${l.t}〜${(l.t + l.hold).toFixed(2)} ∉ ${s.from}〜${s.to})`);
      }
    });
  });

  const flat = allLines(spec).sort((a, b) => a.line.t - b.line.t);
  flat.forEach(({ line, section }, i) => {
    const w = `${section.id}@${line.t.toFixed(2)}`;
    const need = Math.max(MIN_HOLD, [...line.text].length * SEC_PER_CHAR);
    if (line.hold < need - 1e-6) {
      push('warn', 'too-fast-to-read', w, `${[...line.text].length}文字に hold=${line.hold}s は短い（目安 ${need.toFixed(1)}s）: "${line.text}"`);
    }
    const next = flat[i + 1];
    // 重なりを**型として使う**スタイルがある（刷り出して残す型は複数行が画面に共存する）。
    // その場合は section.params か line.params に allowOverlap を立てて宣言させる
    // ＝黙って警告が出続けると lint 自体が無視されるようになるため。
    const allowOverlap = Boolean(section.params?.allowOverlap ?? line.params?.allowOverlap);
    if (next && !allowOverlap && next.line.t < line.t + line.hold - 1e-6) {
      push('warn', 'lines-overlap', w, `次の行と重なっている（前の行が消える前に次が出る）: "${line.text}" / "${next.line.text}"`);
    }
  });

  // --- 空白（間が持たない区間） -------------------------------------------
  // 歌詞が無い区間そのものは正常（間奏）。**セクションが宣言されていれば**
  // 「そこは意図的に歌詞を置いていない」とみなして許す。
  // 危ないのは、どのセクションにも属さない時間が長く残っている場合＝設計から抜け落ちた区間。
  const GAP_LIMIT = 6.0;
  /** [a,b] がセクションの**和集合**で覆われているか（1本で跨いでいる必要はない） */
  const covered = (a: number, b: number) => {
    const ranges = spec.sections
      .map((s) => [Math.max(a, s.from), Math.min(b, s.to)] as [number, number])
      .filter(([x, y]) => y > x)
      .sort((p, q) => p[0] - q[0]);
    let reach = a;
    for (const [x, y] of ranges) {
      if (x > reach + 1e-6) return false; // 穴がある
      reach = Math.max(reach, y);
    }
    return reach >= b - 1e-6;
  };
  const busy: [number, number][] = [
    ...flat.map(({ line }) => [line.t, line.t + line.hold] as [number, number]),
    ...spec.sections.flatMap((s) => (s.overlays ?? []).map((o) => [o.t, o.t + o.hold] as [number, number])),
  ].sort((a, b) => a[0] - b[0]);
  let cursor = 0;
  const hasAmbient = (spec.stage.ambient?.length ?? 0) > 0;
  for (const [a, b] of busy) {
    if (a - cursor > GAP_LIMIT && !hasAmbient && !covered(cursor, a)) {
      push('warn', 'dead-air', `${cursor.toFixed(1)}〜${a.toFixed(1)}s`, `${(a - cursor).toFixed(1)}s がどのセクションにも属さない。間奏なら inst セクションとして宣言する（宣言済みなら許容される）`);
    }
    cursor = Math.max(cursor, b);
  }
  if (spec.meta.duration - cursor > GAP_LIMIT && !hasAmbient && !covered(cursor, spec.meta.duration)) {
    push('warn', 'dead-air', `${cursor.toFixed(1)}〜${spec.meta.duration}s`, `末尾 ${(spec.meta.duration - cursor).toFixed(1)}s が空`);
  }

  // --- 行ごとパラメータの濫用 ---------------------------------------------
  // params は「パラメータ振り」であって「見せ方の差し替え」ではない。
  // 1セクション内で params のキー構成がバラけすぎていたら、セクションを切るべきサイン。
  spec.sections.forEach((s) => {
    const shapes = new Set(s.lines.map((l) => Object.keys(l.params ?? {}).sort().join('|')));
    if (s.lines.length >= 4 && shapes.size > Math.ceil(s.lines.length / 2)) {
      push(
        'warn',
        'params-churn',
        s.id,
        `行ごとの params 構成が ${shapes.size} 通り／${s.lines.length}行。セクション内で見せ方が揺れている＝区間を切り直すサイン`
      );
    }
  });

  // --- 解釈されない params -------------------------------------------------
  const SPEC_KEYS = new Set(['scale', 'y', 'accent', 'soft', 'glitch', 'wideOnly', 'allowOverlap']);
  spec.sections.forEach((s: Section) => {
    const def = getTreatment(s.treatment);
    if (!def || !def.paramKeys) return;
    const known = new Set([...def.paramKeys, ...SPEC_KEYS]);
    const seen = new Map<string, string>();   // key -> どこで
    Object.keys(s.params ?? {}).forEach((k) => { if (!known.has(k)) seen.set(k, 'section.params'); });
    s.lines.forEach((l: Line, i) => {
      Object.keys(l.params ?? {}).forEach((k) => { if (!known.has(k)) seen.set(k, `lines[${i}].params`); });
    });
    seen.forEach((where, k) => {
      push(
        'warn',
        'unknown-param',
        s.id,
        `params "${k}"（${where}）を treatment "${s.treatment}" は解釈しない＝画に出ない。実装を読んで綴りか設計を直す`
      );
    });
  });

  return out;
}

export function formatFindings(findings: Finding[]): string {
  if (findings.length === 0) return 'lint: 指摘なし';
  const e = findings.filter((f) => f.level === 'error').length;
  const w = findings.length - e;
  return (
    `lint: error ${e} / warn ${w}\n` +
    findings
      .map((f) => `  [${f.level === 'error' ? 'E' : 'W'}] ${f.rule} (${f.where})\n      ${f.message}`)
      .join('\n')
  );
}
