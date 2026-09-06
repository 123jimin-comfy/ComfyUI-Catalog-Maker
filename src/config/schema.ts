import {type Type, type} from 'arktype';

export type JsonValue = null | boolean | number | string | JsonValue[] | {[key: string]: JsonValue};

function isJson(value: unknown): boolean {
    if(value === null || typeof value === 'string' || typeof value === 'boolean') return true;
    if(typeof value === 'number') return Number.isFinite(value);
    if(Array.isArray(value)) return value.every(isJson);
    return typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype && Object.values(value).every(isJson);
}

export const jsonValue: Type<JsonValue> = type('unknown').narrow((value, ctx): value is JsonValue => isJson(value) || ctx.mustBe('a finite JSON value'));

export const candidateValue = type({"value": jsonValue, 'label?': 'string', 'category?': 'string', '+': 'reject'});
export const candidateValueInput = candidateValue.or(type('string').narrow((value, ctx) =>
    value.split('/').length <= 2 || ctx.mustBe('a candidate string with at most one "/"'))
    .pipe((value): typeof candidateValue.infer => {
        const slash = value.indexOf('/');
        return slash < 0 ? {value} : {category: value.slice(0, slash), value: value.slice(slash + 1)};
    }));
export const nodeOverride = type({
    "target": {"node": 'string > 0', "input": 'string > 0', '+': 'reject'},
    "value": jsonValue,
    '+': 'reject',
});
export const variation = type({
    "name": 'string > 0',
    "target": {"node": 'string > 0', "input": 'string > 0', 'placeholder?': 'string > 0', '+': 'reject'},
    "values": candidateValue.array().atLeastLength(1),
    '+': 'reject',
});
export const catalogConfig = type({
    "id": 'string > 0', "name": 'string > 0', "workflow": 'string > 0',
    'output_node?': 'string > 0', 'overrides?': nodeOverride.array(),
    "variations": variation.omit('values').merge({values: candidateValueInput.array().atLeastLength(1)}).array().atLeastLength(1), '+': 'reject',
});
export const backendConfig = type({
    "comfy": {"url": 'string > 0', 'auth?': {"username": 'string', "password": 'string', '+': 'reject'}, '+': 'reject'},
    '+': 'reject',
});

export type CatalogConfig = typeof catalogConfig.infer;
export type BackendConfig = typeof backendConfig.infer;
export type Variation = typeof variation.infer;
