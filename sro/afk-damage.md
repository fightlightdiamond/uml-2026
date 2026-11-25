# Damage

One hit produces one damage number. Every rate in the formula is a decimal. 99% is entered as 0.99, 103.9% as 1.039, and 208% as 2.08. A percent copied from a sheet is divided by 100 before it is used. A number that is already a decimal is not divided again.

STR and INT do different jobs. STR raises attack. INT raises the skill coefficient. Critical is a damage rate, added with the other damage rates, and the hit is multiplied by that sum once.

## The hit

The attack is reduced by absorption, then by defense. What remains is amplified.

\[
\mathrm{Raw}=\frac{A\,(1+C)}{1+D}-E
\]

\[
\mathrm{Calc}=\mathrm{Raw}\times(1+G)\times H
\]

\[
\mathrm{DMG}=
\begin{cases}
1 & \mathrm{Raw}\le 0\\
\max(1,\lfloor\mathrm{Calc}\rfloor) & \mathrm{Raw}>0
\end{cases}
\]

The steps run in that order. The damage of the hit is DMG.

1. Take the attack \(A\) and multiply by the attack-power rate \((1+C)\). This is the hit before the target. The damaging skill does not add attack points. It supplies the coefficient \(H\).
2. Divide by \(1+D\). Jewelry absorption lets that fraction through. At \(D = 1\), half the hit remains. At \(D = 0\), the whole hit remains.
3. Subtract defense \(E\). The result is Raw, the amount that got past the target.
4. If Raw is 0 or negative, the hit did not beat defense. Damage is 1. \((1+G)\) and \(H\) do not raise it.
5. If Raw is positive, multiply by the damage rate \((1+G)\) and the skill coefficient \(H\). Drop the fraction. If that product is below 1, the hit still deals 1. That integer is the damage of the hit.

Absorption and defense act on the attack. Damage rates act on what got through. A +25% damage buff does not enlarge the hit before jewelry and armor. It enlarges the remainder.

## Skills

A skill does one of five jobs. The damaging skill supplies \(H\). The other four change a number that is already in the formula, and that change is in place before the hit is resolved.

| Skill | Change |
| --- | --- |
| Increase attack | Add a rate to \(C\) |
| Increase damage | Add a rate to \(G\) |
| Reduce absorption | Subtract from \(D\) |
| Reduce defense | Subtract from \(E\) |
| Damage coefficient | Supply \(H\) for the hit |

Several skills of the same job add together. Two attack skills both go into \(C\). Two defense skills both subtract from \(E\).

\(D\) and \(E\) stay at 0 or above after those skills. A defense skill that removes more defense than the target has leaves \(E = 0\). An absorption skill that removes more absorption than the jewelry has leaves \(D = 0\), so the whole attack passes that step. An absorption skill subtracts a decimal: 30% absorption removed is \(0.30\). A defense skill subtracts points.

## Attack, from STR

\(A\) is the attack of the hit. The weapon lists a base attack, a flat bonus, and a reinforce value in percent points. An 80% reinforce line is 80 in the formula below, then divided by 100.

\[
A=\mathrm{Weapon}+\mathrm{Flat}+\mathrm{STR}\times\frac{\mathrm{Reinforce}}{100}
\]

A weapon of 100, a flat bonus of 10, STR 80, and reinforce 50:

\[
A=100+10+80\times 0.50=150
\]

INT does not appear in \(A\). A skill does not add attack points on top of \(A\).

Mastery is an attack-power rate, so it belongs in \(C\). If the attack figure already includes Mastery, leave Mastery out of \(C\). The same source is counted once.

## Skill coefficient, from INT

\(H\) is the skill coefficient. The skill lists a base coefficient and an INT factor in percent points. A listed coefficient of 208% is \(H_{\mathrm{skill}} = 2.08\). An INT factor of 1 means each point of INT adds 0.01 to the coefficient.

\[
H=H_{\mathrm{skill}}+\mathrm{INT}\times\frac{\mathrm{IntFactor}}{100}
\]

A skill with \(H_{\mathrm{skill}} = 1.50\), INT 100, and IntFactor 1:

\[
H=1.50+100\times 0.01=2.50
\]

A skill with IntFactor 0 keeps \(H = H_{\mathrm{skill}}\). STR does not appear in \(H\).

\(H\) is applied only when Raw is positive. It multiplies the remainder after defense, together with \((1+G)\).

## Rates that add, then apply once

\(C\), \(D\), and \(G\) are each a sum of sources of one kind. Add the sources first. Put the sum in one place in the formula.

\(C\) is the sum of attack-power rates: the weapon passive, Mastery when \(A\) does not already include it, and skills that increase attack. Two lines of 40% and 59% are \(C = 0.99\), and the multiplier is \(1.99\). They are not applied as \(1.40 \times 1.59\).

\(G\) is the sum of damage rates. Gear, skills that increase damage, and the attacker's critical stat all go here. Gear +5% and a skill of +25% damage are \(G = 0.30\), so the multiplier is \(1.30\).

Critical is a stat on the attacker, written as a decimal. A critical stat of 20% adds 0.20 to \(G\). It is not a second multiplier after the damage has been floored. Gear +5% and critical 0.20 are:

\[
G=0.05+0.20=0.25,\qquad 1+G=1.25
\]

## Absorption

\(D\) is the sum of absorption on the jewelry, as a decimal. The sum is not capped at 1. Four pieces of 23.5%, 23.7%, 30.5%, and 26.2% are 103.9%, so \(D = 1.039\). The denominator is \(1+D = 2.039\).

The fraction that gets through is \(1/(1+D)\).

| D | Fraction that gets through |
| --- | --- |
| 0 | 100% |
| 0.50 | 66.67% |
| 1.00 | 50% |
| 1.039 | 49.04% |
| 2.00 | 33.33% |

Each added point of absorption removes a smaller share than the point before it. At \(D = 1.039\), about 49.04% of the attack remains, and defense is subtracted from that remainder. A skill that reduces absorption subtracts from this sum first. The \(D\) used in the hit is at least 0.

## Defense

\(E\) is defense after armor, armor reinforce, and defense buffs. A skill that reduces defense subtracts its points from this total. The \(E\) used in the hit is at least 0.

Raw at or below 0 means the amount left after absorption did not exceed \(E\). The hit deals 1. A positive Raw that the later multipliers shrink below 1 also deals 1. A skill coefficient below 1 can do that.

## Several hits

A skill with several hits runs the formula once per hit. Each hit brings its own \(H\). Each hit subtracts \(E\), and each hit is floored on its own. Skill damage is the sum of those hits.

## A worked hit

\(A = 200\), \(C = 0.50\), \(D = 1\), \(E = 40\), \(G = 0.25\), \(H = 2\).

\[
\frac{200\times 1.50}{1+1}-40=\frac{300}{2}-40=110
\]

\[
110\times 1.25\times 2=275
\]

Raw is positive, so the damage of the hit is 275.

## A hit that does not beat defense

\(A = 20\), \(C = 0\), \(D = 1\), \(E = 3000\).

\[
\frac{20\times 1}{2}-3000=10-3000=-2990
\]

Raw is negative, so the damage of the hit is 1. The damage rates and the skill coefficient do not change that 1.
