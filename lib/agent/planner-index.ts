import {
  CONFIG,
} from "@/lib/config";

import type {
  Planner,
} from "./planner";

import {
  rulePlanner,
} from "./rule-planner";

import {
  llmPlanner,
} from "./llm-planner";

import {
  hybridPlanner,
} from "./hybrid-planner";


export function getPlanner(): Planner {

  switch (
    CONFIG.plannerMode
  ) {

    case "llm":
      return llmPlanner;

    case "hybrid":
      return hybridPlanner;

    case "rule":
    default:
      return rulePlanner;

  }

}