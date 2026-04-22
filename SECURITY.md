# Security Policy

riv-inspector is a local CLI tool that reads `.riv` files from disk. It makes no network requests and handles no credentials.

**Supported versions:** Only the latest release on `main` is actively maintained.

**Reporting a vulnerability:** Open a regular GitHub issue. There is no sensitive infrastructure at risk, so a public issue is appropriate. If you believe the issue is sensitive, email isadora@ganttus.tv instead.

**Note on untrusted input:** riv-inspector loads `.riv` binaries via the Rive WASM runtime. Running it against untrusted `.riv` files carries the same risk as running any binary parser on untrusted input. Use it only on files you trust.
