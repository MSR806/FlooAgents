import type { AnyConnector } from "@floo/gateway-kit";
import { agentBuilder } from "./agent-builder.ts";
import { amplitude } from "./amplitude.ts";
import { branch } from "./branch.ts";
import { echo } from "./echo.ts";
import { github } from "./github.ts";
import { jira } from "./jira.ts";
import { meta } from "./meta.ts";

export const connectors: AnyConnector[] = [
  echo,
  agentBuilder,
  github,
  jira,
  amplitude,
  branch,
  meta,
];
