export interface WalletProfile {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  is_guest?: boolean | null;
  eth_address?: string | null;
}

export function playerNameFromAddress(evmAddress: string): string {
  return `Player_${evmAddress.substring(2, 8)}`;
}

function profileFromModernRow(row: any, fallbackName: string): WalletProfile {
  return {
    id: row.id,
    display_name: row.display_name ?? fallbackName,
    username: row.display_name ?? fallbackName,
    avatar_url: row.avatar_url ?? null,
    is_guest: row.is_guest ?? false,
  };
}

function profileFromLegacyRow(row: any, fallbackName: string, evmAddress: string): WalletProfile {
  return {
    id: row.id,
    display_name: row.username ?? fallbackName,
    username: row.username ?? fallbackName,
    avatar_url: row.avatar_url ?? null,
    eth_address: row.eth_address ?? evmAddress.toLowerCase(),
  };
}

export async function ensureWalletProfile(
  supabaseAdmin: any,
  authUserId: string,
  evmAddress: string,
): Promise<WalletProfile> {
  const displayName = playerNameFromAddress(evmAddress);
  const now = new Date().toISOString();

  const modernPayload = {
    id: authUserId,
    display_name: displayName,
    is_guest: false,
    updated_at: now,
  };

  const modern = await supabaseAdmin
    .from("profiles")
    .upsert(modernPayload, { onConflict: "id" })
    .select("id, display_name, avatar_url, is_guest")
    .maybeSingle();

  if (!modern.error && modern.data) {
    return profileFromModernRow(modern.data, displayName);
  }

  console.warn(
    "[wallet-profile] Modern Play Hub profile upsert failed; trying legacy profile shape:",
    modern.error?.message ?? modern.error,
  );

  const legacyPayload = {
    id: authUserId,
    username: displayName,
    eth_address: evmAddress.toLowerCase(),
    updated_at: now,
  };

  const legacy = await supabaseAdmin
    .from("profiles")
    .upsert(legacyPayload, { onConflict: "id" })
    .select("id, username, avatar_url, eth_address")
    .maybeSingle();

  if (!legacy.error && legacy.data) {
    return profileFromLegacyRow(legacy.data, displayName, evmAddress);
  }

  throw legacy.error ?? modern.error ?? new Error("Profile upsert failed");
}
