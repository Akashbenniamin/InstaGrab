# Architecture

## Why a Local Helper?

### The Browser Limitation

A normal web browser **cannot** download Instagram videos directly due to fundamental web security constraints:

| Barrier | Explanation |
|---------|-------------|
| **CORS** | Instagram's servers don't include `Access-Control-Allow-Origin` headers for third-party websites. Any `fetch()` request from our site to `instagram.com` is blocked by the browser. |
| **Signed CDN URLs** | Instagram video URLs contain cryptographic signatures that are tied to the user's session and expire quickly. |
| **Login Walls** | Instagram shows at most 1-2 public posts before requiring login. API endpoints return 401/403 for unauthenticated requests. |
| **Cookie Partitioning** | Even if the user is logged into Instagram, our website cannot access those cookies due to same-origin policy and third-party cookie restrictions. |
| **Header Requirements** | Instagram's internal APIs require custom headers (`x-ig-app-id`, `x-csrftoken`) that browsers prohibit setting on cross-origin requests. |

These are not limitations of our code — they are fundamental browser security features that **cannot** be bypassed by any client-side JavaScript.

### The Solution: Local Helper

A desktop application running on the user's own computer operates outside the browser sandbox:

- ✅ Can make HTTP requests to any URL without CORS restrictions
- ✅ Can set any HTTP headers
- ✅ Can optionally access the user's browser cookies (with consent)
- ✅ Can save files directly to the filesystem
- ✅ Can use yt-dlp, which is specifically maintained to handle Instagram's protections

## System Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                    GITHUB PAGES (FREE)                         │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Static Files Only (~200 KB)                             │  │
│  │  HTML + CSS + JavaScript                                 │  │
│  │  No server-side code, no database, no backend            │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTPS (static files)
                              │
┌─────────────────────────────▼──────────────────────────────────┐
│                    USER'S BROWSER                              │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  React SPA                                               │  │
│  │  - URL input & validation                                │  │
│  │  - Progress display                                      │  │
│  │  - Download history (localStorage)                       │  │
│  └───────────────────────┬──────────────────────────────────┘  │
│                          │                                     │
│                          │ HTTP to 127.0.0.1:18765             │
│                          │ (CORS + PNA + Bearer Token)         │
│                          │                                     │
└──────────────────────────┼─────────────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────────────┐
│                    USER'S COMPUTER                             │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  InstaGrab Helper (Python)                               │  │
│  │                                                          │  │
│  │  Flask Server ◄──── Security Middleware                  │  │
│  │       │              (Host, Origin, Token, Headers)      │  │
│  │       │                                                  │  │
│  │       ▼                                                  │  │
│  │  Downloader (yt-dlp) ───────► Instagram CDN              │  │
│  │       │                       *.cdninstagram.com         │  │
│  │       │                       *.fbcdn.net                │  │
│  │       ▼                                                  │  │
│  │  Downloads/Instagram/video.mp4                           │  │
│  │                                                          │  │
│  │  System Tray Icon ◄──── Pairing Code                     │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
```

## Communication Protocol

### Website → Helper

All communication uses HTTP REST over `http://127.0.0.1:18765`.

**Why HTTP and not HTTPS?** Loopback addresses (`127.0.0.1`) are classified as "potentially trustworthy" by the W3C spec. Chrome, Edge, and Firefox all allow HTTP requests from an HTTPS page to loopback without treating it as mixed content.

**Why not WebSockets?** Unencrypted WebSockets (`ws://`) from an HTTPS page are blocked by all browsers, even to loopback. We use HTTP polling instead, which works reliably.

### Security Layers

```
Request from Website
        │
        ▼
  1. Is Host header = 127.0.0.1:18765?  ──── No ──► 400 Rejected
        │ Yes                                         (DNS rebinding defense)
        ▼
  2. Is Origin in allowed list?          ──── No ──► 403 Rejected
        │ Yes                                         (unauthorized website defense)
        ▼
  3. Has X-Requested-With header?        ──── No ──► 400 Rejected
        │ Yes                                         (forces CORS preflight)
        ▼
  4. Is Bearer token valid?              ──── No ──► 401 Rejected
        │ Yes                                         (session authentication)
        ▼
  5. Is URL a valid Instagram URL?       ──── No ──► 422 Rejected
        │ Yes                                         (URL allowlist)
        ▼
  6. Is file within download dir?        ──── No ──► 403 Rejected
        │ Yes                                         (path traversal defense)
        ▼
  ✅ Execute download
```

### Pairing Flow

The pairing code prevents unauthorized websites from using the helper. Even though we check the Origin header, a pairing code adds defense-in-depth (protects against XSS on the website origin).

```
Helper starts
    │
    ├── Generates random 6-digit code
    ├── Shows code in system tray
    │
    ▼
User opens website
    │
    ├── Website probes /api/health (no auth needed)
    ├── Helper detected ✓
    │
    ▼
User enters 6-digit code
    │
    ├── Website POSTs to /api/pair/verify
    ├── Helper verifies code
    ├── Helper generates 64-char session token
    ├── Returns token to website
    │
    ▼
Website stores token in localStorage
    │
    ├── All future requests include: Authorization: Bearer <token>
    │
    ▼
Paired ✓
```

## Data Flow

### What flows through the website's server:
- HTML, CSS, JavaScript files (~200 KB total)
- **That's it.** No video data, no API proxying, no user data.

### What flows through the user's computer:
- Instagram URL (from website to helper via localhost)
- Video data (from Instagram CDN to helper, saved to disk)
- Progress updates (from helper to website via localhost polling)

### What is stored:
- **Server:** Nothing. Static files only.
- **Browser localStorage:** Pairing token, download history (optional), theme preference
- **User's disk:** Downloaded videos, helper config, pairing tokens

## Why yt-dlp?

[yt-dlp](https://github.com/yt-dlp/yt-dlp) is the most actively maintained open-source video downloader. Key advantages:

- **Instagram support:** Dedicated extractor maintained by the community
- **Resilient:** Handles Instagram's anti-bot protections including TLS fingerprinting
- **Cookie support:** Can use existing browser cookies for authenticated access
- **Progress reporting:** Provides download progress callbacks
- **FFmpeg integration:** Handles audio/video muxing seamlessly
- **Self-updating:** Can update itself to handle Instagram API changes
- **Python native:** Runs as a library, no subprocess spawning needed

## Limitations

| Limitation | Reason | Workaround |
|-----------|--------|------------|
| Requires desktop computer | Helper needs to run locally | Mobile users can't use the tool |
| Safari not supported | WebKit blocks HTTP to localhost from HTTPS | Use Chrome, Edge, or Firefox |
| May fail without cookies | Instagram rate-limits unauthenticated requests | Enable browser cookie sharing in helper settings |
| yt-dlp may break temporarily | Instagram changes its API frequently | Update yt-dlp via helper menu |
| No private content | Would require Instagram credentials | By design — we don't collect credentials |
