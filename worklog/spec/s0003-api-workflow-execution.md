+++
id = "s0003"
title = "API Workflow Execution"
tags = ["workflow"]
+++

## Observable Behavior

- UNIMPLEMENTED: Execute one resolved ComfyUI API graph against the server specified by the backend configuration in s0002, using its authentication settings when supplied.
- UNIMPLEMENTED: Submit the graph as a ComfyUI prompt and associate the execution with its prompt ID. Wait for that job's completion or failure; queue acceptance alone is not completion.
- UNIMPLEMENTED: On completion, retrieve only the images reported by the output node selected under s0002, preserving their returned order. Preserve all images in a batch; report an error if the selected node produces no images.
- UNIMPLEMENTED: Report submission rejection, execution failure, and image retrieval failure to the caller, including the prompt ID and node-specific error details when available.

## Constraints

- UNIMPLEMENTED: Do not automatically resubmit a prompt after a failed or uncertain submission. Report connection failures; stopping the CLI does not cancel remote jobs.
- UNIMPLEMENTED: Execute the supplied graph without constructing a built-in pipeline, adding output nodes, or changing its input values. Variation application belongs to s0002 and s0004.
- UNIMPLEMENTED: Associate completion events and outputs with the submitted prompt ID; other clients' jobs and intermediate preview images do not count as this job's result.
- UNIMPLEMENTED: Required node types and model assets must be available on the configured server. Failures are reported without substituting nodes or models.

## Anticipated Changes

- Timeout, retry, reconnection, and cancellation policies remain to be specified.
- Outputs other than images remain outside the image catalog contract.

## Dangers

- A connection failure can leave the client uncertain whether a job was accepted or completed; resubmission may duplicate generation.
- ComfyUI caching can reuse node results; completion does not imply every node ran again.
