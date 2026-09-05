import type {Variation} from '../config/schema.ts';
import type {ApiGraph} from './graph.ts';
import {placeholderSpans, replaceSpans, type TextSpan} from './text.ts';

export function* coordinates(variations: readonly Variation[]): Generator<number[]> {
    const indices = variations.map(() => 0);
    if(indices.length === 0 || variations.some((v) => v.values.length === 0)) return;
    for(;;) {
        yield [...indices];
        let axis = indices.length - 1;
        while(axis >= 0 && indices[axis]! + 1 === variations[axis]!.values.length) {
            indices[axis] = 0;
            axis--;
        }
        if(axis < 0) return;
        indices[axis] = indices[axis]! + 1;
    }
}

export function applyCoordinate(source: ApiGraph, variations: readonly Variation[], coordinate: readonly number[]): ApiGraph {
    const graph = structuredClone(source);
    const texts = new Map<string, {node: string; input: string; text: string; replacements: (TextSpan & {value: string})[]}>();
    for(const [axis, variation] of variations.entries()) {
        const candidate = variation.values[coordinate[axis]!];
        if(!candidate) throw new Error(`Invalid coordinate ${coordinate.join('-')}`);
        const {node, input, placeholder} = variation.target;
        if(!placeholder) {
            graph[node]!.inputs[input] = structuredClone(candidate.value);
            continue;
        }
        const text = source[node]!.inputs[input];
        if(typeof text !== 'string' || typeof candidate.value !== 'string') throw new Error('Text placeholders require string inputs and values');
        const key = JSON.stringify([node, input]);
        const group = texts.get(key) ?? {node, input, text, replacements: []};
        for(const span of placeholderSpans(text, placeholder)) group.replacements.push({...span, value: candidate.value});
        texts.set(key, group);
    }
    for(const {node, input, text, replacements} of texts.values()) graph[node]!.inputs[input] = replaceSpans(text, replacements);
    return graph;
}
