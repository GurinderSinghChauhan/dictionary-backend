import path from "node:path";
import { fileURLToPath } from "node:url";
import xlsx from "xlsx";
import {
  normalizeWordKey,
  readWorkbookRows,
  senseColumns,
  writeWorkbookRows,
} from "./workbook-utils.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const workbookPath =
  process.argv[2] || path.join(scriptDir, "word-details.xlsx");

const memoryTricks = {
  abate: "Think of bait being taken away and the noise dying down. Abate means lessen or die down.",
  aberrant: "Hear errant in aberrant. An errant arrow goes off course, so aberrant means abnormal or off the usual path.",
  abjure: "Think ab-jury: you stand up and swear off an old belief. Abjure means formally reject.",
  abscond: "Picture someone with abs gone out the back door. Abscond means slip away secretly.",
  abstain: "Hear stay away in abstain. You keep your hand away from it, so abstain means choose not to take part.",
  acumen: "Think acute vision. Acumen means sharp judgment.",
  admonish: "Picture a monitor flashing a warning. Admonish means warn or scold firmly.",
  adulterate: "Picture an adult adding cheap filler to pure milk. Adulterate means make something impure.",
  advocate: "Think add voice. If you add your voice for someone, you advocate for them.",
  aesthetic: "Picture an artist judging beauty. Aesthetic relates to beauty or artistic taste.",
  affectation: "Hear act in affectation. Someone is acting fake to impress others.",
  aggrandize: "See grand inside aggrandize. To aggrandize is to make something seem greater or more powerful.",
  alacrity: "Think electric speed. Alacrity means eager quickness.",
  amalgamate: "Think all melt together. Amalgamate means combine into one.",
  ambiguous: "Think ambi, both. A sign points two ways, so ambiguous means unclear with more than one meaning.",
  ambivalent: "Think two opposite pulls. Ambivalent means having mixed feelings.",
  ameliorate: "Picture a bad meal improving until it earns a better rating. Ameliorate means improve or make better.",
  anachronism: "Picture a wristwatch on a medieval knight. Anachronism means something placed in the wrong time period.",
  analogous: "Think analogy. Two matching cases are analogous because they are similar in key ways.",
  anomaly: "Picture one red marble among blue ones. An anomaly is the odd one out.",
  antipathy: "Anti plus feeling. Antipathy means strong dislike.",
  apathy: "Picture someone too uninterested even to move. Apathy means lack of interest or feeling.",
  appease: "Hear peace in appease. To appease is to calm someone into peace.",
  approbation: "Think approval stamp. Approbation means praise or approval.",
  arbitrary: "Picture random berries falling from the air with no pattern. Arbitrary means based on random choice, not reason.",
  arcane: "Picture a locked old spellbook. Arcane means secret or known by only a few.",
  archaic: "Think archive. Archaic means very old or outdated.",
  arduous: "Picture a hard uphill climb. Arduous means difficult and tiring.",
  articulate: "Think every part of speech clearly lined up. Articulate means express clearly.",
  ascetic: "Picture someone refusing comfort, luxury, and soft cushions. Ascetic means self-denying and simple.",
  assuage: "Hear soothe in assuage. To assuage is to calm or ease something painful.",
  audacious: "Picture someone boldly speaking up in a silent room. Audacious means fearless and bold.",
  austere: "Picture a bare room with one hard chair. Austere means plain, strict, and without comfort.",
  aver: "Think of avow. Aver means state firmly as true.",
  banal: "Picture a room so dull that all sparkle is banned. Banal means boring and unoriginal.",
  belie: "Hear be-lie. Something looks one way but hides the truth underneath, so belie means give a false impression.",
  benign: "Think be kind. Benign means gentle or harmless.",
  bolster: "Picture a bolster pillow propping something up. Bolster means support or strengthen.",
  bombastic: "Picture words exploding like bombs but saying little. Bombastic means overly grand in speech.",
  brazen: "Think shiny brass confidence. Brazen means bold and shameless.",
  burgeon: "Picture flower buds bursting open fast. Burgeon means begin to grow quickly.",
  buttress: "Picture a strong support holding up a wall. A buttress supports and strengthens.",
  cacophony: "Hear caw-caw from many birds at once. Cacophony means a harsh mix of sounds.",
  candid: "Think candid camera. Candid means honest and straightforward.",
  capricious: "Picture a car suddenly swerving for no reason. Capricious means unpredictable and changeable.",
  castigate: "Picture blame being cast like stones. Castigate means scold harshly.",
  caustic: "Picture words sizzling like acid. Caustic means sharply cutting or corrosive.",
  censure: "Think censor mark. Censure means strong formal criticism.",
  chicanery: "Hear trickery inside chicanery. It means clever deception.",
  cogent: "Picture gears locking together smoothly. Cogent means clear and convincing.",
  commensurate: "Think measuring on the same scale. Commensurate means matching in size or degree.",
  complacent: "Picture someone too comfy to improve. Complacent means smugly satisfied.",
  complaisant: "Hear comply in complaisant. Someone eager to please is complaisant.",
  conciliatory: "Think console and reconcile. Conciliatory means meant to make peace.",
  condone: "Think con done and allowed. Condone means accept or allow wrongdoing.",
  confound: "Picture your thoughts tied in knots. Confound means confuse or mix up.",
  conspicuous: "Picture a neon hat in a gray crowd. Conspicuous means easy to notice.",
  contrite: "Picture someone crushed with regret, head bowed. Contrite means truly sorry.",
  conundrum: "Think of a stubborn puzzle. A conundrum is a difficult problem.",
  convoluted: "Picture a road twisted into coils. Convoluted means overly tangled or complex.",
  craven: "Picture someone hiding in a cave from danger. Craven means cowardly.",
  decorum: "Picture formal behavior in a formal room. Decorum means proper and polite conduct.",
  deference: "Think defer and step aside. Deference means respectful yielding to another.",
  delineate: "See line in delineate. To delineate is to draw or describe clearly.",
  demur: "Hear a soft murmur of objection. Demur means object politely or hesitate.",
  deride: "Picture riding over someone's idea with laughter. Deride means mock with contempt.",
  desiccate: "Picture fruit drying in desert sun. Desiccate means dry out completely.",
  desultory: "Picture scattered notes with no order. Desultory means jumping around without a clear plan.",
  diatribe: "Picture a long angry rant from a whole tribe. Diatribe means a bitter attack in words.",
  didactic: "Think teach in didactic. Didactic means intended to instruct.",
  diffident: "Picture confidence stuck behind a wall. Diffident means shy and lacking confidence.",
  dilatory: "Think delay. Dilatory means slow because of delay.",
  dilettante: "Picture someone dabbling from one hobby tent to another. A dilettante takes shallow interest in many things.",
  dirge: "Picture slow music at a funeral. A dirge is a mournful song or poem.",
  disabuse: "Picture pulling a false label off an idea. Disabuse means free someone from a mistaken belief.",
  discern: "Think see clearly. Discern means notice or understand something carefully.",
  disingenuous: "Think not genuine. Disingenuous means pretending to be sincere when you are not.",
  disinterested: "Picture a judge standing at a fair distance. Disinterested means impartial, not self-seeking.",
  disparage: "Picture tearing praise apart. Disparage means speak of as unimportant or bad.",
  disparate: "Think separate. Disparate things are very different from each other.",
  dissemble: "Picture assembling a disguise. Dissemble means hide your true feelings behind a false appearance.",
  dissonance: "Hear clashing notes on a piano. Dissonance means lack of harmony or agreement.",
  dogma: "Picture rigid rules posted like a manual nobody may question. Dogma means fixed beliefs accepted without challenge.",
  dupe: "Think fake duplicate tricking someone. Dupe means fool or deceive.",
  ebullient: "Picture excitement bubbling up. Ebullient means overflowing with enthusiasm.",
  eclectic: "Think collecting from many shelves. Eclectic means made from many different sources or styles.",
  efficacy: "Think effective. Efficacy means power to produce the intended result.",
  effrontery: "Picture someone boldly stepping to the front without shame. Effrontery means shameless boldness.",
  egregious: "Think outrageously bad. Egregious means remarkably bad or shocking.",
  elegy: "Think eulogy in poem form. An elegy is a mournful poem, often for the dead.",
  elicit: "Hear pull it. Elicit means draw out a response or answer.",
  eloquent: "Picture elegant speech flowing smoothly. Eloquent means fluent and persuasive in speaking or writing.",
  embellish: "Picture adding shiny bells and ribbons. Embellish means decorate or exaggerate to make better.",
  empirical: "Think experiment and evidence. Empirical means based on observation or experience.",
  emulate: "Think imitate a champion. Emulate means copy in order to match or equal.",
  enervate: "Picture energy draining out of your nerves. Enervate means weaken or drain energy.",
  engender: "Think engine generate. Engender means cause or produce.",
  enigma: "Picture a locked box with a question mark. Enigma means mystery or puzzle.",
  ephemeral: "Picture morning mist fading fast. Ephemeral means short-lived.",
  equivocate: "Think equal voices dodging a clear answer. Equivocate means speak ambiguously to avoid committing.",
};

const { workbook, sheetName, rows } = readWorkbookRows(workbookPath);
const hasSenseColumns = rows.some(
  (row) => "senseId" in row || "normalizedWord" in row || "contextType" in row
);

let updated = 0;
const missing = [];

for (const row of rows) {
  const word = normalizeWordKey(row);
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

writeWorkbookRows(
  workbook,
  sheetName,
  rows,
  hasSenseColumns ? senseColumns : undefined
);
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
