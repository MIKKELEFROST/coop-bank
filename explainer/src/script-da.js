/**
 * script-da.js — the single source of truth for beat timings and Danish
 * voiceover copy. Imported by the browser timeline AND by the Node scripts
 * that emit the manuscript, timing JSON and SRT, so the three can never drift.
 *
 * Times are seconds on the master timeline. 75.0 s total at 30 fps = 2250 frames.
 */

export const FPS = 30;

export const BEATS = [
  {
    id: 'beat-01', n: 1, start: 0, end: 4.5,
    title: 'Åbning — Marketing og AI-agenter',
    vo: 'Marketing er ved at ændre sig. Ikke kun gennem nye værktøjer, men gennem AI-agenter.',
    onScreen: ['Marketing og AI-agenter'],
  },
  {
    id: 'beat-02', n: 2, start: 4.5, end: 10.5,
    title: 'Hvad er en AI-agent',
    vo: 'En AI-agent kan selv planlægge, søge information, træffe beslutninger og udføre handlinger for at nå et mål.',
    onScreen: ['En AI-agent kan selv …', 'Planlæg', 'Søg', 'Beslut', 'Udfør'],
  },
  {
    id: 'beat-03', n: 3, start: 10.5, end: 15.5,
    title: 'Organisatorisk konsekvens',
    vo: 'Det ændrer vores arbejdsgange – og på sigt også vores roller og hvor mange vi skal være.',
    onScreen: ['Værktøjer', 'Arbejdsgange', 'Roller', 'Bemanding'],
  },
  {
    id: 'beat-04', n: 4, start: 15.5, end: 21.5,
    title: 'Konkurrencefordel for en mindre afdeling',
    vo: 'For en mindre marketingafdeling som vores betyder det, at Coop Bank kan stå stærkere over for langt større spillere.',
    onScreen: ['Mindre afdeling.', 'Større slagkraft.'],
  },
  {
    id: 'beat-05', n: 5, start: 21.5, end: 26, title: 'Bedre indsigter',
    vo: 'Agenter kan analysere store datamængder, finde mønstre og give os bedre indsigter.',
    onScreen: ['Bedre indsigter', 'Store datamængder bliver til tydelige mønstre.'],
  },
  {
    id: 'beat-06', n: 6, start: 26, end: 30.5,
    title: 'Løbende optimering',
    vo: 'De kan løbende analysere, teste og anbefale forbedringer – hurtigere og mere ensartet.',
    onScreen: ['Analysér · Test · Forbedr'],
  },
  {
    id: 'beat-07', n: 7, start: 30.5, end: 35.5,
    title: 'Digital synlighed',
    vo: 'Når AI-agenter søger nettet efter svar, bliver vores digitale synlighed endnu vigtigere.',
    onScreen: ['AI søger.', 'Bliver vi fundet?'],
  },
  {
    id: 'beat-08', n: 8, start: 35.5, end: 41.5,
    title: 'Ny rolle: lede frem for at udføre',
    vo: 'Vores rolle flytter sig fra at udføre alt selv til i højere grad at lede, kontrollere og prioritere AI-agenter.',
    onScreen: ['Fra selv at udføre – til at lede arbejdet', 'Lede · Kontrollere · Prioritere'],
  },
  {
    id: 'beat-09', n: 9, start: 41.5, end: 46,
    title: 'Tillid og kontrol (mørk sekvens)',
    vo: 'Jo mere vi overlader til AI, desto vigtigere bliver spørgsmålet om tillid og kontrol.',
    onScreen: ['Høj tillid kræver høj kontrol'],
  },
  {
    id: 'beat-10', n: 10, start: 46, end: 50,
    title: 'Overgang til nutid',
    vo: 'Og det er ikke kun fremtid. Vi arbejder allerede sådan i dag.',
    onScreen: ['Sådan bruger vi AI-agenter i dag'],
  },
  {
    id: 'beat-11', n: 11, start: 50, end: 62.5,
    title: 'Fire agenter i drift',
    vo: 'Mikkel udvikler i Webflow med Claude og MCP. Nicole bruger en agent til idéer og content. TonePilot sikrer vores tone of voice. CMO Copilot sparrer om strategi, analyse og beslutninger.',
    onScreen: ['Fire agenter. Ét samlet marketingsystem.', 'Webudvikling', 'Idéudvikling & content', 'Tone of Voice', 'Strategi & analyse'],
  },
  {
    id: 'beat-12', n: 12, start: 62.5, end: 75,
    title: 'Konklusion og ledelsesspørgsmål',
    vo: 'Fælles for dem er, at AI ikke bare genererer. AI arbejder sammen med os og udfører opgaver. Er fremtidens marketingchef den, der beslutter, hvilke agenter der skal tændes og slukkes?',
    onScreen: ['AI genererer ikke bare.', 'AI arbejder sammen med os.', 'Er fremtidens marketingchef den, der tænder og slukker agenter?'],
  },
];

