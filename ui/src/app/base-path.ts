// The path MeTube is served under ("/" or a URL_PREFIX such as "/metube/"),
// derived from the page's own address. There is no <base href>: the server
// serves the same index.html under any URL_PREFIX, so the app finds its root
// at runtime by dropping a client-side route from the end of the path.
const CLIENT_ROUTES = /(?:settings|share-target)\/?$/;

export function appBasePath(pathname: string = document.location.pathname): string {
  const base = pathname.replace(CLIENT_ROUTES, '');
  return base.endsWith('/') ? base : base + '/';
}
