import { createFileRoute } from "@tanstack/react-router";
import { loadPublicLink } from "@/lib/public-link.server";

export const Route = createFileRoute("/api/public/pay/$code")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const view = await loadPublicLink(params.code);
        if (!view) return new Response("Not found", { status: 404 });
        return Response.json(view, {
          headers: {
            "Cache-Control": "no-store",
            "X-Robots-Tag": "noindex, nofollow",
          },
        });
      },
    },
  },
});
