import type { CloseWindowInput } from './types';

export async function closeWindow(input: CloseWindowInput): Promise<void> {
  const { repository } = input.dependencies;
  const window = await repository.findWindow();
  await repository.saveWindow({ window: { ...window, closedAt: input.at } });
}
