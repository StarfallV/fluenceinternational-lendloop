import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** One place where an identifier is defined, relative to the docs directory. */
export interface Definition {
  id: string;
  location: string;
}

export interface IdReport {
  definitions: Definition[];
  /** Identifier → every location that defines it, only for identifiers defined more than once. */
  duplicates: Map<string, string[]>;
  /** Definitions that contradict themselves, such as an ADR file titled with another number. */
  problems: string[];
}

const TD_HEADING = /^### (TD-\d{3})\b/;
const ADR_FILE = /^(ADR-\d{3})-.+\.md$/;
const ADR_TITLE = /^# (ADR-\d{3})\b/m;
const BUG_FILE = /^(BUG-\d{3})-.+\.md$/;
const BLOCK_FILE = /^(\d{3})-.+\.md$/;

function filesIn(dir: string): string[] {
  return existsSync(dir) ? readdirSync(dir).sort() : [];
}

function techDebtDefinitions(docsDir: string): Definition[] {
  const file = join(docsDir, "tech-debt.md");
  if (!existsSync(file)) return [];
  const definitions: Definition[] = [];
  readFileSync(file, "utf8")
    .split(/\r?\n/)
    .forEach((line, index) => {
      const match = TD_HEADING.exec(line);
      if (match) definitions.push({ id: match[1], location: `tech-debt.md:${index + 1}` });
    });
  return definitions;
}

function fileDefinitions(
  docsDir: string,
  folder: string,
  pattern: RegExp,
  prefix = "",
): Definition[] {
  return filesIn(join(docsDir, folder)).flatMap((file) => {
    const match = pattern.exec(file);
    return match ? [{ id: `${prefix}${match[1]}`, location: `${folder}/${file}` }] : [];
  });
}

function adrTitleProblems(docsDir: string): string[] {
  return filesIn(join(docsDir, "adr")).flatMap((file) => {
    const match = ADR_FILE.exec(file);
    if (!match) return [];
    const title = ADR_TITLE.exec(readFileSync(join(docsDir, "adr", file), "utf8"));
    return title && title[1] !== match[1] ? [`adr/${file} is titled ${title[1]}`] : [];
  });
}

/** Identifiers defined more than once, with every location that defines them. */
export function findDuplicates(definitions: Definition[]): Map<string, string[]> {
  const locations = new Map<string, string[]>();
  for (const { id, location } of definitions) {
    locations.set(id, [...(locations.get(id) ?? []), location]);
  }
  return new Map([...locations].filter(([, where]) => where.length > 1));
}

/**
 * Checks that every TD, ADR and BUG identifier and every block number under `docsDir` is defined
 * once. TD items are defined by their heading in tech-debt.md; ADRs, bugs and blocks by their
 * file names. A missing docs directory or tech-debt.md, or no identifiers at all, is a problem
 * too, so a run from the wrong directory can't pass.
 */
export function checkIds(docsDir: string): IdReport {
  if (!existsSync(docsDir)) {
    return {
      definitions: [],
      duplicates: new Map(),
      problems: [`${docsDir} not found; run check:ids from the repository root`],
    };
  }
  const definitions = [
    ...techDebtDefinitions(docsDir),
    ...fileDefinitions(docsDir, "adr", ADR_FILE),
    ...fileDefinitions(docsDir, "bugs", BUG_FILE),
    ...fileDefinitions(docsDir, "blocks", BLOCK_FILE, "block "),
  ];
  const problems = [
    ...(existsSync(join(docsDir, "tech-debt.md")) ? [] : ["tech-debt.md not found"]),
    ...(definitions.length === 0 ? ["no identifiers found"] : []),
    ...adrTitleProblems(docsDir),
  ];
  return { definitions, duplicates: findDuplicates(definitions), problems };
}
