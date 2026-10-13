const CHUNK_BYTES = 512 * 1024;

function fail(res, status, message) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  return res.status(status).json({error: message});
}

module.exports = async function migrationBackup(req, res) {
  if (process.env.VERCEL_ENV !== 'preview') return fail(res, 404, 'Not found');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return fail(res, 405, 'Method not allowed');
  }

  const url = new URL(req.url || '/', 'https://preview.invalid');
  const mode = url.searchParams.get('mode') || '';
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  try {
    const {list, get} = await import('@vercel/blob');

    if (mode === 'list') {
      const cursor = url.searchParams.get('cursor') || undefined;
      const page = await list({limit: 100, ...(cursor ? {cursor} : {})});
      return res.status(200).json({
        blobs: (page.blobs || []).map(blob => ({
          pathname: blob.pathname,
          size: blob.size,
          uploadedAt: blob.uploadedAt,
          contentType: blob.contentType,
          etag: blob.etag
        })),
        cursor: page.cursor || null
      });
    }

    if (mode === 'blob') {
      const pathname = url.searchParams.get('pathname') || '';
      if (!pathname || pathname.length > 1000 || pathname.startsWith('/') ||
          pathname.includes('..') || pathname.includes('\\')) {
        return fail(res, 400, 'Invalid blob path');
      }
      const offsetText = url.searchParams.get('offset') || '0';
      if (!/^\\d+$/.test(offsetText)) return fail(res, 400, 'Invalid offset');
      const offset = Number(offsetText);
      if (!Number.isSafeInteger(offset)) return fail(res, 400, 'Invalid offset');

      const item = await get(pathname, {access: 'private'});
      if (!item || (item.statusCode && item.statusCode !== 200)) return fail(res, 404, 'Blob not found');
      const bytes = Buffer.from(await new Response(item.stream).arrayBuffer());
      if (offset > bytes.length) return fail(res, 416, 'Offset out of range');
      const end = Math.min(offset + CHUNK_BYTES, bytes.length);
      return res.status(200).json({
        pathname,
        size: bytes.length,
        offset,
        nextOffset: end,
        done: end >= bytes.length,
        contentType: item.blob && item.blob.contentType ? item.blob.contentType : 'application/octet-stream',
        data: bytes.subarray(offset, end).toString('base64')
      });
    }

    return fail(res, 400, 'Unknown mode');
  } catch (error) {
    return fail(res, 500, 'Backup export failed');
  }
};
