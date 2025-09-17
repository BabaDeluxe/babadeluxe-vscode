import { type FlatXoConfig, type XoConfigItem } from 'xo'
import sharedConfig from '@babadeluxe/xo-config'

const baseConfig = sharedConfig as XoConfigItem | XoConfigItem[]

const config: FlatXoConfig = Array.isArray(baseConfig) ? [...baseConfig] : [baseConfig]

export default config
