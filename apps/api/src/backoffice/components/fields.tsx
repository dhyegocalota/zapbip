import type { OwnerLocale } from '@zapbip/types';
import { BackofficeCopyKey, renderBackofficeCopy } from '../backoffice-copy';

export type FieldProps = {
  id: string;
  name: string;
  label: string;
  help: string | null;
  type: string;
  autocomplete: string;
  autofocus?: boolean;
};

export function Field(props: FieldProps) {
  const helpId = `${props.id}-help`;
  return (
    <div class="field">
      <label for={props.id}>{props.label}</label>
      {props.help === null ? null : (
        <p id={helpId} class="field-help">
          {props.help}
        </p>
      )}
      <input
        id={props.id}
        name={props.name}
        type={props.type}
        autocomplete={props.autocomplete}
        aria-describedby={props.help === null ? undefined : helpId}
        autofocus={props.autofocus}
        spellcheck={false}
        autocapitalize="off"
        required
      />
    </div>
  );
}

export function CodeField(props: { locale: OwnerLocale; id: string }) {
  const translate = (key: BackofficeCopyKey): string => renderBackofficeCopy({ key, locale: props.locale });
  return (
    <div class="field">
      <label for={props.id}>{translate(BackofficeCopyKey.SignInCodeLabel)}</label>
      <p id={`${props.id}-help`} class="field-help">
        {translate(BackofficeCopyKey.SignInCodeHelp)}
      </p>
      <input
        id={props.id}
        name="code"
        type="text"
        class="code-input"
        inputmode="numeric"
        autocomplete="one-time-code"
        pattern="[0-9]{6}"
        maxlength={6}
        aria-describedby={`${props.id}-help`}
        required
      />
    </div>
  );
}
