import {orderedEntries} from './catalog.js';

export function createView(catalog) {
    return {
        mode: 'gallery', columnAxis: 0, rowAxis: catalog.variations.length > 1 ? 1 : -1,
        fixed: catalog.variations.map(() => 0),
        allowed: catalog.variations.map((variation) => variation.values.map((_, index) => index)),
    };
}

/** Complete coordinate plan; image loading is bounded by the viewport. */
export function planView(catalog, state) {
    const allowed = state.allowed.map((indices) => new Set(indices));
    if(state.mode === 'gallery' || state.rowAxis < 0 || state.columnAxis < 0) {
        const entries = orderedEntries(catalog).filter((entry) => entry.coordinate.every((value, axis) => allowed[axis].has(value)
            && (axis === state.rowAxis || axis === state.columnAxis || value === state.fixed[axis])));
        return {cells: entries.map((entry) => ({coordinate: entry.coordinate, entry}))};
    }
    const axisValues = (axis) => catalog.variations[axis].values.map((_, index) => index).filter((index) => allowed[axis].has(index));
    const rows = axisValues(state.rowAxis).filter((index) => state.mode !== 'row' || index === state.fixed[state.rowAxis]);
    const columns = axisValues(state.columnAxis).filter((index) => state.mode !== 'column' || index === state.fixed[state.columnAxis]);
    const fixedAllowed = state.fixed.every((value, axis) => axis === state.rowAxis || axis === state.columnAxis || allowed[axis].has(value));
    const cells = [];
    if(fixedAllowed) for(const row of rows) for(const column of columns) {
        const coordinate = [...state.fixed];
        coordinate[state.rowAxis] = row;
        coordinate[state.columnAxis] = column;
        cells.push({coordinate, entry: catalog.entries[coordinate.join('-')]});
    }
    return {cells, rows: fixedAllowed ? rows : [], columns: fixedAllowed ? columns : []};
}
