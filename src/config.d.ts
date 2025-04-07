export interface ComfyUIConfig {
    host: string;

    auth?: {
        username: string;
        password: string;
    }
}

export interface PromptConfig {
    id: string;
    group: string;
    prompt: string;
}

export interface ParameterConfig {
    pattern: string; // Wildcard pattern
    exclude: boolean; // Exclude from catalog if set to true.
    workflow: string; // Workflow ID to use.
    width: number; // Width of the image.
    height: number; // Height of the image.
    styles: string[]; // List of styles to apply.
    prompts: string[]; // List of prompts to generate.
}

export interface Config {
    comfy?: ComfyUIConfig;
    prompts?: Array<Partial<PromptConfig> & Pick<PromptConfig, 'id'>>;
    parameters?: Array<Partial<ParameterConfig>>;
}