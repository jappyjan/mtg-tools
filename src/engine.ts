export const abilities = {
  trample: [
    "Trample",
    "Excess combat damage can hit the defending player after lethal is assigned to every blocker.",
  ],
  deathtouch: [
    "Deathtouch",
    "Any positive damage is lethal to creatures. One assigned damage is lethal for trample.",
  ],
  firstStrike: [
    "First strike",
    "Deals combat damage in the first damage step. Does not change fight damage.",
  ],
  doubleStrike: [
    "Double strike",
    "Deals combat damage in both damage steps. Does not change fight damage.",
  ],
  lifelink: [
    "Lifelink",
    "Damage dealt also gains that much life for its controller.",
  ],
  flying: ["Flying", "Can only be blocked by creatures with flying or reach."],
  reach: ["Reach", "Can block creatures with flying."],
  menace: [
    "Menace",
    "Must be blocked by at least two creatures, if blocked at all.",
  ],
  indestructible: [
    "Indestructible",
    "Survives lethal damage and deathtouch, but not zero toughness.",
  ],
  infect: [
    "Infect",
    "Damage gives creatures −1/−1 counters and players poison instead of life loss.",
  ],
  wither: [
    "Wither",
    "Damage gives creatures −1/−1 counters instead of marked damage.",
  ],
  unblockable: ["Can’t be blocked", "No blockers can be assigned."],
  cantBlock: ["Can’t block", "Cannot be declared as a blocker."],
  defender: ["Defender", "Cannot be declared as an attacker."],
  shadow: ["Shadow", "Can only block and be blocked by creatures with shadow."],
  horsemanship: [
    "Horsemanship",
    "Can only be blocked by creatures with horsemanship.",
  ],
  skulk: ["Skulk", "Cannot be blocked by creatures with greater power."],
  vigilance: [
    "Vigilance",
    "Attacking does not cause this creature to tap. No damage change.",
  ],
  haste: ["Haste", "Can attack despite summoning sickness. No damage change."],
} as const;
export type Ability = keyof typeof abilities;
export type Side = "attack" | "block";
export type Color = "W" | "U" | "B" | "R" | "G";
export interface Creature {
  id: string;
  name: string;
  power: number;
  toughness: number;
  bonusPower: number;
  bonusToughness: number;
  counters: number;
  minusCounters: number;
  marked: number;
  prevention: number;
  shields: number;
  regeneration: number;
  damageMultiplier: number;
  damageReduction: number;
  toxic: number;
  blockCapacity: number;
  toughnessDamage: boolean;
  abilities: Ability[];
  colors: Color[];
  protection: Color[];
  preventAll: boolean;
  tapped: boolean;
  sick: boolean;
  blocked: boolean;
  oracle?: string;
  art?: string;
  attribution?: string;
  review?: boolean;
}
export interface Team {
  power: number;
  toughness: number;
  multiplier: number;
  life: number;
  poison: number;
}
export type Assignments = Record<string, string[]>;
export type Splits = Record<string, Record<string, number>>;
export interface Board {
  version: 1;
  attackers: Creature[];
  blockers: Creature[];
  assignments: Assignments;
  splits: Splits;
  attack: Team;
  block: Team;
  mode: "combat" | "fight";
  fightPair: [string, string];
  fog: boolean;
  noPrevention: boolean;
  noLifeGain: boolean;
}
export const makeCreature = (
  name = "Creature",
  power = 2,
  toughness = 2,
  traits: Ability[] = [],
): Creature => ({
  id: crypto.randomUUID(),
  name,
  power,
  toughness,
  bonusPower: 0,
  bonusToughness: 0,
  counters: 0,
  minusCounters: 0,
  marked: 0,
  prevention: 0,
  shields: 0,
  regeneration: 0,
  damageMultiplier: 1,
  damageReduction: 0,
  toxic: 0,
  blockCapacity: 1,
  toughnessDamage: false,
  abilities: traits,
  colors: [],
  protection: [],
  preventAll: false,
  tapped: false,
  sick: false,
  blocked: false,
  review: false,
});
export function emptyBoard(): Board {
  return {
    version: 1,
    attackers: [],
    blockers: [],
    assignments: {},
    splits: {},
    attack: { power: 0, toughness: 0, multiplier: 1, life: 20, poison: 0 },
    block: { power: 0, toughness: 0, multiplier: 1, life: 20, poison: 0 },
    mode: "combat",
    fightPair: ["", ""],
    fog: false,
    noPrevention: false,
    noLifeGain: false,
  };
}
export function demoBoard(): Board {
  const b = emptyBoard();
  const a = makeCreature("Ancient behemoth", 6, 6, ["trample"]);
  a.colors = ["G"];
  const c = makeCreature("Skyguard", 2, 2, ["flying", "lifelink"]);
  c.colors = ["W"];
  const d = makeCreature("Woodland guardian", 3, 3);
  d.colors = ["G"];
  const e = makeCreature("Brave recruit", 2, 2);
  e.colors = ["W"];
  return {
    ...b,
    attackers: [a, c],
    blockers: [d, e],
    assignments: { [d.id]: [a.id], [e.id]: [a.id] },
    fightPair: [a.id, d.id],
  };
}
export function stats(c: Creature, t: Team, counters = c.minusCounters) {
  return {
    power: c.power + c.bonusPower + c.counters - counters + t.power,
    toughness:
      c.toughness + c.bonusToughness + c.counters - counters + t.toughness,
  };
}
export function canBlock(
  a: Creature,
  b: Creature,
  at: Team,
  bt: Team,
): string | null {
  const has = (c: Creature, k: Ability) => c.abilities.includes(k);
  if (b.tapped) return "Tapped creatures cannot block.";
  if (has(b, "cantBlock")) return `${b.name} cannot block.`;
  if (has(a, "unblockable")) return `${a.name} cannot be blocked.`;
  if (has(a, "flying") && !has(b, "flying") && !has(b, "reach"))
    return `${b.name} needs flying or reach.`;
  if (has(a, "shadow") !== has(b, "shadow"))
    return "Shadow creatures only block other shadow creatures.";
  if (has(a, "horsemanship") && !has(b, "horsemanship"))
    return `${b.name} needs horsemanship.`;
  if (has(a, "skulk") && stats(b, bt).power > stats(a, at).power)
    return "Skulk prevents this higher-power creature from blocking.";
  if (a.protection.some((c) => b.colors.includes(c)))
    return "Protection prevents this block.";
  return null;
}
export interface Unit {
  creature: Creature;
  side: Side;
  damage: number;
  minus: number;
  prevention: number;
  shields: number;
  regeneration: number;
  dead: boolean;
  removed: boolean;
  reason: string;
  touched: boolean;
}
export interface Event {
  source: string;
  target: string;
  assigned: number;
  dealt: number;
  text: string;
}
export interface Step {
  name: string;
  events: Event[];
  deaths: string[];
}
export interface Allocation {
  key: string;
  source: string;
  label: string;
  amount: number;
  targets: { id: string; name: string; amount: number }[];
  custom: boolean;
}
export interface Result {
  units: Record<string, Unit>;
  steps: Step[];
  allocations: Allocation[];
  errors: string[];
  warnings: string[];
  lifeLoss: number;
  attackGain: number;
  blockGain: number;
  poison: number;
  attackDeaths: number;
  blockDeaths: number;
}
export function simulate(board: Board): Result {
  const r: Result = {
    units: {},
    steps: [],
    allocations: [],
    errors: [],
    warnings: [],
    lifeLoss: 0,
    attackGain: 0,
    blockGain: 0,
    poison: 0,
    attackDeaths: 0,
    blockDeaths: 0,
  };
  const fight = board.mode === "fight";
  const attackers = fight
    ? board.attackers.filter((c) => c.id === board.fightPair[0])
    : board.attackers;
  const blockers = fight
    ? board.blockers.filter((c) => c.id === board.fightPair[1])
    : board.blockers;
  if (fight && (attackers.length !== 1 || blockers.length !== 1))
    r.errors.push("Choose one creature from each side to fight.");
  const has = (c: Creature, k: Ability) => c.abilities.includes(k);
  const team = (s: Side) => (s === "attack" ? board.attack : board.block);
  for (const [list, side] of [
    [attackers, "attack"],
    [blockers, "block"],
  ] as const)
    for (const c of list)
      r.units[c.id] = {
        creature: c,
        side,
        damage: c.marked,
        minus: c.minusCounters,
        prevention: c.prevention,
        shields: c.shields,
        regeneration: c.regeneration,
        dead: false,
        removed: false,
        reason: "",
        touched: false,
      };
  const getStats = (u: Unit) => stats(u.creature, team(u.side), u.minus);
  if (!fight) {
    for (const a of attackers) {
      if (has(a, "defender"))
        r.errors.push(`${a.name} has defender and cannot attack.`);
      if (a.tapped) r.errors.push(`${a.name} is tapped and cannot attack.`);
      if (a.sick && !has(a, "haste"))
        r.errors.push(`${a.name} is summoning sick.`);
      const bs = blockers.filter((b) =>
        board.assignments[b.id]?.includes(a.id),
      );
      if (has(a, "menace") && bs.length === 1)
        r.errors.push(
          `${a.name} has menace: assign at least two blockers or none.`,
        );
      for (const b of bs) {
        const error = canBlock(a, b, board.attack, board.block);
        if (error) r.errors.push(`${a.name}: ${error}`);
      }
    }
    for (const b of blockers)
      if ((board.assignments[b.id]?.length ?? 0) > b.blockCapacity)
        r.errors.push(
          `${b.name} can block only ${b.blockCapacity} attacker(s).`,
        );
  }
  const stateActions = () => {
    const deaths: string[] = [];
    for (const u of Object.values(r.units)) {
      if (u.dead || (!fight && u.removed)) continue;
      const s = getStats(u);
      const zero = s.toughness <= 0;
      const lethal = u.damage >= s.toughness || u.touched;
      if (zero || (lethal && !has(u.creature, "indestructible"))) {
        if (!zero && u.regeneration > 0) {
          u.regeneration--;
          u.damage = 0;
          u.touched = false;
          u.removed = true;
          u.reason = fight ? "Regenerated" : "Regenerated; removed from combat";
          continue;
        }
        u.dead = true;
        u.reason = zero
          ? "Zero toughness"
          : u.touched
            ? "Deathtouch"
            : "Lethal damage";
        deaths.push(u.creature.name);
      }
    }
    return deaths;
  };
  const initial = stateActions();
  if (initial.length)
    r.steps.push({ name: "Before damage", events: [], deaths: initial });
  const alive = (id: string) =>
    r.units[id] && !r.units[id].dead && (fight || !r.units[id].removed);
  let assignedSoFar: Record<string, number> = {};
  let assignedTouch = new Set<string>();
  const allocate = (u: Unit, ids: string[], player: boolean, step: string) => {
    const s = getStats(u);
    const amount = Math.max(
      0,
      u.creature.toughnessDamage ? s.toughness : s.power,
    );
    const key = `${step}:${u.creature.id}`;
    const targets = [...ids, ...(player ? ["player"] : [])];
    if (!targets.length || !amount) return [];
    let left = amount;
    const automatic: Record<string, number> = {};
    for (const id of ids) {
      const target = r.units[id];
      const remaining = assignedTouch.has(id)
        ? 0
        : Math.max(
            0,
            getStats(target).toughness -
              target.damage -
              (assignedSoFar[id] ?? 0),
          );
      const need = has(u.creature, "deathtouch")
        ? Math.min(1, remaining)
        : remaining;
      automatic[id] = Math.min(left, need);
      left -= automatic[id];
    }
    if (player) automatic.player = left;
    else if (ids.length)
      automatic[ids[ids.length - 1]] =
        (automatic[ids[ids.length - 1]] ?? 0) + left;
    const custom = board.splits[key];
    let values = automatic;
    if (custom) {
      const total = targets.reduce((v, id) => v + (custom[id] ?? 0), 0);
      if (
        Object.keys(custom).some((id) => !targets.includes(id)) ||
        Object.values(custom).some((v) => !Number.isInteger(v) || v < 0) ||
        total !== amount
      )
        r.errors.push(
          `${u.creature.name} (${step}): assign exactly ${amount} damage to the current targets.`,
        );
      else values = custom;
    }
    r.allocations.push({
      key,
      source: u.creature.id,
      label: step,
      amount,
      targets: targets.map((id) => ({
        id,
        name: id === "player" ? "Defending player" : r.units[id].creature.name,
        amount: values[id] ?? 0,
      })),
      custom: !!custom,
    });
    for (const id of ids) {
      assignedSoFar[id] = (assignedSoFar[id] ?? 0) + (values[id] ?? 0);
      if (has(u.creature, "deathtouch") && (values[id] ?? 0) > 0)
        assignedTouch.add(id);
    }
    return targets
      .filter((id) => (values[id] ?? 0) > 0)
      .map((id) => ({
        source: u.creature.id,
        target: id,
        assigned: values[id] ?? 0,
      }));
  };
  const first =
    !fight &&
    [...attackers, ...blockers.filter((c) => board.assignments[c.id]?.length)]
      .filter((c) => alive(c.id))
      .some((c) => has(c, "firstStrike") || has(c, "doubleStrike"));
  const phases = fight
    ? ["Fight"]
    : first
      ? ["First strike", "Regular damage"]
      : ["Regular damage"];
  for (const phase of phases) {
    assignedSoFar = {};
    assignedTouch = new Set();
    const step: Step = { name: phase, events: [], deaths: [] };
    let pending: { source: string; target: string; assigned: number }[] = [];
    for (const u of Object.values(r.units)) {
      if (!alive(u.creature.id)) continue;
      const c = u.creature;
      if (
        !fight &&
        phase === "First strike" &&
        !has(c, "firstStrike") &&
        !has(c, "doubleStrike")
      )
        continue;
      if (
        !fight &&
        first &&
        phase === "Regular damage" &&
        has(c, "firstStrike") &&
        !has(c, "doubleStrike")
      )
        continue;
      if (fight) {
        const other = u.side === "attack" ? blockers[0] : attackers[0];
        if (other && alive(other.id))
          pending.push(...allocate(u, [other.id], false, phase));
        continue;
      }
      if (u.side === "attack") {
        const all = blockers.filter((b) =>
          board.assignments[b.id]?.includes(c.id),
        );
        const ids = all.filter((b) => alive(b.id)).map((b) => b.id);
        const blocked = all.length > 0 || c.blocked;
        pending.push(...allocate(u, ids, !blocked || has(c, "trample"), phase));
      } else {
        const ids = (board.assignments[c.id] ?? []).filter(alive);
        pending.push(...allocate(u, ids, false, phase));
      }
    }
    for (const e of pending.filter((e) => e.target === "player")) {
      const u = r.units[e.source];
      const ids = blockers
        .filter(
          (b) =>
            board.assignments[b.id]?.includes(u.creature.id) && alive(b.id),
        )
        .map((b) => b.id);
      if (
        ids.some(
          (id) =>
            !assignedTouch.has(id) &&
            (assignedSoFar[id] ?? 0) <
              Math.max(0, getStats(r.units[id]).toughness - r.units[id].damage),
        )
      )
        r.errors.push(
          `${u.creature.name}: trample requires lethal assignment to every blocker first.`,
        );
    }
    // All assignments are fixed before any damage or state-based actions.
    const toxicSources = new Set<string>();
    const shielded = new Set<string>();
    for (const e of pending) {
      if (e.target === "player") continue;
      const target = r.units[e.target],
        source = r.units[e.source];
      const raw =
        e.assigned *
        source.creature.damageMultiplier *
        team(source.side).multiplier;
      const otherwisePrevented =
        !board.noPrevention &&
        ((board.fog && !fight) ||
          target.creature.preventAll ||
          target.creature.protection.some((color) =>
            source.creature.colors.includes(color),
          ));
      if (raw > 0 && !otherwisePrevented && target.shields > 0)
        shielded.add(e.target);
    }
    for (const id of shielded) r.units[id].shields--;
    for (const e of pending) {
      const u = r.units[e.source],
        c = u.creature;
      let dealt = e.assigned * c.damageMultiplier * team(u.side).multiplier;
      const target = e.target === "player" ? null : r.units[e.target];
      let prevented = 0;
      const preventionAllowed = !board.noPrevention;
      if (
        preventionAllowed &&
        ((board.fog && !fight) ||
          (target &&
            (target.creature.preventAll ||
              target.creature.protection.some((color) =>
                c.colors.includes(color),
              ))))
      ) {
        prevented = dealt;
        dealt = 0;
      }
      if (target && preventionAllowed && dealt > 0) {
        if (shielded.has(e.target)) {
          prevented += dealt;
          dealt = 0;
        } else {
          const reduction = Math.min(dealt, target.creature.damageReduction);
          dealt -= reduction;
          prevented += reduction;
          const pool = Math.min(dealt, target.prevention);
          target.prevention -= pool;
          dealt -= pool;
          prevented += pool;
        }
      }
      if (dealt > 0) {
        if (has(c, "lifelink") && !board.noLifeGain) {
          if (u.side === "attack") r.attackGain += dealt;
          else r.blockGain += dealt;
        }
        if (!target) {
          if (has(c, "infect")) r.poison += dealt;
          else r.lifeLoss += dealt;
          if (!fight && c.toxic > 0) toxicSources.add(c.id);
        } else {
          if (has(c, "infect") || has(c, "wither")) target.minus += dealt;
          else target.damage += dealt;
          if (has(c, "deathtouch")) target.touched = true;
        }
      }
      step.events.push({
        ...e,
        dealt,
        text: `${c.name} → ${target ? target.creature.name : "defending player"}: ${dealt} damage${prevented ? ` (${prevented} prevented)` : ""}${has(c, "lifelink") && dealt && !board.noLifeGain ? `, gain ${dealt} life` : ""}${has(c, "infect") && dealt && !target ? ` as poison` : ""}`,
      });
    }
    for (const id of toxicSources) r.poison += r.units[id].creature.toxic;
    step.deaths = stateActions();
    r.steps.push(step);
    if (
      board.block.life - r.lifeLoss + r.blockGain <= 0 ||
      board.block.poison + r.poison >= 10
    )
      break;
  }
  r.attackDeaths = Object.values(r.units).filter(
    (u) => u.side === "attack" && u.dead,
  ).length;
  r.blockDeaths = Object.values(r.units).filter(
    (u) => u.side === "block" && u.dead,
  ).length;
  if (
    [...attackers, ...blockers.filter((c) => board.assignments[c.id]?.length)]
      .filter((c) => alive(c.id))
      .some((c) => c.review)
  )
    r.warnings.push(
      "Imported cards may have additional text. Review their Oracle text and set any extra effects manually.",
    );
  return r;
}
// Persist only bounded, explicitly shaped data; shared links are untrusted input.
export function parseBoard(value: unknown): Board {
  const o = value as Partial<Board>;
  if (
    !o ||
    o.version !== 1 ||
    !Array.isArray(o.attackers) ||
    !Array.isArray(o.blockers) ||
    o.attackers.length > 60 ||
    o.blockers.length > 60
  )
    throw Error("Invalid battlefield.");
  const num = (v: unknown, f: number, min = -999, max = 999) =>
    typeof v === "number" && Number.isFinite(v)
      ? Math.max(min, Math.min(max, Math.trunc(v)))
      : f;
  const parse = (v: unknown): Creature => {
    const c = v as Partial<Creature>;
    if (
      !c ||
      typeof c.id !== "string" ||
      typeof c.name !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        c.id,
      )
    )
      throw Error("Invalid creature.");
    const d = makeCreature();
    const n = { ...d, id: c.id.slice(0, 80), name: c.name.slice(0, 100) };
    for (const k of [
      "power",
      "toughness",
      "bonusPower",
      "bonusToughness",
    ] as const)
      n[k] = num(c[k], d[k]);
    for (const k of [
      "counters",
      "minusCounters",
      "marked",
      "prevention",
      "shields",
      "regeneration",
      "damageReduction",
      "toxic",
    ] as const)
      n[k] = num(c[k], d[k], 0);
    n.blockCapacity = num(c.blockCapacity, 1, 1, 60);
    n.damageMultiplier = num(c.damageMultiplier, 1, 0, 10);
    for (const k of [
      "toughnessDamage",
      "preventAll",
      "tapped",
      "sick",
      "blocked",
      "review",
    ] as const)
      n[k] = c[k] === true;
    n.abilities = Array.isArray(c.abilities)
      ? c.abilities.filter(
          (k): k is Ability =>
            typeof k === "string" && Object.hasOwn(abilities, k),
        )
      : [];
    for (const k of ["colors", "protection"] as const)
      n[k] = Array.isArray(c[k])
        ? c[k].filter((x): x is Color => ["W", "U", "B", "R", "G"].includes(x))
        : [];
    if (typeof c.oracle === "string") n.oracle = c.oracle.slice(0, 5000);
    if (
      typeof c.art === "string" &&
      c.art.startsWith("https://cards.scryfall.io/")
    )
      n.art = c.art;
    if (typeof c.attribution === "string")
      n.attribution = c.attribution.slice(0, 200);
    return n;
  };
  const b = emptyBoard();
  b.attackers = o.attackers.map(parse);
  b.blockers = o.blockers.map(parse);
  const ids = [...b.attackers, ...b.blockers].map((c) => c.id);
  if (new Set(ids).size !== ids.length) throw Error("Duplicate creature IDs.");
  for (const side of ["attack", "block"] as const) {
    const t = o[side];
    if (t)
      for (const k of [
        "power",
        "toughness",
        "multiplier",
        "life",
        "poison",
      ] as const)
        b[side][k] = num(
          t[k],
          b[side][k],
          k === "multiplier" || k === "poison" ? 0 : -999,
          k === "multiplier" ? 10 : 999,
        );
  }
  b.mode = o.mode === "fight" ? "fight" : "combat";
  b.fightPair = [
    b.attackers.some((c) => c.id === o.fightPair?.[0])
      ? o.fightPair![0]
      : (b.attackers[0]?.id ?? ""),
    b.blockers.some((c) => c.id === o.fightPair?.[1])
      ? o.fightPair![1]
      : (b.blockers[0]?.id ?? ""),
  ];
  for (const k of ["fog", "noPrevention", "noLifeGain"] as const)
    b[k] = o[k] === true;
  for (const c of b.blockers) {
    const a = o.assignments?.[c.id];
    if (Array.isArray(a))
      b.assignments[c.id] = [
        ...new Set(a.filter((id) => b.attackers.some((c) => c.id === id))),
      ];
  }
  if (o.splits && typeof o.splits === "object")
    for (const [key, v] of Object.entries(o.splits).slice(0, 240)) {
      if (
        ["Fight", "First strike", "Regular damage"].some((step) =>
          ids.some((id) => key === `${step}:${id}`),
        ) &&
        v &&
        typeof v === "object"
      ) {
        b.splits[key] = {};
        for (const [target, n] of Object.entries(v).slice(0, 61))
          if (target === "player" || ids.includes(target))
            b.splits[key][target] = num(n, 0, 0);
      }
    }
  return b;
}
