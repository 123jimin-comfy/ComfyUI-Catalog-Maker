import { ParameterConfig } from "./parameter.d.ts";

export interface ComfyUIConfig {
    host: string;

    auth?: {
        username: string;
        password: string;
    }
}

export interface BackendConfig {
    comfy?: ComfyUIConfig;
    parameters?: Array<Partial<ParameterConfig & {pattern: string}>>;
}