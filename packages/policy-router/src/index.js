const {
  loadRouterConfig,
  validateRouterConfig,
  hasProviderUpstream,
  requiresProviderUpstream
} = require('./config');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function listTrackProviders(tracks, track) {
  return Array.isArray(tracks?.[track]) ? tracks[track] : [];
}

function deriveFallbackTrack(track, capabilityRule, defaults, options) {
  if (options.fallbackTrack !== undefined) return options.fallbackTrack;
  if (capabilityRule.fallbackTrack !== undefined) return capabilityRule.fallbackTrack;

  const fallbackTrackByTrack = defaults.fallbackTrackByTrack || {};
  if (fallbackTrackByTrack[track]) return fallbackTrackByTrack[track];

  if (track === 'free' && capabilityRule.allowPaidEscalation) return 'paid';
  if (track === 'paid' && capabilityRule.allowFreeDegrade) return 'free';
  return null;
}

async function callCandidates(candidates, context, invoke) {
  let attempts = 0;
  let lastError = null;

  for (const candidate of candidates) {
    attempts += 1;
    try {
      const output = await invoke({ ...context, candidate });
      return {
        ok: true,
        attempts,
        output,
        route: {
          capability: context.capability,
          track: context.track,
          provider: candidate.name,
          model: candidate.model
        }
      };
    } catch (error) {
      lastError = error;
    }
  }

  return {
    ok: false,
    attempts,
    error: lastError ? lastError.message : 'no provider available'
  };
}

class PolicyRouter {
  constructor(options = {}) {
    this.defaults = clone(options.defaults || {});
    this.capabilities = clone(options.capabilities || {});
    this.tracks = clone(options.tracks || {});
    this.invoke = options.invoke || null;
  }

  resolve(capability, options = {}) {
    const capabilityRule = this.capabilities[capability] || {};
    const track = options.forceTrack || capabilityRule.track || this.defaults.track || 'free';
    const allCandidates = listTrackProviders(this.tracks, track);
    const candidates = options.forceProvider
      ? allCandidates.filter((provider) => provider.name === options.forceProvider)
      : allCandidates;

    return {
      capability,
      track,
      fallbackTrack: deriveFallbackTrack(track, capabilityRule, this.defaults, options),
      candidates
    };
  }

  async execute(capability, request, options = {}) {
    const invoke = options.invoke || this.invoke;
    if (typeof invoke !== 'function') {
      throw new Error('PolicyRouter requires an invoke function');
    }

    const route = this.resolve(capability, options);
    const primary = await callCandidates(route.candidates, {
      capability,
      request,
      options,
      track: route.track
    }, invoke);

    if (primary.ok) {
      return {
        ok: true,
        output: primary.output,
        route: primary.route,
        fallbackCount: Math.max(0, primary.attempts - 1)
      };
    }

    if (!route.fallbackTrack) {
      return {
        ok: false,
        error: primary.error,
        fallbackCount: Math.max(0, primary.attempts - 1)
      };
    }

    const fallbackCandidates = listTrackProviders(this.tracks, route.fallbackTrack);
    const narrowedFallback = options.forceProvider
      ? fallbackCandidates.filter((provider) => provider.name === options.forceProvider)
      : fallbackCandidates;

    const fallback = await callCandidates(narrowedFallback, {
      capability,
      request,
      options,
      track: route.fallbackTrack
    }, invoke);

    if (fallback.ok) {
      return {
        ok: true,
        output: fallback.output,
        route: {
          ...fallback.route,
          degradedFrom: route.track
        },
        fallbackCount: primary.attempts + Math.max(0, fallback.attempts - 1)
      };
    }

    return {
      ok: false,
      error: `${primary.error}; fallback failed: ${fallback.error}`,
      fallbackCount: primary.attempts + fallback.attempts
    };
  }
}

function createPolicyRouter(options = {}) {
  return new PolicyRouter(options);
}

function createPolicyRouterFromConfig(options = {}) {
  const loaded = loadRouterConfig(options);
  return createPolicyRouter({
    defaults: loaded.defaults,
    capabilities: loaded.capabilities,
    tracks: loaded.tracks,
    invoke: options.invoke
  });
}

module.exports = {
  PolicyRouter,
  createPolicyRouter,
  createPolicyRouterFromConfig,
  loadRouterConfig,
  validateRouterConfig,
  hasProviderUpstream,
  requiresProviderUpstream
};
