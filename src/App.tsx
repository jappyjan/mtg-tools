import { useEffect, useRef, useState } from "react";
import {
  Swords,
  Shield,
  Plus,
  ArrowUpRight,
  ChevronDown,
  ChevronRight,
  X,
  Copy,
  Trash2,
  Undo2,
  Redo2,
  Share2,
  Bookmark,
  SlidersHorizontal,
  Search,
  Sparkles,
  Heart,
  Skull,
  Info,
  Download,
  Check,
  WifiOff,
  Flag,
  Leaf,
  CircleHelp,
  RotateCcw,
  Crosshair,
  ArrowRight,
  Target,
  BookOpen,
} from "lucide-react";
import { registerSW } from "virtual:pwa-register";
import {
  abilities,
  canBlock,
  demoBoard,
  emptyBoard,
  makeCreature,
  parseBoard,
  simulate,
  stats,
  type Ability,
  type Board,
  type Color,
  type Creature,
  type Result,
  type Side,
} from "./engine";
import "./style.css";

type Save = { name: string; board: Board };
type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};
const KEY = "clash.battlefield.v1";
const getSaved = (): Save[] => {
  try {
    return JSON.parse(localStorage.getItem("clash.saves") || "[]").map(
      (s: Save) => ({ name: String(s.name), board: parseBoard(s.board) }),
    );
  } catch {
    return [];
  }
};
const decode = (hash: string) =>
  JSON.parse(
    new TextDecoder().decode(
      Uint8Array.from(atob(hash), (c) => c.charCodeAt(0)),
    ),
  );
