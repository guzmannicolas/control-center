/**
 * Verifies if an Instagram profile exists and returns a valid 200 response
 * (differentiating between real profile and Instagram's internal 404 / PolarisErrorRoot page).
 */
export async function verifyInstagramProfile(urlOrHandle: string): Promise<{
  valid: boolean;
  username: string | null;
  statusCode: number;
  reason?: string;
}> {
  if (!urlOrHandle || typeof urlOrHandle !== 'string') {
    return { valid: false, username: null, statusCode: 400, reason: 'Empty URL or handle' };
  }

  const clean = urlOrHandle.trim().replace(/^@/, '');
  let username = clean;
  try {
    if (clean.includes('instagram.com/')) {
      const after = clean.split('instagram.com/')[1] ?? '';
      const parts = after.split(/[/?#]/);
      username = parts[0] ?? '';
    }
  } catch {
    username = clean;
  }

  username = username.replace(/[^a-zA-Z0-9._]/g, '');
  if (!username || username === 'p' || username === 'reel' || username === 'stories' || username === 'explore') {
    return { valid: false, username: null, statusCode: 400, reason: 'Invalid or generic Instagram handle' };
  }

  const profileUrl = `https://www.instagram.com/${username}/`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4500);

    const res = await fetch(profileUrl, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'es-419,es;q=0.9,en;q=0.8',
      },
    });

    clearTimeout(timeoutId);

    if (res.status === 404) {
      return { valid: false, username, statusCode: 404, reason: 'HTTP 404 Not Found' };
    }

    const text = await res.text();

    const isError =
      text.includes('PolarisErrorRoot') ||
      text.includes('Page Not Found') ||
      text.includes('Esta página no está disponible') ||
      text.includes("This page isn't available");

    if (isError) {
      return { valid: false, username, statusCode: 404, reason: 'Profile not found on Instagram' };
    }

    return { valid: true, username, statusCode: 200 };
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return { valid: false, username, statusCode: 408, reason: 'Verification timed out' };
    }
    return { valid: false, username, statusCode: 500, reason: err.message || 'Network error' };
  }
}
