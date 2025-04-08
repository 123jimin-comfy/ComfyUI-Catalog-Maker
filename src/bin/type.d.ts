export interface ProgramArgs {
    backend_config: string;
    reset: boolean;
    force: boolean;

    catalog_config: string;
    output_dir: string;
    gen_info: boolean;
}