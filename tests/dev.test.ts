import { describe, expect, it } from 'vitest';
import { renderDevMenu } from '../src/cli/screen';
import { devTools } from '../src/game/dev';
import { createInitialState } from '../src/game/state';

const plain = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, '');

describe('development tools', () => {
  const use = (label: string) => {
    const s = createInitialState(0);
    devTools.find((t) => t.label === label)!.apply(s);
    return s;
  };

  it('adds a billion points, Lines and Sentences', () => {
    expect(use('Add 1 billion bananas').currency).toBe(1e9);
    expect(use('Add 1,000 Lines').lines).toBe(1000);
    expect(use('Add 1,000 Sentences').sentences).toBe(1000);
  });

  it('gives every letter once', () => {
    const s = use('Own every letter');
    expect(s.letters).toHaveLength(26);
    expect(new Set(s.letters).size).toBe(26);
  });

  it('lists each tool with its number key', () => {
    expect(plain(renderDevMenu(createInitialState(0)))).toContain('[1] Add 1 billion bananas');
  });
});
