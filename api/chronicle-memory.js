module.exports = async function chronicleMemory(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.statusCode = 405;
    return res.end('Method not allowed');
  }

  let id = '';
  try {
    const url = new URL(req.url || '/', 'https://chronicle.invalid');
    id = url.searchParams.get('id') || '';
    if (url.origin !== 'https://chronicle.invalid' || url.pathname !== '/api/chronicle-memory' ||
        url.searchParams.size !== 1 || url.hash || !/^[a-f0-9-]{36}$/i.test(id)) {
      res.statusCode = 400;
      return res.end('Invalid memory id');
    }
  } catch {
    res.statusCode = 400;
    return res.end('Invalid request');
  }

  try {
    const {get} = await import('@vercel/blob');
    const memory = await get('chronicle/memories/' + id + '.webp', {access:'private'});
    if (!memory || (memory.statusCode && memory.statusCode !== 200)) {
      res.statusCode = 404;
      return res.end('Memory not found');
    }
    const bytes = Buffer.from(await new Response(memory.stream).arrayBuffer());
    res.setHeader('Content-Type', 'image/webp');
    res.setHeader('Content-Length', String(bytes.length));
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.statusCode = 200;
    return res.end(bytes);
  } catch {
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.statusCode = 503;
    return res.end('Unable to load memory');
  }
};
