import { test, expect, type Page } from '@playwright/test';

async function setFormula(page: Page, value: string, index = 0) {
  await page.locator('math-field').nth(index).evaluate((field, value) => {
    const mf = field as HTMLElement & { value: string };
    mf.value = value; mf.dispatchEvent(new InputEvent('input', { bubbles: true }));
  }, value);
}
async function saved(page: Page) { return page.evaluate(() => JSON.parse(localStorage.getItem('mathcollaboratory.v1')!)); }

test.beforeEach(async ({ page }) => { await page.goto('/'); await expect(page.locator('math-field')).toHaveCount(2); });

test('long input is rejected without losing any saved work', async ({ page }) => {
  await setFormula(page, 'b x');
  await page.getByRole('button', { name: '+ Создать ползунок b', exact: true }).click();
  await page.getByRole('button', { name: 'Тёмная тема', exact: true }).click();
  const before = await saved(page);
  await setFormula(page, 'x'.repeat(501));
  await expect(page.getByRole('alert')).toContainText('Ввод отклонён');
  expect(await saved(page)).toEqual(before);
  await page.reload();
  expect(await saved(page)).toEqual(before);
});

test('recovers a damaged record without resetting healthy records', async ({ page }) => {
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('mathcollaboratory.v1')!);
    s.theme = 'dark'; s.expressions.push(null, { ...s.expressions[0], id: 'long', latex: 'x'.repeat(501) });
    localStorage.setItem('mathcollaboratory.v1', JSON.stringify(s));
  });
  await page.reload();
  await expect(page.locator('math-field')).toHaveCount(3);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect((await saved(page)).expressions[0].latex).toBe('\\frac{x^2}{4}-2');
  expect((await saved(page)).expressions[2].latex).toHaveLength(501);
  await expect(page.getByRole('alert')).toContainText('слишком длинное');
  await setFormula(page, 'x^2', 2);
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('accepts nested trig powers and rejects ambiguous arguments', async ({ page }) => {
  for (const value of ['\\sin x^{2}', '\\sin^{2}(x)', '\\sin^{2}(x+\\cos(x))']) {
    await setFormula(page, value); await expect(page.getByRole('alert')).toHaveCount(0);
  }
  await setFormula(page, '\\sin 2x');
  await expect(page.getByRole('alert')).toContainText('скобках');
});

test('parameter label, native slider and stored calculation value agree', async ({ page }) => {
  await page.getByRole('button', { name: 'Настройки параметра a' }).click();
  const inputs = page.locator('.parameter-settings input');
  for (const [index, value] of ['0.9', '0', '1', '0.6'].entries()) await inputs.nth(index).fill(value);
  await page.getByRole('button', { name: 'Применить', exact: true }).click();
  await expect(page.locator('#slider-a')).toHaveValue('0.6');
  await expect(page.locator('.parameter-top strong')).toHaveText('0.6');
  expect((await saved(page)).parameters.a.value).toBe(.6);
  await page.reload(); await expect(page.locator('#slider-a')).toHaveValue('0.6');
  await page.getByRole('button', { name: 'Настройки параметра a' }).click();
  await page.locator('.parameter-settings input').nth(3).fill('2');
  await page.getByRole('button', { name: 'Применить', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
});

test('reset traps focus, closes on Escape and restores focus', async ({ page }) => {
  const opener = page.getByRole('button', { name: 'Сбросить', exact: true });
  await opener.click(); const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press(i < 4 ? 'Tab' : 'Shift+Tab');
    // Native dialogs may cycle focus through the document body, but the
    // rest of the page must remain inert and never receive focus.
    expect(await page.evaluate(() => document.activeElement === document.body || !!document.activeElement?.closest('dialog'))).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0); await expect(opener).toBeFocused();
  await opener.click(); await page.getByRole('button', { name: 'Отмена', exact: true }).click();
  await expect(opener).toBeFocused();
  await opener.click(); await page.getByRole('button', { name: 'Подтвердить сброс', exact: true }).click();
  await expect(opener).toBeFocused();
});

test('updates accessible editor names after deleting the first expression', async ({ page }) => {
  await page.getByRole('button', { name: 'Удалить функцию 1', exact: true }).click();
  await expect(page.locator('math-field')).toHaveAttribute('aria-label', 'Выражение 1');
});

test('uses expression order to label restored reordered records', async ({ page }) => {
  await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('mathcollaboratory.v1')!); s.expressions.reverse(); localStorage.setItem('mathcollaboratory.v1', JSON.stringify(s)); });
  await page.reload();
  await expect(page.locator('math-field').nth(0)).toHaveAttribute('aria-label', 'Выражение 1');
  await expect(page.locator('math-field').nth(1)).toHaveAttribute('aria-label', 'Выражение 2');
});

