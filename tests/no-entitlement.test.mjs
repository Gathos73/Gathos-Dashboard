import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const require = createRequire(import.meta.url);
async function load(path, dependencies = {}) {
  const source = await readFile(new URL(path, import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const loaded = { exports: {} };
  new Function('module', 'exports', 'require', compiled)(loaded, loaded.exports,
    name => dependencies[name] ?? require(name));
  return loaded.exports;
}
const { SubscriptionDetails } = await load('../components/subscription-details.tsx');

for (const access_active of [false, undefined]) {
  test(`null entitlement renders no access with access_active=${access_active}`, async () => {
    const user = { userId: 'user', email: 'user@example.test', name: 'User', plan: 'free',
      subscription: null, plan_details: null, trial: null, product_codes: [], access_active };
    const { SubscriptionClient } = await load('../components/subscription-client.tsx', {
      react: { useState: initial => [typeof initial === 'function' ? initial() : initial, () => {}], useEffect() {} },
      'next/link': { default: 'a' },
      '@/components/icons': Object.fromEntries(['CardIcon', 'CheckIcon', 'SparklesIcon', 'VoiceIcon', 'WarningIcon'].map(name => [name, 'i'])),
      '@/components/page-header': { PageHeader: () => null },
      '@/components/subscription-details': { SubscriptionDetails },
      '@/lib/client-api': { dashboardRequest() { assert.fail('render must not make requests'); } },
      './dashboard-account': { useDashboardAccount: () => ({ user, update() {}, refresh() {} }) },
    });
    const html = renderToStaticMarkup(SubscriptionClient({ initialUser: user, paymentTarget: null }));
    assert.match(html, /No active plan/);
    assert.match(html, /No active subscription/);
    assert.match(html, /Access unavailable/);
    assert.doesNotMatch(html, /Access is ready|Plan unavailable/);
  });
}
