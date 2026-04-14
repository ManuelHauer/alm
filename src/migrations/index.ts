import * as migration_20260414_015111 from './20260414_015111';

export const migrations = [
  {
    up: migration_20260414_015111.up,
    down: migration_20260414_015111.down,
    name: '20260414_015111'
  },
];
