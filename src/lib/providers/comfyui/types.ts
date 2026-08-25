export type ComfyUiMediaType = 'image' | 'video'

export type ComfyUiWorkflow = Record<string, {
  class_type: string
  inputs: Record<string, unknown>
  _meta?: Record<string, unknown>
}>

export interface ComfyUiOutput {
  filename?: string
  local_path?: string
  type?: string
  subfolder?: string
  node_id?: string
  output_type?: string
  data?: string
  mimetype?: string
  url?: string
}

export interface ComfyUiResult {
  id?: string
  message?: string
  status?: string
  comfyui_response?: Record<string, unknown>
  output?: ComfyUiOutput[]
  timings?: Record<string, unknown>
}

