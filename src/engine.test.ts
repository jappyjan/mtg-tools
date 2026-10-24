import { describe, expect, it } from "vitest";
import {
  canBlock,
  demoBoard,
  emptyBoard,
  makeCreature,
  parseBoard,
  simulate,
  type Ability,
  type Board,
} from "./engine";
function duel(
  ap = 3,
  at = 3,
  bp = 2,
  bt = 2,
  aa: Ability[] = [],
  ba: Ability[] = [],
) {
  const b = emptyBoard(),
    a = makeCreature("Attacker", ap, at, aa),
    d = makeCreature("Blocker", bp, bt, ba);
  b.attackers = [a];
  b.blockers = [d];
  b.assignments[d.id] = [a.id];
  b.fightPair = [a.id, d.id];
  return { b, a, d };
}
const dead = (b: Board, id: string) => simulate(b).units[id].dead;
describe("combat damage and state-based actions", () => {
  it("resolves the multi-blocker example", () => {
    const r = simulate(demoBoard());
    expect(r.errors).toEqual([]);
    expect([r.lifeLoss, r.attackDeaths, r.blockDeaths, r.attackGain]).toEqual([
      3, 0, 2, 2,
    ]);
  });
  it("deals damage simultaneously even if a source dies", () => {
    const { b, a, d } = duel(3, 2, 2, 3);
    expect(dead(b, a.id)).toBe(true);
    expect(dead(b, d.id)).toBe(true);
  });
  it("first strike removes a blocker before retaliation", () => {
    const { b, a, d } = duel(3, 2, 2, 3, ["firstStrike"]);
    expect(dead(b, a.id)).toBe(false);
    expect(dead(b, d.id)).toBe(true);
  });
  it("double strike without trample stays blocked after killing a blocker", () => {
    const { b } = duel(3, 3, 1, 2, ["doubleStrike"]);
    expect(simulate(b).lifeLoss).toBe(0);
  });
  it("double strike with trample spills again in the regular step", () => {
    const { b } = duel(3, 3, 1, 2, ["doubleStrike", "trample"]);
    expect(simulate(b).lifeLoss).toBe(4);
  });
  it("blocked creatures without remaining blockers do not hit the player", () => {
    const b = emptyBoard(),
      a = makeCreature("Blocked", 5, 5);
    a.blocked = true;
    b.attackers = [a];
    expect(simulate(b).lifeLoss).toBe(0);
    a.abilities = ["trample"];
    expect(simulate(b).lifeLoss).toBe(5);
  });
  it("deathtouch needs only one assigned damage for trample", () => {
    const { b } = duel(5, 5, 1, 10, ["trample", "deathtouch"]);
    expect(simulate(b).lifeLoss).toBe(4);
  });
  it("indestructible survives deathtouch", () => {
    const { b, d } = duel(1, 1, 1, 9, ["deathtouch"], ["indestructible"]);
    expect(dead(b, d.id)).toBe(false);
  });
  it("zero toughness ignores indestructible and regeneration", () => {
    const { b, d } = duel(5, 5, 0, 0, [], ["indestructible"]);
    d.regeneration = 1;
    d.shields = 1;
    expect(dead(b, d.id)).toBe(true);
  });
  it("marked damage lowers the lethal assignment threshold", () => {
    const { b, d } = duel(5, 5, 1, 5, ["trample"]);
    d.marked = 3;
    expect(simulate(b).lifeLoss).toBe(3);
  });
  it("damage multiplication applies after assignment", () => {
    const { b, a } = duel(5, 5, 0, 3, ["trample"]);
    a.damageMultiplier = 2;
    expect(simulate(b).lifeLoss).toBe(4);
  });
  it("negative power assigns no damage", () => {
    const { b } = duel(-2, 4, 0, 3);
    expect(simulate(b).steps[0].events).toEqual([]);
  });
  it("stops after a player loses in the first-strike step", () => {
    const b = emptyBoard();
    b.block.life = 2;
    b.attackers = [makeCreature("Double", 3, 3, ["doubleStrike"])];
    const r = simulate(b);
    expect(r.lifeLoss).toBe(3);
    expect(r.steps).toHaveLength(1);
  });
});
describe("counters, prevention, and replacement effects", () => {
  it("wither in first strike lowers regular-step power", () => {
    const { b, a, d } = duel(2, 4, 4, 4, ["firstStrike", "wither"]);
    const r = simulate(b);
    expect(r.units[d.id].minus).toBe(2);
    expect(r.units[a.id].damage).toBe(2);
  });
  it("infect damage reduces toughness even on indestructible creatures", () => {
    const { b, d } = duel(3, 3, 0, 3, ["infect"], ["indestructible"]);
    expect(dead(b, d.id)).toBe(true);
  });
  it("infect and toxic add poison without normal damage", () => {
    const b = emptyBoard(),
      a = makeCreature("Poison", 3, 3, ["infect", "doubleStrike"]);
    a.toxic = 2;
    b.attackers = [a];
    const r = simulate(b);
    expect(r.poison).toBe(10);
    expect(r.lifeLoss).toBe(0);
  });
  it("lifelink gains actual damage only", () => {
    const { b, d } = duel(3, 5, 0, 4, ["lifelink"]);
    d.prevention = 2;
    expect(simulate(b).attackGain).toBe(1);
    b.noLifeGain = true;
    expect(simulate(b).attackGain).toBe(0);
  });
  it("a prevention pool is consumed across damage steps", () => {
    const { b, d } = duel(3, 5, 0, 10, ["doubleStrike"]);
    d.prevention = 4;
    expect(simulate(b).units[d.id].damage).toBe(2);
  });
  it("one shield prevents all simultaneous damage to one creature", () => {
    const { b, a, d } = duel(3, 5, 0, 4);
    const a2 = makeCreature("Second", 3, 5);
    b.attackers.push(a2);
    b.assignments[d.id] = [a.id, a2.id];
    d.blockCapacity = 2;
    d.shields = 2;
    const r = simulate(b);
    expect(r.units[d.id].damage).toBe(0);
    expect(r.units[d.id].shields).toBe(1);
  });
  it("unpreventable damage consumes one shield and can kill through it", () => {
    const { b, d } = duel(3, 5, 0, 3);
    d.shields = 2;
    b.noPrevention = true;
    const r = simulate(b);
    expect(r.units[d.id].shields).toBe(1);
    expect(r.units[d.id].dead).toBe(true);
  });
  it("shield counters cannot save a creature with lethal marked damage", () => {
    const { b, d } = duel(0, 5, 0, 3);
    d.marked = 3;
    d.shields = 1;
    expect(dead(b, d.id)).toBe(true);
  });
  it("regeneration removes a creature from combat but keeps the attacker blocked", () => {
    const { b, a, d } = duel(3, 4, 0, 2, ["doubleStrike"]);
    d.regeneration = 1;
    const r = simulate(b);
    expect(r.units[d.id].removed).toBe(true);
    expect(r.units[a.id].dead).toBe(false);
    expect(r.lifeLoss).toBe(0);
  });
  it("colored protection prevents fight damage", () => {
    const { b, a, d } = duel(3, 4, 1, 4);
    b.mode = "fight";
    a.colors = ["R"];
    d.protection = ["R"];
    expect(simulate(b).units[d.id].damage).toBe(0);
  });
  it("Fog prevents combat but never fight damage", () => {
    const { b, d } = duel(3, 4, 0, 4);
    b.fog = true;
    expect(simulate(b).units[d.id].damage).toBe(0);
    b.mode = "fight";
    expect(simulate(b).units[d.id].damage).toBe(3);
  });
});
describe("legal blocks, manual assignments, and fight", () => {
  it("enforces flying, reach, menace, shadow, and capacity", () => {
    const { b, a, d } = duel(3, 3, 1, 4, ["flying", "menace"]);
    expect(canBlock(a, d, b.attack, b.block)).toMatch(/flying/);
    d.abilities = ["reach"];
    expect(canBlock(a, d, b.attack, b.block)).toBe(null);
    expect(simulate(b).errors.join()).toMatch(/menace/);
    a.abilities = ["shadow"];
    expect(canBlock(a, d, b.attack, b.block)).toMatch(/Shadow/);
  });
  it("allows arbitrary modern damage splits without lethal ordering", () => {
    const { b, a, d } = duel(4, 5, 0, 3);
    const d2 = makeCreature("Other", 0, 3);
    b.blockers.push(d2);
    b.assignments[d2.id] = [a.id];
    b.splits[`Regular damage:${a.id}`] = { [d.id]: 2, [d2.id]: 2 };
    const r = simulate(b);
    expect(r.errors).toEqual([]);
    expect(r.blockDeaths).toBe(0);
  });
  it("rejects splits that do not total the source power", () => {
    const { b, a, d } = duel();
    b.splits[`Regular damage:${a.id}`] = { [d.id]: 1 };
    expect(simulate(b).errors.join()).toMatch(/exactly 3/);
  });
  it("rejects trample spill without lethal assignment", () => {
    const { b, a, d } = duel(5, 5, 0, 3, ["trample"]);
    b.splits[`Regular damage:${a.id}`] = { [d.id]: 1, player: 4 };
    expect(simulate(b).errors.join()).toMatch(/trample/);
  });
  it("supports shared lethal assignment by several attackers", () => {
    const { b, a, d } = duel(1, 3, 0, 2);
    const a2 = makeCreature("Trampler", 3, 3, ["trample"]);
    b.attackers.push(a2);
    b.assignments[d.id] = [a.id, a2.id];
    d.blockCapacity = 2;
    b.splits[`Regular damage:${a2.id}`] = { [d.id]: 1, player: 2 };
    const r = simulate(b);
    expect(r.errors).toEqual([]);
    expect(r.lifeLoss).toBe(2);
  });
  it("fight ignores strike abilities, trample, evasion, and toxic", () => {
    const { b, a, d } = duel(3, 2, 2, 3, ["doubleStrike", "trample", "flying"]);
    a.toxic = 5;
    b.mode = "fight";
    const r = simulate(b);
    expect(r.errors).toEqual([]);
    expect(r.units[a.id].dead && r.units[d.id].dead).toBe(true);
    expect([r.lifeLoss, r.poison, r.steps.length]).toEqual([0, 0, 1]);
  });
  it("fights only the selected pair", () => {
    const { b, a, d } = duel();
    b.attackers.push(makeCreature("Unused", 99, 99));
    b.mode = "fight";
    expect(Object.keys(simulate(b).units).sort()).toEqual([a.id, d.id].sort());
  });
});
describe("saved and shared scenarios", () => {
  it("round-trips a battlefield", () => {
    const b = demoBoard();
    expect(parseBoard(JSON.parse(JSON.stringify(b)))).toEqual(b);
  });
  it("rejects malformed scenarios and duplicate IDs", () => {
    expect(() => parseBoard({})).toThrow();
    const b = demoBoard();
    b.blockers[0].id = b.attackers[0].id;
    expect(() => parseBoard(b)).toThrow(/Duplicate/);
  });
  it("strips unknown abilities and untrusted image URLs", () => {
    const b = demoBoard();
    b.attackers[0].abilities.push("unknown" as Ability);
    b.attackers[0].art = "https://evil.example/track";
    const c = parseBoard(b).attackers[0];
    expect(c.abilities).toEqual(["trample"]);
    expect(c.art).toBeUndefined();
  });
});
