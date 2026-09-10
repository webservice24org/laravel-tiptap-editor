export type NewsBlockStyle =
    | 'card'
    | 'compact'
    | 'featured'

export interface NewsBlockData {
    id?: string | number
    title: string
    url: string
    thumbnail?: string
    category?: string
    excerpt?: string
    style?: NewsBlockStyle
}

export interface NewsSearchResult
    extends NewsBlockData {}

export type NewsSearchHandler = (
    query: string
) => Promise<NewsSearchResult[]>
