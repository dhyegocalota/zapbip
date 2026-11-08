import { format, resolveConfig } from 'prettier';
import { repositoryPath } from './repository';

const FORMATTED_EXTENSIONS = ['.ts', '.mdx', '.json'];

export async function formatted(input: { path: string; content: string }): Promise<string> {
  if (!FORMATTED_EXTENSIONS.some((extension) => input.path.endsWith(extension))) return input.content;
  const filepath = repositoryPath(input.path);
  const options = await resolveConfig(filepath);
  if (!options) throw new Error(`no Prettier configuration found for ${input.path}`);
  return format(input.content, { ...options, filepath });
}
