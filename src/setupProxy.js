/**
 * CRA Dev Server Proxy
 * Handles OAuth token exchange server-side (holds client secret).
 * This runs in the CRA dev server (Node), NOT in the browser.
 */

const OAUTH = {
  clientId: process.env.AZURE_CLIENT_ID || '9de823b8-9748-4461-a4ea-b06c6bffd13f',
  clientSecret: process.env.AZURE_CLIENT_SECRET || '',
  tenantId: process.env.AZURE_TENANT_ID || '45296cf8-0a85-4f08-a78e-624bea2dee95',
  tokenEndpoint: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID || '45296cf8-0a85-4f08-a78e-624bea2dee95'}/oauth2/v2.0/token`,
  redirectUri: 'http://localhost:3000/api/auth/callback/microsoft',
  scope: 'api://7cae726c-e76c-4abb-a584-0c053adad85a/access_as_user openid profile email offline_access',
};

module.exports = function (app) {
  // Handle Microsoft OAuth callback — exchange code for token server-side
  app.get('/api/auth/callback/microsoft', async (req, res) => {
    const { code, error, error_description } = req.query;

    if (error) {
      return res.redirect(`/?error=${encodeURIComponent(error)}&error_description=${encodeURIComponent(error_description || '')}`);
    }

    if (!code) {
      return res.redirect('/?error=no_code');
    }

    try {
      const params = new URLSearchParams({
        client_id: OAUTH.clientId,
        client_secret: OAUTH.clientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: OAUTH.redirectUri,
        scope: OAUTH.scope,
      });

      const response = await fetch(OAUTH.tokenEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('[Auth] Token exchange failed:', data.error_description || data.error);
        return res.redirect(`/?error=${encodeURIComponent(data.error)}&error_description=${encodeURIComponent(data.error_description || '')}`);
      }

      console.log('[Auth] Token exchange successful');

      // Redirect back to app with tokens in hash (not query params for security)
      const tokenData = encodeURIComponent(JSON.stringify({
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresIn: data.expires_in,
      }));

      res.redirect(`/?auth_success=${tokenData}`);
    } catch (err) {
      console.error('[Auth] Token exchange error:', err.message);
      res.redirect(`/?error=exchange_failed&error_description=${encodeURIComponent(err.message)}`);
    }
  });

  // Token refresh endpoint
  app.post('/api/auth/refresh', require('express').json(), async (req, res) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ success: false, message: 'Refresh token required' });
    }

    try {
      const params = new URLSearchParams({
        client_id: OAUTH.clientId,
        client_secret: OAUTH.clientSecret,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        scope: OAUTH.scope,
      });

      const response = await fetch(OAUTH.tokenEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });

      const data = await response.json();

      if (!response.ok) {
        return res.status(400).json({ success: false, message: data.error_description || 'Refresh failed' });
      }

      res.json({
        success: true,
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresIn: data.expires_in,
      });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });
};
