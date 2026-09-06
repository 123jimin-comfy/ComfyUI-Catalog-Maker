import {type} from 'arktype';

import {type CatalogConfig, type JsonValue, jsonValue, type Variation} from '../config/schema.ts';
import {placeholderSpans, replaceSpans, type TextSpan, validateSpans} from './text.ts';
import {coordinates} from './variations.ts';

export const apiGraph = type({'[string]': {class_type: 'string > 0', inputs: type({'[string]': jsonValue})}});
export type ApiGraph = typeof apiGraph.infer;
export const nodeDefinitions = type({'[string]': {
    'output_node': 'boolean',
    'output?': 'unknown[]',
    'input?': {'required?': 'Record<string, unknown>', 'optional?': 'Record<string, unknown>'},
}});
export type NodeDefinitions = typeof nodeDefinitions.infer;

export function validateGraph(data: unknown, catalog: CatalogConfig): ApiGraph {
    const graph = structuredClone(apiGraph.assert(data));
    if(Object.keys(graph).length === 0) throw new Error('Workflow must contain an API node graph. Export API format from ComfyUI.');
    const overridden = new Set<string>();
    for(const override of catalog.overrides ?? []) {
        const {node, input} = override.target;
        if(!Object.hasOwn(graph, node) || !Object.hasOwn(graph[node]!.inputs, input)) throw new Error(`Override: missing target ${node}.inputs.${input}`);
        const key = JSON.stringify([node, input]);
        if(overridden.has(key)) throw new Error(`Multiple overrides target ${node}.inputs.${input}`);
        overridden.add(key);
        graph[node]!.inputs[input] = structuredClone(override.value);
    }
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
    const targets = new Map<string, Variation[]>();
    for(const variation of catalog.variations) {
        const key = JSON.stringify([variation.target.node, variation.target.input]);
        const group = targets.get(key) ?? [];
        group.push(variation);
        targets.set(key, group);
    }
    const outputs: string[] = [];
    for(const [id, node] of Object.entries(graph)) {
        if(!Object.hasOwn(definitions, node.class_type)) throw new Error(`Node ${id}: unavailable node class ${node.class_type}`);
        const definition = definitions[node.class_type]!;
        if(definition.output_node) outputs.push(id);
        for(const required of Object.keys(definition.input?.required ?? {})) {
            if(!Object.hasOwn(node.inputs, required)) throw new Error(`Node ${id}: missing required input ${required}`);
        }
        for(const [input, value] of Object.entries(node.inputs)) {
            if(targets.has(JSON.stringify([id, input]))) continue;
            const descriptor = definition.input?.required?.[input] ?? definition.input?.optional?.[input];
            validateInput(value, descriptor, graph, `${id}.inputs.${input}`, definitions);
        }
    }
    if(catalog.output_node) {
        if(!outputs.includes(catalog.output_node)) throw new Error(`output_node ${catalog.output_node} is not an output node in the workflow`);
    } else if(outputs.length !== 1) {
        throw new Error(`Workflow has ${outputs.length} output nodes; specify output_node when multiple exist.`);
    }
    for(const variations of targets.values()) {
        const {node, input, placeholder} = variations[0]!.target;
        const definition = definitions[graph[node]!.class_type]!;
        const descriptor = definition.input?.required?.[input] ?? definition.input?.optional?.[input];
        if(typeof descriptor === 'undefined') throw new Error(`Node ${node}: input ${input} is not declared by the server`);
        const target = `${node}.inputs.${input}`;
        if(!placeholder) {
            for(const candidate of variations[0]!.values) validateInput(candidate.value, descriptor, graph, target, definitions);
            continue;
        }
        const text = graph[node]!.inputs[input];
        if(typeof text !== 'string') throw new Error('Text placeholders require string inputs and values');
        const spans = variations.map((variation) => placeholderSpans(text, variation.target.placeholder!));
        // Only variations sharing this input affect its final value. Resolve all of
        // them against the baseline, never against previously inserted text.
        for(const coordinate of coordinates(variations)) {
            const replacements: (TextSpan & {value: string})[] = [];
            for(const [axis, variation] of variations.entries()) {
                const value = variation.values[coordinate[axis]!]!.value;
                if(typeof value !== 'string') throw new Error('Text placeholders require string inputs and values');
                for(const span of spans[axis]!) replacements.push({...span, value});
            }
            validateInput(replaceSpans(text, replacements), descriptor, graph, target, definitions);
        }
    }
    for(const override of catalog.overrides ?? []) {
        const {node, input} = override.target;
        const definition = definitions[graph[node]!.class_type]!;
        const descriptor = definition.input?.required?.[input] ?? definition.input?.optional?.[input];
        if(typeof descriptor === 'undefined') throw new Error(`Node ${node}: input ${input} is not declared by the server`);
    }
    return catalog.output_node ?? outputs[0]!;
}

function validateInput(value: JsonValue, descriptor: unknown, graph: ApiGraph, target: string, definitions: NodeDefinitions): void {
    const fail = () => { throw new Error(`Incompatible candidate value for ${target}: ${JSON.stringify(value)}`); };
    // API links refer to graph nodes; they are not literal primitive values.
    if(Array.isArray(value) && value.length === 2 && typeof value[0] === 'string' && typeof value[1] === 'number') {
        if(!Object.hasOwn(graph, value[0]) || !Number.isInteger(value[1]) || value[1] < 0) fail();
        const source = graph[value[0]];
        const outputs: unknown = source && definitions[source.class_type]?.output;
        if(Array.isArray(outputs) && value[1] >= outputs.length) fail();
        return;
    }
    if(!Array.isArray(descriptor) || descriptor.length === 0) return;
    const kind: unknown = descriptor[0];
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
