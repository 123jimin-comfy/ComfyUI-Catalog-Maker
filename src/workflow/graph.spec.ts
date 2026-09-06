import assert from 'node:assert/strict';
import {test} from 'node:test';

import {newMetadata} from '../catalog/metadata.ts';
import {catalogConfig} from '../config/schema.ts';
import {type ApiGraph, type NodeDefinitions, selectOutput, validateGraph} from './graph.ts';
import {applyCoordinate} from './variations.ts';

const source: ApiGraph = {1: {class_type: 'Output', inputs: {text: 'original', seed: 1, options: {old: true}}}};
const definitions: NodeDefinitions = {Output: {output_node: true, input: {required: {text: ['STRING'], seed: ['INT'], options: ['OBJECT']}}}};
const base = {id: 'test', name: 'Test', workflow: 'workflow.json', variations: [
    {name: 'Text', target: {node: '1', input: 'text'}, values: ['A', 'C/B']},
]};

test('overrides establish an isolated baseline for whole-input and placeholder variations', () => {
    const catalog = catalogConfig.assert({...base, overrides: [
        {target: {node: '1', input: 'text'}, value: 'prefix {{value}}'},
        {target: {node: '1', input: 'seed'}, value: 42},
        {target: {node: '1', input: 'options'}, value: {"new": true}},
    ]});
    const graph = validateGraph(source, catalog);
    assert.equal(selectOutput(graph, catalog, definitions), '1');
    assert.deepEqual(applyCoordinate(graph, catalog.variations, [0])['1']!.inputs,
        {text: 'A', seed: 42, options: {"new": true}});
    catalog.variations[0]!.target.placeholder = '{{value}}';
    const baseline = validateGraph(source, catalog);
    const first = applyCoordinate(baseline, catalog.variations, [0]);
    first['1']!.inputs['options'] = null;
    assert.deepEqual(applyCoordinate(baseline, catalog.variations, [1])['1']!.inputs,
        {text: 'prefix B', seed: 42, options: {"new": true}});
    assert.equal(source['1']!.inputs['text'], 'original');
    assert.deepEqual(source['1']!.inputs['options'], {old: true});
    assert.deepEqual(catalog.overrides![2]!.value, {"new": true});
});

test('missing and duplicate override targets are rejected', () => {
    for(const target of [{node: 'missing', input: 'text'}, {node: '1', input: 'missing'}]) {
        const catalog = catalogConfig.assert({...base, overrides: [{target, value: 'V'}]});
        assert.throws(() => validateGraph(source, catalog), /Override: missing target/);
    }
    const override = {target: {node: '1', input: 'text'}, value: 'V'};
    assert.throws(() => validateGraph(source, catalogConfig.assert({...base, overrides: [override, override]})), /Multiple overrides/);
});

test('static overrides must remain compatible with their inputs', () => {
    for(const override of [
        {target: {node: '1', input: 'seed'}, value: '42'},
        {target: {node: '1', input: 'options'}, value: ['missing', 0]},
    ]) {
        const catalog = catalogConfig.assert({...base, overrides: [override]});
        assert.throws(() => selectOutput(validateGraph(source, catalog), catalog, definitions), /Incompatible/);
    }
});

test('whole-input variations supersede incompatible baselines and overrides', () => {
    const enumDefinitions: NodeDefinitions = {Output: {output_node: true, input: {required: {text: [['A', 'B']]}}}};
    for(const overrides of [[], [{target: {node: '1', input: 'text'}, value: 42}]]) {
        const catalog = catalogConfig.assert({...base, overrides});
        const graph = validateGraph(source, catalog);
        assert.equal(selectOutput(graph, catalog, enumDefinitions), '1');
        assert.equal(applyCoordinate(graph, catalog.variations, [1])['1']!.inputs['text'], 'B');
        catalog.variations[0]!.values[1]!.value = 'missing';
        assert.throws(() => selectOutput(graph, catalog, enumDefinitions), /Incompatible/);
    }
});

const modelSource: ApiGraph = {'60:44': {class_type: 'Loader', inputs: {unet_name: 'Anima/{{model}}.safetensors'}}};
const modelDefinitions: NodeDefinitions = {Loader: {output_node: true, input: {required: {
    unet_name: [['Anima/base.safetensors', 'Anima/tuned.safetensors']],
}}}};
const modelCatalog = {...base, variations: [
    {name: 'Model', target: {node: '60:44', input: 'unet_name', placeholder: '{{model}}'}, values: ['base', 'tuned']},
]};

