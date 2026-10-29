import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getTraceHtml } from '../ui/webview/html';

const html = getTraceHtml({ cspSource: 'https://file+.vscode-resource.vscode-cdn.net', nonce: 'abc123' });

describe('getTraceHtml', () => {
  it('wires the CSP to the given source and nonce', () => {
    assert.ok(html.includes('Content-Security-Policy'));
    assert.ok(html.includes('style-src https://file+.vscode-resource.vscode-cdn.net'));
    assert.ok(html.includes("script-src 'nonce-abc123'"));
    assert.ok(html.includes('<script nonce="abc123">'));
  });

  it('renders untrusted bodies with textContent only, never innerHTML', () => {
    assert.equal(html.includes('innerHTML'), false);
    assert.ok(html.includes('textContent'));
  });

  it('speaks the panel message protocol', () => {
    for (const token of ['ready', 'selectRun', 'openSource', 'acquireVsCodeApi']) {
      assert.ok(html.includes(token), `missing outbound token: ${token}`);
    }
    assert.ok(html.includes("msg.type === 'runs'"));
    assert.ok(html.includes("msg.type === 'detail'"));
  });

  it('labels token counts estimated', () => {
    assert.ok(html.includes('tokens (estimated)'));
  });
});
