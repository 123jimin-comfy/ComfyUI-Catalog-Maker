export interface WorkflowInfo {
    checkpoint_node_id: string;
    sampler_node_id: string;
}

export type WorkflowFunction = (params: ImageGenerationParams) => [ComfyUIWorkflow, WorkflowInfo];

export interface LoraParams {
    name: string;
    model_strength?: number;
    clip_strength?: number;
}

export interface SamplerParams {
    seed?: number;
    steps: number;
    cfg: number;
    sampler_name: string;
    scheduler: string;
    denoise: number;
}

export interface PromptParams {
    style: string[];
    positive: string; negative: string;
    loras: Array<LoraParams>;
}

export interface ImageGenerationParams {
    checkpoint: string;
    workflow_id: string;

    width: number; height: number; batch_size?: number;
    prompt: PromptParams;
    sampler: SamplerParams;
}

export function parsePrompt(prompt: string): PromptParams {
    return {
        style: [],
        positive: prompt,
        negative: "",
        loras: [],
    };
}