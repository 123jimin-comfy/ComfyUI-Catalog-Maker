import assert from 'node:assert/strict';
import {test} from 'node:test';

import {createView, planView} from '../static/assets/view.js';

function fixture(sizes = [12, 15, 2]) {
    return {variations: sizes.map((size, axis) => ({name: `Axis ${axis}`, values: Array.from({length: size}, (_, value) => ({value}))})), entries: {
        '0-0-0': {coordinate: [0, 0, 0], images: [{index: 0, file: '0-0-0.0.png'}, {index: 1, file: '0-0-0.1.png'}]},
    }};
}

test('matrix retains all coordinates, alignment and missing combinations', () => {
    const catalog = fixture();
    const state = createView(catalog);
    state.mode = 'matrix';
    const view = planView(catalog, state);
    assert.deepEqual(view.cells.map((cell) => cell.coordinate), Array.from({length: 15}, (_, row) => Array.from({length: 12}, (_, column) => [column, row, 0])).flat());
    assert.deepEqual(view.cells[0].coordinate, [0, 0, 0]);
    assert.equal(view.cells[0].entry.images.length, 2);
    assert.equal(view.cells[1].entry, void 0);
});

test('filtered comparisons retain numeric order, chosen axes and fixed dimensions', () => {
    const catalog = fixture();
    const state = createView(catalog);
    state.mode = 'matrix';
    state.allowed[0] = [2, 10];
    state.allowed[1] = [1, 4];
    state.fixed[2] = 1;
    assert.deepEqual(planView(catalog, state).cells.map((cell) => cell.coordinate), [[2, 1, 1], [10, 1, 1], [2, 4, 1], [10, 4, 1]]);
    [state.rowAxis, state.columnAxis] = [0, 1];
    assert.deepEqual(planView(catalog, state).cells.map((cell) => cell.coordinate), [[2, 1, 1], [2, 4, 1], [10, 1, 1], [10, 4, 1]]);
});

test('single row and column respect selected values and empty filters', () => {
    const catalog = fixture();
    const state = createView(catalog);
    state.mode = 'row';
    state.fixed[1] = 10;
    assert.deepEqual(planView(catalog, state).cells.map((cell) => cell.coordinate), Array.from({length: 12}, (_, column) => [column, 10, 0]));
    state.mode = 'column';
    state.fixed[0] = 9;
    assert.deepEqual(planView(catalog, state).cells.map((cell) => cell.coordinate), Array.from({length: 15}, (_, row) => [9, row, 0]));
    state.allowed[0] = [];
    assert.equal(planView(catalog, state).cells.length, 0);
});

test('one-dimensional gallery retains all results and supports filtering', () => {
    const catalog = fixture([100]);
    catalog.entries = Object.fromEntries(Array.from({length: 100}, (_, index) => [String(index), {coordinate: [index], images: [{index: 0, file: `${index}.0.png`}]}]));
    const state = createView(catalog);
    assert.deepEqual(planView(catalog, state).cells.map((cell) => cell.coordinate), Array.from({length: 100}, (_, index) => [index]));
    state.allowed[0] = [99];
    assert.deepEqual(planView(catalog, state).cells[0].coordinate, [99]);
    state.mode = 'matrix';
    assert.deepEqual(planView(catalog, state).cells.map((cell) => cell.coordinate), [[99]]);
});
