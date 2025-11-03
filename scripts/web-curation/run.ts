import path from 'path';

import {
  WebCurator,
  loadMappings,
  parseNdjsonFile,
  writeOutputs,
} from './curator';

type CliOptions = {
  missingPath: string;
  outNdjson: string;
  outJson: string;
  dryRun: boolean;
  limit?: number;
};

function parseArgs(argv: string[]): CliOptions {
  const opts: CliOptions = {
    missingPath: path.resolve('data/name_mappings/missing_names.ndjson'),
    outNdjson: path.resolve('data/name_mappings/autocurated/geography_name_map.ndjson'),
    outJson: path.resolve('data/name_mappings/geography_name_map.json'),
    dryRun: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    switch (arg) {
      case '--missing':
        if (!next) throw new Error('--missing requires a value');
        opts.missingPath = path.resolve(next);
        i += 1;
        break;
      case '--out-ndjson':
        if (!next) throw new Error('--out-ndjson requires a value');
        opts.outNdjson = path.resolve(next);
        i += 1;
        break;
      case '--out-json':
        if (!next) throw new Error('--out-json requires a value');
        opts.outJson = path.resolve(next);
        i += 1;
        break;
      case '--limit':
        if (!next) throw new Error('--limit requires a value');
        opts.limit = Number.parseInt(next, 10);
        if (Number.isNaN(opts.limit)) {
          throw new Error('--limit must be a number');
        }
        i += 1;
        break;
      case '--dry-run':
        opts.dryRun = true;
        break;
      default:
        if (arg.startsWith('--')) {
          throw new Error(`Unknown flag: ${arg}`);
        }
    }
  }

  return opts;
}

async function main(argv: string[]) {
  const options = parseArgs(argv);

  const mappingsPath = path.resolve('data/name_mappings/manual_mappings.json');
  const mappings = loadMappings(mappingsPath);
  const entries = parseNdjsonFile(options.missingPath);
  const limited = typeof options.limit === 'number' ? entries.slice(0, options.limit) : entries;

  const budget = Number.parseInt(process.env.CSE_DAILY_BUDGET ?? '100', 10);
  const rateLimitSeconds = Number.parseFloat(process.env.CSE_RATE_LIMIT_S ?? '1.5');

  const runStartedAt = new Date();
  const curator = new WebCurator({
    budget: Number.isNaN(budget) ? 100 : budget,
    rateLimitMs: Number.isNaN(rateLimitSeconds) ? 1500 : Math.max(0, rateLimitSeconds * 1000),
    mappings,
    now: () => runStartedAt,
    reporter: (message) => {
      process.stderr.write(`[web-curator] ${message}\n`);
    },
  });

  const result = await curator.curate(limited);

  if (!options.dryRun) {
    writeOutputs(result.records, options.outNdjson, options.outJson);
  }

  const summary = {
    ok: true,
    dryRun: options.dryRun,
    outputNdjson: options.dryRun ? null : options.outNdjson,
    outputJson: options.dryRun ? null : options.outJson,
    stats: result.stats,
    skipped: result.skipped,
  };

  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);

  if (!options.dryRun && result.records.length === 0) {
    process.stderr.write('[web-curator] No records curated; nothing to write.\n');
  }
}

const invokedUrl = process.argv[1] ? new URL(process.argv[1], 'file://').href : null;
if (invokedUrl && import.meta.url === invokedUrl) {
  main(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`[web-curator] ${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  });
}
