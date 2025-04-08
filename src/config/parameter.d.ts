// Parameters for image generation.
export interface ParameterConfig {
    /** Workflow ID to use. If empty, then the checkpoint will be skipped. */
    workflow: string;

    checkpoint: string;
    prompt: string;

    width: number;
    height: number;

    /** Seed for the random number generator. If not specified, a random seed will be used - fixed across all images in the same batch. */
    seed?: number;
    steps: number;
    cfg: number;
    sampler_name: string;
    scheduler: string;
    denoise: number;

    /** List of styles to apply. */
    styles?: string[];

    /** List of LoRAs to apply. */
    loras?: string[];
}