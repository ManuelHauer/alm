import * as migration_20260414_015111 from './20260414_015111';
import * as migration_20260414_211440 from './20260414_211440';

export const migrations = [
  {
    up: migration_20260414_015111.up,
    down: migration_20260414_015111.down,
    name: '20260414_015111',
  },
  {
    up: migration_20260414_211440.up,
    down: migration_20260414_211440.down,
    name: '20260414_211440'
  },
];
