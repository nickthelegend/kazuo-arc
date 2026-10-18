# World setup

Provisioned 25 Jul 2026 via the Developer Portal MCP. Nothing here is secret.

## IDs

| What | Value |
|---|---|
| Team | `team_196dacfac2becfe58e4768e696c9bbbd` ("Commitment issues") |
| `app_id` | `app_bc54fc90967dc037abf5374c4e6323e9` |
| `rp_id` | `rp_d048b1d7148f48d8` |
| Signer address | `0x040b872b1589FeAedb344709ffc8b770EAB7a274` |
| Manager address | `0xe2422667AE196Ce2d592213E91EE17F630EBF40f` |
| App mode | `external` (not a Mini App) |
| Engine | `cloud` (verify via API, not on-chain) |

## Endpoints

```
POST /api/v4/verify/rp_d048b1d7148f48d8          # forward the IDKit result verbatim
GET  /api/v4/rp-status/rp_d048b1d7148f48d8
     /api/v4/proof-context/rp_d048b1d7148f48d8
```

Base: `https://developer.world.org`

## Status, verified not assumed

- On-chain RP registration: **registered** on both production and staging
- Action `git-sign`: created in **both** environments, `registration_status: registered`
- **`enable_face_check: true`** → Selfie Check is enabled for this app
- `can_user_verify: "yes"`
- `is_verified: false` → cosmetic only, see below

## The signing key

Generated server-side and returned exactly once. The portal does not keep a copy.

Stored at `~/.config/world/commitment-issues.env`, chmod 600. **Not in this repo, keep it that way.**

```bash
WORLD_RP_ID=rp_d048b1d7148f48d8
WORLD_SIGNING_KEY=<from ~/.config/world/commitment-issues.env>
NEXT_PUBLIC_APP_ID=app_bc54fc90967dc037abf5374c4e6323e9
```

Rotating it invalidates the current signer, so do not run `rotate_world_id_signing_key` casually.

## Gotcha that will bite: max_verifications

The action came back with:

```json
"max_verifications": 1,
"max_accounts_per_user": 1
```

One verification per human per action. Combined with World ID 4.0 nullifiers being one-time-use, a
fixed action cannot sign more than one commit. Two ways out:

1. **Unique action per commit** — `git-sign:<sha>`. Actions do not need portal registration for
   verify to work. Downside: a fresh nullifier every commit, so you cannot link commits to the same
   person.
2. **Session proofs** — `IDKit.createSession()` then `proveSession()`. `session_id` is the stable
   identity across commits, `session_nullifier` handles per-proof replay. Use this if you want to
   count how many commits a given human actually signed.

## Order of operations, learned the hard way

```
create_app
  └─> configure_world_id          # without this, everything below 404s
        └─> poll registration     # "pending" -> "registered", took ~4s
              └─> create_world_id_action
                    └─> precheck  # enable_face_check
```

`create_world_id_action` fails with `"World ID is not configured for this app."` if you skip
`configure_world_id`. The precheck fails with `"No action found for this app."` if you skip the action.

## Reproducing / more portal calls

MCP client is at `../EthLisbon/world-docs/portal-mcp-client.py`.

```bash
python3 portal-mcp-client.py get_app_config '{"app_id":"app_bc54fc90967dc037abf5374c4e6323e9"}'
```

Note: the portal blocks default Python and curl user agents with Cloudflare error 1010. The client
sets a browser user agent. Do not remove it.

## Offline docs

Full World docs are mirrored at `../EthLisbon/world-docs/`:

- `llms-full.txt` — every prose page, 506 KB, verified complete against the index
- `openapi/` — developer-portal, world-id, world-miniapps specs

Point your coding agents at these instead of fetching pages one at a time.
