import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { TabBar } from '../src/app/components/TabBar';
import type { Screen } from '../src/lib/types';

/**
 * The bar as drawn, on every screen it is drawn on: exactly one tab current,
 * and it is the one `tabOf` names. Rendered rather than read, because the
 * defect was in the component — it tested `home` and `detail` for Receipts
 * and nothing else, so the claim pack, Edit and the money-back screen lit no
 * tab at all.
 */
const lit = (screen: Screen) => {
  const html = renderToStaticMarkup(createElement(TabBar, { screen, alert: false, onGo: () => {} }));
  return [...html.matchAll(/<button[^>]*aria-current="page"[^>]*>([\s\S]*?)<\/button>/g)].map((m) => m[1].replace(/<[^>]+>/g, '').trim());
};

describe('the tab bar on each screen', () => {
  it('lights Receipts on the claim pack, Edit and the money-back screen, which are all reached from a receipt', () => {
    expect(lit('pack')).toEqual(['Receipts']);
    expect(lit('edit')).toEqual(['Receipts']);
    expect(lit('celebrate')).toEqual(['Receipts']);
  });

  it('lights exactly one tab everywhere else it is drawn', () => {
    expect(lit('home')).toEqual(['Receipts']);
    expect(lit('detail')).toEqual(['Receipts']);
    expect(lit('watch')).toEqual(['Watch']);
    expect(lit('add')).toEqual(['Add']);
    expect(lit('settings')).toEqual(['Settings']);
  });

  it('draws the lit tab’s glyph solid and the rest outlined, and nothing above any tab', () => {
    const html = renderToStaticMarkup(createElement(TabBar, { screen: 'pack', alert: false, onGo: () => {} }));
    expect(html.match(/data-glyph="filled"/g)).toHaveLength(1);
    expect(html.match(/data-glyph="outline"/g)).toHaveLength(3);
    expect(html).not.toContain('data-tab-indicator');
  });
});
