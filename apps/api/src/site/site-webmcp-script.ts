import { SitePath } from './site-paths';

export enum WebMcpTool {
  RequestAccess = 'request_access',
  GetPricing = 'get_pricing',
  GetQuickStart = 'get_quick_start',
  SwitchLanguage = 'switch_language',
}

const LANGUAGE_OPTION_SELECTOR = '.lang-option';
const LANGUAGE_DESCRIPTION = 'Language tag such as en or pt-BR. Defaults to the language of the page.';

export const WEBMCP_SOURCE = `
  var WEBMCP_LANGUAGE_OPTIONS = '${LANGUAGE_OPTION_SELECTOR}';

  function toolResult(payload, isError) {
    var result = { content: [{ type: 'text', text: JSON.stringify(payload) }] };
    if (isError) result.isError = true;
    return result;
  }

  function fetchTool(path, init) {
    return fetch(path, init).then(
      function (response) {
        return response.json().then(
          function (payload) {
            return toolResult(payload, !response.ok);
          },
          function () {
            return toolResult({ status: 'unreadable_response', httpStatus: response.status }, true);
          }
        );
      },
      function () {
        return toolResult({ status: 'network_error' }, true);
      }
    );
  }

  function requestedLanguage(input) {
    return input && input.language ? input.language : document.documentElement.lang;
  }

  function languageOptions() {
    return Array.prototype.slice.call(document.querySelectorAll(WEBMCP_LANGUAGE_OPTIONS));
  }

  function languageOptionOf(tag) {
    var wanted = String(tag).toLowerCase().replace('_', '-');
    var options = languageOptions();
    return (
      options.find(function (option) { return option.lang.toLowerCase() === wanted; }) ||
      options.find(function (option) { return option.lang.toLowerCase() === wanted.split('-')[0]; })
    );
  }

  function switchLanguage(input) {
    var option = languageOptionOf(requestedLanguage(input));
    if (!option) {
      var languages = languageOptions().map(function (candidate) { return candidate.lang; });
      return Promise.resolve(toolResult({ status: 'unsupported_language', languages: languages }, true));
    }
    option.form.requestSubmit(option);
    return Promise.resolve(toolResult({ status: 'switching', language: option.lang }, false));
  }

  var WEBMCP_TOOLS = [
    {
      name: '${WebMcpTool.RequestAccess}',
      description: 'Request early access to zapbip for a person, without a captcha. Adds the email to the waitlist and answers in the language asked.',
      inputSchema: {
        type: 'object',
        properties: {
          email: { type: 'string', description: 'The email of the person who wants access.' },
          language: { type: 'string', description: '${LANGUAGE_DESCRIPTION}' }
        },
        required: ['email']
      },
      execute: function (input) {
        var body = JSON.stringify({ email: input.email, language: requestedLanguage(input) });
        return fetchTool('${SitePath.RequestAccess}', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body });
      }
    },
    {
      name: '${WebMcpTool.GetPricing}',
      description: 'Read the zapbip plans: the free trial, the Pro price, the included messages and what counts as a message.',
      inputSchema: {
        type: 'object',
        properties: { language: { type: 'string', description: '${LANGUAGE_DESCRIPTION}' } }
      },
      execute: function (input) {
        return fetchTool('${SitePath.Pricing}?' + new URLSearchParams({ language: requestedLanguage(input) }));
      }
    },
    {
      name: '${WebMcpTool.GetQuickStart}',
      description: 'Read how to connect one agent to zapbip: the one line that makes an AI set itself up, the address of the setup page, and the manual hint, steps and code. The connection link is an example.',
      inputSchema: {
        type: 'object',
        properties: {
          agent: { type: 'string', description: 'The agent id. An unknown id answers the list of known ids.' },
          language: { type: 'string', description: '${LANGUAGE_DESCRIPTION}' }
        },
        required: ['agent']
      },
      execute: function (input) {
        return fetchTool('${SitePath.QuickStart}?' + new URLSearchParams({ agent: input.agent, language: requestedLanguage(input) }));
      }
    },
    {
      name: '${WebMcpTool.SwitchLanguage}',
      description: 'Switch this site to another language and remember the choice.',
      inputSchema: {
        type: 'object',
        properties: { language: { type: 'string', description: 'Language tag such as en or pt-BR.' } },
        required: ['language']
      },
      execute: switchLanguage
    }
  ];

  function setupModelContext() {
    var modelContext = document.modelContext || navigator.modelContext;
    if (!modelContext || typeof modelContext.registerTool !== 'function') return;
    WEBMCP_TOOLS.forEach(function (tool) {
      new Promise(function (resolve) { resolve(modelContext.registerTool(tool)); }).catch(function () {});
    });
  }
`;
