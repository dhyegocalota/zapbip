export type FormBody = Record<string, string | File | (string | File)[]>;

export function textFieldOf(input: { form: FormBody; name: string }): string | null {
  const value = input.form[input.name];
  return typeof value === 'string' ? value : null;
}

export function textFieldsOf(input: { form: FormBody; name: string }): string[] {
  const value = input.form[input.name];
  const values = Array.isArray(value) ? value : [value];
  return values.filter((entry): entry is string => typeof entry === 'string');
}
