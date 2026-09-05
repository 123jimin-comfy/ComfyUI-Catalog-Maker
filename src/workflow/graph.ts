import {type} from 'arktype';

import {type CatalogConfig, type JsonValue, jsonValue} from '../config/schema.ts';
import {placeholderSpans, type TextSpan, validateSpans} from './text.ts';

export const apiGraph = type({'[string]': {class_type: 'string > 0', inputs: type({'[string]': jsonValue})}});
export type ApiGraph = typeof apiGraph.infer;
export const nodeDefinitions = type({'[string]': {"output_node": 'boolean', 'input?': {'required?': 'Record<string, unknown>', 'optional?': 'Record<string, unknown>'}}});
export type NodeDefinitions = typeof nodeDefinitions.infer;

export function validateGraph(data: unknown, catalog: CatalogConfig): ApiGraph {
    const graph = apiGraph.assert(data);
    if(Object.keys(graph).length === 0) throw new Error('Workflow must contain an API node graph. Export API format from ComfyUI.');
    const seen = new Map<string, TextSpan[] | null>();
    for(const variation of catalog.variations) {
        const {node, input, placeholder} = variation.target;
        if(!Object.hasOwn(graph, node) || !Object.hasOwn(graph[node]!.inputs, input)) throw new Error(`Variation ${variation.name}: missing target ${node}.inputs.${input}`);
        const key = JSON.stringify([node, input]);
        if(!placeholder) {
            if(seen.has(key)) throw new Error(`Multiple variations target ${node}.inputs.${input}`);
            seen.set(key, null);
            continue;
        }
        const text = graph[node]!.inputs[input];
        if(typeof text !== 'string' || variation.values.some((v) => typeof v.value !== 'string')) throw new Error(`Placeholder target ${node}.inputs.${input} and its candidate values must be strings`);
        if(seen.get(key) === null) throw new Error(`Whole-input and placeholder variations conflict at ${node}.inputs.${input}`);
        const spans = [...(seen.get(key) ?? []), ...placeholderSpans(text, placeholder)];
        validateSpans(spans);
        seen.set(key, spans);
    }
    return graph;
}

export function selectOutput(graph: ApiGraph, catalog: CatalogConfig, definitions: NodeDefinitions): string {
    const outputs: string[] = [];
    for(const [id, node] of Object.entries(graph)) {
        if(!Object.hasOwn(definitions, node.class_type)) throw new Error(`Node ${id}: unavailable node class ${node.class_type}`);
        if(definitions[node.class_type]!.output_node) outputs.push(id);
    }
    if(catalog.output_node) {
        if(!outputs.includes(catalog.output_node)) throw new Error(`output_node ${catalog.output_node} is not an output node in the workflow`);
    } else if(outputs.length !== 1) {
        throw new Error(`Workflow has ${outputs.length} output nodes; specify output_node when multiple exist.`);
    }
    for(const variation of catalog.variations) {
        const {node, input} = variation.target;
        const definition = definitions[graph[node]!.class_type]!;
        const descriptor = definition.input?.required?.[input] ?? definition.input?.optional?.[input];
        if(typeof descriptor === 'undefined') throw new Error(`Node ${node}: input ${input} is not declared by the server`);
        for(const candidate of variation.values) validateInput(candidate.value, descriptor, graph, `${node}.inputs.${input}`);
    }
    return catalog.output_node ?? outputs[0]!;
}

function validateInput(value: JsonValue, descriptor: unknown, graph: ApiGraph, target: string): void {
    const fail = () => { throw new Error(`Incompatible candidate value for ${target}: ${JSON.stringify(value)}`); };
    if(!Array.isArray(descriptor) || descriptor.length === 0) return;
    const kind: unknown = descriptor[0];
    // API links refer to graph nodes; they are not literal primitive values.
    if(Array.isArray(value) && value.length === 2 && typeof value[0] === 'string' && typeof value[1] === 'number') {
        if(!Object.hasOwn(graph, value[0]) || !Number.isInteger(value[1]) || value[1] < 0) fail();
        return;
    }
    if(Array.isArray(kind)) {
        if(!kind.some((choice: unknown) => choice === value)) fail();
        return;
    }
    if((kind === 'INT' && (typeof value !== 'number' || !Number.isSafeInteger(value)))
        || (kind === 'FLOAT' && (typeof value !== 'number' || !Number.isFinite(value)))
        || (kind === 'STRING' && typeof value !== 'string')
        || (kind === 'BOOLEAN' && typeof value !== 'boolean')) fail();
    const bounds: unknown = descriptor[1];
    if(typeof value === 'number' && bounds && typeof bounds === 'object') {
        if('min' in bounds && typeof bounds.min === 'number' && value < bounds.min) fail();
        if('max' in bounds && typeof bounds.max === 'number' && value > bounds.max) fail();
    }
}
