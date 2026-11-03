// Dock configuration. `ids` are tried in order; the first installed one wins.
// At startup ProleWebOS also matches installed apps by title, so missing IDs
// are repaired automatically as long as the app title matches `name`.
window.PROLE_CONFIG = {
  rotateSeconds: 30,
  apps: [
    {
      key: 'netflix',
      name: 'Netflix',
      ids: ['netflix', 'com.netflix.ninja']
    },
    {
      key: 'youtube',
      name: 'YouTube',
      ids: ['youtube.leanback.v4', 'com.google.youtube.tv', 'com.google.youtube']
    },
    {
      key: 'prime',
      name: 'Prime Video',
      ids: ['amazon', 'com.amazon.amazonvideo.livingroom', 'com.amazon.amazonvideo.tv', 'com.amazon.avod']
    },
    {
      key: 'disney',
      name: 'Disney+',
      ids: ['com.disney.disneyplus-prod', 'com.disney.disneyplus', 'com.disney.disneyplus.tv', 'com.disney.disneyplus.lg']
    },
    {
      key: 'stremio',
      name: 'Stremio',
      ids: ['io.strem.tv', 'com.stremio.stremio', 'com.stremio.app', 'com.stremio.webos', 'com.stremio']
    },
    {
      key: 'appletv',
      name: 'Apple TV',
      ids: ['com.apple.appletv', 'com.apple.appletv.tv', 'com.apple.tv']
    },
    {
      key: 'hbomax',
      name: 'HBO Max',
      ids: ['com.wbd.stream', 'com.hbomax.hbomax', 'com.wbd.hbomax', 'com.hbo.hbomax', 'com.hbomax.max']
    },
    {
      key: 'retroarch',
      name: 'RetroArch',
      ids: ['com.retroarch.webos']
    }
  ]
};
