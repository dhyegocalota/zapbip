import type { Page } from '@playwright/test';

const SDK_URL = 'https://connect.facebook.net/en_US/sdk.js';
const FRAME_URL_PATTERN = 'https://www.facebook.com/__stub/signup**';
const HTML_CONTENT_TYPE = 'text/html; charset=utf-8';
const JAVASCRIPT_CONTENT_TYPE = 'text/javascript; charset=utf-8';
const VIOLATION_REPORTER = 'reportCspViolation';

export enum SignupOutcome {
  Finish = 'finish',
  Cancel = 'cancel',
  ForeignOrigin = 'foreign_origin',
}

export type SignupStub = { outcome: SignupOutcome; code: string; phoneNumberId: string; wabaId: string };

function sdkScript(input: { stub: SignupStub }): string {
  return `
window.FB = {
  init: function () {},
  login: function (callback) {
    var stub = ${JSON.stringify(input.stub)};
    var finish = JSON.stringify({ type: 'WA_EMBEDDED_SIGNUP', event: 'FINISH', data: { phone_number_id: stub.phoneNumberId, waba_id: stub.wabaId } });
    if (stub.outcome === 'foreign_origin') {
      window.postMessage(finish, '*');
      return callback({ authResponse: { code: stub.code } });
    }
    var frame = document.createElement('iframe');
    frame.src = 'https://www.facebook.com/__stub/signup?outcome=' + stub.outcome;
    window.addEventListener('message', function (event) {
      if (event.origin !== 'https://www.facebook.com' || event.data !== 'STUB_DONE') return;
      callback(stub.outcome === 'finish' ? { authResponse: { code: stub.code } } : {});
    });
    document.body.appendChild(frame);
  },
};
if (window.fbAsyncInit) window.fbAsyncInit();
`;
}

function frameHtml(input: { stub: SignupStub; outcome: string }): string {
  const { stub, outcome } = input;
  const message =
    outcome === SignupOutcome.Finish
      ? { type: 'WA_EMBEDDED_SIGNUP', event: 'FINISH', data: { phone_number_id: stub.phoneNumberId, waba_id: stub.wabaId } }
      : { type: 'WA_EMBEDDED_SIGNUP', event: 'CANCEL', data: {} };
  return `<!doctype html><script>
    parent.postMessage(${JSON.stringify(JSON.stringify(message))}, '*');
    parent.postMessage('STUB_DONE', '*');
  </script>`;
}

const stubStates = new WeakMap<Page, { stub: SignupStub; violations: string[] }>();

export async function useEmbeddedSignupStub(input: { page: Page; stub: SignupStub }): Promise<string[]> {
  const { page, stub } = input;
  const installed = stubStates.get(page);
  if (installed !== undefined) {
    installed.stub = stub;
    return installed.violations;
  }
  const state = { stub, violations: [] as string[] };
  stubStates.set(page, state);
  await page.exposeFunction(VIOLATION_REPORTER, (violation: string) => state.violations.push(violation));
  await page.addInitScript({
    content: `document.addEventListener('securitypolicyviolation', function (event) {
      window.${VIOLATION_REPORTER}(event.violatedDirective + ' ' + event.blockedURI);
    });`,
  });
  await page.route(SDK_URL, (route) => route.fulfill({ contentType: JAVASCRIPT_CONTENT_TYPE, body: sdkScript({ stub: state.stub }) }));
  await page.route(FRAME_URL_PATTERN, (route) => {
    const outcome = new URL(route.request().url()).searchParams.get('outcome');
    if (outcome === null) throw new Error('the signup frame was opened without an outcome');
    return route.fulfill({ contentType: HTML_CONTENT_TYPE, body: frameHtml({ stub: state.stub, outcome }) });
  });
  return state.violations;
}
