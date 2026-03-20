import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import esbuild from "esbuild";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, "..");
const packageJson = JSON.parse(readFileSync(resolve(rootDir, "package.json"), "utf8"));

function readGitRevision() {
  try {
    const shortSha = execFileSync("git", ["rev-parse", "--short", "HEAD"], {
      cwd: rootDir,
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString("utf8")
      .trim();

    if (shortSha) {
      return shortSha;
    }
  } catch {
    // The project may not be initialized as a git repository yet.
  }

  return process.env.GITHUB_SHA?.slice(0, 7) ?? "nogit";
}

function parseArguments(argv) {
  const formats = new Set();
  let watch = false;

  for (const argument of argv) {
    if (argument === "--watch") {
      watch = true;
      continue;
    }

    if (argument.startsWith("--format=")) {
      formats.add(argument.slice("--format=".length));
    }
  }

  return {
    formats: formats.size ? [...formats] : ["esm", "cjs", "browser"],
    watch,
  };
}

const revision = readGitRevision();
const version = packageJson.version;
const release = `${version}+${revision}`;
const buildDate = new Date().toISOString();
const browserBanner = `/* scryfall-query-dsl v${release} | built ${buildDate} */`;
const sharedDefines = {
  __SCRYFALL_QUERY_DSL_VERSION__: JSON.stringify(version),
  __SCRYFALL_QUERY_DSL_RELEASE__: JSON.stringify(release),
  __SCRYFALL_QUERY_DSL_BUILD_DATE__: JSON.stringify(buildDate),
};

const targetByFormat = {
  browser: "es2020",
  cjs: "node18",
  esm: "es2020",
};

const outfilesByFormat = {
  browser: resolve(rootDir, "dist", "scryfall-query-dsl.js"),
  cjs: resolve(rootDir, "dist", "scryfall-query-dsl.cjs"),
  esm: resolve(rootDir, "dist", "scryfall-query-dsl.esm.js"),
};

const optionsByFormat = {
  browser: {
    bundle: true,
    format: "iife",
    globalName: "ScryfallQueryDSL",
    platform: "browser",
    banner: {
      js: browserBanner,
    },
  },
  cjs: {
    bundle: true,
    format: "cjs",
    platform: "node",
    banner: {
      js: browserBanner,
    },
  },
  esm: {
    bundle: true,
    format: "esm",
    platform: "browser",
    banner: {
      js: browserBanner,
    },
  },
};

async function buildFormat(format, watch) {
  if (!optionsByFormat[format]) {
    throw new Error(`Unsupported build format "${format}".`);
  }

  const outfile = outfilesByFormat[format];
  mkdirSync(dirname(outfile), { recursive: true });

  const buildOptions = {
    entryPoints: [resolve(rootDir, "src", "index.js")],
    outfile,
    target: targetByFormat[format],
    define: sharedDefines,
    ...optionsByFormat[format],
  };

  if (watch) {
    const context = await esbuild.context(buildOptions);
    await context.watch();
    return;
  }

  await esbuild.build(buildOptions);
}

const { formats, watch } = parseArguments(process.argv.slice(2));

await Promise.all(formats.map((format) => buildFormat(format, watch)));

if (!watch) {
  writeFileSync(resolve(rootDir, "dist", ".nojekyll"), "");
}

if (watch) {
  process.stdout.write(`Watching scryfall-query-dsl ${release} for ${formats.join(", ")} builds\n`);
}
