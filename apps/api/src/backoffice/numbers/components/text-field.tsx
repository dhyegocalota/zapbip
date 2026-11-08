export type TextFieldProps = {
  id: string;
  name: string;
  label: string;
  help: string | null;
  value: string | null;
  error: string | null;
  inputmode?: 'numeric' | 'tel';
  isSecret?: boolean;
};

export function TextField(props: TextFieldProps) {
  const helpId = `${props.id}-help`;
  const errorId = `${props.id}-error`;
  const describedBy = [props.help === null ? null : helpId, props.error === null ? null : errorId].filter((id) => id !== null).join(' ');
  return (
    <div class="field">
      <label for={props.id}>{props.label}</label>
      {props.help === null ? null : (
        <p id={helpId} class="field-help">
          {props.help}
        </p>
      )}
      {props.error === null ? null : (
        <p id={errorId} class="field-help field-error">
          {props.error}
        </p>
      )}
      <input
        id={props.id}
        name={props.name}
        type={props.isSecret === true ? 'password' : 'text'}
        value={props.isSecret === true || props.value === null ? undefined : props.value}
        inputmode={props.inputmode}
        aria-describedby={describedBy.length === 0 ? undefined : describedBy}
        aria-invalid={props.error === null ? undefined : 'true'}
        spellcheck={false}
        autocapitalize="off"
        autocomplete="off"
      />
    </div>
  );
}
