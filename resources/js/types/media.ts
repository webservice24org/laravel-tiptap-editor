export interface ImageUploadResult {
    url: string
    path?: string
    temporary?: boolean
}

export interface ImageData {
    src: string
    alt?: string
    caption?: string
    path?: string
}