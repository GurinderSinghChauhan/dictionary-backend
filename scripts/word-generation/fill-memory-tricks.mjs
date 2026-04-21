import path from "node:path";
import { fileURLToPath } from "node:url";
import xlsx from "xlsx";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const workbookPath =
  process.argv[2] || path.join(scriptDir, "word-details.xlsx");

const memoryTricks = {
  abate: "A-bate: picture bait being pulled away and the noise around it dying down.",
  aberrant: "Aberrant sounds like errant: an errant arrow flies off the normal path.",
  abjure: "Ab-jury: imagine leaving the jury box after swearing off your old claim.",
  abscond: "Abscond has abs + gone: picture someone with strong abs gone out the back door.",
  abstain: "Abstain sounds like stay away: picture your hand staying away from a tempting plate.",
  acumen: "Acu sounds like acute: picture a sharp needle point for sharp judgment.",
  admonish: "Admonish has monitor in its sound: picture a monitor warning you with a red alert.",
  adulterate: "Adult-er-ate: picture an adult mixing cheap filler into a pure drink.",
  advocate: "Advocate sounds like add voice: picture adding your voice to support someone.",
  aesthetic: "Aesthetic starts with aesth, like artist's taste: picture an artist judging beauty.",
  affectation: "Affectation has act: picture someone acting fancy to impress a crowd.",
  aggrandize: "Aggrandize contains grand: picture making a small trophy look grand.",
  alacrity: "Alacrity sounds like electricity: picture moving with an electric burst.",
  amalgamate: "Amalgamate sounds like all-meld: picture several colors melting into one.",
  ambiguous: "Ambiguous starts with ambi, meaning both: picture a sign pointing two ways.",
  ambivalent: "Ambivalent has ambi: picture two opposite magnets pulling your mind.",
  ameliorate: "Ameliorate sounds like meal-you-rate: picture improving a bad meal until it rates higher.",
  anachronism: "Anachronism has chrono: picture a wristwatch on a medieval knight.",
  analogous: "Analogous sounds like analogy: picture two matching puzzle pieces.",
  anomaly: "Anomaly sounds like odd anomaly: picture one red marble among blue marbles.",
  antipathy: "Anti-pathy: picture an anti sign blocking a path toward someone.",
  apathy: "Apathy sounds like no path: picture someone too uninterested to choose a path.",
  appease: "Appease sounds like at peace: picture calming a storm into peace.",
  approbation: "Approbation has approve: picture a giant approval stamp.",
  arbitrary: "Arbitrary sounds like air-berry: picture random berries floating in the air.",
  arcane: "Arcane sounds like locked arcane: picture a locked ancient book.",
  archaic: "Archaic sounds like archive: picture a dusty old archive box.",
  arduous: "Arduous sounds like hard-to-us: picture a hard mountain climb.",
  articulate: "Articulate has article: picture each article of speech placed clearly in order.",
  ascetic: "Ascetic sounds like a skeptic of comfort: picture someone refusing a soft couch.",
  assuage: "Assuage sounds like a soothing swage: picture smoothing rough metal with calm hands.",
  audacious: "Audacious sounds like audio loud: picture a bold person speaking loudly.",
  austere: "Austere sounds like a stern room: picture a plain room with one hard chair.",
  aver: "Aver sounds like avow: picture raising a hand and firmly saying it is true.",
  banal: "Banal sounds like ban all sparkle: picture a dull gray room where fun is banned.",
  belie: "Belie sounds like be-lie: picture a smile that hides the lie underneath.",
  benign: "Benign sounds like be kind: picture a kind, harmless doctor.",
  bolster: "Bolster is a pillow: picture propping up a weak wall with pillows.",
  bombastic: "Bombastic starts with bomb: picture words exploding louder than their meaning.",
  brazen: "Brazen sounds like brass: picture someone boldly wearing shiny brass armor.",
  burgeon: "Burgeon sounds like bud-gin: picture buds suddenly bursting open.",
  buttress: "Buttress sounds like butt-rest: picture a strong support holding up a wall.",
  cacophony: "Cacophony sounds like caw-caw: picture many harsh bird calls at once.",
  candid: "Candid camera: picture an honest unposed photo.",
  capricious: "Capricious sounds like caprice car: picture a car swerving randomly.",
  castigate: "Castigate has cast: picture casting blame like stones at someone.",
  caustic: "Caustic sounds like acid: picture words sizzling like acid drops.",
  censure: "Censure sounds like censor: picture a red mark across bad behavior.",
  chicanery: "Chicanery sounds like trickery: picture a magician hiding cards in sleeves.",
  cogent: "Cogent has cog: picture gears locking together in a clear argument.",
  commensurate: "Commensurate has measure: picture two scales measuring to the same level.",
  complacent: "Complacent sounds like comfy place: picture someone too comfy to improve.",
  complaisant: "Complaisant sounds like comply-pleasant: picture someone pleasantly saying yes.",
  conciliatory: "Conciliatory sounds like console: picture someone consoling two rivals.",
  condone: "Condone sounds like con-done: picture stamping done on a questionable con.",
  confound: "Confound sounds like confusion found: picture tangled wires in your mind.",
  conspicuous: "Conspicuous sounds like can't miss: picture a neon hat in a quiet room.",
  contrite: "Contrite sounds like crushed-right: picture someone with head bowed after doing wrong.",
  conundrum: "Conundrum sounds like can-none-drum: picture a puzzle drum no one can play.",
  convoluted: "Convoluted has coils: picture a sentence twisted into coils.",
  craven: "Craven sounds like cave-in: picture someone hiding in a cave.",
  decorum: "Decorum sounds like decorate a room: picture a formal room with proper behavior.",
  deference: "Deference sounds like defer: picture stepping aside respectfully.",
  delineate: "Delineate has line: picture drawing clear lines around an idea.",
  demur: "Demur sounds like murmur: picture softly objecting with a murmur.",
  deride: "Deride sounds like ride down: picture riding over someone's idea with laughter.",
  desiccate: "Desiccate sounds like desert: picture fruit drying in desert sun.",
  desultory: "Desultory sounds like result scattered: picture notes scattered without order.",
  diatribe: "Diatribe sounds like angry tribe: picture a tribe shouting a long complaint.",
  didactic: "Didactic sounds like did-act-teach: picture a teacher acting out a lesson.",
  diffident: "Diffident sounds like difficult confidence: picture confidence stuck behind a wall.",
  dilatory: "Dilatory sounds like delay story: picture someone telling stories to delay work.",
  dilettante: "Dilettante sounds like dabble-tent: picture hopping between hobby tents.",
  dirge: "Dirge sounds like funeral surge: picture slow music at a funeral.",
  disabuse: "Disabuse has abuse of an idea: picture removing a false label from someone's mind.",
  discern: "Discern sounds like see and learn: picture a magnifying glass spotting details.",
  disingenuous: "Disingenuous has not genuine: picture a fake smile mask.",
  disinterested: "Disinterested sounds like distance interest: picture a judge standing at a distance.",
  disparage: "Disparage sounds like damage praise: picture tearing down a compliment.",
  disparate: "Disparate sounds like separate: picture two unmatched socks far apart.",
  dissemble: "Dissemble sounds like disguise assemble: picture assembling a disguise.",
  dissonance: "Dissonance sounds like dissonant notes: picture piano keys clashing.",
  dogma: "Dogma sounds like dog manual: picture rigid rules posted for everyone to follow.",
  dupe: "Dupe sounds like duplicate: picture a fake duplicate fooling someone.",
  ebullient: "Ebullient sounds like bubble: picture bubbles of excitement rising.",
  eclectic: "Eclectic sounds like collect: picture collecting styles from many shelves.",
  efficacy: "Efficacy starts like efficient: picture a tool that actually gets the job done.",
  effrontery: "Effrontery has front: picture someone boldly stepping to the front uninvited.",
  egregious: "Egregious sounds like outrageous: picture a huge red mistake sign.",
  elegy: "Elegy sounds like eulogy: picture a solemn poem beside a candle.",
  elicit: "Elicit sounds like pull-it: picture pulling an answer out with a hook.",
  eloquent: "Eloquent sounds like elegant speaking: picture words dressed in a suit.",
  embellish: "Embellish sounds like bells: picture adding shiny bells to a plain story.",
  empirical: "Empirical sounds like experiment: picture lab results on a clipboard.",
  emulate: "Emulate sounds like imitate: picture copying a champion's moves.",
  enervate: "Enervate has nerve: picture energy draining out of tired nerves.",
  engender: "Engender sounds like engine-generate: picture an engine generating a result.",
  enigma: "Enigma sounds like mystery machine: picture a locked box with a question mark.",
  ephemeral: "Ephemeral sounds like a fever: picture something fading as quickly as a fever breaks.",
  equivocate: "Equivocate has equal voice: picture two voices dodging a direct answer.",
};

const workbook = xlsx.readFile(workbookPath);
const sheetName = workbook.SheetNames[0];

if (!sheetName) {
  throw new Error(`No sheets found in ${workbookPath}`);
}

const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], {
  defval: "",
});

let updated = 0;
const missing = [];

for (const row of rows) {
  const word = String(row.word || "").trim().toLowerCase();
  const memoryTrick = memoryTricks[word];

  if (!memoryTrick) {
    missing.push(word);
    continue;
  }

  if (row.memoryTrick !== memoryTrick) {
    row.memoryTrick = memoryTrick;
    updated += 1;
  }
}

workbook.Sheets[sheetName] = xlsx.utils.json_to_sheet(rows);
xlsx.writeFile(workbook, workbookPath);

console.log(
  JSON.stringify(
    {
      workbook: workbookPath,
      sheet: sheetName,
      rows: rows.length,
      updated,
      missing,
    },
    null,
    2
  )
);
