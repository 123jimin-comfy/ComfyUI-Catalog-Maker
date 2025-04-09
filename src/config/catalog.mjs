//@ts-check

import { toFileName } from "../util.mjs";

/** @import {Client} from "../comfy-ui/index.mjs" */
/** @import {AxisValue, CatalogAxisConfig} from "./catalog" */

/**
 * Returns the values for the given axis config.
 * 
 * @param {Client} client 
 * @param {CatalogAxisConfig} axis_config
 * @returns {Promise<AxisValue[]>}
 */
export async function getCatalogAxisValues(client, axis_config) {
    if(axis_config.target === 'checkpoint' && !axis_config.range) {
        // Enumerate all checkpoints.

        return (await client.getSDModels()).map((model, index) => {
            return {
                id: `${index}`,
                value: model,
            };
        });
    }

    if(!axis_config.range) return [];

    switch(axis_config.range.type) {
        case 'enum': {
            return axis_config.range.values.map((/** @type {string | number | AxisValue} */ value, /** @type {number} */ index) => {
                switch(typeof value) {
                    case 'object': {
                        return value;
                    }
                    default: {
                        return {
                            id: `${index}`,
                            value,
                        };
                    }
                }
            });
        }
        case 'float': {
            const values = [];
            const delta = (axis_config.range.max - axis_config.range.min) / axis_config.range.num_steps;
            for(let i = 0; i <= axis_config.range.num_steps; i++) {
                if(i === axis_config.range.num_steps ) {
                    values.push(axis_config.range.max);
                } else {
                    values.push(axis_config.range.min + i * delta);
                }
            }

            return values.map((value, index) => {
                return {
                    id: `${index}`,
                    value,
                };
            });
        }
    }

    throw new Error(`Unknown range type: ${(/** @type {{type: string}} */ (axis_config.range)).type}`);
}