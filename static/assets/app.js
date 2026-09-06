import {candidateText, combinationCount, orderedEntries, readCatalog, readCatalogList} from './catalog.js';

const select = document.getElementById('catalog-select');
const title = document.getElementById('catalog-title');
const summary = document.getElementById('catalog-summary');
const status = document.getElementById('status');
const gallery = document.getElementById('gallery');
let currentLoad;

function element(tag, text = '', className = '') {
    const node = document.createElement(tag);
    node.textContent = text;
    if(className) node.className = className;
    return node;
}

function showStatus(message, error = false) {
    status.textContent = message;
    status.hidden = !message;
    status.classList.toggle('error', error);
}

async function fetchJSON(url, signal) {
    const response = await fetch(url, {signal, cache: 'no-cache'});
    if(!response.ok) throw new Error(`Could not load ${url.pathname} (HTTP ${response.status}).`);
    return response.json();
}

function renderEntry(catalog, entry, metadataURL) {
    const card = element('article', '', 'entry');
    const key = entry.coordinate.join('-');
    const images = element('div', '', 'entry-images');
    for(const image of entry.images) {
        const figure = element('figure');
        const link = element('a', '', 'image-link');
        link.href = new URL(image.file, metadataURL).href;
        link.target = '_blank';
        link.rel = 'noopener';
        const img = element('img');
        img.loading = 'lazy';
        img.decoding = 'async';
        img.alt = `${catalog.name}, coordinate ${key}, image ${image.index}`;
        img.addEventListener('error', () => {
            img.hidden = true;
            link.append(element('span', `Image unavailable: ${image.file}`, 'image-error'));
        }, {once: true});
        img.src = link.href;
        link.append(img);
        figure.append(link, element('figcaption', `Image ${image.index} · ${image.file}`));
        images.append(figure);
    }
    const details = element('div', '', 'entry-details');
    details.append(element('h2', `Coordinate ${key}`, 'coordinate'));
    const values = element('dl');
    entry.coordinate.forEach((index, axis) => {
        const variation = catalog.variations[axis];
        const candidate = variation.values[index];
        const row = element('div', '', 'variation');
        const value = element('dd', candidateText(candidate));
        if(typeof candidate.category === 'string') value.append(element('span', candidate.category, 'category'));
        row.append(element('dt', variation.name), value);
        values.append(row);
    });
    details.append(values);
    card.append(images, details);
    return card;
}

async function loadCatalog(item) {
    currentLoad?.abort();
    const controller = new AbortController();
    currentLoad = controller;
    gallery.replaceChildren();
    title.textContent = item.name;
    summary.textContent = '';
    showStatus('Loading catalog…');
    gallery.setAttribute('aria-busy', 'true');
    try {
        const catalog = readCatalog(await fetchJSON(item.url, controller.signal));
        if(currentLoad !== controller) return;
        title.textContent = catalog.name;
        document.title = `${catalog.name} · ComfyUI Catalog`;
        const entries = orderedEntries(catalog);
        const imageCount = entries.reduce((total, entry) => total + entry.images.length, 0);
        summary.textContent = `${entries.length.toLocaleString()} / ${combinationCount(catalog)} combinations complete · ${imageCount.toLocaleString()} images · ${catalog.variations.length} variations`;
        const fragment = document.createDocumentFragment();
        for(const entry of entries) fragment.append(renderEntry(catalog, entry, item.url));
        gallery.append(fragment);
        showStatus(entries.length ? '' : 'No completed images yet. Reload after generation completes an entry.');
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
        if(catalogs.length === 0) {
            select.append(element('option', 'No catalogs'));
            showStatus('No catalogs are listed.');
            return;
        }
        catalogs.forEach((catalog, index) => {
            const option = element('option', `${index + 1}. ${catalog.name}`);
            option.value = String(index);
            select.append(option);
        });
        select.disabled = false;
        select.addEventListener('change', () => { void loadCatalog(catalogs[Number(select.value)]); });
        await loadCatalog(catalogs[0]);
    } catch (error) {
        select.replaceChildren(element('option', 'Catalog list unavailable'));
        showStatus(error.message, true);
    }
}

void start();
