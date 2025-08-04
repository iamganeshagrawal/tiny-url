// Cloudflare Worker for URL Shortener
// URLs are loaded at build time and embedded into the worker

// This will be replaced by the build script with actual URL mappings
const URL_MAPPINGS = __URL_MAPPINGS__;


export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Handle root path - show simple info page
    if (path === '/') {
      const urlCount = Object.keys(URL_MAPPINGS).length;
      const urlList = Object.entries(URL_MAPPINGS)
        .map(([key, value]) => `<li><a href="${url.origin}/${key}"<code>${key}</code> → ${value}</li>`)
        .join('');

      return new Response(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>URL Shortener</title>
          <style>
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
              max-width: 800px; 
              margin: 50px auto; 
              padding: 20px; 
              line-height: 1.6;
              color: #333;
            }
            .header { text-align: center; margin-bottom: 40px; }
            .header h1 { color: #2c3e50; margin-bottom: 10px; }
            .info { 
              background: #f8f9fa; 
              padding: 20px; 
              border-radius: 8px; 
              margin: 20px 0; 
              border-left: 4px solid #007bff;
            }
            .urls-list {
              background: #fff;
              border: 1px solid #e9ecef;
              border-radius: 8px;
              padding: 20px;
              margin: 20px 0;
            }
            .urls-list ul {
              list-style: none;
              padding: 0;
              margin: 0;
            }
            .urls-list li {
              padding: 8px 0;
              border-bottom: 1px solid #f1f3f4;
            }
            .urls-list li:last-child {
              border-bottom: none;
            }
            code { 
              background: #e9ecef; 
              padding: 3px 8px; 
              border-radius: 4px; 
              font-family: 'Monaco', 'Consolas', monospace;
              font-size: 0.9em;
            }
            a { color: #007bff; text-decoration: none; }
            a:hover { text-decoration: underline; }
            .stats {
              text-align: center;
              color: #6c757d;
              font-size: 0.9em;
              margin-top: 30px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>🔗 URL Shortener</h1>
            <p>Simple URL shortener powered by Cloudflare Workers</p>
          </div>
          
          <div class="info">
            <h3>📖 How to use:</h3>
            <p>Visit <code>${url.origin}/your-alias</code> to redirect to your configured URL</p>
            <p>URLs are loaded at build time for maximum performance ⚡</p>
          </div>

          <div class="urls-list">
            <h3>🎯 Available Short URLs (${urlCount} total):</h3>
            <ul>
              ${urlList}
            </ul>
          </div>

          <div class="stats">
            <p>Last built: ${new Date().toISOString()}</p>
          </div>
        </body>
        </html>
      `, {
        headers: {
          'Content-Type': 'text/html',
          'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
        },
      });
    }

    // Handle API endpoint to show current URLs
    if (path === '/api/urls') {
      return new Response(JSON.stringify({
        urls: URL_MAPPINGS,
        count: Object.keys(URL_MAPPINGS).length,
        buildTime: new Date().toISOString()
      }, null, 2), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=3600',
        },
      });
    }

    // Handle health check
    if (path === '/health') {
      return new Response(JSON.stringify({
        status: 'ok',
        urlCount: Object.keys(URL_MAPPINGS).length,
        buildTime: new Date().toISOString()
      }), {
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    // Handle short URL redirects
    const shortCode = path.substring(1); // Remove leading slash

    if (!shortCode) {
      return new Response('Not Found', { status: 404 });
    }

    const targetUrl = URL_MAPPINGS[shortCode];

    if (targetUrl) {
      // Log the redirect for analytics (if needed)
      console.log(`Redirecting ${shortCode} to ${targetUrl}`);

      env.ANALYTICS.writeDataPoint({
        'blobs': [targetUrl],
        'doubles': [1],
      });

      return Response.redirect(targetUrl, 301);
    } else {

      function levenshtein(a, b) {
        const matrix = Array.from({ length: a.length + 1 }, () => []);

        for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
        for (let j = 0; j <= b.length; j++) matrix[0][j] = j;

        for (let i = 1; i <= a.length; i++) {
          for (let j = 1; j <= b.length; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            matrix[i][j] = Math.min(
              matrix[i - 1][j] + 1,
              matrix[i][j - 1] + 1,
              matrix[i - 1][j - 1] + cost
            );
          }
        }

        return matrix[a.length][b.length];
      }
      const availableUrls = Object.keys(URL_MAPPINGS).filter(key => levenshtein(key, shortCode) <= 2).slice(0, 5).join(', ');
      console.log("Similar Keys:", availableUrls || "No similar keys found");

      return new Response(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>URL Not Found</title>
          <style>
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
              text-align: center; 
              margin-top: 100px; 
              padding: 20px;
              color: #333;
            }
            .error { color: #dc3545; margin-bottom: 20px; }
            .suggestions { 
              background: #f8f9fa; 
              padding: 20px; 
              border-radius: 8px; 
              margin: 30px auto; 
              max-width: 500px;
            }
            .back { margin-top: 30px; }
            a { color: #007bff; text-decoration: none; }
            a:hover { text-decoration: underline; }
            code { 
              background: #e9ecef; 
              padding: 2px 6px; 
              border-radius: 4px; 
            }
          </style>
        </head>
        <body>
          <h1 class="error">404 - Short URL Not Found</h1>
          <p>The short URL <code>${shortCode}</code> was not found.</p>
          
          <div class="suggestions">
            <h3>💡 Available URLs include:</h3>
            <p><code>${availableUrls}</code></p>
          </div>
          
          <div class="back">
            <a href="${url.origin}">← Back to Home</a>
          </div>
        </body>
        </html>
      `, {
        status: 404,
        headers: {
          'Content-Type': 'text/html',
          'Cache-Control': 'public, max-age=300' // Cache 404s for 5 minutes
        },
      });
    }
  },
};

