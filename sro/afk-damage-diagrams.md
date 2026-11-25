# Combat around the locked formula

One hit. Rates are decimals. Skills do one job each, and that job is already applied before the hit is resolved.

\[
\mathrm{Raw}=\frac{A\,(1+C)}{1+D}-E
\]

\[
\mathrm{Calc}=\mathrm{Raw}\times(1+G)\times H
\]

Raw at or below 0 deals 1. A positive Raw deals \(\max(1,\lfloor\mathrm{Calc}\rfloor)\).

## Use cases

The player prepares the fight with four modifier skills, then strikes. The strike includes resolving the hit. Gear, jewelry, STR, INT, and critical are already on the characters. They are not separate use cases.

```mermaid
flowchart LR
  player((Player))

  subgraph combat [Combat]
    attack[Increase attack]
    damage[Increase damage]
    absorb[Reduce absorption]
    defense[Reduce defense]
    strike[Strike]
    resolve[Resolve the hit]
  end

  player --> attack
  player --> damage
  player --> absorb
  player --> defense
  player --> strike
  strike -->|include| resolve
```

| Use case | What the player changes |
| --- | --- |
| Increase attack | Adds a rate to \(C\) on the attacker |
| Increase damage | Adds a rate to \(G\) on the attacker |
| Reduce absorption | Subtracts from the target's \(D\), which stays at or above 0 |
| Reduce defense | Subtracts points from the target's \(E\), which stays at or above 0 |
| Strike | Supplies \(H\) and asks the combat system to resolve the hit |

## Classes

\(A\) comes from the weapon and STR. \(H\) comes from the damage skill and INT. \(C\) and \(G\) are sums on the attacker. \(D\) and \(E\) are the target's absorption and defense after skills. Critical is one rate inside \(G\).

```mermaid
classDiagram
  class Combatant {
    +str
    +int
    +crit
    +baseDefense
    +attackA()
    +rateC()
    +rateG()
    +absorptionD()
    +defenseE()
  }

  class Weapon {
    +base
    +flat
    +reinforce
  }

  class Jewelry {
    +absorption
  }

  class Skill {
    <<abstract>>
  }

  class AttackSkill {
    +rate
  }

  class DamageSkill {
    +rate
  }

  class AbsorbSkill {
    +rate
  }

  class DefenseSkill {
    +points
  }

  class StrikeSkill {
    +hits
  }

  class StrikeHit {
    +hSkill
    +intFactor
    +coefficient(int)
  }

  class HitResolver {
    +resolve(attacker, target, strike) int
  }

  Combatant "1" --> "1" Weapon : weapon
  Combatant "1" --> "*" Jewelry : jewelry
  Combatant "1" --> "*" Skill : active skills
  Skill <|-- AttackSkill
  Skill <|-- DamageSkill
  Skill <|-- AbsorbSkill
  Skill <|-- DefenseSkill
  Skill <|-- StrikeSkill
  StrikeSkill "1" --> "1..*" StrikeHit : each hit has its own H
  HitResolver ..> Combatant : reads A, C, G, D, E
  HitResolver ..> StrikeHit : reads H
```

`attackA` is \(\mathrm{Weapon}+\mathrm{Flat}+\mathrm{STR}\times\mathrm{Reinforce}/100\).

`coefficient` is \(H_{\mathrm{skill}}+\mathrm{INT}\times\mathrm{IntFactor}/100\).

`rateC` sums the weapon passive, Mastery when it is not already inside \(A\), and every active attack skill.

`rateG` sums gear, the attacker's `crit` stat, and every active damage skill.

`absorptionD` sums jewelry, subtracts absorb skills, and stops at 0.

`defenseE` starts from armor, subtracts defense skills, and stops at 0.

`resolve` runs the formula once per `StrikeHit` and returns the sum.

## Sequence

The numbers below are the worked hit. Attack +20% on top of 30% already on the character makes \(C = 0.50\). Jewelry 1.20 minus an absorb skill of 0.20 makes \(D = 1\). Armor 90 minus a defense skill of 50 makes \(E = 40\). Gear +5% and critical 20% make \(G = 0.25\). The strike coefficient is \(H = 2\). \(A = 200\).

```mermaid
sequenceDiagram
  actor Player
  participant Attacker
  participant Target
  participant Resolver as HitResolver

  Player->>Attacker: Increase attack +0.20
  Note over Attacker: C = 0.30 + 0.20 = 0.50

  Player->>Target: Reduce absorption 0.20
  Note over Target: D = max(0, 1.20 - 0.20) = 1

  Player->>Target: Reduce defense 50
  Note over Target: E = max(0, 90 - 50) = 40

  Note over Attacker: crit = 0.20, a stat on the attacker
  Note over Attacker: G = 0.05 gear + crit 0.20 = 0.25

  Player->>Resolver: Strike, H = 2
  Resolver->>Attacker: attackA(), rateC(), rateG()
  Attacker-->>Resolver: A = 200, C = 0.50, G = 0.25
  Resolver->>Target: absorptionD(), defenseE()
  Target-->>Resolver: D = 1, E = 40

  Note over Resolver: Raw = 200 * 1.50 / 2 - 40 = 110
  alt Raw > 0
    Note over Resolver: Calc = 110 * 1.25 * 2 = 275
    Resolver-->>Player: DMG = floor(275) = 275
  else Raw <= 0
    Resolver-->>Player: DMG = 1
  end
```

A strike with several hits repeats the resolve step once per hit. Each hit brings its own \(H\), subtracts \(E\) again, and is floored on its own. The skill damage is the sum of those hits. \(C\), \(D\), \(G\), and \(E\) stay as they were when the strike started.
