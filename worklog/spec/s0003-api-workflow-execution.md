+++
id = "s0003"
title = "API Workflow Execution"
tags = ["workflow"]
paths = ["src/comfy/**"]
+++

## Observable Behavior

- Execute one resolved ComfyUI API graph against the server specified by the backend configuration in s0002, using its authentication settings when supplied.
- Submit the graph as a ComfyUI prompt and associate the execution with its prompt ID. Wait for that job's completion or failure; queue acceptance alone is not completion.
- On completion, retrieve only the images reported by the output node selected under s0002, preserving their returned order. Preserve all images in a batch; report an error if the selected node produces no images.
- Report submission rejection, execution failure, and image retrieval failure to the caller, including the prompt ID and node-specific error details when available.

## Constraints

- Do not automatically resubmit a prompt after a failed or uncertain submission. Report connection failures; stopping the CLI does not cancel remote jobs.
- Poll the submitted prompt's history until completion, execution failure, transport failure, or local interruption. No application-level generation deadline or automatic reconnection is imposed.
- Execute the supplied graph without constructing a built-in pipeline, adding output nodes, or changing its input values. Variation application belongs to s0002 and s0004.
- Associate completion events and outputs with the submitted prompt ID; other clients' jobs and intermediate preview images do not count as this job's result.
- Required node types and model assets must be available on the configured server. Failures are reported without substituting nodes or models.

## Anticipated Changes

- Configurable execution deadlines and remote job cancellation may be added.
- Outputs other than images remain outside the image catalog contract.

## Dangers

- A connection failure can leave the client uncertain whether a job was accepted or completed; resubmission may duplicate generation.
- ComfyUI caching can reuse node results; completion does not imply every node ran again.
