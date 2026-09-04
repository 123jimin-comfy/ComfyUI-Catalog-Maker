import {PatternMatchedParameterConfig} from "./parameter";

export interface FloatRange {
    type: 'float';

    min: number;
    max: number;
    num_steps: number;
}

export interface AxisValue {
    id: string;
    name?: string;
    group?: string;
    value: string|number;
}

export interface EnumRange {
    type: 'enum';

    values: Array<string|number>|Array<AxisValue>;
}

export type Range = FloatRange|EnumRange;

export interface CatalogAxisConfig {
    target: string; // Target parameter to modify.
    name?: string; // Display name for the axis. If not set, then the ID will be used.

    range?: Range;
}

export interface CatalogConfig {
    id: string; // Unique identifier for the catalog.
    name?: string; // Display name for the catalog. If not set, then the ID will be used.

    axes: CatalogAxisConfig[];
    parameters?: Array<Partial<PatternMatchedParameterConfig>>;
}