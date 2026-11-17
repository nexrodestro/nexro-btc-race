// DIP-ANCHOR: a patient long-only cbBTC bot for make.fun bars-replay/v1.
//
// Idea: on 1-minute bars the market is mostly noise (per-bar sd ~6 bps) while a
// full-size round trip costs ~26-36 bps in fee, slippage and price impact, so
// trading often is guaranteed to lose. This bot trades at most a few times per
// 24h window: it buys ONE dip below the slow trend and otherwise holds to the
// end, with a wide disaster stop. The hello message names the universe (CBBTC),
// the capital and the caps; each batch carries one bar and the fills of the
// orders sent on the previous batch; every reply echoes the batch seq with its
// orders (at most one buy or one sell per batch here).
//
// Rules, per bar close (all integer bps, 1 bp = 0.01%):
//   - Slow trend: EMA-240 of closes (~4h). Fast momentum: EMA-24 (~24 min).
//   - DIP entry (flat): close at least 60 bps below EMA-240 -> buy 100% of cash.
//   - BREAKOUT fallback (flat, from bar 480): close above EMA-240, EMA-24 above
//     EMA-240, EMA-240 rising over the last 120 bars -> buy 100% of cash.
//   - LATE fallback (flat, from bar 1080): close above EMA-240 -> buy 100%.
//     (Guarantees at least one trade on the race window even if no dip comes.)
//   - DISASTER exit (holding): close at least 250 bps below the peak close
//     since entry -> sell everything. After a disaster stop the DIP entry
//     stays off for the rest of the window: in a steady downtrend re-buying
//     every dip bleeds one stop after another, so only a confirmed breakout
//     (price back above the slow EMA and rising) may re-enter, which also
//     catches a V-shaped recovery. The cooldown (120 bars) still applies.
//   - Otherwise hold to the end; the replay flattens the position at the last
//     close. max_slippage_bps is 100 (1%) on every order: wide enough that a
//     normal next-open fill is never refused, tight enough to skip a gap fill.
//   - Orders decided on a bar fill at the next bar's open, so a signal that
//     still holds is simply sent again on the next batch until it fills.
//   - No network, no wall clock, no files outside the repo; floats are IEEE 754
//     and the bar sequence is the only input, so two runs give the same orders.

import { runBars, type Bar, type BarsState, type BuyInput, type SellInput } from './vendor/makefun-bars.ts';

const SYMBOL = 'CBBTC';
const SLOW_SPAN = 240;
const FAST_SPAN = 24;
const DIP_BPS = 60;
const TRAIL_BPS = 250;
const BREAKOUT_BAR = 480;
const LATE_BAR = 1080;
const SLOPE_BARS = 120;
const COOLDOWN_BARS = 120;
const MAX_SLIPPAGE_BPS = 100;

/** EMA seeded as the mean of its first span of closes, then 2/(span+1) steps. */
class Ema {
  span: number;
  warm: number[] = [];
  value: number | null = null;
  constructor(span: number) {
    this.span = span;
  }
  push(close: number): number | null {
    if (this.value !== null) {
      this.value += (2 / (this.span + 1)) * (close - this.value);
      return this.value;
    }
    this.warm.push(close);
    if (this.warm.length === this.span) {
      this.value = this.warm.reduce((a, x) => a + x, 0) / this.span;
    }
    return this.value;
  }
}

const slow = new Ema(SLOW_SPAN);
const fast = new Ema(FAST_SPAN);
const slowHist: (number | null)[] = [];
let peak: number | null = null;
let coolUntil = -1;
let barsSeen = 0;
/** Set by the disaster exit: DIP entries stay off until a breakout re-enters. */
let stoppedOut = false;

await runBars({
  onBatch(state: BarsState, batch: { bars: Bar[] }): (BuyInput | SellInput)[] {
    for (const bar of batch.bars) {
      if (bar.symbol !== SYMBOL) continue;
      const close = Number(bar.c);
      barsSeen += 1;
      const slowV = slow.push(close);
      fast.push(close);
      slowHist.push(slowV);
      if (slowV === null) continue;
      const held = state.positions.get(SYMBOL);
      if (held !== undefined) {
        if (peak === null || close > peak) peak = close;
        if (close * 10000 < peak * (10000 - TRAIL_BPS)) {
          coolUntil = barsSeen + COOLDOWN_BARS;
          peak = null;
          stoppedOut = true;
          return [{ side: 'sell', symbol: SYMBOL, qty: held.qty, max_slippage_bps: MAX_SLIPPAGE_BPS }];
        }
        return [];
      }
      // Flat: entries. Never trade while warming up (the replay rejects it).
      if (state.warmingUp || barsSeen <= coolUntil) continue;
      const dip = !stoppedOut && close * 10000 < slowV * (10000 - DIP_BPS);
      if (dip) {
        peak = close;
        return [{ side: 'buy', symbol: SYMBOL, notional_quote_units: state.cash, max_slippage_bps: MAX_SLIPPAGE_BPS }];
      }
      if (barsSeen < BREAKOUT_BAR) continue;
      const fastV = fast.value;
      const rising =
        slowHist.length > SLOPE_BARS &&
        slowHist[slowHist.length - 1] !== null &&
        slowHist[slowHist.length - 1 - SLOPE_BARS] !== null &&
        (slowHist[slowHist.length - 1] as number) > (slowHist[slowHist.length - 1 - SLOPE_BARS] as number);
      const above = close > slowV;
      if (above && fastV !== null && fastV > slowV && rising) {
        peak = close;
        stoppedOut = false;
        return [{ side: 'buy', symbol: SYMBOL, notional_quote_units: state.cash, max_slippage_bps: MAX_SLIPPAGE_BPS }];
      }
      if (barsSeen >= LATE_BAR && above) {
        peak = close;
        stoppedOut = false;
        return [{ side: 'buy', symbol: SYMBOL, notional_quote_units: state.cash, max_slippage_bps: MAX_SLIPPAGE_BPS }];
      }
    }
    return [];
  },
});