/**
 * Derived from the beats rather than written down beside them. As a literal
 * these could disagree with the table above, and the failure would be silent:
 * seekToTime() clamps to DURATION, so a film whose beats ran past it would
 * simply stop early with nothing reported.
 */
export const DURATION = BEATS[BEATS.length - 1].end; // 75
export const FRAME_COUNT = Math.round(DURATION * FPS); // 2250
if (Math.abs(DURATION * FPS - FRAME_COUNT) > 1e-9) {
  throw new Error(`beat timings must land on whole frames: ${DURATION}s x ${FPS}fps = ${DURATION * FPS}`);
}

/**
 * Sub-cues inside a beat, used for the SRT and for syncing card pulses to the
 * spoken word. `t` is absolute seconds on the master timeline.
 */
export const CUES = [
  { t: 0.25, text: 'Marketing er ved at ændre sig.' },
  { t: 2.25, text: 'Ikke kun gennem nye værktøjer, men gennem AI-agenter.' },
  { t: 4.7, text: 'En AI-agent kan selv planlægge, søge information,' },
  { t: 7.6, text: 'træffe beslutninger og udføre handlinger for at nå et mål.' },
  { t: 10.7, text: 'Det ændrer vores arbejdsgange – og på sigt også vores roller' },
  { t: 13.4, text: 'og hvor mange vi skal være.' },
  { t: 15.7, text: 'For en mindre marketingafdeling som vores betyder det,' },
  { t: 18.5, text: 'at Coop Bank kan stå stærkere over for langt større spillere.' },
  { t: 21.7, text: 'Agenter kan analysere store datamængder, finde mønstre' },
  { t: 24.2, text: 'og give os bedre indsigter.' },
  { t: 26.2, text: 'De kan løbende analysere, teste og anbefale forbedringer' },
  { t: 28.9, text: '– hurtigere og mere ensartet.' },
  { t: 30.7, text: 'Når AI-agenter søger nettet efter svar,' },
  { t: 33.0, text: 'bliver vores digitale synlighed endnu vigtigere.' },
  { t: 35.7, text: 'Vores rolle flytter sig fra at udføre alt selv' },
  { t: 38.4, text: 'til i højere grad at lede, kontrollere og prioritere AI-agenter.' },
  { t: 41.7, text: 'Jo mere vi overlader til AI,' },
  { t: 43.3, text: 'desto vigtigere bliver spørgsmålet om tillid og kontrol.' },
  { t: 46.2, text: 'Og det er ikke kun fremtid.' },
  { t: 47.9, text: 'Vi arbejder allerede sådan i dag.' },
  { t: 50.3, text: 'Mikkel udvikler i Webflow med Claude og MCP.' },
  { t: 53.4, text: 'Nicole bruger en agent til idéer og content.' },
  { t: 56.4, text: 'TonePilot sikrer vores tone of voice.' },
  { t: 59.0, text: 'CMO Copilot sparrer om strategi, analyse og beslutninger.' },
  { t: 62.8, text: 'Fælles for dem er, at AI ikke bare genererer.' },
  { t: 65.6, text: 'AI arbejder sammen med os og udfører opgaver.' },
  { t: 68.6, text: 'Er fremtidens marketingchef den, der beslutter,' },
  { t: 70.8, text: 'hvilke agenter der skal tændes og slukkes?' },
];

/** Direction notes for the person or TTS engine recording the voiceover. */
export const VO_DIRECTION = {
  language: 'Dansk (rigsdansk, neutral)',
  tone: 'Rolig, troværdig, intelligent og fremadskuende. Ledelsesniveau — ikke reklamestemme.',
  pace: 'Ca. 160–165 ord i minuttet som gennemsnit.',
  notes: [
    'Læg et lille ophold efter hvert punktum – billedet skifter dér.',
    'Beat 3, 4, 8 og 9 er tætpakkede: lever dem let komprimeret (ca. 175–190 ord/min) eller lad linjen glide få tiendedele ind over næste klip.',
    'Beat 11 og 12 har luft: tal roligt og lad navnene stå tydeligt.',
    'Det afsluttende spørgsmål siges roligt og lukkes ikke af – det skal stå åbent.',
    'Produktnavne udtales som på engelsk: Claude, Webflow, MCP, TonePilot, CMO Copilot.',
  ],
};

export default { FPS, DURATION, FRAME_COUNT, BEATS, CUES, VO_DIRECTION };
