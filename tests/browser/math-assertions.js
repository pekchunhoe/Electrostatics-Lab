import {expect} from '@playwright/test';
// Assert authored native-math equations instead of the removed programming-style
// text. Physics comparisons in each regression remain independent and unchanged.
export async function expectEquation(page,source,selector='#calculation-body'){
  const equations=await page.locator(selector+' annotation').allTextContents();
  expect(equations).toContain(source);
}
export async function expectZeroPotential(page){
  const primary=await page.locator('#calculation-body > .equation annotation').allTextContents();
  expect(primary.some(s=>/^\\Delta V(?:_\{AB\})?=0\\;\\mathrm\{V\}$/.test(s))).toBe(true);
  expect(primary).toContain(String.raw`\Delta U=0\;\mathrm{J}`);
  expect(primary.some(s=>/^W_\{\\mathrm\{field\}\}=(?:-\\Delta U=)?0\\;\\mathrm\{J\}$/.test(s))).toBe(true);
  for(const source of [String.raw`\Delta V=0\;\mathrm{V}`,String.raw`\Delta U=0\;\mathrm{J}`,String.raw`W_{\mathrm{field}}=0\;\mathrm{J}`])await expectEquation(page,source,'#snap-comparison');
}
