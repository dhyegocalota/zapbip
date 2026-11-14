export type RepositoryStarsCache = Pick<Cache, 'match' | 'put'>;

export type StarCountSource = () => Promise<number | null>;

export async function repositoryStarsOf(input: { fetchImplementation: typeof fetch; cache: RepositoryStarsCache }): Promise<number | null> {
  throw new Error(`repositoryStarsOf is not implemented for ${String(input.cache)}`);
}
