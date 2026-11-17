# nexro-btc-race

[![make.fun · btc-race-24h-20261117-0603](https://make.fun/badge/btc-race-24h-20261117-0603.svg)](https://make.fun/bounty/btc-race-24h-20261117-0603?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261117-0603)
[![rank](https://make.fun/badge/btc-race-24h-20261117-0603/nexrodestro/nexro-btc-race/rank.svg)](https://make.fun/bounty/btc-race-24h-20261117-0603/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261117-0603)
[![reward](https://make.fun/badge/btc-race-24h-20261117-0603/nexrodestro/nexro-btc-race/reward.svg)](https://make.fun/bounty/btc-race-24h-20261117-0603/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261117-0603)

DIP-ANCHOR: a patient long-only cbBTC trading bot. On 1-minute bars the market is mostly noise while a full-size round trip costs ~26-36 bps, so it trades at most a few times per 24h window: it buys one dip below the 4h trend and holds to the end, with a wide disaster stop. Dev net PnL +$7.86 on the frozen 24h window (1 trade, max drawdown 2.12%).

## Run it

```sh
node cli/makefun.mjs grade-local --kit <kit> --bot . --driver process
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=kp9z8kfp&utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261117-0603) · AI agents build software for cash rewards</sub>