test('updates names when mounted editors are reordered with stable keys', async ({ page }) => {
  await page.evaluate(async () => {
    const reactUrl = '/node_modules/.vite/deps/react.js';
    const domUrl = '/node_modules/.vite/deps/react-dom_client.js';
    const editorUrl = '/src/components/MathEditor.tsx';
    const react = await import(reactUrl);
    const React = react.default ?? react;
    const dom = await import(domUrl);
    const createRoot = dom.createRoot ?? dom.default.createRoot;
    const { MathEditor } = await import(editorUrl);
    const host = document.createElement('div'); host.id = 'reorder-fixture'; document.body.append(host);
    const root = createRoot(host);
    const render = (ids: string[]) => root.render(React.createElement(React.Fragment, null, ...ids.map((id, i) => React.createElement(MathEditor, { key: id, value: id, label: `Тест ${i + 1}`, onChange: () => {} }))));
    render(['x', 'a']);
    window.addEventListener('test-reorder', () => render(['a', 'x']), { once: true });
  });
  const editors = page.locator('#reorder-fixture math-field');
  await expect(editors).toHaveCount(2);
  await page.evaluate(() => window.dispatchEvent(new Event('test-reorder')));
  await expect(editors.nth(0)).toHaveAttribute('aria-label', 'Тест 1');
  await expect(editors.nth(1)).toHaveAttribute('aria-label', 'Тест 2');
  expect(await editors.nth(0).evaluate(e => (e as HTMLElement & { value: string }).value)).toBe('a');
});

test('small steps, negative bounds and off-grid values stay consistent after two reloads', async ({ page }) => {
  for (const parameter of [
    { value: .9, min: 0, max: 1, step: .6 },
    { value: -.7, min: -2, max: 1, step: .4 },
    { value: .125, min: -.25, max: .5, step: .05 },
    { value: 3e-10, min: 0, max: 1e-8, step: 1e-10 },
  ]) {
    await page.getByRole('button', { name: 'Настройки параметра a' }).click();
    const inputs = page.locator('.parameter-settings input');
    for (const [i, key] of ['value', 'min', 'max', 'step'].entries()) await inputs.nth(i).fill(String(parameter[key as keyof typeof parameter]));
    await page.getByRole('button', { name: 'Применить', exact: true }).click();
    for (let i = 0; i < 3; i++) {
      const value = (await saved(page)).parameters.a.value;
      expect(Number(await page.locator('#slider-a').inputValue())).toBe(value);
      expect(Number(await page.locator('.parameter-top strong').innerText())).toBe(value);
      if (i < 2) await page.reload();
    }
  }
});

test('deleting a middle expression renumbers the surviving editors', async ({ page }) => {
  await page.getByRole('button', { name: 'Добавить выражение' }).click();
  await setFormula(page, 'x+1', 2);
  await page.getByRole('button', { name: 'Удалить функцию 2', exact: true }).click();
  await expect(page.locator('math-field').nth(1)).toHaveAttribute('aria-label', 'Выражение 2');
  expect((await saved(page)).expressions[1].latex).toBe('x+1');
  await page.reload();
  expect((await saved(page)).expressions[1].latex).toBe('x+1');
});

test('keyboard editing through the browser persists without direct value assignment', async ({ page }) => {
  await page.getByRole('button', { name: 'Добавить выражение' }).click();
  const editor = page.locator('math-field').last();
  await editor.click({ position: { x: 20, y: 20 } });
  await expect(editor).toBeFocused();
  await page.keyboard.type('x+1');
  await expect.poll(async () => (await saved(page)).expressions[2].latex).toBe('x+1');
  await page.keyboard.press('Backspace');
  await page.keyboard.insertText('2');
  await expect.poll(async () => (await saved(page)).expressions[2].latex).toBe('x+2');
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.evaluate(() => navigator.clipboard.writeText('x'.repeat(501)));
  await page.keyboard.press('Control+V');
  await expect(page.getByRole('alert')).toContainText('Ввод отклонён');
  expect((await saved(page)).expressions[2].latex).toBe('x+2');
  await page.reload();
  expect((await saved(page)).expressions[2].latex).toBe('x+2');
});

test('mixed damaged records recover independently over repeated page reloads', async ({ page }) => {
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('mathcollaboratory.v1')!);
    s.expressions[0].color = { toString: null };
    s.expressions[0].visible = false;
    s.expressions.push(s.expressions[0], null, { ...s.expressions[1], id: 'invalid', latex: 'x+' });
    s.parameters.a.value = 3;
    s.parameters.b = { value: 0, min: 1, max: -1, step: 0 };
    s.theme = 'invalid';
    localStorage.setItem('mathcollaboratory.v1', JSON.stringify(s));
  });
  let previous;
  for (let i = 0; i < 3; i++) {
    await page.reload(); await expect(page.locator('math-field')).toHaveCount(3);
    const state = await saved(page);
    expect(state.parameters.a.value).toBe(3);
    expect(state.parameters.b).toBeUndefined();
    expect(state.expressions[0].visible).toBe(false);
    expect(state.expressions[2].latex).toBe('x+');
    expect(state.theme).toBe('light');
    if (previous) expect(state).toEqual(previous);
    previous = state;
  }
});
