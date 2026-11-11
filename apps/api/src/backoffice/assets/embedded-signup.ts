import { BackofficePath } from '../backoffice-paths';
import { contentHashOf } from './stylesheet';

const SCRIPT_SOURCE = `(function () {
  var SIGNUP_EVENT_TYPE = 'WA_EMBEDDED_SIGNUP';
  var FINISH_EVENT = 'FINISH';
  var CANCEL_EVENT = 'CANCEL';
  var FACEBOOK_DOMAIN = 'facebook.com';
  var DIGITS_PATTERN = /^[0-9]+$/;
  var button = document.getElementById('connect-button');
  var form = document.getElementById('connect-form');
  var status = document.getElementById('connect-status');
  var signup = { phoneNumberId: null, wabaId: null, code: null, isSettled: false };

  function resetSignup() {
    signup = { phoneNumberId: null, wabaId: null, code: null, isSettled: false };
    status.hidden = true;
  }

  function show(key) {
    signup.isSettled = true;
    status.textContent = button.getAttribute('data-status-' + key);
    status.hidden = false;
  }

  function isFacebookOrigin(origin) {
    if (!URL.canParse(origin)) return false;
    var url = new URL(origin);
    var isFacebookHost = url.hostname === FACEBOOK_DOMAIN || url.hostname.endsWith('.' + FACEBOOK_DOMAIN);
    return url.protocol === 'https:' && isFacebookHost;
  }

  function messageOf(data) {
    if (typeof data !== 'string') return data;
    try {
      return JSON.parse(data);
    } catch (error) {
      return null;
    }
  }

  function submitWhenReady() {
    if (signup.isSettled || signup.phoneNumberId === null || signup.code === null) return;
    form.elements.signupCode.value = signup.code;
    form.elements.phoneNumberId.value = signup.phoneNumberId;
    form.elements.wabaId.value = signup.wabaId;
    show('working');
    form.requestSubmit();
  }

  function onSignupMessage(message) {
    if (message.event === FINISH_EVENT) {
      var data = message.data;
      var hasIds = data && DIGITS_PATTERN.test(String(data.phone_number_id)) && DIGITS_PATTERN.test(String(data.waba_id));
      if (!hasIds) return show('error');
      signup.phoneNumberId = String(data.phone_number_id);
      signup.wabaId = String(data.waba_id);
      return submitWhenReady();
    }
    if (message.event === CANCEL_EVENT) return show('cancelled');
    show('error');
  }

  window.addEventListener('message', function (event) {
    if (!isFacebookOrigin(event.origin)) return;
    var message = messageOf(event.data);
    if (message === null || typeof message !== 'object' || message.type !== SIGNUP_EVENT_TYPE) return;
    onSignupMessage(message);
  });

  window.fbAsyncInit = function () {
    FB.init({
      appId: button.getAttribute('data-app-id'),
      autoLogAppEvents: false,
      xfbml: false,
      version: button.getAttribute('data-graph-version'),
    });
  };

  button.addEventListener('click', function () {
    if (!form.reportValidity()) return;
    if (typeof FB === 'undefined') return show('sdk-failed');
    resetSignup();
    FB.login(
      function (response) {
        var code = response.authResponse ? response.authResponse.code : null;
        if (!code) {
          if (!signup.isSettled) show('no-code');
          return;
        }
        signup.code = code;
        submitWhenReady();
      },
      {
        config_id: button.getAttribute('data-configuration-id'),
        response_type: 'code',
        override_default_response_type: true,
        extras: { setup: {} },
      },
    );
  });
})();
`;

export const EMBEDDED_SIGNUP_SCRIPT: string = SCRIPT_SOURCE;
export const EMBEDDED_SIGNUP_SCRIPT_HREF: string = `${BackofficePath.EmbeddedSignupScript}?v=${contentHashOf({ text: SCRIPT_SOURCE })}`;
