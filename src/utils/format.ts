export function formatAddress(address: string | null | undefined, visibleChars = 4): string {
  if (!address) return '';
  if (address.length <= visibleChars * 2 + 2) return address;
  return `${address.slice(0, visibleChars + 2)}...${address.slice(-visibleChars)}`;
}

export function formatShortId(id: string | null | undefined, visibleChars = 6): string {
  if (!id) return '';
  if (id.length <= visibleChars * 2) return id;
  return `${id.slice(0, visibleChars)}...${id.slice(-visibleChars)}`;
}

export function getPlayerDisplayName({
  name,
  address,
  id,
  fallback,
}: {
  name?: string | null;
  address?: string | null;
  id?: string | null;
  fallback: string;
}): string {
  return name || formatAddress(address) || (id ? `Player ${formatShortId(id, 4)}` : fallback);
}
