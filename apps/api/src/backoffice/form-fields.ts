export type FormBody = Record<string, string | File | (string | File)[]>;

export function textFieldOf(input: { form: FormBody; name: string }): string | null {
  const value = input.form[input.name];
  return typeof value === 'string' ? value : null;
}
