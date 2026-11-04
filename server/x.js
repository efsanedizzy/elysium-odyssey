import { randomBytes, createHash } from 'node:crypto';

export function createXService({ clientId, clientSecret, redirectUri, fetchImpl = fetch, pending = new Map() }) {
  const connections = new Map();
  const enabled = !!(clientId && redirectUri);
  function prune() {
    for (const [key, value] of pending) if (value.expires <= Date.now()) pending.delete(key);
    for (const [key, value] of connections) if (value.expires <= Date.now()) connections.delete(key);
  }
  async function call(url, options = {}) {
    let response;
    try { response = await fetchImpl(url, { ...options, signal: AbortSignal.timeout(12000) }); }
    catch { throw new Error('X could not be reached. Please retry later.'); }
    if (!response.ok) {
      let problem = {};
      try { problem = await response.json(); } catch { /* Some X errors have no JSON body. */ }
      const kind = String(problem.type || '') + ' ' + String(problem.title || '') + ' ' + String(problem.reason || '');
      const stage = String(url).includes('/following') ? 'follow lookup' : String(url).includes('/oauth2/') ? 'authorization' : 'user lookup';
      const prefix = `X API ${response.status} (${stage}): `;
      if (response.status === 402 || /credits?[-_ ]?(?:depleted|exhausted)|insufficient[-_ ]?(?:credits|balance)/i.test(kind))
        throw new Error(prefix + "The site's X API credits are depleted. The site owner must add X API credits in the Developer Console before verification can continue. Reconnecting your X account will not fix this.");
      if (response.status === 401) throw new Error(prefix + 'X authorization expired. Connect your X account again.');
      if (response.status === 403) throw new Error(prefix + "X denied access. The site owner must check the project's endpoint access and users.read permission.");
      if (response.status === 429) throw new Error(prefix + 'X rate limit reached. Please retry later.');
      if (response.status === 400) throw new Error(prefix + 'X rejected the request parameters. Please contact the site owner.');
      throw new Error(prefix + 'X could not complete the request. Please retry later or contact the site owner.');
    }
    const body = await response.json();
    if (body.errors?.length) throw new Error('X returned an incomplete response. Please retry later.');
    return body;
  }
  return {
    enabled,
    status(session) { prune(); const c = connections.get(session); return c ? { username: c.username, id: c.id } : null; },
    forget(session) { connections.delete(session); for (const [key, p] of pending) if (p.session === session) pending.delete(key); },
    start(session, address) {
      if (!enabled) throw new Error('X integration is not configured yet. The site owner must set the X OAuth environment variables.');
      prune();
      for (const [key, p] of pending) if (p.session === session) pending.delete(key);
      const state = randomBytes(32).toString('hex'), verifier = randomBytes(48).toString('base64url');
      pending.set(state, { session, address, verifier, expires: Date.now() + 600000 });
      const url = new URL('https://x.com/i/oauth2/authorize');
      url.search = new URLSearchParams({ response_type: 'code', client_id: clientId, redirect_uri: redirectUri,
        scope: 'tweet.read users.read', state, code_challenge_method: 'S256',
        code_challenge: createHash('sha256').update(verifier).digest('base64url') }).toString();
      return url.href;
    },
    async callback(session, address, state, code) {
      prune();
      const p = pending.get(state);
      if (!p || p.session !== session || p.address !== address) throw new Error('Invalid or expired X authorization. Please connect again.');
      pending.delete(state);
      if (!code) throw new Error('X authorization was cancelled.');
      const headers = { 'content-type': 'application/x-www-form-urlencoded' };
      if (clientSecret) headers.authorization = 'Basic ' + Buffer.from(`${encodeURIComponent(clientId)}:${encodeURIComponent(clientSecret)}`).toString('base64');
      const auth = await call('https://api.x.com/2/oauth2/token', { method: 'POST', headers,
        body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirectUri, client_id: clientId, code_verifier: p.verifier }).toString() });
      if (!auth.access_token || !Number.isFinite(auth.expires_in) || auth.expires_in <= 0) throw new Error('X did not return valid authorization. Please connect again.');
      const me = await call('https://api.x.com/2/users/me', { headers: { authorization: `Bearer ${auth.access_token}` } });
      if (!me.data?.id || !me.data.username) throw new Error('X account could not be identified.');
      const connection = { id: me.data.id, username: me.data.username, expires: Date.now() + auth.expires_in * 1000 };
      connections.set(session, connection);
      return { id: connection.id, username: connection.username };
    },
  };
}
