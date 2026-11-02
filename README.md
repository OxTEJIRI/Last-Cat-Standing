# CMBG: Last Cat Standing

A fan-made, free browser battle royale for the [Catmeme Battlegrounds](https://catbattlegrounds.com) cats. You open a card pack, drop into the trenches and try to be the last of 10 cats alive. Rounds take 90 seconds and work on phones and desktop, with no wallet needed.

> Fan-made. Not affiliated with CMBG.

## What's here

| Path | What it is |
|---|---|
| `concept.html` | A 28-second animated design trailer. Everything is drawn with canvas code, with no image assets. |
| `scripts/export.mjs` | Renders `concept.html` frame by frame and encodes an MP4 with ffmpeg. |

The playable game (`index.html`) is in progress.

## The design

- **Opening a pack:** you get one of three fighters, matching CMBG's card rarities.
  - Street Cat (Common, 60%)
  - Alley Boss (Rare, 30%)
  - Chain Royalty (Legendary, 10%)
- **Lives:** health is 9 lives, shown as paw icons.
- **Weapons:**
  - **Fishbone blade:** melee swing.
  - **Yarn bomb:** thrown, damages an area.
  - **Laser pointer:** bots chase the dot.
  - **Catnip:** heals and speeds you up.
- **Hazards:**
  - Red candles crash down from above.
  - Rug tiles get pulled away.
  - Fake CA loot bites.
- **Liquidation zone:** it shrinks over the round, and cats outside it lose lives.
- **End screen:** shows your place, kills and lives left, with a Share on X button.
- **Style:** CMBG's lime `#d4ff00` on ink `#0b0b0b`, using the Anton and JetBrains Mono fonts.

## Run the trailer

Open `concept.html` in a browser.

| Key | Action |
|---|---|
| Click | Replay |
| `P` | Pause |
| `1`–`6` | Jump to a scene |
| `←` `→` | Seek 1 second back or forward |

## Export the trailer to MP4

You need Node, Chrome, ffmpeg and `playwright-core`.

```bash
node scripts/export.mjs concept.html frames/ music.mp3 exports/concept_trailer.mp4 30
```
