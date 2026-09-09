# Målt designsystem på coopbank.dk (Webflow) — udtrukket fra produktions-CSS

Kilde: `https://cdn.prod.website-files.com/694a6f40021364d1efffc3a5/css/project-8d8b939-af22a855sa1fc9-staging.shared.5c3b3cf97.min.css` (Webflow site-id 694a6f40021364d1efffc3a5, publiceret 2026-09-08). Alle værdier er læst maskinelt fra `:root`.

## Farve-primitives i Webflow-variabelsystemet (39 stk.)

| Webflow-variabel | Værdi | Findes i designguiden? |
|---|---|---|
| `1000-bordeaux` | `#55252f` | JA — Coop Bordeaux (primær) |
| `black` | `black` | n/a (sort/hvid/alpha) |
| `black-15` | `#00000026` | n/a (sort/hvid/alpha) |
| `black-50` | `#00000080` | n/a (sort/hvid/alpha) |
| `blue-400` | `#779ffd` | JA — Komplementær blå |
| `blue-500` | `#3864f9` | **NEJ — uden for paletten** |
| `blue-600` | `#2243ee` | **NEJ — uden for paletten** |
| `bordeaux` | `#5c2833` | **NEJ — uden for paletten** |
| `color` | `#dbadb7` | **NEJ — uden for paletten** |
| `green-300` | `#8ee7ad` | **NEJ — uden for paletten** |
| `green-400` | `#64d78c` | **NEJ — uden for paletten** |
| `green-500` | `#2eb95f` | **NEJ — uden for paletten** |
| `green-600` | `#21984b` | **NEJ — uden for paletten** |
| `neutral-100` | `#e5e5e8` | **NEJ — uden for paletten** |
| `neutral-1000` | `#0c0c0d` | **NEJ — uden for paletten** |
| `neutral-200` | `#ceced3` | **NEJ — uden for paletten** |
| `neutral-400` | `#83858d` | **NEJ — uden for paletten** |
| `neutral-50` | `#f5f5f6` | **NEJ — uden for paletten** |
| `neutral-700` | `#4c4d52` | **NEJ — uden for paletten** |
| `neutral-800` | `#434347` | **NEJ — uden for paletten** |
| `purple-200` | `#dddbf9` | **NEJ — uden for paletten** |
| `purple-300` | `#c4bef4` | JA — Komplementær lilla |
| `purple-300-80` | `#c4bef4cc` | n/a (sort/hvid/alpha) |
| `purple-400` | `#a699ec` | **NEJ — uden for paletten** |
| `red-100` | `#ffe1e1` | **NEJ — uden for paletten** |
| `red-200` | `#ffc7c7` | **NEJ — uden for paletten** |
| `red-50` | `#fff1f1` | **NEJ — uden for paletten** |
| `red-700` | `#c31414` | JA — Coop Red (primær) |
| `red-800` | `#a01414` | **NEJ — uden for paletten** |
| `satin-100` | `#edebe3` | JA — Coop Satin Linen (sekundær) |
| `satin-200` | `#ddd9cb` | **NEJ — uden for paletten** |
| `satin-50` | `#f6f5f1` | JA — Coop Pampas (sekundær) |
| `transparent-red` | `#be1011d9` | n/a (sort/hvid/alpha) |
| `white` | `white` | n/a (sort/hvid/alpha) |
| `white-1` | `#ffffff03` | n/a (sort/hvid/alpha) |
| `white-10` | `#ffffff1a` | n/a (sort/hvid/alpha) |
| `white-25` | `#ffffff40` | n/a (sort/hvid/alpha) |
| `white-70` | `#ffffffb3` | n/a (sort/hvid/alpha) |
| `yellow-50` | `#fdefda` | **NEJ — uden for paletten** |

## Border radius-tokens

| Token | Værdi |
|---|---|
| `circle` | 100% |
| `l-20px` | 20px |
| `m-16px` | 16px |
| `s-12px` | 12px |
| `xl-24px` | 24px |
| `xs-8px` | 8px |
| `xxl-32px` | 32px |
| `xxs-4px` | 4px |

Designguiden foreskriver **6 px** for billedbokse og infokasser. Der findes ingen 6 px-token.

### Faktisk brugte border-radius-værdier i CSS (antal deklarationer)

| Værdi | Antal |
|---|---|
| `var(--_extras---border-radius--m-16px)` | 52 |
| `var(--_extras---border-radius--xl-24px)` | 40 |
| `16px` | 27 |
| `0` | 18 |
| `var(--_extras---border-radius--s-12px)` | 16 |
| `24px` | 16 |
| `var(--_extras---border-radius--xs-8px)` | 13 |
| `var(--_extras---border-radius--circle)` | 11 |
| `12px` | 11 |
| `32px` | 10 |
| `var(--_extras---border-radius--xxl-32px)` | 8 |
| `8px` | 7 |
| `100px` | 7 |
| `360px` | 4 |
| `100%` | 2 |
| `50%` | 2 |
| `2px` | 2 |
| `var(--_extras---border-radius--xxs-4px)` | 2 |
| `unset` | 1 |
| `3px!important` | 1 |
| `3px` | 1 |
| `.75rem` | 1 |
| `var(--_typography---body-text--m-16px)` | 1 |
| `.5rem` | 1 |
| `14px` | 1 |
| `10px` | 1 |
| `48px` | 1 |
| `15px` | 1 |
| `0px 0px var(--_extras---border-radius--m-16px)var(--_extras---border-radius--m-16px)` | 1 |

## Typografi-tokens

