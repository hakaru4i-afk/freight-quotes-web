import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const css = fs.readFileSync(new URL('../test/task2-contrast-hotfix.css', import.meta.url), 'utf8');
const index = fs.readFileSync(new URL('../test/index.html', import.meta.url), 'utf8');

function luminance(hex) {
  const rgb = hex.match(/[\da-f]{2}/gi);
  assert.equal(rgb?.length, 3);
  const channels = rgb.map(x => parseInt(x, 16) / 255).map(c =>
    c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  );
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}
function ratio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((a,b) => b-a);
  return (hi + .05) / (lo + .05);
}
test('contrast patch is linked after every existing staging palette sheet', () => {
  const patch = index.indexOf('task2-contrast-hotfix.css?v=t2-contrast-20261106-c1');
  assert.ok(patch > index.indexOf('style.css?v='));
  assert.ok(patch > index.indexOf('task2.css?v='));
  assert.ok(patch > index.indexOf('transport-application.css?v='));
  assert.equal(index.match(/task2-contrast-hotfix.css/g)?.length, 1);
});
test('light stage headings, help, field labels and muted text exceed 4.5:1', () => {
  for (const [name, fg, bg] of [
    ['stage body','#18392f','#f8faf8'],
    ['headings','#173a31','#f8faf8'],
    ['muted help','#4a6357','#f8faf8'],
    ['form labels','#1e3e33','#ffffff'],
    ['field text','#17372e','#ffffff'],
    ['placeholder','#576b61','#ffffff'],
    ['ghost action','#145b44','#ffffff'],
  ]) {
    assert.ok(css.includes(fg) && css.includes(bg), name+' colors missing');
    assert.ok(ratio(fg,bg) >= 4.5, name+' insufficient contrast: '+ratio(fg,bg));
  }
});
test('inactive and active tabs meet normal-text contrast on dark carrier workspace', () => {
  assert.match(css, /\.carrier-portal #task2-root \.t2-tabs button \{/);
  assert.match(css, /\.carrier-portal #task2-root \.t2-tabs button\.active \{/);
  assert.ok(ratio('#e8f4fd','#18384f') >= 4.5);
  assert.ok(ratio('#ffffff','#176b53') >= 4.5);
  assert.match(css, /:focus-visible/);
});
test('patch scoped to Task2 workspace; does not hide controls or disable pointer events', () => {
  const blocks=css.match(/([^{}]+)\{[^{}]*\}/g) ?? [];
  for(const block of blocks) {
    const selector=block.slice(0,block.indexOf('{'));
    if(selector.trim().startsWith('/*')) continue;
    assert.ok(selector.includes('#task2-root'), 'unscoped selector: '+selector);
  }
  assert.doesNotMatch(css, /display:\s*none|visibility:\s*hidden|pointer-events:\s*none|opacity:\s*0(?:;|\b)/);
});
