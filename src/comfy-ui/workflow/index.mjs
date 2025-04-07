//@ts-check

/** @import {WorkflowFunction} from "./type" */

export * from "./sdxl.mjs";
import { createSDXLWorkflow } from "./sdxl.mjs";

/** @type {Record<string, WorkflowFunction>} */
export const WORKFLOWS = {
    sdxl: createSDXLWorkflow,
};