import replace from "@rollup/plugin-replace";
import { createRequire } from "module";
import type { RollupOptions } from "rollup";
import dts from "rollup-plugin-dts";
import esbuild from "rollup-plugin-esbuild";
import preserveDirectives from "rollup-plugin-preserve-directives";

import { clean } from "./plugins/rollup/clean";
import { styles } from "./plugins/rollup/styles";

const SRC_DIR = "src";
const DIST_DIR = "dist";
const ENTRIES = [`${SRC_DIR}/index.ts`];

interface Pkg {
  version: string;
  dependencies: Record<string, string>;
  peerDependencies: Record<string, string>;
}

const pkg = createRequire(import.meta.url)("./package.json") as Pkg;

function createMainConfig(format: "cjs" | "esm"): RollupOptions {
  const output: RollupOptions["output"] =
    format === "cjs"
      ? {
          dir: DIST_DIR,
          preserveModules: true,
          preserveModulesRoot: SRC_DIR,
          format: "cjs",
          sourcemap: true,
        }
      : {
          dir: DIST_DIR,
          entryFileNames: "[name].mjs",
          preserveModules: true,
          preserveModulesRoot: SRC_DIR,
          format: "esm",
          sourcemap: true,
        };

  return {
    input: ENTRIES,
    external: [
      ...Object.keys(pkg.dependencies),
      ...Object.keys(pkg.peerDependencies),
      "@lexical/react/LexicalCollaborationPlugin",
      "@lexical/react/LexicalComposerContext",
      "react-dom",

      // NOTE: These should ideally not have to be here, because
      // use-sync-external-store is already declared as a production
      // dependency. Figure this out later.
      "use-sync-external-store/shim/index.js",
      "use-sync-external-store/shim/with-selector.js",
    ],
    output,
    treeshake: false,
    plugins: [
      esbuild({
        target: "es2020",
        sourceMap: true,
      }),
      preserveDirectives(),
      replace({
        values: {
          __VERSION__: JSON.stringify(pkg.version),
          TSUP_FORMAT: JSON.stringify(format),
        },
        preventAssignment: true,
      }),

      // Clean dist directory
      clean({ directory: DIST_DIR }),
      // Build .css files
      styles({
        files: [
          {
            entry: `${SRC_DIR}/styles/index.css`,
            destination: "styles.css",
          },
        ],
      }),
    ],
    onwarn(warning, warn) {
      if (
        warning.code === "MODULE_LEVEL_DIRECTIVE" &&
        warning.message.includes("use client")
      ) {
        return;
      }
      warn(warning);
    },
  };
}

function createTypesConfigs() {
  return ENTRIES.map((input) => ({
    input,
    output: [
      {
        file: input
          .replace(`${SRC_DIR}/`, `${DIST_DIR}/`)
          .replace(/\.ts$/, ".d.ts"),
      },
      {
        file: input
          .replace(`${SRC_DIR}/`, `${DIST_DIR}/`)
          .replace(/\.ts$/, ".d.mts"),
      },
    ],
    plugins: [dts()],
  }));
}

const configs: RollupOptions[] = [
  // Build .js and .mjs files
  createMainConfig("cjs"),
  createMainConfig("esm"),

  // Build .d.ts and .d.mts files
  ...createTypesConfigs(),
];

export default configs;
