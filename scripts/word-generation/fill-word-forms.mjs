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
const overwrite = process.argv.includes("--overwrite");

const irregularForms = new Map(
  Object.entries({
    aesthetic: ["more aesthetic", "most aesthetic", "aesthetically"],
    analogous: ["more analogous", "most analogous", "analogously"],
    arbitrary: ["more arbitrary", "most arbitrary", "arbitrarily"],
    arcane: ["more arcane", "most arcane", "arcanely"],
    archaic: ["more archaic", "most archaic", "archaically"],
    arduous: ["more arduous", "most arduous", "arduously"],
    articulate: ["more articulate", "most articulate", "articulately"],
    ascetic: ["more ascetic", "most ascetic", "ascetically"],
    audacious: ["more audacious", "most audacious", "audaciously"],
    austere: ["more austere", "most austere", "austerely"],
    banal: ["more banal", "most banal", "banally"],
    benign: ["more benign", "most benign", "benignly"],
    bombastic: ["more bombastic", "most bombastic", "bombastically"],
    brazen: ["more brazen", "most brazen", "brazenly"],
    candid: ["more candid", "most candid", "candidly"],
    capricious: ["more capricious", "most capricious", "capriciously"],
    caustic: ["more caustic", "most caustic", "caustically"],
    cogent: ["more cogent", "most cogent", "cogently"],
    commensurate: [
      "more commensurate",
      "most commensurate",
      "commensurately",
    ],
    complacent: ["more complacent", "most complacent", "complacently"],
    complaisant: ["more complaisant", "most complaisant", "complaisantly"],
    conciliatory: [
      "more conciliatory",
      "most conciliatory",
      "conciliatorily",
    ],
    conspicuous: ["more conspicuous", "most conspicuous", "conspicuously"],
    contrite: ["more contrite", "most contrite", "contritely"],
    convoluted: ["more convoluted", "most convoluted", "convolutedly"],
    craven: ["more craven", "most craven", "cravenly"],
    desultory: ["more desultory", "most desultory", "desultorily"],
    didactic: ["more didactic", "most didactic", "didactically"],
    diffident: ["more diffident", "most diffident", "diffidently"],
    dilatory: ["more dilatory", "most dilatory", "dilatorily"],
    disingenuous: [
      "more disingenuous",
      "most disingenuous",
      "disingenuously",
    ],
    disinterested: [
      "more disinterested",
      "most disinterested",
      "disinterestedly",
    ],
    disparate: ["more disparate", "most disparate", "disparately"],
    ebullient: ["more ebullient", "most ebullient", "ebulliently"],
    eclectic: ["more eclectic", "most eclectic", "eclectically"],
    egregious: ["more egregious", "most egregious", "egregiously"],
    eloquent: ["more eloquent", "most eloquent", "eloquently"],
    empirical: ["more empirical", "most empirical", "empirically"],
    ephemeral: ["more ephemeral", "most ephemeral", "ephemerally"],
  })
);

function isEmptyArrayCell(value) {
  const text = String(value || "").trim();
  return !text || text === "[]";
}

function pluralize(word) {
  if (word === "dogma") {
    return "dogmas";
  }

  if (word.endsWith("y") && !/[aeiou]y$/.test(word)) {
    return `${word.slice(0, -1)}ies`;
  }

  if (/(s|x|z|ch|sh)$/.test(word)) {
    return `${word}es`;
  }

  return `${word}s`;
}

function thirdPerson(word) {
  return pluralize(word);
}

function pastTense(word) {
  if (word.endsWith("e")) {
    return `${word}d`;
  }

  if (word.endsWith("y") && !/[aeiou]y$/.test(word)) {
    return `${word.slice(0, -1)}ied`;
  }

  return `${word}ed`;
}

function presentParticiple(word) {
  if (word.endsWith("ie")) {
    return `${word.slice(0, -2)}ying`;
  }

  if (word.endsWith("e") && !/(ee|oe|ye)$/.test(word)) {
    return `${word.slice(0, -1)}ing`;
  }

  return `${word}ing`;
}

function defaultAdjectiveForms(word) {
  const adverb = word.endsWith("y")
    ? `${word.slice(0, -1)}ily`
    : word.endsWith("le")
      ? `${word.slice(0, -1)}y`
      : `${word}ly`;

  return [`more ${word}`, `most ${word}`, adverb];
}

function wordFormsFor(row) {
  const word = normalizeWordKey(row);
  const partOfSpeech = String(row.partOfSpeech || "").trim().toLowerCase();

  if (!word) {
    return [];
  }

  if (irregularForms.has(word)) {
    return irregularForms.get(word);
  }

  if (partOfSpeech.includes("verb")) {
    return [thirdPerson(word), pastTense(word), presentParticiple(word)];
  }

  if (partOfSpeech.includes("noun")) {
    return [pluralize(word)];
  }

  if (partOfSpeech.includes("adjective")) {
    return defaultAdjectiveForms(word);
  }

  return [];
}

const { workbook, sheetName, rows } = readWorkbookRows(workbookPath);
const hasSenseColumns = rows.some(
  (row) => "senseId" in row || "normalizedWord" in row || "contextType" in row
);

let updated = 0;
for (const row of rows) {
  if (!overwrite && !isEmptyArrayCell(row.wordForms)) {
    continue;
  }

  const forms = wordFormsFor(row);
  if (forms.length === 0) {
    continue;
  }

  row.wordForms = JSON.stringify(forms);
  updated += 1;
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
    },
    null,
    2
  )
);
