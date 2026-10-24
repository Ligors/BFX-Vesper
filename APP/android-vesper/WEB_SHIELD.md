# Web Shield — Vesper 1.1

Open Vesper → Web Shield → Open protected browser. Links can also be shared to
Vesper Web Shield using Android's share menu. Android may offer it in its browser
chooser; protection only covers pages opened inside this activity.

## Features

- Bundled phishing and gambling domain lists from Block List Project, with source
  attribution and license in assets/webshield. The original upstream dates are
  retained. This build uses a snapshot downloaded on 23 October 2026.
- Custom whole-domain, section, and individual-page rules. Includes subdomains.
  Page rules ignore query strings and fragments. Canonical path matching covers
  encoded characters and dot segments.
- Separate six-digit guardian PIN, salted PBKDF2-SHA256, five-minute cooldown
  after five failed attempts. PIN changes and rule removal require authentication.
  There is no default PIN or recovery bypass.
- Direct entry, navigation and each HTTP redirect pass the same policy. Main
  redirects reload under their actual destination; resource redirects are also
  checked before each network connection.
- No "continue anyway" action. A safe offline demo covers direct and redirect
  blocking, plus a page on which to try custom rules.

## Deliberate limits

This is a strict, read-only browser, not device-wide VPN/DNS protection.
JavaScript, forms, frames, pop-ups, downloads, file access, and external-app
launches are disabled. Interactive sites can have limited functionality.
No native JavaScript bridge is attached to remote content.

WebView's own network loading is disabled. The checked GET loader handles
requests, applies time/size limits, rejects attachments and unsupported content,
and does not forward cookies or credentials. CSP disables active content.
HTTP and HTTPS public-domain addresses on default ports are supported.
IP-literal addresses, custom schemes, embedded credentials and other ports are
rejected. Domain lists cannot identify every newly registered or mirrored site.

Protection does not extend to Chrome, other apps, uninstalling Vesper, or clearing
its app data. Default phishing protection stays enabled; gambling is configurable.

## Validation

Run from this directory:

    .\gradlew.bat :app:testDebugUnitTest :app:assembleDebug

Tests cover domain boundaries, subdomains, encoded/dot paths, query variations,
IDNs, malformed URLs, category settings, direct network rejection, main/resource
redirects, loops, external-app schemes, attachments and allowed HTML.

On-device smoke test:

1. Open Web Shield, wait for the bundled counts, and open the safe demo.
2. Try the direct blocked link and redirect; neither should open its destination.
3. Set a guardian PIN and block demo.vesper.invalid/private as one page.
4. Verify /private?ref=1 is blocked while the demo homepage is allowed.
5. Restart the app and confirm the rule and PIN persist.
6. Try a public HTTPS reading page, then try removing a rule with an incorrect PIN.

The existing app.js also contained an orphaned Call Guard fragment with an
unmatched catch clause. It was removed so the app module passes syntax checking.
