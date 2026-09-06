import assert from 'node:assert/strict';
import {test} from 'node:test';

import {candidateValueInput, catalogConfig} from './schema.ts';

test('candidate shorthand normalizes strings without coercion or trimming', () => {
    for(const [input, expected] of [
        ['V', {value: 'V'}], ['C/V', {category: 'C', value: 'V'}],
        ['42', {value: '42'}], ['', {value: ''}],
        ['/V', {category: '', value: 'V'}], ['C/', {category: 'C', value: ''}],
        [' C / V ', {category: ' C ', value: ' V '}],
    ] as const) assert.deepEqual(candidateValueInput.assert(input), expected);
    const explicit = {value: 'path/to/file', category: 'C/D', label: 'Label'};
    assert.deepEqual(candidateValueInput.assert(explicit), explicit);
    for(const input of ['A/B/C', '//', 'A/B/', '/A/B']) {
        assert.throws(() => candidateValueInput.assert(input), /at most one/);
    }
    for(const input of [42, true, {value: 'V', unknown: true}]) {
        assert.throws(() => candidateValueInput.assert(input));
    }
});

test('catalog normalizes mixed candidate forms and rejects malformed overrides', () => {
    const input = {id: 'test', name: 'Test', workflow: 'workflow.json', variations: [
        {name: 'Text', target: {node: '1', input: 'text'}, values: ['V', 'C/V', {value: 'W', label: 'Label'}]},
    ]};
    assert.deepEqual(catalogConfig.assert(input).variations[0]!.values, [
        {value: 'V'}, {value: 'V', category: 'C'}, {value: 'W', label: 'Label'},
    ]);
    for(const override of [
        {target: {node: '1', input: 'text', placeholder: 'V'}, value: 'W'},
        {target: {node: '', input: 'text'}, value: 'W'},
        {target: {node: '1', input: 'text'}},
    ]) assert.throws(() => catalogConfig.assert({...input, overrides: [override]}));
});
