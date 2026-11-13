export enum OperatorToolRefusalCode {
  ConfirmRequired = 'confirm_required',
  BatchTooLarge = 'batch_too_large',
  NoStartNumber = 'no_start_number',
}

export class OperatorToolRefusal extends Error {
  readonly code: OperatorToolRefusalCode;

  constructor(input: { code: OperatorToolRefusalCode; message: string }) {
    super(`${input.code}: ${input.message}`);
    this.code = input.code;
  }
}
