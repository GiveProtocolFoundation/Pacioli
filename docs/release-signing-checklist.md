# Release Signing Checklist

Pacioli release builds (`.github/workflows/release.yml`) are currently **unsigned**.
This is acceptable for pre-launch alpha testing (users will see OS warnings:
Gatekeeper "unidentified developer" on macOS, SmartScreen on Windows), but signing
must be in place before any public launch (Gate 4).

This checklist lists exactly what a human must procure and where each secret plugs
into the workflow. All secrets go in **GitHub → Repository → Settings → Secrets and
variables → Actions**. Once set, uncomment the matching `env:` lines in the
"Build and upload to draft release" step of `release.yml` — no other workflow
changes are needed (`tauri-apps/tauri-action` picks these variables up natively).

## 1. macOS — Developer ID signing + notarization

Procure:

- [ ] An Apple Developer Program membership (USD 99/year) for the Give Protocol
      Foundation legal entity.
- [ ] A **Developer ID Application** certificate created in the Apple Developer
      portal, exported from Keychain as a `.p12` file with a password.
- [ ] An **app-specific password** for the Apple ID (for notarization), created at
      appleid.apple.com.
- [ ] The 10-character **Team ID** from the developer account membership page.

Set secrets:

| Secret | Value |
| --- | --- |
| `APPLE_CERTIFICATE` | base64 of the `.p12` (`base64 -i cert.p12 \| pbcopy`) |
| `APPLE_CERTIFICATE_PASSWORD` | password chosen at `.p12` export |
| `APPLE_SIGNING_IDENTITY` | e.g. `Developer ID Application: Give Protocol Foundation (TEAMID)` |
| `APPLE_ID` | the Apple ID email |
| `APPLE_PASSWORD` | the app-specific password |
| `APPLE_TEAM_ID` | the 10-character Team ID |

Then uncomment the six `APPLE_*` lines in `release.yml`. Signing and notarization
both run automatically during the macOS matrix job.

## 2. Windows — Authenticode

Since 2023, OV/EV code-signing certificates require hardware tokens or cloud
signing, so pick ONE option:

- [ ] **Option A (recommended for an OSS nonprofit): Azure Trusted Signing** —
      lowest cost, cloud-based. Requires an Azure tenant. This uses a different
      mechanism than the `WINDOWS_CERTIFICATE` env vars: it plugs in via
      `bundle > windows > signCommand` in `tauri.conf.json` invoking the
      Trusted Signing CLI, plus Azure credential secrets
      (`AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`).
- [ ] **Option B: traditional OV certificate** (Sectigo/SSL.com etc.) exported as
      `.pfx` — only possible where the CA offers a cloud/exportable flavor.
      Set secrets and uncomment the two `WINDOWS_*` lines in `release.yml`:

| Secret | Value |
| --- | --- |
| `WINDOWS_CERTIFICATE` | base64 of the `.pfx` |
| `WINDOWS_CERTIFICATE_PASSWORD` | the `.pfx` password |

- [ ] **Option C: ship unsigned for now** and document the SmartScreen bypass in
      release notes (current state; fine pre-launch, not fine at Gate 4).

## 3. Linux

No signing required for `.deb`/`.AppImage` at this stage. (Optional later: GPG-sign
release checksums; AppImage embedded signatures.)

## 4. Tauri updater key (only when auto-update ships)

Not needed for Stage 0. When the updater plugin is adopted:

- [ ] Generate a keypair: `pnpm tauri signer generate`
- [ ] Set `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
      secrets; uncomment the matching lines in `release.yml`.
- [ ] Commit the **public** key into `tauri.conf.json` (`plugins > updater > pubkey`).
- [ ] NEVER commit the private key. Store it in the foundation password manager.

## 5. Verification after enabling signing

- [ ] macOS: `spctl -a -vv Pacioli.app` reports `accepted`, `source=Notarized Developer ID`
- [ ] Windows: installer Properties → Digital Signatures tab shows the certificate,
      SmartScreen shows publisher name
- [ ] Re-download artifacts from the draft release (not local builds) for these checks
