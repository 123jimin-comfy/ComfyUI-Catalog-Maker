import { PatternMatchedParameterConfig } from "./parameter";

export interface ComfyUIConfig {
    ssl?: boolean;
    host: string;

    auth?: {
        username: string;
        password: string;
    }
}

export interface BackendConfig {
    comfy?: ComfyUIConfig;
    parameters?: Array<Partial<PatternMatchedParameterConfig>>;
}