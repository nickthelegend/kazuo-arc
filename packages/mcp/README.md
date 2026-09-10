# @kazuo/mcp

[Kazuo](https://github.com/nickthelegend/kazuo-arc) as an MCP server: any agent can find AI capacity on the
Kazuo network, price a job, **pay for it in USDC over x402 on Arc**, and get the result with the settlement
transaction beside it. No account, no API key, no card.

```bash
claude mcp add kazuo -- npx -y @kazuo/mcp
```

## Configuration

Environment only — an MCP server has no terminal to prompt at.

| Variable | |
|---|---|
| `KAZUO_BROKER_URL` | Broker to buy from (default `http://localhost:8402`) |
| `KAZUO_PAYER_KEY` | Private key that pays for jobs; its address is derived. Needs USDC, no gas |
| `KAZUO_MAX_USD` | Hard ceiling per job, default `0.05`. Tool arguments can ask for less, never more |
| `KAZUO_NETWORK` | Default `eip155:5042002` (Arc testnet) |
| `KAZUO_AGENTKIT` | Set to `0` to stop signing World AgentKit proofs |

## Tools

| Tool | Spends? | |
|---|---|---|
| `kazuo_list_providers` | no | Who is live, what they run, what they charge |
| `kazuo_network_status` | no | Providers, settled volume, facilitator, audit log contract |
| `kazuo_quote` | no | Price a job without paying. `human_backed_only` restricts to World ID–backed providers |
| `kazuo_run_job` | **yes** | Quote, pay over x402, wait for the result, return it with ArcScan links |
| `kazuo_get_job` | no | Look up a job by id |

## Human-backed agents (World AgentKit)

Before a quote the server signs the broker's SIWE challenge with the payer key. If that address is registered
in AgentBook on World Chain, the job is recorded as bought by a human-backed agent. It never changes the
price, and an unregistered key works exactly the same — just without the label.

## Why the ceiling

A model that can spend without a bound is a model that can empty an account through a loop it didn't mean
to write. `kazuo_run_job` refuses anything over `KAZUO_MAX_USD`, client-side, before it signs.

MIT
