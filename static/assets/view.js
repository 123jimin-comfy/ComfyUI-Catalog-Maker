import {orderedEntries} from './catalog.js';

export function createView(catalog) {
    return {
        mode: 'gallery', rowAxis: 0, columnAxis: catalog.variations.length > 1 ? 1 : -1,
        fixed: catalog.variations.map(() => 0),
        allowed: catalog.variations.map((variation) => variation.values.map((_, index) => index)),
        page: 0, rowPage: 0, columnPage: 0,
    };
}

function pageOf(values, page, size) {
    const pages = Math.max(1, Math.ceil(values.length / size));
    const current = Math.max(0, Math.min(page, pages - 1));
    return {values: values.slice(current * size, (current + 1) * size), page: current, pages};
}

/** A bounded render plan independent of DOM presentation. */
export function planView(catalog, state) {
    const allowed = state.allowed.map((indices) => new Set(indices));
    if(state.mode === 'gallery' || state.columnAxis < 0) {
        const entries = orderedEntries(catalog).filter((entry) => entry.coordinate.every((value, axis) => allowed[axis].has(value)
            && (axis === state.rowAxis || axis === state.columnAxis || value === state.fixed[axis])));
        const page = pageOf(entries, state.page, 48);
        return {cells: page.values.map((entry) => ({coordinate: entry.coordinate, entry})), page: page.page, pages: page.pages};
    }
    const axisValues = (axis) => catalog.variations[axis].values.map((_, index) => index).filter((index) => allowed[axis].has(index));
    const rows = pageOf(axisValues(state.rowAxis).filter((index) => state.mode !== 'row' || index === state.fixed[state.rowAxis]), state.rowPage, 8);
    const columns = pageOf(axisValues(state.columnAxis).filter((index) => state.mode !== 'column' || index === state.fixed[state.columnAxis]), state.columnPage, 6);
    const fixedAllowed = state.fixed.every((value, axis) => axis === state.rowAxis || axis === state.columnAxis || allowed[axis].has(value));
    const cells = [];
    if(fixedAllowed) for(const row of rows.values) for(const column of columns.values) {
        const coordinate = [...state.fixed];
        coordinate[state.rowAxis] = row;
        coordinate[state.columnAxis] = column;
        cells.push({coordinate, entry: catalog.entries[coordinate.join('-')]});
    }
    return {cells, rows: rows.values, columns: columns.values, rowPage: rows.page, rowPages: rows.pages, columnPage: columns.page, columnPages: columns.pages};
}
