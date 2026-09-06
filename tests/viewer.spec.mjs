import assert from 'node:assert/strict';
import {test} from 'node:test';
import {URL} from 'node:url';

import {candidateText, combinationCount, orderedEntries, readCatalog, readCatalogList} from '../static/assets/catalog.js';

function fixture() {
    const values = Array.from({length: 12}, (_, value) => ({value}));
    return {
        version: 1, id: 'test', name: 'Test',
        variations: [{name: 'A', values}, {name: 'B', values}],
        entries: Object.fromEntries([[10, 0], [2, 10], [2, 2]].map((coordinate) => [coordinate.join('-'), {
            coordinate, images: [0, 1].map((index) => ({index, file: `${coordinate.join('-')}.${index}.png`})),
        }])),
    };
}

test('viewer orders multidimensional coordinates numerically and retains every batch image', () => {
    const catalog = readCatalog(fixture());
    const entries = orderedEntries(catalog);
    assert.deepEqual(entries.map((entry) => entry.coordinate), [[2, 2], [2, 10], [10, 0]]);
    assert.equal(entries.flatMap((entry) => entry.images).length, 6);
    assert.equal(combinationCount(catalog), '144');
    catalog.entries = {};
    assert.deepEqual(orderedEntries(readCatalog(catalog)), []);
});

test('viewer preserves labels and renders structured values without invented descriptions', () => {
    assert.equal(candidateText({value: 0}), '0');
    assert.equal(candidateText({value: null}), 'null');
    assert.equal(candidateText({value: false}), 'false');
    assert.equal(candidateText({value: {a: [1, 'two']}}), '{"a":[1,"two"]}');
    assert.equal(candidateText({value: 'raw', label: ''}), '');
    assert.equal(candidateText({value: 'raw', label: '<img src=x onerror=alert(1)>'}), '<img src=x onerror=alert(1)>');
});

test('viewer resolves encoded catalog URLs beneath a hosting subdirectory', () => {
    const base = new URL('https://example.test/gallery/catalogs.json');
    const list = readCatalogList({version: 1, catalogs: [{name: 'A', metadata: 'catalogs/a%20%23%25/metadata.json'}]}, base);
    assert.equal(list[0].url.href, 'https://example.test/gallery/catalogs/a%20%23%25/metadata.json');
    assert.deepEqual(readCatalogList({version: 1, catalogs: []}, base), []);
    for(const metadata of ['../outside.json', '%2e%2e/outside.json', 'https://elsewhere.test/data.json', '/outside.json', 'a\\b.json', 'a%2fb.json', 'a.json#fragment']) {
        assert.throws(() => readCatalogList({version: 1, catalogs: [{name: 'A', metadata}]}, base));
    }
});

test('viewer rejects malformed data and unsafe image paths before rendering', () => {
    for(const change of [
        (c) => { c.version = 2; },
        (c) => { c.variations[0].values = []; },
        (c) => { c.entries['2-2'].coordinate = [2, 13]; },
        (c) => { c.entries['2-2'].images[0].file = '../image.png'; },
        (c) => { c.entries['2-2'].images = []; },
    ]) {
        const catalog = fixture();
        change(catalog);
        assert.throws(() => readCatalog(catalog));
    }
});
