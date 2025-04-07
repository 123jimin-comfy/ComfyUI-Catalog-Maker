# ComfyUI-Checkpoint-Catalog

This is a tool for creating and updating sample images for T2I (text-to-image) models.

## How to Use

Here's an example config file:

```toml
[comfy]
# Hostname and port of the server running ComfyUI.
host = "comfy-ui.example.com:8188"

[comfy.auth]
# Username and password for the ComfyUI server, using HTTP basic authentication.
username = "alex"
password = "hunter2"

[[parameters]]
pattern = "*"
width = 896
height = 1152

[[parameters]]
pattern = "sdxl/*"
styles = ["sdxl"]
```