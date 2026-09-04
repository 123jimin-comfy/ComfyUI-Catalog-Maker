import { PatternMatchedParameterConfig } from "./parameter";

export interface ComfyUIConfig {
    url: string;
    
    auth?: {
        username: string;
        password: string;
    }
}

export interface BackendConfig {
    comfy?: ComfyUIConfig;
    parameters?: Array<Partial<PatternMatchedParameterConfig>>;
}