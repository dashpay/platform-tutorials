# External app icons

Registry `iconUrl` values are untrusted. The browser must not request them
directly: doing so reveals each visitor's IP address and user agent to the icon
host, permits content swapping after submission, and leaves resource/decode limits
to the browser.

The intended renderer is a same-origin image proxy. On first fetch it must:

1. Accept HTTPS only and resolve DNS itself, rejecting loopback, private, link-local
   and otherwise non-public destinations before every redirect.
2. Allow only a small redirect count and revalidate every destination.
3. Enforce response and decompressed byte limits, dimensions and decode time.
4. Accept known raster inputs, decode them, strip metadata and re-encode to PNG or
   WebP. SVG and pass-through active formats are rejected.
5. Cache immutable output by a content digest and serve it from the Dashapps origin
   with `Content-Type`, `nosniff`, a restrictive CSP and long-lived immutable caching.

Until that service exists, Dashapps shows a generated fallback based on the app
name and does not put `iconUrl` into an `img`, CSS URL, preload or browser fetch.
