export const expectedNodeEngine = '>=22.13 <23 || >=24 <25';
export const expectedNvmVersion = '22.22.2';

export const parseNodeVersion = (version) => {
  const match = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(version.trim());
  if (!match) return null;

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
};

export const isSupportedNodeVersion = (version) => {
  const parsed = parseNodeVersion(version);
  if (!parsed) return false;

  if (parsed.major === 22) {
    return parsed.minor > 13 || (parsed.minor === 13 && parsed.patch >= 0);
  }

  return parsed.major === 24;
};
