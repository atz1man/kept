import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Every browser sweep runs in exactly one shard, and the shards answer as one.
 *
 * The browser job is a matrix now: it outgrew one runner (9.8 minutes on 28
 * September, 22.7 on 5 October, against a 25-minute backstop), so each sweep
 * step carries `if: matrix.shard == '<name>'`. That condition is a new way to
 * lose a gate without anyone seeing it go: a shard name spelt wrong matches no
 * runner, the step is skipped on all three, and a skipped step is green. A
 * step with no condition at all is the opposite fault, run three times over,
 * which is the minutes the split was made to save.
 *
 * It reads the REAL workflow, like `sweeps-report.test.ts` beside it, and the
 * rules are a function of the text so they can be shown to catch what they
 * are for on a workflow that is wrong.
 */
const WORKFLOW = readFileSync(join(__dirname, '..', '.github', 'workflows', 'ci.yml'), 'utf8');

/** A top-level job's block: from its key to the next job's key. */
function job(text: string, key: string): string {
  const start = text.indexOf(`\n  ${key}:\n`);
  if (start < 0) return '';
  const rest = text.slice(start + 1);
  const next = rest.slice(1).search(/\n {2}[\w-]+:\n/);
  return next < 0 ? rest : rest.slice(0, next + 1);
}

interface Sweep { scripts: string[]; shard: string | null }

function shardsOf(text: string): { shards: string[]; sweeps: Sweep[] } {
  const block = job(text, 'browser');
  const list = block.match(/\n\s+shard: \[([^\]]*)\]/);
  const shards = list ? list[1].split(',').map((s) => s.trim()).filter(Boolean) : [];
  const sweeps = block
    .split(/\n {6}- /)
    .slice(1)
    .map((step) => ({
      scripts: [...step.matchAll(/npm run ([\w:-]+)/g)].map((m) => m[1]),
      shard: step.match(/\n\s+if: matrix\.shard == '([\w-]+)'/)?.[1] ?? null,
    }))
    .filter((s) => s.scripts.length > 0);
  return { shards, sweeps };
}

/** Every way the split can lose or repeat a sweep, as sentences. */
function problems(text: string): string[] {
  const { shards, sweeps } = shardsOf(text);
  const out: string[] = [];
  if (shards.length < 2) out.push(`the browser job lists ${shards.length} shard(s)`);
  for (const s of sweeps) {
    const name = s.scripts.join(' && ');
    if (s.shard === null) out.push(`${name} has no shard, so it runs on every one`);
    else if (!shards.includes(s.shard)) out.push(`${name} is in "${s.shard}", which no runner is`);
  }
  for (const shard of shards) {
    if (!sweeps.some((s) => s.shard === shard)) out.push(`shard "${shard}" runs no sweep`);
  }
  const gate = job(text, 'browser-result');
  if (!/\n\s+name: browser\n/.test(gate)) out.push('no job answers as "browser"');
  if (!/\n\s+needs: browser\n/.test(gate)) out.push('the "browser" result does not wait for the shards');
  if (!/\n\s+if: always\(\)\n/.test(gate)) out.push('the "browser" result is skipped when a shard fails, and a skipped check is not a red one');
  if (!/needs\.browser\.result/.test(gate) || !/= success/.test(gate)) out.push('the "browser" result does not check what the shards returned');
  return out;
}

describe('the browser shards', () => {
  it('finds the sweeps it is meant to be checking', () => {
    const { shards, sweeps } = shardsOf(WORKFLOW);
    expect(shards.length).toBeGreaterThanOrEqual(2);
    const scripts = sweeps.flatMap((s) => s.scripts);
    for (const sweep of ['smoke', 'contrast', 'a11y', 'layout', 'agreement', 'freshness', 'ios', 'feed:wiring']) {
      expect(scripts, `${sweep} is no longer a browser step`).toContain(sweep);
    }
  });

  it('runs every sweep in exactly one shard that exists, and answers as one "browser" check', () => {
    expect(problems(WORKFLOW)).toEqual([]);
  });

  it('would say so if a shard name were misspelt, a step lost its shard, or a shard ran nothing', () => {
    const misspelt = WORKFLOW.replace("if: matrix.shard == 'screens'\n        run: npm run contrast", "if: matrix.shard == 'screen'\n        run: npm run contrast");
    expect(misspelt).not.toBe(WORKFLOW);
    expect(problems(misspelt)).toContain('contrast is in "screen", which no runner is');

    const unsharded = WORKFLOW.replace("        if: matrix.shard == 'journeys'\n        run: npm run smoke", '        run: npm run smoke');
    expect(unsharded).not.toBe(WORKFLOW);
    expect(problems(unsharded)).toContain('smoke has no shard, so it runs on every one');

    const idle = WORKFLOW.replace(/shard: \[([^\]]*)\]/, 'shard: [$1, spare]');
    expect(problems(idle)).toContain('shard "spare" runs no sweep');
  });

  it('would say so if the "browser" result passed over a failed shard', () => {
    const skipped = WORKFLOW.replace(/(\n {2}browser-result:[\s\S]*?)\n {4}if: always\(\)\n/, '$1\n');
    expect(skipped).not.toBe(WORKFLOW);
    expect(problems(skipped)).toContain('the "browser" result is skipped when a shard fails, and a skipped check is not a red one');

    const gone = WORKFLOW.replace(/\n {2}browser-result:[\s\S]*?(?=\n {2}# The iPhone app)/, '\n');
    expect(gone).not.toBe(WORKFLOW);
    expect(problems(gone)).toContain('no job answers as "browser"');
  });
});
