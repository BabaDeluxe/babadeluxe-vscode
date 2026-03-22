export type ParsedOAuthCallback =
  | Readonly<{ kind: 'code'; code: string }>
  | Readonly<{
      kind: 'implicit'
      accessToken: string
      refreshToken: string
      expiresAtUnixSeconds: number | undefined
    }>

export type SupabaseSessionPayload = Readonly<{
  accessToken: string
  refreshToken: string
  expiresAtUnixSeconds: number | undefined
}>

export type SupabaseConfiguration = Readonly<{
  supabaseUrl: string
  supabaseAnonKey: string
}>
