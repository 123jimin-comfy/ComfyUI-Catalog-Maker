import {PromptConfig} from "./config";

export interface CatalogCheckpoint {
    checkpoint: string;
    dir_names: string[];
    prompts: string[];
}

export interface Catalog {
    checkpoints: CatalogCheckpoint[];
    prompts: Array<Partial<PromptConfig> & Pick<PromptConfig, 'id'>>;
}