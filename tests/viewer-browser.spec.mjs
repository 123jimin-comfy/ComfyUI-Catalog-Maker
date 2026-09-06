/* global document, innerWidth */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import process from 'node:process';
import {test} from 'node:test';
import {pathToFileURL, URL} from 'node:url';

// Optional browser check using an existing Playwright installation; no frontend build.
test('viewer browser: mobile layout, comparisons, modal, batches, keyboard and load states', {skip: !process.env.PLAYWRIGHT_MODULE}, async () => {
    const {chromium} = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
    const variations = [
        {name: 'Character', values: [{value: 'a', label: 'Alpha', category: 'First'}, {value: 'b', label: 'Beta', category: 'Second'}]},
        {name: 'Gesture', values: [{value: 'standing'}, {value: 'sitting'}, {value: 'waving'}]},
        {name: 'CFG', values: [{value: 4}, {value: 7}]},
    ];
    const data = {version: 1, id: 'demo', name: 'Demo', variations, entries: {}};
    for(let a = 0; a < 2; a++) for(let b = 0; b < 3; b++) for(let c = 0; c < 2; c++) {
        if(a === 1 && b === 2) continue;
        const coordinate = [a, b, c], key = coordinate.join('-');
        data.entries[key] = {coordinate, images: [0, 1].map((index) => ({index, file: `${key}.${index}.png`}))};
    }
    const single = {version: 1, id: 'single', name: 'Single', variations: [variations[0]], entries: Object.fromEntries(variations[0].values.map((_, index) => [String(index), {
        coordinate: [index], images: [{index: 0, file: `${index}.0.png`}],
    }]))};
    const server = createServer(async (request, response) => {
        try {
            const url = new URL(request.url, 'http://localhost');
            if(url.pathname === '/catalogs.json') {
                response.setHeader('Content-Type', 'application/json');
                response.end(JSON.stringify({version: 1, catalogs: [{name: 'Demo', metadata: 'demo/metadata.json'}, {name: 'Empty', metadata: 'empty/metadata.json'}, {name: 'Invalid', metadata: 'invalid/metadata.json'}, {name: 'Single', metadata: 'single/metadata.json'}]}));
            } else if(url.pathname.endsWith('metadata.json')) {
                response.setHeader('Content-Type', 'application/json');
                response.end(JSON.stringify(url.pathname.startsWith('/invalid') ? {} : url.pathname.startsWith('/empty') ? {...data, entries: {}} : url.pathname.startsWith('/single') ? single : data));
            } else if(url.pathname.endsWith('.png')) {
                response.setHeader('Content-Type', 'image/svg+xml');
                response.end('<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><rect width="512" height="512" fill="#354b63"/><circle cx="256" cy="230" r="120" fill="#8ec5d5"/></svg>');
            } else {
                const asset = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
                if(!['index.html', 'assets/app.js', 'assets/catalog.js', 'assets/view.js', 'assets/style.css'].includes(asset)) {
                    response.writeHead(404).end();
                    return;
                }
                response.setHeader('Content-Type', asset.endsWith('.js') ? 'text/javascript' : asset.endsWith('.css') ? 'text/css' : 'text/html');
                response.end(await readFile(new URL(`../static/${asset}`, import.meta.url)));
            }
        } catch{ response.writeHead(500).end(); }
    });
    await new Promise((resolve) => { server.listen(0, '127.0.0.1', resolve); });
    let browser;
    try {
        browser = await chromium.launch({headless: true});
        const page = await browser.newPage({viewport: {width: 390, height: 844}});
        const errors = [];
        page.on('pageerror', (error) => errors.push(error.message));
        await page.goto(`http://127.0.0.1:${server.address().port}/`);
        await page.locator('.image-button').first().waitFor();
        assert.deepEqual(await page.locator('#catalog-select option').allTextContents(), ['Demo', 'Empty', 'Invalid', 'Single']);
        assert.equal(await page.locator('.image-button').count(), 5);
        assert.deepEqual(await page.locator('.caption').allTextContents(), [
            'Character: Alpha · Gesture: standing', 'Character: Alpha · Gesture: sitting', 'Character: Alpha · Gesture: waving',
            'Character: Beta · Gesture: standing', 'Character: Beta · Gesture: sitting',
        ]);
        await page.locator('.image-button img').first().evaluate((image) => image.decode());
        assert.deepEqual(await page.locator('.image-button img').first().evaluate((image) => [image.naturalWidth, image.naturalHeight]), [512, 512]);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        await page.locator('.image-button').first().click();
        assert.equal(await page.locator('dialog').evaluate((node) => node.open), true);
        await page.keyboard.press('ArrowDown');
        assert.match(await page.locator('#batch-controls').innerText(), /Image 2\/2/);
        await page.keyboard.press('ArrowRight');
        assert.equal(await page.locator('#image-position').innerText(), '2/5');
        assert.match(await page.locator('#full-image').getAttribute('src'), /\/0-1-0\.1\.png$/);
        await page.keyboard.press('Escape');
        assert.equal(await page.locator('dialog').evaluate((node) => node.open), false);
        assert.equal(await page.locator('.image-button').first().evaluate((node) => node === document.activeElement), true);
        await page.getByLabel('View', {exact: true}).selectOption('matrix');
        assert.deepEqual(await page.locator('thead th[scope="col"]').allTextContents(), ['Alpha', 'Beta']);
        assert.deepEqual(await page.locator('tbody th[scope="row"]').allTextContents(), ['standing', 'sitting', 'waving']);
        assert.deepEqual(await page.locator('tbody tr').nth(1).locator('.image-button img').evaluateAll((images) => images.map((image) => new URL(image.src).pathname)), ['/demo/0-1-0.0.png', '/demo/1-1-0.0.png']);
        await page.locator('.image-button').first().focus();
        await page.keyboard.press('ArrowRight');
        assert.equal(await page.getByRole('button', {name: 'Character: Beta · Gesture: standing · CFG: 4', exact: true}).evaluate((node) => node === document.activeElement), true);
        await page.keyboard.press('ArrowDown');
        assert.equal(await page.getByRole('button', {name: 'Character: Beta · Gesture: sitting · CFG: 4', exact: true}).evaluate((node) => node === document.activeElement), true);
        assert.equal(await page.locator('.missing').count(), 1);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        await page.locator('#filters summary').click();
        await page.getByLabel('Beta', {exact: true}).uncheck();
        assert.deepEqual(await page.locator('thead th[scope="col"]').allTextContents(), ['Alpha']);
        await page.getByLabel('Beta', {exact: true}).check();
        await page.getByLabel('Category', {exact: true}).selectOption('1');
        assert.deepEqual(await page.locator('thead th[scope="col"]').allTextContents(), ['Beta']);
        await page.locator('fieldset').first().getByRole('button', {name: 'None', exact: true}).click();
        assert.equal(await page.locator('.image-button').count(), 0);
        assert.match(await page.locator('#status').innerText(), /No results/);
        await page.locator('fieldset').first().getByRole('button', {name: 'All', exact: true}).click();
        await page.locator('#filters summary').click();
        await page.getByLabel('View', {exact: true}).selectOption('row');
        await page.getByRole('button', {name: 'Next row', exact: true}).click();
        assert.deepEqual(await page.locator('tbody th[scope="row"]').allTextContents(), ['sitting']);
        assert.deepEqual(await page.locator('.image-button img').evaluateAll((images) => images.map((image) => new URL(image.src).pathname)), ['/demo/0-1-0.0.png', '/demo/1-1-0.0.png']);
        await page.getByRole('button', {name: 'Previous row', exact: true}).focus();
        await page.keyboard.press('[');
        assert.deepEqual(await page.locator('tbody th[scope="row"]').allTextContents(), ['standing']);
        await page.getByLabel('View', {exact: true}).selectOption('column');
        await page.getByRole('button', {name: 'Next column', exact: true}).click();
        assert.deepEqual(await page.locator('thead th[scope="col"]').allTextContents(), ['Beta']);
        assert.deepEqual(await page.locator('.image-button img').evaluateAll((images) => images.map((image) => new URL(image.src).pathname)), ['/demo/1-0-0.0.png', '/demo/1-1-0.0.png']);
        await page.getByLabel('CFG', {exact: true}).selectOption('1');
        assert.equal(await page.locator('#context').innerText(), 'CFG: 7');
        await page.getByLabel('View', {exact: true}).selectOption('matrix');
        await page.getByRole('button', {name: 'Swap axes'}).click();
        assert.deepEqual(await page.locator('thead th[scope="col"]').allTextContents(), ['standing', 'sitting', 'waving']);
        assert.deepEqual(await page.locator('tbody th[scope="row"]').allTextContents(), ['Alpha', 'Beta']);
        if(process.env.VIEWER_SCREENSHOT) await page.screenshot({path: process.env.VIEWER_SCREENSHOT, fullPage: true});
        await page.setViewportSize({width: 1440, height: 900});
        await page.getByLabel('View', {exact: true}).selectOption('gallery');
        assert.equal(await page.locator('.caption').first().innerText(), 'Gesture: standing · Character: Alpha');
        await page.locator('.image-button').first().focus();
        await page.keyboard.press('ArrowRight');
        assert.equal(await page.locator('.image-button').nth(1).evaluate((node) => node === document.activeElement), true);
        await page.keyboard.press('Enter');
        assert.equal(await page.locator('dialog').evaluate((node) => node.open), true);
        await page.getByRole('button', {name: 'Close', exact: true}).click();
        await page.route('**/demo/0-0-0.0.png', (route) => route.abort());
        await page.reload();
        await page.locator('.image-error').waitFor();
        await page.locator('.image-button').first().click();
        await page.locator('#full-error').waitFor();
        await page.getByRole('button', {name: 'Close', exact: true}).click();
        await page.locator('#catalog-select').selectOption('1');
        await page.waitForFunction(() => document.querySelector('#status').textContent.includes('No completed'));
        await page.locator('#catalog-select').selectOption('2');
        await page.waitForFunction(() => document.querySelector('#status').classList.contains('error'));
        await page.locator('#catalog-select').selectOption('3');
        await page.getByRole('button', {name: 'Character: Alpha', exact: true}).waitFor();
        assert.deepEqual(await page.locator('.caption').allTextContents(), ['Character: Alpha', 'Character: Beta']);
        assert.equal(await page.getByLabel('View', {exact: true}).count(), 0);
        assert.equal(await page.locator('#context').innerText(), '');
        await page.getByRole('button', {name: 'Character: Alpha', exact: true}).click();
        await page.keyboard.press('ArrowRight');
        assert.match(await page.locator('#full-image').getAttribute('src'), /\/single\/1\.0\.png$/);
        assert.equal(await page.getByRole('button', {name: 'Next image', exact: true}).isDisabled(), true);
        await page.keyboard.press('Escape');
        await page.locator('#filters summary').click();
        await page.getByLabel('Alpha', {exact: true}).uncheck();
        assert.deepEqual(await page.locator('.caption').allTextContents(), ['Character: Beta']);
        assert.deepEqual(errors, []);
    } finally {
        await browser?.close();
        await new Promise((resolve) => { server.close(resolve); });
    }
});