test('enum validation accepts complete placeholder paths rather than candidate fragments', () => {
    const catalog = catalogConfig.assert(modelCatalog);
    const graph = validateGraph(modelSource, catalog);
    assert.equal(selectOutput(graph, catalog, modelDefinitions), '60:44');
    assert.equal(applyCoordinate(graph, catalog.variations, [1])['60:44']!.inputs['unet_name'], 'Anima/tuned.safetensors');
});

test('enum validation rejects an invalid final placeholder path', () => {
    const catalog = catalogConfig.assert(modelCatalog);
    catalog.variations[0]!.values[1]!.value = 'missing';
    assert.throws(() => selectOutput(validateGraph(modelSource, catalog), catalog, modelDefinitions),
        /Incompatible.*Anima\/missing\.safetensors/);
});

test('enum validation combines every placeholder on an overridden input', () => {
    const catalog = catalogConfig.assert({...modelCatalog,
        overrides: [{target: {node: '60:44', input: 'unet_name'}, value: '{{family}}/{{model}}-{{model}}.safetensors'}],
        variations: [...modelCatalog.variations,
            {name: 'Family', target: {node: '60:44', input: 'unet_name', placeholder: '{{family}}'}, values: ['Anima', 'Other']},
        ],
    });
    const enumDefinitions: NodeDefinitions = {Loader: {output_node: true, input: {required: {unet_name: [[
        'Anima/base-base.safetensors', 'Other/base-base.safetensors',
        'Anima/tuned-tuned.safetensors', 'Other/tuned-tuned.safetensors',
    ]]}}}};
    const graph = validateGraph(modelSource, catalog);
    assert.equal(selectOutput(graph, catalog, enumDefinitions), '60:44');
    assert.equal(applyCoordinate(graph, catalog.variations, [1, 0])['60:44']!.inputs['unet_name'], 'Anima/tuned-tuned.safetensors');
    enumDefinitions['Loader']!.input!.required!['unet_name'] = [['Anima/base-base.safetensors', 'Other/tuned-tuned.safetensors']];
    assert.throws(() => selectOutput(graph, catalog, enumDefinitions), /Incompatible.*Other\/base-base\.safetensors/);
});

test('enum validation does not recursively replace placeholder text in candidates', () => {
    const catalog = catalogConfig.assert({...modelCatalog,
        overrides: [{target: {node: '60:44', input: 'unet_name'}, value: '{{family}}/{{model}}.safetensors'}],
        variations: [
            {name: 'Family', target: {node: '60:44', input: 'unet_name', placeholder: '{{family}}'}, values: ['{{model}}']},
            {...modelCatalog.variations[0], values: ['base']},
        ],
    });
    const enumDefinitions: NodeDefinitions = {Loader: {output_node: true, input: {required: {
        unet_name: [['{{model}}/base.safetensors']],
    }}}};
    const graph = validateGraph(modelSource, catalog);
    assert.equal(selectOutput(graph, catalog, enumDefinitions), '60:44');
    assert.equal(applyCoordinate(graph, catalog.variations, [0, 0])['60:44']!.inputs['unet_name'], '{{model}}/base.safetensors');
});

test('fingerprints include overrides and source values, and normalize candidate notation', () => {
    const catalog = catalogConfig.assert({...base, overrides: [{target: {node: '1', input: 'seed'}, value: 42}]});
    const fingerprint = newMetadata(catalog, source, '1').fingerprint;
    const explicit = catalogConfig.assert({...catalog, variations: [{...catalog.variations[0], values: [{value: 'A'}, {value: 'B', category: 'C'}]}]});
    assert.equal(newMetadata(explicit, source, '1').fingerprint, fingerprint);
    const changed = structuredClone(catalog);
    changed.overrides![0]!.value = 43;
    assert.notEqual(newMetadata(changed, source, '1').fingerprint, fingerprint);
    const changedSource = structuredClone(source);
    changedSource['1']!.inputs['seed'] = 2;
    assert.notEqual(newMetadata(catalog, changedSource, '1').fingerprint, fingerprint);
});
