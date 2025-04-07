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
    workflow: string; // Workflow ID to use. If not set, then the checkpoint will be skipped.
    width: number; // Width of the image.
    height: number; // Height of the image.
    seed: number;
    styles: string[]; // List of styles to apply.
    prompt_ids: string[]; // List of prompt IDs to generate.
}

export interface Config {
    comfy?: ComfyUIConfig;
    prompts?: Array<Partial<PromptConfig> & Pick<PromptConfig, 'id'>>;
    parameters?: Array<Partial<ParameterConfig>>;
}