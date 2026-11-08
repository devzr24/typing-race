import { prisma } from "@/lib/prisma";

export async function GET(request: Request, { params }: RouteContext<"/api/avatars/[userId]">) {
  const { userId } = await params;
  const avatar = await prisma.userAvatar.findUnique({ where: { userId } });
  if (!avatar) return new Response(null, { status: 404 });
  const version = String(avatar.updatedAt.getTime());
  // Une ancienne URL ne doit jamais mettre en cache les octets d'une nouvelle version.
  const versioned = new URL(request.url).searchParams.get("v") === version;
  const headers = {
    "Content-Type": "image/webp",
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": versioned ? "public, max-age=31536000, immutable" : "no-cache",
    "ETag": `"${version}"`,
  };
  const matches = request.headers.get("If-None-Match")?.split(",").some((tag) => {
    const value = tag.trim().replace(/^W\//, "");
    return value === "*" || value === headers.ETag;
  });
  if (matches) return new Response(null, { status: 304, headers });
  return new Response(new Uint8Array(avatar.bytes), { headers });
}
