import { appBasePath } from './base-path';

describe('appBasePath', () => {
  it.each([
    ['/', '/'],
    ['/settings', '/'],
    ['/share-target', '/'],
    ['/metube/', '/metube/'],
    ['/metube/settings', '/metube/'],
    ['/metube/share-target', '/metube/'],
  ])('%s is served from %s', (pathname, base) => {
    expect(appBasePath(pathname)).toBe(base);
  });
});
