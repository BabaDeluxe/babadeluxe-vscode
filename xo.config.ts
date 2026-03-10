import { type FlatXoConfig, type XoConfigItem } from 'xo'
import sharedConfig from '@babadeluxe/xo-config'

const baseConfig = sharedConfig as XoConfigItem | XoConfigItem[]

const config: FlatXoConfig = Array.isArray(baseConfig)
  ? [
      ...baseConfig,
      {
        rules: {
          'unicorn/no-abusive-eslint-disable': 'off',
        },
      },
    ]
  : [
      baseConfig,
      {
        rules: {
          'unicorn/no-abusive-eslint-disable': 'off',
        },
      },
    ]

export default config