| Token | Værdi |
|---|---|
| `body-text--l-18px` | 1.125rem |
| `body-text--m-16px` | 1rem |
| `body-text--s-14px` | .875rem |
| `body-text--xs-12px` | .75rem |
| `button-text--l-16px` | 1rem |
| `button-text--m-14px` | .875rem |
| `font-family--font-family` | Porteron,Arial,sans-serif |
| `headings--display-100px` | 6.25rem |
| `headings--display-60px` | 3.75rem |
| `headings--display-72px` | 4.5rem |
| `headings--display-72px-fixed` | 4.5rem |
| `headings--display-92px` | 5.75rem |
| `headings--h1-48px` | 3rem |
| `headings--h1-48px-fixed` | 3rem |
| `headings--h2-36px` | 2.25rem |
| `headings--h3-30px` | 1.875rem |
| `headings--h4-24px` | 1.5rem |
| `headings--h5-20px` | 1.25rem |
| `headings--h6-14px\<deleted\|variable-8a3455c7-8234-b32b-fcda-82e729338090\>` | .875rem |
| `line-height--0-7` | .7826 |
| `line-height--100` | 1 |
| `line-height--105` | 1.05 |
| `line-height--106` | 1.06 |
| `line-height--108` | 1.08 |
| `line-height--110` | 1.1 |
| `line-height--120` | 1.2 |
| `line-height--130` | 1.3 |
| `line-height--140` | 1.4 |
| `nav-link--m-16px` | 1rem |
| `weight--bold-700` | 700 |
| `weight--light-300` | 300 |
| `weight--medium-500` | 500 |
| `weight--normal-400` | 400 |
| `weight--semibold-600` | 600 |

## Indlæste Porteron-snit (@font-face i produktions-CSS)

- **Porteron-Bold** — `font-weight:700`
- **Porteron-Medium** — `font-weight:500`
- **Porteron-Semi** — `font-weight:600`
- **Porteron-Regular** — `font-weight:400`

## Semantiske text/background-tokens

| Token | Peger på |
|---|---|
| `--background--blue` | `var(--color-primitives--blue-400)` |
| `--background--bordeaux` | `var(--color-primitives--1000-bordeaux)` |
| `--background--bordeaux-light` | `var(--color-primitives--bordeaux)` |
| `--background--gray` | `var(--color-primitives--neutral-100)` |
| `--background--gray-light` | `var(--color-primitives--neutral-50)` |
| `--background--purple` | `var(--color-primitives--purple-400)` |
| `--background--red` | `var(--color-primitives--red-700)` |
| `--background--red-light` | `var(--color-primitives--red-100)` |
| `--background--satin` | `var(--color-primitives--satin-100)` |
| `--background--satin-dark` | `var(--color-primitives--satin-200)` |
| `--background--satin-light` | `var(--color-primitives--satin-50)` |
| `--background--white` | `var(--color-primitives--white)` |
| `--background--white-10` | `var(--color-primitives--white-10)` |
| `--text--black` | `var(--color-primitives--black)` |
| `--text--bordeaux` | `var(--color-primitives--1000-bordeaux)` |
| `--text--gray` | `var(--color-primitives--neutral-700)` |
| `--text--red-dark` | `var(--color-primitives--red-800)` |
| `--text--red-medium` | `var(--color-primitives--red-700)` |
| `--text--white` | `var(--color-primitives--white)` |
| `--text--white-70` | `var(--color-primitives--white-70)` |

## Hårdkodede hex-farver brugt i regler uden for `:root` (top 40)

| Hex | Antal | Kommentar |
|---|---|---|
| `#fff` | 72 | sort/hvid/alpha |
| `#0000` | 67 | sort/hvid/alpha |
| `#000` | 39 | sort/hvid/alpha |
| `#0c0c0d` | 33 | **uden for paletten** |
| `#4c4d52` | 26 | **uden for paletten** |
| `#f5f5f6` | 18 | **uden for paletten** |
| `#21984b` | 18 | **uden for paletten** |
| `#ceced3` | 9 | **uden for paletten** |
| `#2243ee` | 8 | **uden for paletten** |
| `#333` | 6 | **uden for paletten** |
| `#ddd` | 6 | **uden for paletten** |
| `#ccc` | 6 | **uden for paletten** |
| `#222` | 6 | **uden for paletten** |
| `#fafafa` | 5 | **uden for paletten** |
| `#75869600` | 5 | sort/hvid/alpha |
| `#fff0` | 5 | sort/hvid/alpha |
| `#be1011` | 5 | **uden for paletten** |
| `#0000001a` | 4 | sort/hvid/alpha |
| `#64d78c` | 4 | **uden for paletten** |
| `#ffffff40` | 4 | sort/hvid/alpha |
| `#e5e5e8` | 4 | **uden for paletten** |
| `#00000026` | 4 | sort/hvid/alpha |
| `#c8c8c8` | 3 | **uden for paletten** |
| `#f1fcf4` | 3 | **uden for paletten** |
| `#c31414` | 3 | i paletten |
| `#3898ec` | 2 | **uden for paletten** |
| `#e2e2e2` | 2 | **uden for paletten** |
| `#999` | 2 | **uden for paletten** |
| `#5d6c7b` | 2 | **uden for paletten** |
| `#0082f3` | 2 | **uden for paletten** |
| `#0006` | 2 | sort/hvid/alpha |
| `#2d40ea` | 2 | **uden for paletten** |
| `#83858d` | 2 | **uden for paletten** |
| `#fff1f1` | 2 | **uden for paletten** |
| `#ff9800` | 2 | **uden for paletten** |
| `#ff98001a` | 2 | sort/hvid/alpha |
| `#7550d7` | 2 | **uden for paletten** |
| `#f5f4fe` | 2 | **uden for paletten** |
| `#eff4ff` | 2 | **uden for paletten** |
| `#a0a1a8` | 2 | **uden for paletten** |
