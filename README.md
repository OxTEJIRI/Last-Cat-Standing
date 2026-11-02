# CMBG: Last Cat Standing

A fan-made, free browser battle royale for the [Catmeme Battlegrounds](https://catbattlegrounds.com) cats. You open a card pack, drop into the trenches and try to be the last of 10 cats alive. It works on phones and desktop, with no wallet and no sign-up.

> Fan-made. Not affiliated with CMBG.

## Play

**[last-cat-standing.vercel.app](https://last-cat-standing.vercel.app/)**

To run it yourself, serve the folder with any static web server. There's no build step.

```bash
python -m http.server 4175
```

Open `http://localhost:4175`. The lobby, fighter collection, pack reveal, pause menu and results adapt to desktop and phone screens. On a smaller screen the lobby scrolls, so the controls and artwork have their own space.

| | Desktop | Phone |
|---|---|---|
| Move | WASD or arrow keys | Drag on the left side |
| Scratch | Automatic when a cat is in reach | Automatic |
| Pounce | `Space` | POUNCE button |
| Use item | `Q` | Item button |
| Ultimate | `E` | ULT button |
| Pause | `P` or `Esc` | Pause button |
| Mute | `M` | The sound button |

## How a round works

1. **Open a pack.** Tap it 3 times to reveal your fighter.
   - **Street Cat** (Common, 60%): fast, with the quickest swipes.
   - **Alley Boss** (Rare, 30%): slow and tanky. Every hit does 2 damage and knocks cats back.
   - **Chain Royalty** (Legendary, 10%): a long fishbone blade that hits every cat in reach.
2. **Drop in.** Steer your landing spot before the countdown ends.
3. **Survive.** You have 9 lives, shown as paws. The 9 bots each have 8.
4. **Pounce:** a quick dash that ends in a free scratch. **Q** throws or fires the item you're holding.
5. **Ultimate:** charges as you deal damage and get kills.
   - **Nine-Tail Rush** (Street Cat): three dashes at the nearest cats.
   - **Ground Pound** (Alley Boss): a slam that hits and stuns everything close.
   - **Blade Storm** (Chain Royalty): spinning blades that shred everything around you.

**Kill streaks** call out FIRST BLOOD, DOUBLE, TRIPLE and MEGA SCRATCH.

**My fighters:** every fighter you pull is saved in your browser. Choose one from the lineup, then use **Play now** to play as that fighter again. **Play again** starts another round with the same fighter. Open a free pack from the lobby or lineup to discover the others. The menu also shows your wins, best kills and rounds played.

Your first round includes brief movement, pounce and ultimate tips. The help screen shows touch or keyboard controls for your current input method.

**Loot:**
- **Yarn bomb:** thrown, does 2 damage in an area.
- **Laser pointer:** for 4.5 seconds, nearby bots chase the dot and ignore you.
- **Catnip:** heals 2 lives and gives a burst of speed.
- **Gold CA box:** a coin flip. A real CA gives 8 seconds of 2X damage. A fake CA bites for 2 lives.

**Hazards:**
- **Red candles:** they crash down after a shadow warning.
- **Rugs:** they get pulled out from under you, which stuns you and costs a life.
- **Liquidation zone:** it closes over 90 seconds, and cats outside it lose lives.

When the round ends, the result screen shows your place, kills and lives left, with a **Share on X** button that tags @Cmbg_RH.

## Files

| Path | What it is |
|---|---|
| `index.html` | The page and screens. |
| `design.css` | Lobby, collection, pack, pause and result layouts, including phone breakpoints. |
| `game.js` | Game loop, input, bot AI, combat, loot, hazards, HUD and sound (synthesized with Web Audio). |
| `art.js` | All the canvas drawing: cats, cards, pack and props. There are no image files. |
| `concept.html` | The 28-second animated design trailer. |
| `scripts/export.mjs` | Renders `concept.html` to an MP4. |

## Export the trailer to MP4

You need Node, Chrome, ffmpeg and `playwright-core`.

```bash
node scripts/export.mjs concept.html frames/ music.mp3 exports/concept_trailer.mp4 30
```
