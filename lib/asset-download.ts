// Only resolve redirects from the authenticated, allowlisted backend asset route.
// Never forward dashboard cookies or authorization to object storage.
export async function resolveAssetDownload(upstream: Response, signal: AbortSignal): Promise<Response> {
  if (![302, 303, 307, 308].includes(upstream.status)) return upstream;
  const location = upstream.headers.get("location");
  let url: URL;
  try {
    url = new URL(location || "");
    if (url.protocol !== "https:" || url.username || url.password) throw new Error("Invalid storage URL");
  } catch {
    return Response.json({ error: "The output storage URL is invalid." }, { status: 502 });
  }
  await upstream.body?.cancel();
  const file = await fetch(url, { cache: "no-store", redirect: "error", credentials: "omit", signal });
  if (!file.ok) {
    await file.body?.cancel();
    return Response.json({ error: file.status === 404 ? "The output file is no longer available in storage." : "Unable to retrieve the output from storage. Please try again." }, { status: 502 });
  }
  const headers = new Headers({
    "content-type": file.headers.get("content-type") || "application/octet-stream",
    "content-disposition": "attachment",
    "cache-control": "private, no-store",
    "x-content-type-options": "nosniff",
  });
  return new Response(file.body, { headers });
}
