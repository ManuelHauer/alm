import type { GlobalConfig } from 'payload'

/**
 * SiteSettings — global config managed via the admin panel. Per handoff §5.5.
 */
export const SiteSettings: GlobalConfig = {
  slug: 'site-settings',
  access: {
    read: () => true,
  },
  fields: [
    {
      name: 'shuffleMode',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        description:
          'When ON, landing page shows a random entry. When OFF, shows the latest.',
      },
    },
    {
      name: 'introAnimation',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        description: 'Show the "NO COOKIES EVER" intro animation on first visit.',
      },
    },
    {
      name: 'instagramUrl',
      type: 'text',
      defaultValue: 'https://instagram.com/almproject',
    },
    {
      name: 'shopUrl',
      type: 'text',
      defaultValue: '',
    },
  ],
}
