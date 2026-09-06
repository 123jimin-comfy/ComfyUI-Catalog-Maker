import {candidateText, readCatalog, readCatalogList} from './catalog.js';
import {createView, planView} from './view.js';

const byId = (id) => document.getElementById(id);
const select = byId('catalog-select');
const gallery = byId('gallery');
const dialog = byId('image-viewer');
let currentLoad, catalog, metadataURL, state, plan;
let visibleEntries = [], activeEntry = 0, activeBatch = 0, opener;

function element(tag, text = '', className = '') {
    const node = document.createElement(tag);
    node.textContent = text;
    if(className) node.className = className;
    return node;
}
function button(text, action, label = text) {
    const node = element('button', text);
    node.type = 'button';
    node.setAttribute('aria-label', label);
    node.addEventListener('click', action);
    return node;
}
function picker(label, options, value, change) {
    const wrap = element('label', label + ' ');
    const input = element('select');
    input.setAttribute('aria-label', label);
    for(const [key, text] of options) {
        const option = element('option', text);
        option.value = String(key);
        input.append(option);
    }
    input.value = String(value);
    input.addEventListener('change', () => change(input.value));
    wrap.append(input);
    return wrap;
}
function showStatus(message, error = false) {
    const status = byId('status');
    status.textContent = message;
    status.hidden = !message;
    status.classList.toggle('error', error);
}
function labelFor(axis, index) {
    const values = catalog.variations[axis].values;
    const text = candidateText(values[index]);
    // Only repeated/empty labels need an index to stay distinguishable.
    return !text || values.some((value, other) => other !== index && candidateText(value) === text) ? `${text || '(empty)'} [${index + 1}]` : text;
}
function caption(coordinate, axes = catalog.variations.map((_, axis) => axis)) {
    return axes.map((axis) => `${catalog.variations[axis].name}: ${labelFor(axis, coordinate[axis])}`).join(' · ');
}
function resetPages() {
    state.page = state.rowPage = state.columnPage = 0;
}
function update() {
    resetPages();
    renderControls();
    render();
}
function moveSlice(delta) {
    const axis = state.mode === 'row' ? state.rowAxis : state.mode === 'column' ? state.columnAxis : -1;
    if(axis < 0) return;
    const values = state.allowed[axis];
    const index = values.indexOf(state.fixed[axis]);
    const next = values[index + delta];
    if(next !== void 0) {
        state.fixed[axis] = next;
        update();
    }
}
function renderControls() {
    const controls = byId('controls');
    controls.replaceChildren();
    const axes = catalog.variations.map((variation, axis) => [axis, variation.name]);
    if(axes.length > 1) {
        controls.append(picker('View', [['gallery', 'Gallery'], ['matrix', 'Matrix'], ['row', 'Row'], ['column', 'Column']], state.mode, (value) => {
            state.mode = value;
            update();
        }));
        for(const [key, other, name] of [['columnAxis', 'rowAxis', 'Columns'], ['rowAxis', 'columnAxis', 'Rows']]) {
            controls.append(picker(name, axes, state[key], (value) => {
                const previous = state[key];
                state[key] = Number(value);
                if(state[other] === state[key]) state[other] = previous;
                update();
                renderFilters();
            }));
        }
        controls.append(button('Swap', () => {
            [state.rowAxis, state.columnAxis] = [state.columnAxis, state.rowAxis];
            update();
            renderFilters();
        }, 'Swap axes'));
    }
    catalog.variations.forEach((variation, axis) => {
        const fixed = axis !== state.rowAxis && axis !== state.columnAxis;
        const slice = (state.mode === 'row' && axis === state.rowAxis) || (state.mode === 'column' && axis === state.columnAxis);
        if(fixed || slice) controls.append(picker(variation.name, state.allowed[axis].map((index) => [index, labelFor(axis, index)]), state.fixed[axis], (value) => {
            state.fixed[axis] = Number(value);
            update();
        }));
    });
    if(state.mode === 'row' || state.mode === 'column') {
        const axis = state.mode === 'row' ? state.rowAxis : state.columnAxis;
        for(const [delta, text] of [[-1, 'Previous'], [1, 'Next']]) {
            const node = button(`${text} ${state.mode}`, () => moveSlice(delta));
            node.disabled = state.allowed[axis][state.allowed[axis].indexOf(state.fixed[axis]) + delta] === void 0;
            controls.append(node);
        }
    }
}
function renderFilters() {
    byId('filters').hidden = false;
    const fields = byId('filter-fields');
    fields.replaceChildren();
    catalog.variations.forEach((variation, axis) => {
        const field = element('fieldset');
        field.append(element('legend', variation.name));
        const actions = element('div', '', 'toolbar');
        const setAllowed = (indices) => {
            state.allowed[axis] = indices;
            if(!indices.includes(state.fixed[axis])) state.fixed[axis] = indices[0] ?? 0;
            update();
            renderFilters();
        };
        actions.append(button('All', () => setAllowed(variation.values.map((_, index) => index))), button('None', () => setAllowed([])));
        const categories = [...new Set(variation.values.map((value) => value.category))];
        if(categories.some((category) => category !== void 0)) {
            actions.append(picker('Category', [['', 'Choose…'], ...categories.map((category, index) => [index, category ?? '(uncategorized)'])], '', (value) => {
                if(value !== '') setAllowed(variation.values.flatMap((candidate, index) => candidate.category === categories[Number(value)] ? [index] : []));
            }));
        }
        const search = element('input');
        search.type = 'search';
        search.placeholder = 'Find values';
        search.setAttribute('aria-label', `Find ${variation.name} values`);
        const choices = element('div', '', 'choices');
        variation.values.forEach((candidate, index) => {
            const label = element('label');
            const check = element('input');
            check.type = 'checkbox';
            check.checked = state.allowed[axis].includes(index);
            check.addEventListener('change', () => {
                state.allowed[axis] = variation.values.flatMap((_, i) => (i === index ? check.checked : state.allowed[axis].includes(i)) ? [i] : []);
                if(!state.allowed[axis].includes(state.fixed[axis])) state.fixed[axis] = state.allowed[axis][0] ?? 0;
                update();
            });
            label.append(check, element('span', labelFor(axis, index)));
            label.title = `${candidateText({value: candidate.value})}${candidate.category === void 0 ? '' : ` · ${candidate.category}`}`;
            choices.append(label);
        });
        search.addEventListener('input', () => {
            for(const label of choices.children) label.hidden = !label.textContent.toLowerCase().includes(search.value.toLowerCase());
        });
        field.append(actions, search, choices);
        fields.append(field);
    });
}
function renderCell(cell, matrix = false) {
    const card = element('article', '', 'entry');
    if(!cell.entry) {
        card.append(element('span', 'Not generated', 'missing'));
        card.setAttribute('aria-label', `${caption(cell.coordinate)}: not generated`);
        return card;
    }
    const entryIndex = visibleEntries.length;
    visibleEntries.push(cell.entry);
    const open = button('', () => openImage(entryIndex, 0, open), caption(cell.coordinate));
    open.className = 'image-button';
    const image = element('img');
    image.loading = 'lazy';
    image.decoding = 'async';
    image.alt = caption(cell.coordinate);
    image.addEventListener('error', () => {
        image.hidden = true;
        open.append(element('span', 'Image unavailable', 'image-error'));
    }, {once: true});
    image.src = new URL(cell.entry.images[0].file, metadataURL).href;
    open.append(image);
    card.append(open);
    if(!matrix) card.append(element('p', caption(cell.coordinate, [state.columnAxis, state.rowAxis].filter((axis) => axis >= 0)), 'caption'));
    if(cell.entry.images.length > 1) {
        const batch = button(`${cell.entry.images.length} images`, () => openImage(entryIndex, 0, batch), `View ${cell.entry.images.length} batch images: ${caption(cell.coordinate)}`);
        batch.className = 'batch-button';
        card.append(batch);
    }
    return card;
}
function pagination(label, key, page, pages) {
    if(pages <= 1) return;
    const group = element('div', '', 'page-group');
    const move = (delta) => {
        state[key] = page + delta;
        render();
    };
    const previous = button('←', () => move(-1), `Previous ${label} page`);
    const next = button('→', () => move(1), `Next ${label} page`);
    previous.disabled = page === 0;
    next.disabled = page + 1 === pages;
    group.append(previous, element('span', `${label} ${page + 1}/${pages}`), next);
    byId('paging').append(group);
}
function render() {
    plan = planView(catalog, state);
    gallery.replaceChildren();
    byId('paging').replaceChildren();
    visibleEntries = [];
    const fixedAxes = catalog.variations.map((_, axis) => axis).filter((axis) => axis !== state.rowAxis && axis !== state.columnAxis);
    byId('context').textContent = caption(state.fixed, fixedAxes);
    if(plan.rows) {
        gallery.className = 'matrix-scroll';
        const table = element('table');
        const head = element('thead');
        const row = element('tr');
        row.append(element('th', `${catalog.variations[state.rowAxis].name} ↓ / ${catalog.variations[state.columnAxis].name} →`, 'axis-corner'));
        for(const column of plan.columns) {
            const th = element('th', labelFor(state.columnAxis, column));
            th.scope = 'col';
            row.append(th);
        }
        head.append(row);
        table.append(head);
        const body = element('tbody');
        plan.rows.forEach((index, rowIndex) => {
            const tr = element('tr');
            const th = element('th', labelFor(state.rowAxis, index));
            th.scope = 'row';
            tr.append(th);
            plan.columns.forEach((_, columnIndex) => {
                const td = element('td');
                const cell = plan.cells[rowIndex * plan.columns.length + columnIndex];
                if(cell) td.append(renderCell(cell, true));
                tr.append(td);
            });
            body.append(tr);
        });
        table.append(body);
        gallery.append(table);
        pagination('Rows', 'rowPage', plan.rowPage, plan.rowPages);
        pagination('Columns', 'columnPage', plan.columnPage, plan.columnPages);
    } else {
        gallery.className = 'gallery';
        for(const cell of plan.cells) gallery.append(renderCell(cell));
        pagination('Page', 'page', plan.page, plan.pages);
    }
    showStatus(plan.cells.length ? '' : Object.keys(catalog.entries).length ? 'No results for these selections.' : 'No completed images yet. Reload after generation completes an entry.');
}
function openImage(index, batch = 0, source = opener) {
    activeEntry = index;
    activeBatch = batch;
    opener = source;
    const entry = visibleEntries[index];
    const image = entry.images[batch];
    const full = byId('full-image');
    full.hidden = false;
    byId('full-error').hidden = true;
    full.alt = `${caption(entry.coordinate)} · Image ${batch + 1}`;
    full.src = new URL(image.file, metadataURL).href;
    byId('image-caption').textContent = caption(entry.coordinate);
    byId('image-position').textContent = `${index + 1}/${visibleEntries.length}`;
    byId('previous-image').disabled = index === 0;
    byId('next-image').disabled = index === visibleEntries.length - 1;
    const batchControls = byId('batch-controls');
    batchControls.replaceChildren();
    if(entry.images.length > 1) {
        const previous = button('←', () => moveBatch(-1), 'Previous batch image');
        const next = button('→', () => moveBatch(1), 'Next batch image');
        previous.disabled = batch === 0;
        next.disabled = batch === entry.images.length - 1;
        batchControls.append(previous, element('span', `Image ${batch + 1}/${entry.images.length}`), next);
    }
    const details = byId('parameter-values');
    details.replaceChildren();
    entry.coordinate.forEach((candidateIndex, axis) => {
        const variation = catalog.variations[axis], candidate = variation.values[candidateIndex];
        details.append(element('dt', variation.name), element('dd', `${labelFor(axis, candidateIndex)}\nValue: ${candidateText({value: candidate.value})}${candidate.category === void 0 ? '' : `\nCategory: ${candidate.category}`}`));
    });
    if(!dialog.open) {
        dialog.showModal();
        document.body.classList.add('viewing-image');
    }
}
function moveImage(delta) {
    const index = activeEntry + delta;
    if(index >= 0 && index < visibleEntries.length) openImage(index, Math.min(activeBatch, visibleEntries[index].images.length - 1));
}
function moveBatch(delta) {
    const batch = activeBatch + delta;
    if(batch >= 0 && batch < visibleEntries[activeEntry].images.length) openImage(activeEntry, batch);
}
byId('close-image').addEventListener('click', () => dialog.close());
byId('previous-image').addEventListener('click', () => moveImage(-1));
byId('next-image').addEventListener('click', () => moveImage(1));
byId('full-image').addEventListener('error', () => {
    byId('full-image').hidden = true;
    byId('full-error').hidden = false;
});
dialog.addEventListener('close', () => {
    document.body.classList.remove('viewing-image');
    opener?.focus({preventScroll: true});
});
document.addEventListener('keydown', (event) => {
    if(event.ctrlKey || event.altKey || event.metaKey || ['INPUT', 'SELECT', 'TEXTAREA'].includes(event.target.tagName) || event.target.isContentEditable) return;
    if(dialog.open) {
        const actions = {ArrowLeft: () => moveImage(-1), ArrowRight: () => moveImage(1), ArrowUp: () => moveBatch(-1), ArrowDown: () => moveBatch(1)};
        if(actions[event.key]) {
            event.preventDefault();
            actions[event.key]();
        }
        return;
    }
    if(event.key === '?') {
        byId('shortcuts').open = !byId('shortcuts').open;
        return;
    }
    if(!state) return;
    if(event.key === '[' || event.key === ']') {
        event.preventDefault();
        moveSlice(event.key === '[' ? -1 : 1);
        return;
    }
    const buttons = [...gallery.querySelectorAll('.image-button')];
    const index = buttons.indexOf(document.activeElement);
    if(index < 0) return;
    if(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
        event.preventDefault();
        const current = buttons[index].getBoundingClientRect();
        const horizontal = event.key === 'ArrowLeft' || event.key === 'ArrowRight';
        const direction = event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1;
        const candidates = buttons.filter((node) => node !== buttons[index]).map((node) => {
            const rect = node.getBoundingClientRect();
            const along = horizontal ? rect.x - current.x : rect.y - current.y;
            const across = horizontal ? Math.abs(rect.y - current.y) : Math.abs(rect.x - current.x);
            return {node, along, across};
        }).filter((item) => item.along * direction > 1).sort((a, b) => (a.across - b.across) || Math.abs(a.along) - Math.abs(b.along));
        candidates[0]?.node.focus();
    }
});
async function fetchJSON(url, signal) {
    const response = await fetch(url, {signal, cache: 'no-cache'});
    if(!response.ok) throw new Error(`Could not load ${url.pathname} (HTTP ${response.status}).`);
    return response.json();
}
async function loadCatalog(item) {
    currentLoad?.abort();
    const controller = new AbortController();
    currentLoad = controller;
    if(dialog.open) dialog.close();
    state = null;
    catalog = null;
    gallery.replaceChildren();
    byId('controls').replaceChildren();
    byId('paging').replaceChildren();
    byId('context').textContent = '';
    byId('filters').hidden = true;
    showStatus('Loading catalog…');
    gallery.setAttribute('aria-busy', 'true');
    try {
        const data = readCatalog(await fetchJSON(item.url, controller.signal));
        if(currentLoad !== controller) return;
        catalog = data;
        metadataURL = item.url;
        state = createView(catalog);
        document.title = `${catalog.name} · ComfyUI Catalog`;
        renderControls();
        renderFilters();
        render();
    } catch (error) {
        if(currentLoad === controller && !controller.signal.aborted) showStatus(error.message, true);
    } finally {
        if(currentLoad === controller) gallery.setAttribute('aria-busy', 'false');
    }
}
async function start() {
    try {
        if(location.protocol === 'file:') throw new Error('Serve this directory over HTTP to browse catalogs. Opening a local HTML file directly is not supported.');
        const listURL = new URL('../catalogs.json', import.meta.url);
        const catalogs = readCatalogList(await fetchJSON(listURL), listURL);
        select.replaceChildren();
        if(!catalogs.length) {
            select.append(element('option', 'No catalogs'));
            showStatus('No catalogs are listed.');
            return;
        }
        catalogs.forEach((item, index) => {
            const option = element('option', item.name);
            option.value = String(index);
            select.append(option);
        });
        select.disabled = false;
        select.addEventListener('change', () => {
            void loadCatalog(catalogs[Number(select.value)]);
        });
        await loadCatalog(catalogs[0]);
    } catch (error) {
        select.replaceChildren(element('option', 'Catalog list unavailable'));
        showStatus(error.message, true);
    }
}
void start();
