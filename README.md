# Clash — MTG Combat Lab

**Know before you swing.** A mobile-first Magic: The Gathering combat and fight calculator.

**Live:** https://jappyjan.github.io/mtg-tools/

## Use it

1. Add attackers and blockers manually or search real cards on Scryfall.
2. Tap attacker chips under each blocker to assign blocks. Several blockers can block one attacker. Increase a blocker's capacity for effects that let it block several attackers.
3. Edit creatures to add abilities, counters, combat tricks, equipment bonuses, or other modifiers. Use **Effects** for team anthems and global damage rules.
4. See player damage, losses, lifelink, poison, and surviving stats immediately. Open the breakdown to inspect both damage steps. Override automatic splits when you want a particular allocation.
5. Pin an outcome to compare changes; undo/redo, save scenarios locally, or copy a self-contained share link.

**Fight** selects one creature from each roster for simultaneous noncombat damage.

## Supported effects

- Multiple attackers, multiple blockers, and blockers with additional blocking capacity; up to 60 creatures per side.
- First strike, double strike, trample, deathtouch, lifelink, infect, wither, toxic, indestructible.
- Flying, reach, menace, shadow, horsemanship, skulk, unblockability, defender, cannot-block effects, summoning sickness, haste, tapped creatures, and colored protection for blocking/damage.
- Base stats, arbitrary power/toughness modifiers, team buffs, +1/+1 and −1/−1 counters, marked damage, toughness-based damage, damage multipliers, prevention pools, per-source prevention, shield counters, regeneration shields, Fog, unpreventable damage, and inability to gain life.
- Per-source, per-step custom damage assignment, including shared lethal assignment against blockers blocking several attackers.
- Simultaneous damage; state-based creature deaths between steps; game termination when defender life/poison crosses its loss threshold.

### Scope and rules assumptions

This is a configurable **damage sandbox**, not a full implementation of every Magic card. All supported numerical buffs can be entered manually. Arbitrary Oracle text is not executed. Imported cards always carry a review notice; set variable stats, triggers, equipment, and conditional effects yourself before calculating.

Rules checked against the [official Comprehensive Rules effective September 25, 2026](https://magic.wizards.com/en/rules): 510 (combat damage), 701.14 (fight), 702 (keywords), 704 (state-based actions), 122.1c (shields), and 615 (prevention). Modern damage assignment has **no blocker order**; trample still requires lethal assignment before spilling through. Prevention and multipliers do not change what counts as assigned lethal damage.

Automatic allocation is a deterministic lethal-first suggestion in displayed roster order. It accounts for previously assigned damage from other attackers but does not search for an optimal play. Manual allocation supports shared lethal damage. Damage is assigned before all damage in that step is dealt. A single shield counter prevents simultaneous damage from multiple sources; it is still consumed by unpreventable damage and does not rescue creatures already dying from lethal marked damage.

Resolve all attack/block triggers and spells before entering the battlefield. The following are not automated: the stack, arbitrary card text, layer dependencies, banding, rampage, flanking, annihilator, fear/intimidate, landwalk, damage redirection, targets/ward/hexproof legality for fights, multiple defending players, planeswalkers, battles, commander damage, replacement-order decisions, or effects/choices changing between damage steps. Model buffs numerically where applicable. The toughness-based-damage option must be disabled for fights when the actual effect applies only to combat damage.

Overlapping damage effects use a fixed sequence: creature and team multipliers, broad prevention, shield counters, per-source prevention, then the prevention pool. Damage is processed in displayed source order. When a different legal replacement/prevention order changes the outcome, manually review that interaction. Colored protection does not check attachment/target legality. Player gain/loss replacement effects are outside scope.

## Install and offline use

- **iPhone/iPad:** Safari → Share → Add to Home Screen.
- **Android / desktop:** Chrome or Edge → Install app (or browser menu).
- The app shell, bundled fonts, engine, and icons are precached. After a successful online load the calculator works offline; Scryfall search and uncached artwork require internet.
- Scenarios are browser-local. Share links encode the entire battlefield in their URL fragment. There is no application backend or account. Scryfall receives card search requests.
- Updates prompt before activation. Your current battlefield persists locally.

## Development

Node.js 24 is used in CI.

```sh
npm ci
npm run dev
npm test
npm run build
npm run preview
```

The static base path is `/mtg-tools/`, configured in `vite.config.ts`. GitHub Actions runs the combat tests and TypeScript build before deploying `dist` to GitHub Pages. Enable **Settings → Pages → Source → GitHub Actions** when forking.

Architecture: a pure TypeScript rules engine in `src/engine.ts`, regression cases in `src/engine.test.ts`, React UI in `src/App.tsx`, and responsive styling in `src/style.css`. Persisted and shared data is validated and bounded before use. The PWA uses Vite's Workbox integration. No runtime API keys.

## Credits and license

Code licensed under MIT. Fonts are DM Sans and Manrope (SIL Open Font License; licenses included in their packages). Icons by Lucide (ISC). Card data and art supplied by [Scryfall](https://scryfall.com); artwork belongs to its credited artists and Wizards of the Coast and is not covered by this code's license.

Magic: The Gathering is a trademark of Wizards of the Coast. This is an unofficial fan tool and is not endorsed by Wizards.