let loadNotice = "";
const initial = () => {
  try {
    if (location.hash.startsWith("#battle="))
      return parseBoard(decode(location.hash.slice(8)));
    const s = localStorage.getItem(KEY);
    if (s) return parseBoard(JSON.parse(s));
  } catch {
    loadNotice =
      "That saved battlefield could not be loaded. A fresh example is ready.";
  }
  return demoBoard();
};
const colorNames: Record<Color, string> = {
  W: "White",
  U: "Blue",
  B: "Black",
  R: "Red",
  G: "Green",
};
function NumberField({
  label,
  value,
  onChange,
  min = -999,
  max = 999,
  hint,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  hint?: string;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const normalize = (text: string) =>
    Math.max(min, Math.min(max, Math.trunc(Number(text) || 0)));
  return (
    <label className="number-field">
      <span>{label}</span>
      <div className="stepper">
        <button
          type="button"
          aria-label={`Decrease ${label}`}
          disabled={value <= min}
          onClick={() => onChange(Math.max(min, value - 1))}
        >
          −
        </button>
        <input
          aria-label={label}
          type="number"
          inputMode={min < 0 ? "text" : "numeric"}
          min={min}
          max={max}
          value={draft}
          onChange={(e) => {
            const text = e.target.value;
            setDraft(text);
            if (/^-?\d+$/.test(text)) onChange(normalize(text));
          }}
          onBlur={() => {
            const number = normalize(draft);
            setDraft(String(number));
            if (number !== value) onChange(number);
          }}
        />
        <button
          type="button"
          aria-label={`Increase ${label}`}
          disabled={value >= max}
          onClick={() => onChange(Math.min(max, value + 1))}
        >
          +
        </button>
      </div>
      {hint && <small>{hint}</small>}
    </label>
  );
}
function Modal({
  title,
  subtitle,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current!;
    d.showModal();
    return () => d.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={wide ? "modal wide" : "modal"}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      aria-label={title}
    >
      <div className="modal-head">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <button
          className="icon-btn"
          onClick={onClose}
          aria-label="Close dialog"
        >
          <X size={21} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
function Editor({
  creature,
  side,
  onSave,
  onClose,
}: {
  creature: Creature;
  side: Side;
  onSave: (c: Creature) => void;
  onClose: () => void;
}) {
  const [c, setC] = useState(structuredClone(creature));
  const [tab, setTab] = useState("stats");
  const [query, setQuery] = useState("");
  const [cards, setCards] = useState<Creature[]>([]);
  const [status, setStatus] = useState("");
  const patch = (p: Partial<Creature>) => setC((v) => ({ ...v, ...p }));
  useEffect(() => {
    if (query.trim().length < 3) {
      setCards([]);
      setStatus("");
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setStatus("Searching Scryfall…");
      try {
        const res = await fetch(
          `https://api.scryfall.com/cards/search?q=${encodeURIComponent(`t:creature ${query.trim()}`)}&unique=cards&order=name`,
          {
            signal: controller.signal,
            headers: { Accept: "application/json" },
          },
        );
        const data = await res.json();
        if (!res.ok) {
          setCards([]);
          setStatus(
            res.status === 404
              ? "No creatures found. Try a card name."
              : "Card search is unavailable. You can enter a creature manually.",
          );
          return;
        }
        setCards(
          data.data.slice(0, 8).map(
            (card: {
              name: string;
              power?: string;
              toughness?: string;
              keywords: string[];
              colors: Color[];
              oracle_text?: string;
              image_uris?: { art_crop: string };
              artist?: string;
              card_faces?: {
                power?: string;
                toughness?: string;
                oracle_text?: string;
                image_uris?: { art_crop: string };
              }[];
            }) => {
              const face = card.card_faces?.[0] ?? card;
              const n = makeCreature(
                card.name,
                Number(face.power) || 0,
                Number(face.toughness) || 0,
              );
              n.abilities = (Object.keys(abilities) as Ability[]).filter(
                (key) =>
                  card.keywords?.some(
                    (k) => k.toLowerCase() === abilities[key][0].toLowerCase(),
                  ),
              );
              n.colors = card.colors || [];
              n.oracle = face.oracle_text;
              n.art = face.image_uris?.art_crop ?? card.image_uris?.art_crop;
              n.attribution = card.artist;
              n.review = true;
              const toxic = n.oracle?.match(/Toxic (\d+)/i);
              if (toxic) n.toxic = Number(toxic[1]);
              return n;
            },
          ),
        );
        setStatus("Select a card, then review its effects.");
      } catch (e) {
        if ((e as Error).name !== "AbortError")
          setStatus(
            "Offline or search unavailable. Manual creatures always work.",
          );
      }
    }, 500);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);
  const number = (
    key: keyof Creature,
    label: string,
    min = 0,
    hint?: string,
    max = 999,
  ) => (
    <NumberField
      key={key}
      label={label}
      value={c[key] as number}
      min={min}
      max={max}
      hint={hint}
      onChange={(n) => patch({ [key]: n })}
    />
  );
  return (
    <Modal
      title={side === "attack" ? "Attacking creature" : "Blocking creature"}
      subtitle="Start simple. Add only the effects you need."
      onClose={onClose}
      wide
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave({ ...c, name: c.name.trim() || "Creature" });
        }}
      >
        <div className="modal-body">
          <div className="search-wrap">
            <Search size={18} />
            <input
              aria-label="Search Scryfall cards"
              placeholder="Find a real card on Scryfall…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.preventDefault();
              }}
            />
          </div>
          {status && (
            <p className="search-status" role="status">
              {status}
            </p>
          )}
          {cards.length > 0 && (
            <div className="search-results">
              {cards.map((card) => (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => {
                    setC({ ...card, id: c.id });
                    setQuery("");
                    setCards([]);
                  }}
                >
                  {card.art && <img src={card.art} alt="" />}
                  <span>
                    {card.name}
                    <small>
                      {card.abilities.map((a) => abilities[a][0]).join(" · ") ||
                        "Review Oracle text"}
                    </small>
                  </span>
                  <b>
                    {card.power}/{card.toughness}
                  </b>
                  <Plus size={16} />
                </button>
              ))}
            </div>
          )}
          <label className="text-field">
            Creature name
            <input
              value={c.name}
              maxLength={100}
              onChange={(e) => patch({ name: e.target.value })}
              required
            />
          </label>
          <div
            className="editor-tabs"
            role="tablist"
            aria-label="Creature settings"
            onKeyDown={(e) => {
              const ids = ["stats", "abilities", "advanced"];
              const direction =
                e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
              if (!direction && e.key !== "Home" && e.key !== "End") return;
              e.preventDefault();
              const next =
                e.key === "Home"
                  ? "stats"
                  : e.key === "End"
                    ? "advanced"
                    : ids[(ids.indexOf(tab) + direction + 3) % 3];
              setTab(next);
              document.getElementById(`tab-${next}`)?.focus();
            }}
          >
            {[
              ["stats", "Stats & buffs"],
              ["abilities", "Abilities"],
              ["advanced", "More effects"],
            ].map(([id, label]) => (
              <button
                key={id}
                id={`tab-${id}`}
                type="button"
                role="tab"
                tabIndex={tab === id ? 0 : -1}
                aria-selected={tab === id}
                aria-controls="editor-panel"
                onClick={() => setTab(id)}
              >
                {label}
              </button>
            ))}
          </div>
          <div id="editor-panel" role="tabpanel" aria-labelledby={`tab-${tab}`}>
            {tab === "stats" && (
              <>
                <div className="stat-editor">
                  {number("power", "Base power", -999)}
                  {number("toughness", "Base toughness", -999)}
                </div>
                <div className="section-label">
                  QUICK BUFFS <span>· ADDITIVE</span>
                </div>
                <div className="quick-buffs">
                  {[
                    [1, 1],
                    [3, 3],
                    [2, 0],
                    [0, 3],
                  ].map(([p, t]) => (
                    <button
                      key={`${p}/${t}`}
                      type="button"
                      onClick={() =>
                        patch({
                          bonusPower: c.bonusPower + p,
                          bonusToughness: c.bonusToughness + t,
                        })
                      }
                    >
                      <Sparkles size={13} />+{p}/+{t}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => patch({ bonusPower: 0, bonusToughness: 0 })}
                  >
                    Clear modifiers
                  </button>
                </div>
                <div className="section-label">COUNTERS & TEMPORARY BUFFS</div>
                <div className="field-grid">
                  {number(
                    "bonusPower",
                    "Power modifier",
                    -999,
                    "Spells, equipment, auras, and other effects",
                  )}
                  {number("bonusToughness", "Toughness modifier", -999)}
                  {number("counters", "+1/+1 counters")}
                  {number("minusCounters", "−1/−1 counters")}
                  {number("marked", "Damage already marked")}
                </div>
                <div className="preview-stat">
                  <Sparkles size={18} /> Creature stats before team buffs{" "}
                  <b>
                    {
                      stats(c, {
                        power: 0,
                        toughness: 0,
                        multiplier: 1,
                        life: 20,
                        poison: 0,
                      }).power
                    }
                    /
                    {
                      stats(c, {
                        power: 0,
                        toughness: 0,
                        multiplier: 1,
                        life: 20,
                        poison: 0,
                      }).toughness
                    }
                  </b>
                  <small>Team buffs appear on the battlefield.</small>
                </div>
              </>
            )}
            {tab === "abilities" && (
              <div className="ability-grid">
                {(Object.keys(abilities) as Ability[]).map((key) => (
                  <label
                    key={key}
                    className={`ability-option ${c.abilities.includes(key) ? "checked" : ""}`}
                  >
                    <input
                      type="checkbox"
                      checked={c.abilities.includes(key)}
                      onChange={() =>
                        patch({
                          abilities: c.abilities.includes(key)
                            ? c.abilities.filter((k) => k !== key)
                            : [...c.abilities, key],
                        })
                      }
                    />
                    <span>
                      <b>{abilities[key][0]}</b>
                      <small>{abilities[key][1]}</small>
                    </span>
                  </label>
                ))}
              </div>
            )}
            {tab === "advanced" && (
              <>
                <div className="field-grid">
                  {number(
                    "toxic",
                    "Toxic value",
                    0,
                    "Extra poison per combat damage step that hits the player",
                  )}
                  {number(
                    "damageMultiplier",
                    "Damage dealt ×",
                    0,
                    "Applied after assigning damage",
                    10,
                  )}
                  {number(
                    "prevention",
                    "Prevention pool",
                    0,
                    "A single shield of N damage for this entire simulation",
                  )}
                  {number(
                    "damageReduction",
                    "Prevent per hit",
                    0,
                    "Prevents N damage from each source",
                  )}
                  {number("shields", "Shield counters")}
                  {number("regeneration", "Regeneration shields")}
                  {number(
                    "blockCapacity",
                    "Can block attackers",
                    1,
                    "For creatures allowed to block several attackers",
                    60,
                  )}
                </div>
                <div className="check-list">
                  {(
                    [
                      [
                        "toughnessDamage",
                        "Assign damage using toughness",
                        "Use only when the effect changes this damage. Combat-only effects must be disabled for fights.",
                      ],
                      [
                        "preventAll",
                        "Prevent all incoming damage",
                        "Protection from all damage sources.",
                      ],
                      [
                        "tapped",
                        "Currently tapped",
                        "Cannot attack or block; does not prevent fighting.",
                      ],
                      [
                        "sick",
                        "Summoning sick",
                        "Cannot attack unless it has haste.",
                      ],
                      [
                        "blocked",
                        "Remains blocked",
                        "Use when its blocker left combat before this simulation.",
                      ],
                    ] as const
                  ).map(([key, label, hint]) => (
                    <label key={key}>
                      <input
                        type="checkbox"
                        checked={c[key]}
                        onChange={(e) => patch({ [key]: e.target.checked })}
                      />
                      <span>
                        {label}
                        <small>{hint}</small>
                      </span>
                    </label>
                  ))}
                </div>
                <div className="section-label">CREATURE COLORS</div>
                <div className="color-options">
                  {(Object.keys(colorNames) as Color[]).map((color) => (
                    <label
                      key={color}
                      className={c.colors.includes(color) ? "active" : ""}
                    >
                      <input
                        type="checkbox"
                        checked={c.colors.includes(color)}
                        onChange={() =>
                          patch({
                            colors: c.colors.includes(color)
                              ? c.colors.filter((x) => x !== color)
                              : [...c.colors, color],
                          })
                        }
                      />
                      {colorNames[color]}
                    </label>
                  ))}
                </div>
                <div className="section-label">PROTECTION FROM COLORS</div>
                <div className="color-options">
                  {(Object.keys(colorNames) as Color[]).map((color) => (
                    <label
                      key={color}
                      className={c.protection.includes(color) ? "active" : ""}
                    >
                      <input
                        type="checkbox"
                        checked={c.protection.includes(color)}
                        onChange={() =>
                          patch({
                            protection: c.protection.includes(color)
                              ? c.protection.filter((x) => x !== color)
                              : [...c.protection, color],
                          })
                        }
                      />
                      {colorNames[color]}
                    </label>
                  ))}
                </div>
              </>
            )}
          </div>
          {c.oracle && (
            <details className="oracle" open={c.review}>
              <summary>
                <BookOpen size={15} /> Oracle text · review additional effects
              </summary>
              <p>{c.oracle}</p>
              {c.attribution && (
                <small>Artwork © {c.attribution} · via Scryfall</small>
              )}
              <small>
                Only selected abilities and configured effects are simulated.
                Set variable stats (*), triggers, equipment, and other card text
                manually.
              </small>
            </details>
          )}
        </div>
        <div className="modal-footer">
          <button type="button" className="btn secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" type="submit">
            <Check size={17} />
            Save creature
          </button>
        </div>
      </form>
    </Modal>
  );
}
export default function App() {
  const [board, setRaw] = useState<Board>(initial);
  const [past, setPast] = useState<Board[]>([]);
  const [future, setFuture] = useState<Board[]>([]);
  const [editing, setEditing] = useState<{
    side: Side;
    creature: Creature;
  } | null>(null);
  const [dialog, setDialog] = useState<
    "effects" | "library" | "help" | "reset" | "install" | null
  >(null);
  const [mobile, setMobile] = useState("board");
  const [toast, setToast] = useState(loadNotice);
  const [saves, setSaves] = useState(getSaved);
  const [saveName, setSaveName] = useState("");
  const [baseline, setBaseline] = useState<Result | null>(null);
  const [install, setInstall] = useState<InstallEvent | null>(null);
  const [offline, setOffline] = useState(!navigator.onLine);
  const [update, setUpdate] = useState<null | (() => void)>(null);
  const [showSplits, setShowSplits] = useState(false);
  const result = simulate(board);
  const change = (next: Board | ((b: Board) => Board)) => {
    setPast((p) => [...p.slice(-39), board]);
    setFuture([]);
    setRaw(typeof next === "function" ? next(board) : next);
  };
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(board));
    } catch {
      setToast(
        "Storage is full or unavailable. Use a share link to keep this battlefield.",
      );
    }
  }, [board]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 5000);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    const onInstall = (e: Event) => {
      e.preventDefault();
      setInstall(e as InstallEvent);
    };
    const online = () => setOffline(!navigator.onLine);
    window.addEventListener("beforeinstallprompt", onInstall);
    window.addEventListener("online", online);
    window.addEventListener("offline", online);
    const updateSW = registerSW({
      onNeedRefresh: () => setUpdate(() => () => updateSW(true)),
    });
    return () => {
      window.removeEventListener("beforeinstallprompt", onInstall);
      window.removeEventListener("online", online);
      window.removeEventListener("offline", online);
    };
  }, []);
  const undo = () => {
    if (!past.length) return;
    setFuture((f) => [board, ...f]);
    setRaw(past[past.length - 1]);
    setPast((p) => p.slice(0, -1));
  };
  const redo = () => {
    if (!future.length) return;
    setPast((p) => [...p, board]);
    setRaw(future[0]);
    setFuture((f) => f.slice(1));
  };
  const creatures = (s: Side) =>
    s === "attack" ? board.attackers : board.blockers;
  const editSave = (c: Creature) => {
    const side = editing!.side;
    change((b) => {
      const key = side === "attack" ? "attackers" : "blockers";
      const list = b[key];
      const next = {
        ...b,
        [key]: list.some((v) => v.id === c.id)
          ? list.map((v) => (v.id === c.id ? c : v))
          : [...list, c],
        splits: {},
      };
      if (!next.fightPair[side === "attack" ? 0 : 1]) {
        next.fightPair = [...b.fightPair];
        next.fightPair[side === "attack" ? 0 : 1] = c.id;
      }
      return next;
    });
    setEditing(null);
  };
  const add = (side: Side) => {
    if (creatures(side).length >= 60) {
      setToast("Up to 60 creatures per side.");
      return;
    }
    setEditing({ side, creature: makeCreature("", 2, 2) });
  };
  const duplicate = (side: Side, c: Creature) => {
    if (creatures(side).length >= 60) {
      setToast("Up to 60 creatures per side.");
      return;
    }
    const n = { ...structuredClone(c), id: crypto.randomUUID() };
    change((b) => ({
      ...b,
      [side === "attack" ? "attackers" : "blockers"]: [...creatures(side), n],
      splits: {},
    }));
  };
  const remove = (side: Side, id: string) =>
    change((b) => {
      const assignments = Object.fromEntries(
        Object.entries(b.assignments)
          .filter(([key]) => key !== id)
          .map(([key, ids]) => [key, ids.filter((i) => i !== id)]),
      );
      const key = side === "attack" ? "attackers" : "blockers";
      const next = {
        ...b,
        [key]: b[key].filter((c) => c.id !== id),
        assignments,
        splits: {},
      };
      next.fightPair = [
        next.attackers.some((c) => c.id === b.fightPair[0])
          ? b.fightPair[0]
          : (next.attackers[0]?.id ?? ""),
        next.blockers.some((c) => c.id === b.fightPair[1])
          ? b.fightPair[1]
          : (next.blockers[0]?.id ?? ""),
      ];
      return next;
    });
  const assign = (blocker: Creature, attacker: Creature) => {
    const selected = board.assignments[blocker.id] ?? [];
    const exists = selected.includes(attacker.id);
    const error = canBlock(attacker, blocker, board.attack, board.block);
    if (!exists && error) {
      setToast(error);
      return;
    }
    change((b) => ({
      ...b,
      assignments: {
        ...b.assignments,
        [blocker.id]: exists
          ? selected.filter((id) => id !== attacker.id)
          : blocker.blockCapacity === 1
            ? [attacker.id]
            : [...selected, attacker.id],
      },
      splits: {},
    }));
  };
  const share = async () => {
    try {
      const bytes = new TextEncoder().encode(JSON.stringify(board));
      const hash = btoa(
        Array.from(bytes, (c) => String.fromCharCode(c)).join(""),
      );
      const url = `${location.origin}${location.pathname}#battle=${hash}`;
      await navigator.clipboard.writeText(url);
      setToast(
        "Battlefield link copied. Anyone with the link can load this setup.",
      );
    } catch {
      setToast(
        "Could not copy. Your battlefield is still saved on this device.",
      );
    }
  };
  const persistSaves = (next: Save[]) => {
    try {
      localStorage.setItem("clash.saves", JSON.stringify(next));
      setSaves(next);
    } catch {
      setToast("Could not save: device storage is unavailable or full.");
    }
  };
  const clean = result.errors.length === 0;
  const after = board.block.life - result.lifeLoss + result.blockGain;
  const poison = board.block.poison + result.poison;
  function renderCreature({
    c,
    side,
    index,
  }: {
    c: Creature;
    side: Side;
    index: number;
  }) {
    const s = stats(c, board[side]);
    const u = result.units[c.id];
    const assigned = board.assignments[c.id] ?? [];
    const bs = board.blockers.filter((b) =>
      board.assignments[b.id]?.includes(c.id),
    );
    return (
      <article
        key={c.id}
        className={`creature-card ${side} ${clean && u?.dead ? "fallen" : ""}`}
      >
        <div className="creature-main">
          <button
            className={`creature-avatar color-${c.colors[0] ?? (side === "attack" ? "G" : "W")}`}
            onClick={() => setEditing({ side, creature: c })}
            aria-label={`Edit ${c.name}`}
          >
            {c.art ? (
              <img src={c.art} alt="" />
            ) : side === "attack" ? (
              <Leaf size={25} />
            ) : (
              <Shield size={25} />
            )}
            <span>{String(index + 1).padStart(2, "0")}</span>
          </button>
          <button
            className="creature-info"
            onClick={() => setEditing({ side, creature: c })}
          >
            <b>{c.name}</b>
            <span>
              {c.abilities.length
                ? c.abilities
                    .slice(0, 3)
                    .map((a) => abilities[a][0])
                    .join(" · ")
                : "No abilities"}
              {c.abilities.length > 3 ? ` +${c.abilities.length - 3}` : ""}
              {c.toxic > 0 ? ` · Toxic ${c.toxic}` : ""}
            </span>
          </button>
          <button
            className="stat-badge"
            aria-label={`Edit stats for ${c.name}`}
            onClick={() => setEditing({ side, creature: c })}
          >
            {s.power}
            <span>/</span>
            {s.toughness}
          </button>
          <details className="card-menu">
            <summary aria-label={`Actions for ${c.name}`}>
              <SlidersHorizontal size={17} />
            </summary>
            <div>
              <button onClick={() => setEditing({ side, creature: c })}>
                <SlidersHorizontal size={15} />
                Edit creature
              </button>
              <button onClick={() => duplicate(side, c)}>
                <Copy size={15} />
                Duplicate
              </button>
              <button
                className="danger-text"
                onClick={() => remove(side, c.id)}
              >
                <Trash2 size={15} />
                Remove
              </button>
            </div>
          </details>
        </div>
        {(c.marked > 0 ||
          c.bonusPower !== 0 ||
          c.bonusToughness !== 0 ||
          c.counters > 0 ||
          c.minusCounters > 0 ||
          c.review) && (
          <div className="creature-tags">
            {c.marked > 0 && <span>{c.marked} damage marked</span>}
            {(c.bonusPower || c.bonusToughness) !== 0 && (
              <span>Modified stats</span>
            )}
            {c.counters > 0 && <span>{c.counters} +1/+1 counters</span>}
            {c.minusCounters > 0 && (
              <span>{c.minusCounters} −1/−1 counters</span>
            )}
            {c.review && (
              <button onClick={() => setEditing({ side, creature: c })}>
                <Info size={12} />
                Review card text
              </button>
            )}
          </div>
        )}
        {board.mode === "combat" &&
          (side === "attack" ? (
            <div className="block-status">
              <span className={bs.length ? "blocked-dot" : "open-dot"} />
              {bs.length
                ? `Blocked by ${bs.map((b) => b.name).join(" + ")}`
                : c.blocked
                  ? "Blocked · blocker removed"
                  : "Unblocked · attacks player"}
              {clean && u?.dead && (
                <em>
                  <Skull size={12} />
                  Dies
                </em>
              )}
            </div>
          ) : (
            <div className="assign-area">
              <span>BLOCKS {blockerCapacity(c)}</span>
              <div className="assign-chips">
                {board.attackers.length ? (
                  board.attackers.map((a, i) => (
                    <button
                      key={a.id}
                      aria-pressed={assigned.includes(a.id)}
                      onClick={() => assign(c, a)}
                      className={assigned.includes(a.id) ? "selected" : ""}
                    >
                      <span>{String(i + 1).padStart(2, "0")}</span>
                      {a.name}
                      {assigned.includes(a.id) && <Check size={13} />}
                    </button>
                  ))
                ) : (
                  <small>Add an attacker first.</small>
                )}
              </div>
            </div>
          ))}
      </article>
    );
  }
  function blockerCapacity(c: Creature) {
    return c.blockCapacity > 1 ? `· UP TO ${c.blockCapacity} ATTACKERS` : "";
  }
  const renderResults = () => (
    <section className="results-panel" aria-label="Combat results">
      <div className="panel-title">
        <span className="eyebrow">THE OUTCOME</span>
        <span className={`live-pill ${!clean ? "invalid" : ""}`}>
          <span />
          {clean ? "Live calculation" : "Check setup"}
        </span>
      </div>
      <h2>
        {board.mode === "fight"
          ? "How the fight ends."
          : "See the whole picture."}
      </h2>
      {!clean ? (
        <div className="validation">
          <Flag size={20} />
          <b>One more thing…</b>
          <ul>
            {[...new Set(result.errors)].map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      ) : (
        <>
          <div className="damage-hero">
            <div>
              <span>
                {board.mode === "fight"
                  ? "DAMAGE TO PLAYER"
                  : "THROUGH TO OPPONENT"}
              </span>
              <strong>
                {result.lifeLoss}
                <small>damage</small>
              </strong>
            </div>
            <div className="damage-orbit">
              <Swords size={30} />
            </div>
            <p>
              {board.mode === "fight"
                ? "Fight damage never hits a player."
                : poison >= 10
                  ? "Poison threshold reached."
                  : after <= 0
                    ? "Lethal damage to the defending player."
                    : result.lifeLoss === 0 && result.poison === 0
                      ? "The defense holds."
                      : `${board.block.life} → ${after} opponent life`}
            </p>
          </div>
          <div className="outcome-grid">
            <div>
              <span>
                <Skull size={15} />
                Attackers lost
              </span>
              <b>
                {result.attackDeaths}
                <small>
                  {" "}
                  / {board.mode === "fight" ? 1 : board.attackers.length}
                </small>
              </b>
            </div>
            <div>
              <span>
                <Shield size={15} />
                Blockers lost
              </span>
              <b>
                {result.blockDeaths}
                <small>
                  {" "}
                  / {board.mode === "fight" ? 1 : board.blockers.length}
                </small>
              </b>
            </div>
            <div>
              <span>
                <Heart size={15} />
                Your life gain
              </span>
              <b className="positive">+{result.attackGain}</b>
            </div>
            <div>
              <span>
                <Crosshair size={15} />
                Poison added
              </span>
              <b>{result.poison}</b>
            </div>
          </div>
          <div className="life-line">
            <span>
              Your life <b>{board.attack.life + result.attackGain}</b>
            </span>
            <span>
              Opponent <b>{after}</b>
              {poison > 0 && <small> · {poison} poison</small>}
            </span>
          </div>
          {result.blockGain > 0 && (
            <p className="subtle">
              Defender gains {result.blockGain} life from lifelink.
            </p>
          )}
          {baseline && (
            <div className="comparison">
              <Bookmark size={15} />
              <span>
                vs. pinned outcome{" "}
                <b>
                  {result.lifeLoss - baseline.lifeLoss >= 0 ? "+" : ""}
                  {result.lifeLoss - baseline.lifeLoss} damage
                </b>
                <small>
                  {result.attackDeaths - baseline.attackDeaths >= 0 ? "+" : ""}
                  {result.attackDeaths - baseline.attackDeaths} attackers lost ·{" "}
                  {result.blockDeaths - baseline.blockDeaths >= 0 ? "+" : ""}
                  {result.blockDeaths - baseline.blockDeaths} blockers lost
                </small>
              </span>
              <button
                aria-label="Clear comparison"
                className="icon-btn"
                onClick={() => setBaseline(null)}
              >
                <X size={15} />
              </button>
            </div>
          )}
          <button
            className="pin-btn"
            onClick={() => {
              setBaseline(structuredClone(result));
              setToast("Outcome pinned. Change blocks or buffs to compare.");
            }}
          >
            <Bookmark size={15} />
            {baseline ? "Update pinned outcome" : "Pin outcome to compare"}
          </button>
          <div className="survivors">
            <div className="section-label">AFTER THE DUST SETTLES</div>
            {Object.values(result.units).length === 0 ? (
              <p className="subtle">Add creatures to start exploring.</p>
            ) : (
              Object.values(result.units).map((u) => (
                <div className="survivor" key={u.creature.id}>
                  <span
                    className={`status-icon ${u.dead ? "dead" : u.removed ? "removed" : "alive"}`}
                  >
                    {u.dead ? <X size={13} /> : <Check size={13} />}
                  </span>
                  <span>
                    {u.creature.name}
                    <small>
                      {u.dead
                        ? u.reason
                        : u.removed
                          ? u.reason
                          : `${stats(u.creature, board[u.side], u.minus).power}/${stats(u.creature, board[u.side], u.minus).toughness} · ${u.damage} damage marked`}
                    </small>
                  </span>
                  <b>{u.dead ? "Dies" : u.removed ? "Out" : "Lives"}</b>
                </div>
              ))
            )}
          </div>
          <details className="breakdown">
            <summary>
              <span>
                <BookOpen size={16} />
                Step-by-step breakdown
              </span>
              <ChevronDown size={16} />
            </summary>
            {result.steps.map((step, i) => (
              <div className="damage-step" key={i}>
                <h4>
                  <span>{i + 1}</span>
                  {step.name}
                </h4>
                {step.events.length ? (
                  step.events.map((e, j) => <p key={j}>{e.text}</p>)
                ) : (
                  <p>No damage dealt.</p>
                )}
                {step.deaths.length > 0 && (
                  <p className="danger-text">Dies: {step.deaths.join(", ")}</p>
                )}
              </div>
            ))}
          </details>
        </>
      )}
      <button
        className="allocation-toggle"
        onClick={() => setShowSplits((v) => !v)}
      >
        <SlidersHorizontal size={16} />
        Custom damage allocation{" "}
        {showSplits ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
      </button>
      {showSplits && (
        <div className="allocations">
          <p>
            Auto assigns lethal damage, then spills over. Split freely between
            creatures; trample must assign lethal to every blocker before
            hitting the player. Invalid splits must be fixed before results are
            shown.
          </p>
          {result.allocations
            .filter((a) => a.targets.length > 1)
            .map((a) => (
              <div key={a.key}>
                <b>{result.units[a.source].creature.name}</b>
                <small>
                  {a.label} · assign {a.amount} total
                </small>
                {a.targets.map((t) => (
                  <label key={t.id}>
                    <span>{t.name}</span>
                    <input
                      aria-label={`${a.label}: ${result.units[a.source].creature.name} damage to ${t.name}`}
                      type="number"
                      min={0}
                      max={a.amount}
                      inputMode="numeric"
                      value={board.splits[a.key]?.[t.id] ?? t.amount}
                      onChange={(e) =>
                        change((b) => ({
                          ...b,
                          splits: {
                            ...b.splits,
                            [a.key]: {
                              ...Object.fromEntries(
                                a.targets.map((t) => [t.id, t.amount]),
                              ),
                              ...b.splits[a.key],
                              [t.id]: Math.max(
                                0,
                                Math.min(
                                  a.amount,
                                  Math.trunc(Number(e.target.value) || 0),
                                ),
                              ),
                            },
                          },
                        }))
                      }
                    />
                  </label>
                ))}
                {a.custom && (
                  <button
                    className="text-btn"
                    onClick={() =>
                      change((b) => {
                        const splits = { ...b.splits };
                        delete splits[a.key];
                        return { ...b, splits };
                      })
                    }
                  >
                    Use automatic allocation
                  </button>
                )}
              </div>
            ))}
          {!result.allocations.some((a) => a.targets.length > 1) && (
            <small>
              Available when a creature has multiple damage targets.
            </small>
          )}
        </div>
      )}
      {result.warnings.map((w) => (
        <p className="result-note" key={w}>
          <Info size={16} />
          {w}
        </p>
      ))}
      <div className="rules-foot">
        <Shield size={14} />
        Rules checked · September 2026{" "}
        <button onClick={() => setDialog("help")}>
          Details
          <ArrowUpRight size={12} />
        </button>
      </div>
    </section>
  );
  return (
    <>
      <header className="app-header">
        <a
          className="brand"
          href={import.meta.env.BASE_URL}
          aria-label="Clash home"
        >
          <span>
            <Swords size={23} />
          </span>
          clash<span className="brand-caption">MTG COMBAT LAB</span>
        </a>
        <div className="header-actions">
          {offline && (
            <span className="offline">
              <WifiOff size={15} />
              Offline
            </span>
          )}
          <button
            className="header-link"
            aria-label="How it works"
            onClick={() => setDialog("help")}
          >
            <CircleHelp size={17} />
            <span>How it works</span>
          </button>
          <button
            className="install-btn"
            onClick={async () => {
              if (install) {
                await install.prompt();
                const choice = await install.userChoice;
                if (choice.outcome === "accepted") setInstall(null);
              } else setDialog("install");
            }}
          >
            <Download size={16} />
            <span>Install app</span>
          </button>
        </div>
      </header>
      <main>
        <section className="intro">
          <div>
            <div className="eyebrow">
              <span />A LITTLE CLARITY BEFORE COMBAT
            </div>
            <h1>
              Know before
              <br className="mobile-break" /> you <em>swing.</em>
            </h1>
            <p>
              Build the battlefield. Explore the possibilities.
              <br className="desktop-break" /> Make your next move with
              confidence.
            </p>
          </div>
          <div className="intro-art" aria-hidden="true">
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <div className="art-card art-shield">
              <Shield />
              <span>2 / 3</span>
            </div>
            <div className="art-card art-sword">
              <Swords />
              <span>4 / 4</span>
            </div>
            <Sparkles className="art-spark" />
          </div>
        </section>
        <div className="workspace-toolbar">
          <div className="mode-switch" aria-label="Calculation mode">
            <button
              aria-pressed={board.mode === "combat"}
              className={board.mode === "combat" ? "active" : ""}
              onClick={() =>
                change((b) => ({ ...b, mode: "combat", splits: {} }))
              }
            >
              <Swords size={17} />
              Combat
            </button>
            <button
              aria-pressed={board.mode === "fight"}
              className={board.mode === "fight" ? "active" : ""}
              onClick={() =>
                change((b) => ({ ...b, mode: "fight", splits: {} }))
              }
            >
              <Target size={17} />
              Fight
            </button>
          </div>
          <div className="toolbar-actions">
            <div className="history-buttons">
              <button
                className="icon-btn"
                aria-label="Undo"
                disabled={!past.length}
                onClick={undo}
              >
                <Undo2 size={18} />
              </button>
              <button
                className="icon-btn"
                aria-label="Redo"
                disabled={!future.length}
                onClick={redo}
              >
                <Redo2 size={18} />
              </button>
            </div>
            <button
              className="tool-btn"
              aria-label="Saved scenarios"
              onClick={() => setDialog("library")}
            >
              <Bookmark size={17} />
              <span>Scenarios</span>
            </button>
            <button
              className="tool-btn"
              aria-label="Share battlefield"
              onClick={share}
            >
              <Share2 size={17} />
              <span>Share</span>
            </button>
            <button
              className="icon-btn"
              aria-label="Reset battlefield"
              onClick={() => setDialog("reset")}
            >
              <RotateCcw size={17} />
            </button>
          </div>
        </div>
        <div className="mobile-tabs" role="group" aria-label="Workspace view">
          <button
            aria-pressed={mobile === "board"}
            onClick={() => setMobile("board")}
          >
            Battlefield{" "}
            <span>{board.attackers.length + board.blockers.length}</span>
          </button>
          <button
            aria-pressed={mobile === "results"}
            onClick={() => setMobile("results")}
          >
            Outcome <span>{clean ? result.lifeLoss : "!"}</span>
          </button>
        </div>
        <div className={`workspace view-${mobile}`}>
          <div className="battlefield">
            <div className="battlefield-heading">
              <div>
                <h2>Your battlefield</h2>
                <p>
                  {board.mode === "combat"
                    ? "Tap a blocker’s target to connect the combat."
                    : "Choose two creatures. They deal damage simultaneously."}
                </p>
              </div>
              <button
                className="effects-btn"
                onClick={() => setDialog("effects")}
              >
                <SlidersHorizontal size={16} />
                Effects
                {Boolean(
                  board.attack.power ||
                  board.attack.toughness ||
                  board.block.power ||
                  board.block.toughness ||
                  board.fog ||
                  board.noPrevention ||
                  board.noLifeGain ||
                  board.attack.multiplier !== 1 ||
                  board.block.multiplier !== 1,
                ) && <span className="effect-dot" />}
              </button>
            </div>
            {board.mode === "fight" && (
              <div className="fight-selectors">
                <label>
                  Your fighter
                  <select
                    aria-label="Your fighter"
                    value={board.fightPair[0]}
                    onChange={(e) =>
                      change((b) => ({
                        ...b,
                        fightPair: [e.target.value, b.fightPair[1]],
                        splits: {},
                      }))
                    }
                  >
                    <option value="">Choose a creature</option>
                    {board.attackers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                <Swords size={20} />
                <label>
                  Their fighter
                  <select
                    aria-label="Their fighter"
                    value={board.fightPair[1]}
                    onChange={(e) =>
                      change((b) => ({
                        ...b,
                        fightPair: [b.fightPair[0], e.target.value],
                        splits: {},
                      }))
                    }
                  >
                    <option value="">Choose a creature</option>
                    {board.blockers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}
            {(["attack", "block"] as Side[]).map((side) => (
              <section
                key={side}
                className={`team-section ${side}`}
                aria-label={
                  side === "attack"
                    ? "Attacking creatures"
                    : "Blocking creatures"
                }
              >
                <div className="team-heading">
                  <span className="team-icon">
                    {side === "attack" ? (
                      <Swords size={17} />
                    ) : (
                      <Shield size={17} />
                    )}
                  </span>
                  <h3>{side === "attack" ? "Attackers" : "Blockers"}</h3>
                  <span className="count">{creatures(side).length}</span>
                  <span className="team-description">
                    {side === "attack" ? "YOUR SIDE" : "OPPONENT’S SIDE"}
                  </span>
                </div>
                {(board[side].power !== 0 || board[side].toughness !== 0) && (
                  <div className="team-buff">
                    <Sparkles size={13} />
                    Team buff: {board[side].power >= 0 ? "+" : ""}
                    {board[side].power}/{board[side].toughness >= 0 ? "+" : ""}
                    {board[side].toughness}
                  </div>
                )}
                <div className="creature-list">
                  {creatures(side).map((c, index) =>
                    renderCreature({ c, side, index }),
                  )}
                </div>
                <button className="add-creature" onClick={() => add(side)}>
                  <Plus size={18} />
                  Add {side === "attack" ? "attacker" : "blocker"}
                  <span>Custom or search a card</span>
                </button>
                {side === "attack" && (
                  <div className="battle-divider">
                    <span />
                    <Swords size={16} />
                    <span />
                  </div>
                )}
              </section>
            ))}
            <div className="battle-tip">
              <span>
                <Sparkles size={19} />
              </span>
              <p>
                <b>Explore the “what if.”</b> Change a block, add a combat
                trick, or pin an outcome to compare your options.
              </p>
            </div>
          </div>
          <aside className="results-column">{renderResults()}</aside>
        </div>
        <footer>
          <span>
            <Swords size={14} />
            Made for better battle plans.
          </span>
          <span>
            Unofficial Magic: The Gathering fan tool.
            <button onClick={() => setDialog("help")}>
              Rules & credits <ArrowUpRight size={12} />
            </button>
          </span>
        </footer>
      </main>
      <div className="mobile-result-bar">
        <div>
          <small>{clean ? "DAMAGE THROUGH" : "SETUP NEEDS ATTENTION"}</small>
          <b>
            {clean ? result.lifeLoss : "—"}
            <span>
              {clean
                ? ` · ${result.attackDeaths} attackers lost`
                : result.errors[0]}
            </span>
          </b>
        </div>
        <button
          onClick={() => {
            setMobile(mobile === "board" ? "results" : "board");
            window.scrollTo({ top: 350, behavior: "smooth" });
          }}
        >
          {mobile === "board" ? "See outcome" : "Battlefield"}
          <ArrowRight size={17} />
        </button>
      </div>
      {editing && (
        <Editor
          key={editing.creature.id}
          creature={editing.creature}
          side={editing.side}
          onSave={editSave}
          onClose={() => setEditing(null)}
        />
      )}
      {dialog === "effects" && (
        <Modal
          title="Battlefield effects"
          subtitle="Auras, anthems, combat tricks, and table-wide rules."
          onClose={() => setDialog(null)}
          wide
        >
          <div className="modal-body">
            {(["attack", "block"] as Side[]).map((side) => (
              <section className="team-effect" key={side}>
                <h3>{side === "attack" ? "Your side" : "Opponent’s side"}</h3>
                <div className="field-grid">
                  {(
                    [
                      ["life", "Starting life", -999, 999],
                      ["poison", "Starting poison", 0, 999],
                      ["power", "Team power buff", -999, 999],
                      ["toughness", "Team toughness buff", -999, 999],
                      ["multiplier", "Team damage ×", 0, 10],
                    ] as const
                  ).map(([key, label, min, max]) => (
                    <NumberField
                      key={key}
                      label={label}
                      value={board[side][key]}
                      min={min}
                      max={max}
                      onChange={(n) =>
                        change((b) => ({
                          ...b,
                          [side]: { ...b[side], [key]: n },
                          splits: {},
                        }))
                      }
                    />
                  ))}
                </div>
              </section>
            ))}
            <div className="section-label">GLOBAL RULES</div>
            <div className="check-list">
              {(
                [
                  [
                    "fog",
                    "Prevent all combat damage",
                    "Fog effects. Does not prevent fight damage.",
                  ],
                  [
                    "noPrevention",
                    "Damage cannot be prevented",
                    "Overrides damage prevention, protection from damage, and Fog.",
                  ],
                  [
                    "noLifeGain",
                    "Players cannot gain life",
                    "Suppresses lifelink life gain.",
                  ],
                ] as const
              ).map(([key, label, hint]) => (
                <label key={key}>
                  <input
                    type="checkbox"
                    checked={board[key]}
                    onChange={(e) =>
                      change((b) => ({ ...b, [key]: e.target.checked }))
                    }
                  />
                  <span>
                    {label}
                    <small>{hint}</small>
                  </span>
                </label>
              ))}
            </div>
            <p className="hint-box">
              Apply targeted spells, equipment, auras, exalted, bushido,
              flanking, battle cry, and other conditional buffs using each
              creature’s modifiers. Enter the final effect after triggers
              resolve. Multipliers apply per creature and per team;
              order-dependent replacement effects need manual setup.
            </p>
          </div>
          <div className="modal-footer">
            <button className="btn primary" onClick={() => setDialog(null)}>
              Back to battlefield
              <ArrowRight size={17} />
            </button>
          </div>
        </Modal>
      )}
      {dialog === "library" && (
        <Modal
          title="Your scenarios"
          subtitle="Saved on this device. Share a link to take a setup elsewhere."
          onClose={() => setDialog(null)}
        >
          <div className="modal-body">
            <form
              className="save-form"
              onSubmit={(e) => {
                e.preventDefault();
                if (saveName.trim()) {
                  persistSaves(
                    [
                      { name: saveName.trim(), board: structuredClone(board) },
                      ...saves,
                    ].slice(0, 30),
                  );
                  setSaveName("");
                }
              }}
            >
              <label className="text-field">
                Save this battlefield
                <input
                  placeholder="e.g. Can I survive the crackback?"
                  value={saveName}
                  maxLength={80}
                  required
                  onChange={(e) => setSaveName(e.target.value)}
                />
              </label>
              <button className="btn primary" type="submit">
                <Bookmark size={17} />
                Save scenario
              </button>
            </form>
            <div className="scenario-list">
              {saves.length ? (
                saves.map((s, i) => (
                  <div key={i}>
                    <button
                      onClick={() => {
                        change(parseBoard(s.board));
                        setDialog(null);
                        setBaseline(null);
                        setToast(`Loaded ${s.name}`);
                      }}
                    >
                      <b>{s.name}</b>
                      <small>
                        {s.board.attackers.length} attackers ·{" "}
                        {s.board.blockers.length} blockers
                      </small>
                    </button>
                    <button
                      className="icon-btn"
                      aria-label={`Delete ${s.name}`}
                      onClick={() =>
                        persistSaves(saves.filter((_, j) => j !== i))
                      }
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))
              ) : (
                <p className="subtle">
                  Your favorite “what ifs” will live here.
                </p>
              )}
            </div>
            <button
              className="btn secondary full"
              onClick={() => {
                change(demoBoard());
                setDialog(null);
                setBaseline(null);
              }}
            >
              Load example battlefield
              <ArrowRight size={16} />
            </button>
          </div>
        </Modal>
      )}
      {dialog === "reset" && (
        <Modal
          title="A fresh battlefield?"
          subtitle="Clear all creatures, blocks, and effects. You can undo this."
          onClose={() => setDialog(null)}
        >
          <div className="modal-footer">
            <button className="btn secondary" onClick={() => setDialog(null)}>
              Keep exploring
            </button>
            <button
              className="btn primary"
              onClick={() => {
                change(emptyBoard());
                setBaseline(null);
                setDialog(null);
              }}
            >
              Clear battlefield
            </button>
          </div>
        </Modal>
      )}
      {dialog === "install" && (
        <Modal
          title="Clash, at your fingertips."
          subtitle="Install once. Calculate combat anywhere, even offline."
          onClose={() => setDialog(null)}
        >
          <div className="modal-body help-content">
            <div className="help-step">
              <span>1</span>
              <div>
                <h3>On iPhone or iPad</h3>
                <p>
                  Open this page in Safari. Tap the Share button, then Add to
                  Home Screen.
                </p>
              </div>
            </div>
            <div className="help-step">
              <span>2</span>
              <div>
                <h3>On Android or desktop</h3>
                <p>
                  Open your Chrome or Edge browser menu and choose Install app
                  or Add to Home screen.
                </p>
              </div>
            </div>
            <p>
              After one online visit, your battlefield, saved scenarios, and the
              calculator work offline. Card search still needs a connection.
            </p>
          </div>
          <div className="modal-footer">
            <button className="btn primary" onClick={() => setDialog(null)}>
              Got it
              <Check size={17} />
            </button>
          </div>
        </Modal>
      )}
      {dialog === "help" && (
        <Modal
          title="A clearer path through combat."
          subtitle="Clash · MTG Combat Lab"
          onClose={() => setDialog(null)}
          wide
        >
          <div className="modal-body help-content">
            <div className="help-step">
              <span>1</span>
              <div>
                <h3>Build both sides</h3>
                <p>
                  Add custom creatures or search Scryfall. Tap a creature to
                  edit its stats, counters, abilities, and damage effects.
                </p>
              </div>
            </div>
            <div className="help-step">
              <span>2</span>
              <div>
                <h3>Connect the blocks</h3>
                <p>
                  Tap attacker chips under each blocker. Multiple blockers can
                  share an attacker; increase a blocker’s capacity when a card
                  allows it to block several attackers. Illegal blocks are
                  flagged.
                </p>
              </div>
            </div>
            <div className="help-step">
              <span>3</span>
              <div>
                <h3>Explore, then decide</h3>
                <p>
                  Results update as you edit. Pin an outcome to compare. Open
                  the breakdown to see each damage step or override automatic
                  damage splits. Undo and redo make experiments easy.
                </p>
              </div>
            </div>
            <h3>Combat vs. fight</h3>
            <p>
              Combat handles first strike, double strike, trample, block
              restrictions, and combat poison triggers. Fight selects one
              creature per side and deals simultaneous noncombat damage: first
              strike, double strike, trample, and toxic do not apply.
              Deathtouch, infect, wither, and lifelink do.
            </p>
            <h3>Effects and the limits of a calculator</h3>
            <p>
              Clash models the selected keywords, numeric buffs, counters,
              marked damage, regeneration, shield counters, prevention, colored
              protection, damage multipliers, and toughness-based damage. It is
              a damage sandbox, not a full Magic game engine.
            </p>
            <p>
              Resolve attack/block triggers before entering stats. Arbitrary
              Oracle text, the stack, continuous-effect layers, banding,
              rampage, flanking, annihilator, fear/intimidate, landwalk, damage
              redirection, multiple defending players, planeswalkers, battles,
              commander damage, and effects between damage steps are not
              automated. Enter relevant final buffs manually. Protection covers
              blocking and damage here, not targeting or attachment legality.
              Hexproof and ward need target legality checked manually in fight
              mode.
            </p>
            <p>
              Automatic assignment is a deterministic lethal-first suggestion in
              displayed creature order, not a guaranteed optimal strategy.
              Manual splits are per source and damage step; shared lethal
              assignment is supported, while the automatic suggestion is not
              globally optimized. Overlapping prevention and replacement effects
              use the displayed source order and a fixed multiplier → prevention
              sequence. Situations where choosing a different replacement or
              prevention order matters need manual review.
            </p>
            <h3>Install & use offline</h3>
            <p>
              On iPhone/iPad: open in Safari, tap Share, then Add to Home
              Screen. On Android or desktop Chrome/Edge: use Install app or the
              browser’s install menu. After one online visit, the calculator
              works offline. Card search and uncached card images need a
              connection. Saved scenarios stay in this browser.
            </p>
            <h3>Rules & credits</h3>
            <p>
              Based on the{" "}
              <a
                href="https://magic.wizards.com/en/rules"
                target="_blank"
                rel="noreferrer"
              >
                Magic Comprehensive Rules
              </a>{" "}
              effective September 25, 2026 (especially 510, 701 fight, 702, and
              704). Current damage assignment has no blocker order; trample
              still requires lethal assignment. Card data and artwork via{" "}
              <a href="https://scryfall.com" target="_blank" rel="noreferrer">
                Scryfall
              </a>
              . Imported art remains © its credited artist and Wizards of the
              Coast.
            </p>
            <p>
              Magic: The Gathering is a trademark of Wizards of the Coast. This
              fan project is unofficial and is not endorsed by Wizards. No card
              data is sent to a server by Clash; Scryfall receives search
              queries. Sharing encodes your battlefield in the URL.
            </p>
          </div>
          <div className="modal-footer">
            <button className="btn primary" onClick={() => setDialog(null)}>
              Let’s explore
              <Swords size={17} />
            </button>
          </div>
        </Modal>
      )}
      {toast && (
        <div className="toast" role="status">
          <Info size={17} />
          {toast}
          <button
            aria-label="Dismiss notification"
            onClick={() => setToast("")}
          >
            <X size={15} />
          </button>
        </div>
      )}
      {update && (
        <div className="update-banner">
          A new version of Clash is ready.
          <button onClick={update}>Update now</button>
          <button onClick={() => setUpdate(null)} aria-label="Dismiss update">
            <X size={15} />
          </button>
        </div>
      )}
    </>
  );
}
